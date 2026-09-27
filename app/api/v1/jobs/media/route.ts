import { timingSafeEqual } from "node:crypto";
import { adminDatabase } from "@/lib/server-admin";

export const runtime = "nodejs";
export const maxDuration = 60;
type Job = { id: string; kind: "IMAGE_THUMBNAIL" | "VIDEO_TRANSCODE"; payload: { media_asset_id?: string; storage_key?: string; mime_type?: string } };
type Result = { storageKey: string; mimeType: string; width?: number; height?: number; durationSeconds?: number; metadata?: Record<string, unknown> };

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function processQueue(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const processor = process.env.MEDIA_PROCESSOR_URL;
  const secret = process.env.MEDIA_PROCESSOR_SECRET;
  if (!processor || !secret) return Response.json({ processed: 0, configured: false });
  const db = adminDatabase();
  const { data, error } = await db.rpc("claim_platform_jobs", { p_kinds: ["IMAGE_THUMBNAIL", "VIDEO_TRANSCODE"], p_limit: 5 });
  if (error) return Response.json({ error: "Media queue unavailable" }, { status: 500 });
  let completed = 0;
  for (const job of (data || []) as Job[]) {
    try {
      if (!job.payload.media_asset_id || !job.payload.storage_key) throw new Error("Media job payload is incomplete");
      const response = await fetch(processor, { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id, kind: job.kind, ...job.payload }) });
      if (!response.ok) throw new Error(`Media processor failed (${response.status})`);
      const result = (await response.json()) as Result;
      if (!result.storageKey || !result.mimeType) throw new Error("Media processor returned an incomplete result");
      const derivative = job.kind === "IMAGE_THUMBNAIL" ? "THUMBNAIL" : "TRANSCODE";
      const { error: saveError } = await db.from("media_derivatives").upsert({ media_asset_id: job.payload.media_asset_id, kind: derivative, storage_key: result.storageKey, mime_type: result.mimeType, width: result.width ?? null, height: result.height ?? null, duration_seconds: result.durationSeconds ?? null, status: "READY", metadata: result.metadata || {} }, { onConflict: "media_asset_id,kind" });
      if (saveError) throw saveError;
      await db.rpc("finish_platform_job", { p_id: job.id, p_success: true, p_result: result, p_error: null });
      completed += 1;
    } catch (jobError) {
      await db.rpc("finish_platform_job", { p_id: job.id, p_success: false, p_result: {}, p_error: jobError instanceof Error ? jobError.message : "Media job failed" });
    }
  }
  return Response.json({ processed: (data || []).length, completed, configured: true });
}
export const GET = processQueue;
export const POST = processQueue;
