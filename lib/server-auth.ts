import { createClient } from "@supabase/supabase-js";
export function database(token?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://jbnunnejqvvrwxewljdc.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "sb_publishable_WwF5eEz4xTwImwW6qKdeWg_Pq2atwU8",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined,
    },
  );
}
export async function authenticate(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("UNAUTHORIZED");
  const db = database(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  const { data: active } = await db.rpc("account_active");
  if (!active) throw new Error("FORBIDDEN");
  return { db, user: data.user };
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const status =
    message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
