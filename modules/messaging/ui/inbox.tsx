"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { GuidedField, ModuleHeading, Status } from "@/modules/ui/guided";
type Conversation = { id: string; title: string };
type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
type Context = { kind: string; id: string; title: string };
export default function Inbox() {
  const { t } = useLocale();
  const [contexts, setContexts] = useState<Context[]>([]);
  const [context, setContext] = useState("");
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [thread, setThread] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const clientId = useRef<string | null>(null);
  const current = useRef(thread);
  current.current = thread;
  async function list() {
    const [a, b, c] = await Promise.all([
      supabase.rpc("message_contexts"),
      supabase
        .from("conversations")
        .select("id,title")
        .order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    if (a.error || b.error) setError((a.error || b.error)!.message);
    else {
      setContexts(a.data || []);
      setThreads(b.data || []);
      setUserId(c.data.user?.id || "");
    }
    setLoading(false);
  }
  useEffect(() => {
    void list();
  }, []);
  useEffect(() => {
    setMessages([]);
    setBody(sessionStorage.getItem("cuelance.message." + thread) || "");
    if (!thread) return;
    let cancelled = false;
    const read = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,sender_id,body,created_at")
        .eq("conversation_id", thread)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        if (error) setError(error.message);
        else setMessages((data || []).reverse());
      }
    };
    void read();
    const timer = setInterval(read, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [thread]);
  async function open() {
    const c = contexts.find((c) => `${c.kind}:${c.id}` === context);
    if (!c) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("open_conversation", {
      p_kind: c.kind,
      p_resource: c.id,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      await list();
      setThread(data);
    }
  }
  async function send() {
    if (!body.trim() || !thread) return;
    setBusy(true);
    setError("");
    const target = thread;
    clientId.current ||= crypto.randomUUID();
    const { error } = await supabase.rpc("send_message", {
      p_conversation: target,
      p_body: body,
      p_client: clientId.current,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    clientId.current = null;
    sessionStorage.removeItem("cuelance.message." + target);
    if (current.current === target) {
      setBody("");
      const { data } = await supabase
        .from("messages")
        .select("id,sender_id,body,created_at")
        .eq("conversation_id", target)
        .order("created_at", { ascending: false })
        .limit(100);
      setMessages((data || []).reverse());
    }
  }
  return (
    <>
      <ModuleHeading title={t("messages.title")} help={t("messages.help")} />
      <Status text={error} error />
      {loading ? (
        <p>{t("loading")}</p>
      ) : (
        <div className="messaging-grid">
          <aside className="card">
            <GuidedField label={t("messages.context")}>
              <select
                aria-label={t("messages.context")}
                value={context}
                onChange={(e) => setContext(e.target.value)}
              >
                <option value="">—</option>
                {contexts.map((c) => (
                  <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                    {c.title}
                  </option>
                ))}
              </select>
            </GuidedField>
            {!contexts.length && <p>{t("messages.none")}</p>}
            <button
              className="button"
              disabled={!context || busy}
              onClick={open}
            >
              {t("messages.start")}
            </button>
            {threads.map((c) => (
              <button
                className={`nav-button ${thread === c.id ? "active" : ""}`}
                key={c.id}
                disabled={busy}
                onClick={() => setThread(c.id)}
              >
                {c.title}
              </button>
            ))}
          </aside>
          <section className="card">
            {thread ? (
              <>
                <div className="message-list" role="log" aria-live="polite">
                  {messages.map((m) => (
                    <article
                      key={m.id}
                      className={`message ${m.sender_id === userId ? "own" : ""}`}
                    >
                      <b>
                        {m.sender_id === userId
                          ? t("messages.you")
                          : t("messages.other")}
                      </b>
                      <p dir="auto">{m.body}</p>
                      <small>{new Date(m.created_at).toLocaleString()}</small>
                    </article>
                  ))}
                  {!messages.length && <p>{t("empty")}</p>}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <GuidedField
                    label={t("messages.write")}
                    help={t("messages.example")}
                  >
                    <textarea
                      aria-label={t("messages.write")}
                      required
                      maxLength={4000}
                      dir="auto"
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        clientId.current = null;
                        sessionStorage.setItem(
                          "cuelance.message." + thread,
                          e.target.value,
                        );
                      }}
                      placeholder={t("messages.example")}
                    />
                  </GuidedField>
                  <button
                    className="button primary"
                    disabled={busy || !body.trim()}
                  >
                    {busy ? t("working") : t("messages.send")}
                  </button>
                </form>
              </>
            ) : (
              <p>{t("messages.context")}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
