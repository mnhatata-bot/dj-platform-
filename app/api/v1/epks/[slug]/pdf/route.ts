import { getPublication } from "@/modules/epk/application/publication";
import { renderEpkPdf } from "@/modules/epk/infrastructure/pdf";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const publication = await getPublication(slug);
    if (!publication)
      return new Response("Published EPK not found", { status: 404 });
    if (new URL(_request.url).searchParams.get("language") === "ar") {
      const ar = publication.dj.translations?.ar;
      if (ar) {
        publication.dj = {
          ...publication.dj,
          stage_name: ar.stage_name || publication.dj.stage_name,
          short_bio: ar.short_bio || publication.dj.short_bio,
          long_bio: ar.short_bio || publication.dj.long_bio,
        };
      }
      publication.epk.locale = "ar";
    }
    const buffer = await renderEpkPdf(publication);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cuelance-${slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    console.error(
      JSON.stringify({
        event: "epk.pdf_failed",
        requestId: crypto.randomUUID(),
      }),
    );
    return Response.json(
      { error: "PDF generation failed. Please retry." },
      { status: 503 },
    );
  }
}
