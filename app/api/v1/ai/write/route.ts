import { z } from "zod";
import { authenticate, apiError } from "@/lib/server-auth";
import { writingProvider } from "@/modules/ai/infrastructure/gateway";
export const maxDuration = 60;
const schema = z.object({
  action: z.enum([
    "GENERATE_BIO",
    "SHORTEN_BIO",
    "CHANGE_TONE",
    "PROMOTER_BIO",
    "FESTIVAL_BIO",
    "BRAND_BIO",
    "TRANSLATE",
    "GRAMMAR_FIX",
    "SEO_DESCRIPTION",
    "CAREER_SUMMARY",
  ]),
  text: z.string().trim().min(10).max(6000),
  language: z.enum(["en", "ar"]),
  tone: z.string().max(80),
});
export async function POST(request: Request) {
  try {
    const { db, user } = await authenticate(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Provide 10–6,000 characters and a valid writing action." },
        { status: 400 },
      );
    const { data: id, error } = await db.rpc("begin_ai_request", {
      p_action: parsed.data.action,
    });
    if (error) return Response.json({ error: error.message }, { status: 429 });
    try {
      const result = await writingProvider.generateText({
        ...parsed.data,
        userId: user.id,
      });
      await db.rpc("finish_ai_request", {
        p_id: id,
        p_status: "COMPLETED",
        p_input: result.inputTokens,
        p_output: result.outputTokens,
      });
      return Response.json(
        { text: result.text, requestId: id },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      await db.rpc("finish_ai_request", { p_id: id, p_status: "FAILED" });
      console.error(
        JSON.stringify({ event: "ai.provider_unavailable", requestId: id }),
      );
      return Response.json(
        {
          error:
            "AI is temporarily unavailable or the AI Gateway needs activation/credits. Your source text is safe; manual editing remains available.",
          requestId: id,
        },
        { status: 503 },
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
