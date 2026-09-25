"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { ModuleHeading, Status } from "@/modules/ui/guided";
import {Visual} from "@/modules/providers/ui/visual";
type Ticket = {
  id: string;
  credential_token: string;
  status: string;
  event_id: string;
  events: { title: string; starts_at: string; banner_url: string|null; venue: string; city: string; timezone: string; slug: string } | null;
};
export default function Wallet() {
  const { t, locale } = useLocale();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error(t("signin"));
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,credential_token,status,event_id,events(title,starts_at,banner_url,venue,city,timezone,slug),ticket_orders!inner(user_id)",
        )
        .eq("ticket_orders.user_id", user.user?.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as Ticket[];
      setTickets(rows);
      const QR = await import("qrcode");
      const generated: Record<string, string> = {};
      for (const ticket of rows)
        generated[ticket.id] = await QR.toDataURL(
          `cuelance:ticket:${ticket.credential_token}`,
          { width: 300, margin: 3, errorCorrectionLevel: "M" },
        );
      setCodes(generated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <ModuleHeading title={t("wallet.title")} help={t("wallet.help")} />
      <button className="button" onClick={load} disabled={loading}>
        {t("refresh")}
      </button>
      <Status text={error} error />
      {loading ? (
        <p>{t("loading")}</p>
      ) : tickets.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="ticket-grid">
          {tickets.map((ticket) => {
            const active = ["ACTIVE", "ISSUED"].includes(ticket.status);
            return <article className={`ticket-pass ${active ? "" : "ticket-inactive"}`} key={ticket.id}>
              <div className="ticket-art"><Visual src={ticket.events?.banner_url} alt={ticket.events?.title || t("wallet.title")}/><div className="ticket-brand">CUELANCE <span>{t("ticket.pass")}</span></div></div>
              <div className="ticket-body"><span className="ticket-status">{ticket.status === "CHECKED_IN" ? t("ticket.used") : ticket.status}</span><h2>{ticket.events?.title}</h2>
              <dl className="ticket-facts"><div><dt>{t("event.date")}</dt><dd>{ticket.events?.starts_at && new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:ticket.events.timezone||"Asia/Riyadh"}).format(new Date(ticket.events.starts_at))}</dd></div><div><dt>{t("event.venue")}</dt><dd>{ticket.events?.venue} · {ticket.events?.city}</dd></div></dl>
              {ticket.events?.slug && <a href={`/events/${ticket.events.slug}`}>{t("event.public")} ↗</a>}</div>
              <div className="ticket-stub">{active && codes[ticket.id] ? <><img className="ticket-qr" src={codes[ticket.id]} alt={t("wallet.title")}/><p>{t("ticket.show")}</p></> : <p>{t("ticket.inactive")}</p>}
              <small dir="ltr">{ticket.id.slice(0,8).toUpperCase()}</small>
              {active && <details><summary>{t("wallet.token")}</summary><code className="break-text" dir="ltr">{ticket.credential_token}</code></details>}
              <button className="button ticket-print" onClick={()=>window.print()}>{t("ticket.print")}</button></div>
            </article>;
          })}
        </div>
      )}
    </>
  );
}
