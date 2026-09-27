import { timingSafeEqual } from "node:crypto";
import { adminDatabase } from "@/lib/server-admin";
import { vercelDomains } from "@/modules/domains/infrastructure/vercel-domains";

export const runtime = "nodejs";
type Job = { id: string; kind: "DOMAIN_PROVISION" | "DOMAIN_VERIFY"; payload: { custom_domain_id?: string } };

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function instructions(items: { type: string; domain: string; value: string; reason?: string }[] = []) {
  return items.map((item) => ({ type: item.type, name: item.domain, value: item.value, reason: item.reason || null }));
}

async function processQueue(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!vercelDomains.configured()) return Response.json({ processed: 0, configured: false });
  const db = adminDatabase();
  const { data, error } = await db.rpc("claim_platform_jobs", { p_kinds: ["DOMAIN_PROVISION", "DOMAIN_VERIFY"], p_limit: 10 });
  if (error) return Response.json({ error: "Domain queue unavailable" }, { status: 500 });
  let completed = 0;
  for (const job of (data || []) as Job[]) {
    try {
      const id = job.payload.custom_domain_id;
      if (!id) throw new Error("Domain job is missing its domain id");
      const { data: domain, error: domainError } = await db.from("custom_domains").select("id,domain").eq("id", id).single();
      if (domainError || !domain) throw new Error("Domain request not found");
      const result = job.kind === "DOMAIN_PROVISION" ? await vercelDomains.add(domain.domain) : await vercelDomains.verify(domain.domain);
      const records = instructions(result.verification);
      await db.from("domain_dns_records").delete().eq("custom_domain_id", id);
      if (records.length) await db.from("domain_dns_records").insert(records.map((record) => ({ custom_domain_id: id, type: record.type, name: record.name, value: record.value, status: "PENDING" })));
      const verified = Boolean(result.verified);
      const { error: updateError } = await db.from("custom_domains").update({
        status: verified ? "ACTIVE" : "DNS_REQUIRED",
        dns_instructions: records,
        vercel_verified: verified,
        certificate_status: verified ? "ISSUING" : "PENDING",
        verified_at: verified ? new Date().toISOString() : null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (updateError) throw updateError;
      await db.rpc("finish_platform_job", { p_id: job.id, p_success: true, p_result: { verified, records: records.length }, p_error: null });
      completed += 1;
    } catch (jobError) {
      await db.rpc("finish_platform_job", { p_id: job.id, p_success: false, p_result: {}, p_error: jobError instanceof Error ? jobError.message : "Domain job failed" });
    }
  }
  return Response.json({ processed: (data || []).length, completed, configured: true });
}
export const GET = processQueue;
export const POST = processQueue;
