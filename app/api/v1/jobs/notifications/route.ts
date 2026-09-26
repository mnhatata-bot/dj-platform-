import { timingSafeEqual } from "node:crypto";
import { adminDatabase } from "@/lib/server-admin";
import { notificationEmail } from "@/modules/notifications/infrastructure/email";

export const runtime = "nodejs";
type Outbox = { id: string; recipient_email: string; subject: string; body_text: string };

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function processQueue(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!notificationEmail.configured()) return Response.json({ processed: 0, configured: false });
  const db = adminDatabase();
  const { data, error } = await db.rpc("claim_notification_batch", { p_limit: 25 });
  if (error) return Response.json({ error: "Queue unavailable" }, { status: 500 });
  let sent = 0;
  for (const item of (data || []) as Outbox[]) {
    try {
      await notificationEmail.send({ to: item.recipient_email, subject: item.subject, text: item.body_text });
      await db.rpc("finish_notification_delivery", { p_id: item.id, p_success: true, p_error: null });
      sent += 1;
    } catch (deliveryError) {
      await db.rpc("finish_notification_delivery", { p_id: item.id, p_success: false, p_error: deliveryError instanceof Error ? deliveryError.message : "Delivery failed" });
    }
  }
  return Response.json({ processed: (data || []).length, sent, configured: true });
}
export const GET = processQueue;
export const POST = processQueue;
