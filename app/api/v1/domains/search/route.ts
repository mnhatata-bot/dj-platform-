import { z } from "zod";
import { authenticate, apiError } from "@/lib/server-auth";
import { godaddy } from "@/modules/domains/infrastructure/godaddy";

const Domain = z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/);

export async function GET(request: Request) {
  try {
    await authenticate(request);
    const parsed = Domain.safeParse(new URL(request.url).searchParams.get("domain") || "");
    if (!parsed.success) return Response.json({ error: "Enter a valid domain name." }, { status: 400 });
    const result = await godaddy.availability(parsed.data);
    return Response.json({ ...result, purchaseEnabled: false, beta: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
