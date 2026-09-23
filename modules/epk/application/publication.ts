import { database } from "@/lib/server-auth";
import type { RichSectionContent } from "./rich-content";
export type PublishedSection = {
  id: string;
  type: string;
  enabled: boolean;
  visibility: string;
  sort_order: number;
  content_json?: RichSectionContent;
};
export type PublishedDocument = {
  epk: {
    id: string;
    slug: string;
    title: string;
    template_id: string;
    locale: string;
    seo_description?: string;
    theme?: Record<string, string>;
  };
  dj: {
    id: string;
    stage_name: string;
    short_bio?: string;
    long_bio?: string;
    primary_city?: string;
    country?: string;
    genres?: string[];
    languages?: string[];
    links?: Record<string, string>;
    translations?: { ar?: { stage_name?: string; short_bio?: string } };
  };
  sections: PublishedSection[];
  version: number;
  published_at: string;
};
export async function getPublication(
  slug: string,
): Promise<PublishedDocument | null> {
  const { data, error } = await database().rpc("get_public_epk", {
    p_slug: slug,
  });
  if (error) throw new Error("Publication unavailable");
  return data;
}
