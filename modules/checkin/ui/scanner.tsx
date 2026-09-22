"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { GuidedField, ModuleHeading, Status } from "@/modules/ui/guided";
import { parseCredential } from "../application/credential";
export default function CameraScanner() {
  const { t } = useLocale();
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [eventId, setEventId] = useState("");
  const [token, setToken] = useState("");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState("");
  const [previous, setPrevious] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const selected = useRef(eventId);
  selected.current = eventId;
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data: members, error } = await supabase
        .from("organization_members")
        .select("organization_id,role")
        .eq("user_id", user.user.id)
        .in("role", ["OWNER", "ADMIN", "MANAGER", "SCANNER"]);
      if (error) {
        setNotice(error.message);
        return;
      }
      const ids = (members || []).map((m) => m.organization_id);
      if (!ids.length) return;
      const { data, error: e } = await supabase
        .from("events")
        .select("id,title")
        .in("organization_id", ids);
      if (active) {
        if (e) setNotice(e.message);
        else {
          setEvents(data || []);
          setEventId(data?.[0]?.id || "");
        }
      }
    })();
    return () => {
      active = false;
      generation.current++;
      controls.current?.stop();
    };
  }, []);
  function stop() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    setRunning(false);
  }
  async function validate(raw: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setResult("");
    setNotice("");
    setPrevious("");
    try {
      if (!navigator.onLine) throw new Error(t("scanner.offline"));
      if (!selected.current) throw new Error(t("scanner.event"));
      let credential: string;
      try {
        credential = parseCredential(raw);
      } catch {
        throw new Error(t("scanner.invalid"));
      }
      let device = localStorage.getItem("cuelance.scanner.device");
      if (!device) {
        device = crypto.randomUUID();
        localStorage.setItem("cuelance.scanner.device", device);
      }
      const { data, error } = await supabase.rpc("validate_ticket_checkin", {
        p_token: credential,
        p_event: selected.current,
        p_device: device,
      });
      if (error) throw error;
      const status =
        typeof data === "string" ? data : data?.result || "INVALID";
      setResult(status);
      setToken("");
      if (status === "ALREADY_CHECKED_IN") {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id")
          .eq("credential_token", credential)
          .maybeSingle();
        if (ticket) {
          const { data: entry } = await supabase
            .from("checkins")
            .select("checked_in_at")
            .eq("ticket_id", ticket.id)
            .eq("result", "VALID")
            .order("checked_in_at")
            .limit(1)
            .maybeSingle();
          if (entry)
            setPrevious(new Date(entry.checked_in_at).toLocaleString());
        }
      }
      navigator.vibrate?.(status === "VALID" ? 100 : [100, 80, 100]);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : String((error as { message?: string })?.message || t("error")),
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function start() {
    setNotice("");
    setResult("");
    const current = ++generation.current;
    try {
      if (!navigator.onLine) throw new Error(t("scanner.offline"));
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(t("scanner.cameraError"));
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      setRunning(true);
      const stream = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        video.current!,
        (decoded, _error, scannerControls) => {
          if (decoded && current === generation.current && !locked.current) {
            scannerControls.stop();
            setRunning(false);
            generation.current++;
            void validate(decoded.getText());
          }
        },
      );
      if (current !== generation.current) stream.stop();
      else controls.current = stream;
    } catch {
      if (current === generation.current) {
        setRunning(false);
        setNotice(t("scanner.cameraError"));
      }
    }
  }
  const resultLabels: Record<string, string> = {
    VALID: t("result.VALID"),
    ALREADY_CHECKED_IN: t("result.ALREADY_CHECKED_IN"),
    INVALID: t("result.INVALID"),
    WRONG_EVENT: t("result.WRONG_EVENT"),
    REVOKED: t("result.REVOKED"),
    CANCELLED: t("result.CANCELLED"),
  };
  return (
    <>
      <ModuleHeading title={t("scanner.title")} help={t("scanner.help")} />
      <section className="card module-form">
        <GuidedField label={t("scanner.event")}>
          <select
            aria-label={t("scanner.event")}
            value={eventId}
            disabled={busy || running}
            onChange={(e) => {
              setEventId(e.target.value);
              setResult("");
            }}
          >
            <option value="">—</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </GuidedField>
        <video
          ref={video}
          className={`camera-video ${running ? "" : "camera-idle"}`}
          muted
          playsInline
          aria-label={t("scanner.title")}
        />
        <div className="actions">
          <button
            className="button primary"
            disabled={!eventId || busy || running}
            onClick={start}
          >
            {t("scanner.start")}
          </button>
          <button className="button" disabled={!running} onClick={stop}>
            {t("scanner.stop")}
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            stop();
            void validate(token);
          }}
        >
          <GuidedField
            label={t("scanner.manual")}
            help={t("scanner.manualHelp")}
          >
            <input
              aria-label={t("scanner.manual")}
              required
              value={token}
              dir="ltr"
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </GuidedField>
          <button className="button" disabled={busy || !eventId}>
            {busy ? t("working") : t("scanner.validate")}
          </button>
        </form>
        <Status text={notice} error />
        {result && (
          <div
            role="status"
            className={`scan-result ${result === "VALID" ? "valid" : result === "ALREADY_CHECKED_IN" ? "used" : "invalid"}`}
          >
            <h2>{resultLabels[result] || result}</h2>
            {previous && <p>{previous}</p>}
          </div>
        )}
      </section>
    </>
  );
}
