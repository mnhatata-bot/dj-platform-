"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { ModuleHeading, Status } from "@/modules/ui/guided";
type Ticket = {
  id: string;
  credential_token: string;
  status: string;
  event_id: string;
  events: { title: string; starts_at: string } | null;
};
export default function Wallet() {
  const { t } = useLocale();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id,credential_token,status,event_id,events(title,starts_at),ticket_orders!inner(user_id)",
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
        <div className="guide-grid">
          {tickets.map((ticket) => (
            <article className="card" key={ticket.id}>
              <h2>{ticket.events?.title}</h2>
              <p>
                {ticket.events?.starts_at &&
                  new Date(ticket.events.starts_at).toLocaleString()}
              </p>
              <strong>{ticket.status}</strong>
              {codes[ticket.id] && (
                <img
                  className="ticket-qr"
                  src={codes[ticket.id]}
                  alt={t("wallet.title")}
                />
              )}
              <details>
                <summary>{t("wallet.token")}</summary>
                <code className="break-text" dir="ltr">
                  {ticket.credential_token}
                </code>
              </details>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
