import { database } from "@/lib/server-auth";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = database();
  const { data } = await db
    .from("media_assets")
    .select("storage_key")
    .eq("id", id)
    .eq("visibility", "PUBLIC")
    .maybeSingle();
  if (!data?.storage_key) return new Response("Not found", { status: 404 });
  const { data: link, error } = await db.storage
    .from("media")
    .createSignedUrl(data.storage_key, 60);
  if (error || !link) return new Response("Unavailable", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: link.signedUrl,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
