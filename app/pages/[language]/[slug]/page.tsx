import { notFound } from "next/navigation";
import { database } from "@/lib/server-auth";
import { ContentBlocks, safeLink } from "@/modules/cms/ui/blocks";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ language: string; slug: string }> };
async function getPage(params: Props["params"]) {
  const { language, slug } = await params;
  if (!["en", "ar"].includes(language)) return null;
  const { data } = await database()
    .from("cms_pages")
    .select("*")
    .eq("language", language)
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  return data;
}
export async function generateMetadata({ params }: Props) {
  const page = await getPage(params);
  if (!page)
    return { title: "Page unavailable | Cuelance", robots: { index: false } };
  return {
    title: page.seo_title || page.title,
    description: page.seo_description,
    alternates: {
      canonical: `https://www.cuelance.com/pages/${page.language}/${page.slug}`,
    },
    openGraph: {
      title: page.seo_title || page.title,
      description: page.seo_description,
    },
  };
}
export default async function CmsPage({ params }: Props) {
  const page = await getPage(params);
  if (!page) notFound();
  const { data: settings } = await database()
    .from("platform_settings")
    .select("key,value")
    .in("key", ["branding", "navigation"]);
  const brand = settings?.find((s) => s.key === "branding")?.value;
  const links = settings?.find((s) => s.key === "navigation")?.value;
  return (
    <main
      className="cms-public"
      dir={page.language === "ar" ? "rtl" : "ltr"}
      lang={page.language}
    >
      <header className="public-cms-nav">
        <a className="brand" href="/">
          {brand?.name || "Cuelance"}
        </a>
        <nav>
          {Array.isArray(links) &&
            links.map(
              (item: { label: string; url: string }, i: number) =>
                safeLink(item.url || "") && (
                  <a href={safeLink(item.url)} key={i}>
                    {item.label}
                  </a>
                ),
            )}
        </nav>
      </header>
      <ContentBlocks blocks={page.blocks} />
    </main>
  );
}
