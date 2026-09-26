"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { ModuleHeading, Status } from "@/modules/ui/guided";
import {Visual} from "@/modules/providers/ui/visual";
import {api} from "@/lib/api-client";
type Ticket = {
  id: string;
  credential_token: string;
  status: string;
  event_id: string;
  events: { title: string; starts_at: string; banner_url: string|null; venue: string; city: string; timezone: string; slug: string } | null;
  ticket_orders: { amount:number; currency:string; status:string } | null;
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
          "id,credential_token,status,event_id,events(title,starts_at,banner_url,venue,city,timezone,slug),ticket_orders(amount,currency,status)",
        )
        .eq("holder_user_id", user.user?.id)
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
    const transfer=new URLSearchParams(window.location.search).get("transfer");
    if(transfer){supabase.rpc("accept_ticket_transfer",{p_token:transfer}).then(({error})=>{if(error)setError(error.message);else window.history.replaceState({},"","/workspace?tab=wallet");void load()});return}
    void load();
  }, []);
  async function refund(ticket:Ticket){const reason=window.prompt("Why are you requesting this refund?");if(!reason)return;setLoading(true);try{await api("/api/v1/payments/tickets/refund",{ticketId:ticket.id,reason});await load()}catch(e){setError((e as Error).message);setLoading(false)}}
  async function transfer(ticket:Ticket){const email=window.prompt("Recipient's verified Cuelance email");if(!email)return;const {data,error}=await supabase.rpc("request_ticket_transfer",{p_ticket:ticket.id,p_recipient_email:email});if(error)return setError(error.message);const link=`${window.location.origin}/workspace?tab=wallet&transfer=${data}`;await navigator.clipboard.writeText(link);setError("");window.alert("Secure transfer link copied. It expires in 48 hours and only the named email can accept it.")}
  async function cancel(ticket:Ticket){if(!window.confirm("Cancel this complimentary ticket and release its place?"))return;const {error}=await supabase.rpc("cancel_complimentary_ticket",{p_ticket:ticket.id});if(error)setError(error.message);else await load()}
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
              {active&&<div className="row-actions"><button className="button small" onClick={()=>transfer(ticket)}>Transfer</button>{Number(ticket.ticket_orders?.amount||0)>0?<button className="button small" onClick={()=>refund(ticket)}>Request refund</button>:<button className="button small" onClick={()=>cancel(ticket)}>Cancel ticket</button>}</div>}
              <button className="button ticket-print" onClick={()=>window.print()}>{t("ticket.print")}</button></div>
            </article>;
          })}
        </div>
      )}
    </>
  );
}
