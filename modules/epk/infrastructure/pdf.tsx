import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  Image,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import QRCode from "qrcode";
import { database } from "@/lib/server-auth";
import type { PublishedDocument } from "../application/publication";
import { normalizeContent, richSectionLabels, safeLinks } from "../application/rich-content";

const fonts = path.join(process.cwd(), "node_modules/@fontsource/noto-sans-arabic/files");
Font.register({ family: "CuelanceArabic", src: path.join(fonts, "noto-sans-arabic-arabic-400-normal.woff") });
Font.register({ family: "CuelanceLatin", src: path.join(fonts, "noto-sans-arabic-latin-400-normal.woff") });
Font.registerHyphenationCallback((word) => [word]);

type PdfAsset = { id: string; kind: string; label: string; url: string };

function Copy({ children, size = 11, color = "#f4f1e8", weight = 400 }: { children?: string; size?: number; color?: string; weight?: number }) {
  const value = children || "";
  return (
    <Text style={{ fontSize: size, lineHeight: 1.55, color, fontWeight: weight, textAlign: /[\u0600-\u06ff]/.test(value) ? "right" : "left" }}>
      {value.split(/([\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\s]+)/).map((part, i) => (
        <Text key={i} style={{ fontFamily: /[\u0600-\u06ff]/.test(part) ? "CuelanceArabic" : "CuelanceLatin" }}>{part}</Text>
      ))}
    </Text>
  );
}

function labelFor(type: string) {
  return richSectionLabels[type] || type.replaceAll("_", " ");
}

async function loadPdfAssets(ids: string[]) {
  if (!ids.length) return new Map<string, PdfAsset>();
  const db = database();
  const { data } = await db
    .from("media_assets")
    .select("id,kind,storage_key,metadata")
    .in("id", ids)
    .eq("visibility", "PUBLIC");
  const map = new Map<string, PdfAsset>();
  for (const asset of data || []) {
    const { data: signed } = await db.storage.from("media").createSignedUrl(asset.storage_key, 600);
    if (!signed?.signedUrl) continue;
    map.set(asset.id, {
      id: asset.id,
      kind: asset.kind,
      label: asset.metadata?.alt || asset.metadata?.name || asset.kind,
      url: signed.signedUrl,
    });
  }
  return map;
}

export async function renderEpkPdf(document: PublishedDocument) {
  const live = `https://www.cuelance.com/epk/${encodeURIComponent(document.epk.slug)}`;
  const qr = await QRCode.toDataURL(live, { width: 180, margin: 1, color: { dark: "#0a0b0f", light: "#d5ff41" } });
  const accent = ({ underground: "#d5ff41", minimal: "#2f3d18", festival: "#ff4fa3", luxury: "#d6ad55", experimental: "#65f7ff" } as Record<string, string>)[document.epk.template_id] || "#d5ff41";
  const sections = document.sections
    .filter((section) => section.enabled && section.visibility === "PUBLIC")
    .sort((a, b) => a.sort_order - b.sort_order);
  const assetIds = Array.from(new Set(sections.flatMap((section) => normalizeContent(section.content_json).asset_ids || [])));
  const assets = await loadPdfAssets(assetIds);
  const hero = normalizeContent(sections.find((section) => section.type === "hero")?.content_json);
  const printableSections = sections.filter((section) => section.type !== "hero");
  return renderToBuffer(
    <Document title={`${document.dj.stage_name} - Cuelance EPK`} author="Cuelance" language={document.epk.locale || "en"}>
      <Page size="A4" orientation="landscape" style={{ padding: 34, paddingBottom: 42, fontFamily: "CuelanceLatin", backgroundColor: "#080a0f", color: "#f4f1e8" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#2c3038", paddingBottom: 14 }}>
          <Copy size={9} color="#90949f">{hero.kicker || [document.dj.primary_city, document.dj.country].filter(Boolean).join(" / ") || "Cuelance artist"}</Copy>
          <Copy size={9} color={accent}>{`OFFICIAL PRESS KIT / ${new Date(document.published_at).getFullYear()}`}</Copy>
        </View>
        <View style={{ flexDirection: "row", gap: 28, alignItems: "center", flexGrow: 1 }}>
          <View style={{ flex: 1.25 }}>
            <Copy size={74} color="#f9f8ef" weight={800}>{hero.heading || document.dj.stage_name}</Copy>
            <View style={{ height: 3, width: 220, backgroundColor: accent, marginVertical: 18 }} />
            <Copy size={20} color="#dfe3df">{hero.subheading || document.dj.short_bio || document.epk.seo_description || "Electronic press kit"}</Copy>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 18 }}>
              {[...(hero.badges || []), ...(document.dj.genres || [])].slice(0, 8).map((badge) => <Text key={badge} style={{ color: accent, borderWidth: 1, borderColor: accent, borderRadius: 999, padding: "5 9", fontSize: 9 }}>{badge}</Text>)}
            </View>
          </View>
          <View style={{ width: 125, alignItems: "center" }}>
            <Image src={qr} style={{ width: 112, height: 112, marginBottom: 10 }} />
            <Link src={live} style={{ color: accent, fontSize: 8, textAlign: "center" }}>Live EPK</Link>
          </View>
        </View>
        <Text fixed style={{ position: "absolute", bottom: 20, left: 34, right: 34, fontSize: 8, color: "#707684" }} render={({ pageNumber, totalPages }) => `CUELANCE · ${document.dj.stage_name} · ${pageNumber} / ${totalPages}`} />
      </Page>
      {printableSections.map((section) => {
        const content = normalizeContent(section.content_json);
        const sectionAssets = (content.asset_ids || []).map((id) => assets.get(id)).filter(Boolean) as PdfAsset[];
        const imageAssets = sectionAssets.filter((asset) => asset.kind === "IMAGE").slice(0, 3);
        const fileAssets = sectionAssets.filter((asset) => asset.kind !== "IMAGE");
        return (
          <Page key={section.id} size="A4" orientation="landscape" style={{ padding: 34, paddingBottom: 42, fontFamily: "CuelanceLatin", backgroundColor: "#080a0f", color: "#f4f1e8" }}>
            <View style={{ flexDirection: "row", gap: 24 }}>
              <View style={{ flex: imageAssets.length ? 0.92 : 1.35 }}>
                <Copy size={9} color={accent}>{(content.kicker || labelFor(section.type)).toUpperCase()}</Copy>
                <Copy size={42} color="#f9f8ef" weight={800}>{content.heading || labelFor(section.type)}</Copy>
                {content.subheading && <Copy size={16} color="#c9ccd4">{content.subheading}</Copy>}
                {content.text && <View style={{ marginTop: 14 }}><Copy size={11}>{content.text}</Copy></View>}
                {content.badges?.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 }}>{content.badges.slice(0, 8).map((badge) => <Text key={badge} style={{ color: accent, borderWidth: 1, borderColor: accent, borderRadius: 999, padding: "5 8", fontSize: 8 }}>{badge}</Text>)}</View>
                ) : null}
                {content.callout && <View style={{ marginTop: 14, borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: 10 }}><Copy size={11} color="#f7f6ed" weight={700}>{content.callout}</Copy></View>}
              </View>
              {imageAssets.length ? (
                <View style={{ flex: 0.95, flexDirection: "row", gap: 8 }}>
                  {imageAssets.map((asset) => <View key={asset.id} style={{ flex: 1 }}><Image src={asset.url} style={{ width: "100%", height: 230, objectFit: "cover", borderRadius: 12 }} /><Text style={{ color: "#a4a9b5", fontSize: 8, marginTop: 6 }}>{asset.label}</Text></View>)}
                </View>
              ) : null}
            </View>
            {content.entries?.length ? (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
                {content.entries.slice(0, 4).map((entry, index) => <View key={`${entry.title}-${index}`} style={{ flex: 1, borderWidth: 1, borderColor: "#2b3039", borderRadius: 12, padding: 12 }}><Text style={{ color: accent, fontSize: 8, marginBottom: 5 }}>{entry.meta || String(index + 1).padStart(2, "0")}</Text><Copy size={13} color="#ffffff" weight={800}>{entry.title}</Copy>{entry.description && <Copy size={9} color="#bec3cc">{entry.description}</Copy>}{entry.url && <Link src={entry.url} style={{ color: accent, fontSize: 8, marginTop: 5 }}>Open link</Link>}</View>)}
              </View>
            ) : null}
            {(content.links?.length || fileAssets.length) ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
                {safeLinks(content.links).map((link) => <Link key={`${link.label}-${link.url}`} src={link.url} style={{ color: accent, borderWidth: 1, borderColor: accent, borderRadius: 999, padding: "5 9", fontSize: 8 }}>{link.label || link.url}</Link>)}
                {fileAssets.map((asset) => <Link key={asset.id} src={`https://www.cuelance.com/api/v1/media/${asset.id}`} style={{ color: accent, borderWidth: 1, borderColor: accent, borderRadius: 999, padding: "5 9", fontSize: 8 }}>{asset.label}</Link>)}
              </View>
            ) : null}
            <Text fixed style={{ position: "absolute", bottom: 20, left: 34, right: 34, fontSize: 8, color: "#707684" }} render={({ pageNumber, totalPages }) => `CUELANCE · ${document.dj.stage_name} · ${pageNumber} / ${totalPages}`} />
          </Page>
        );
      })}
    </Document>,
  );
}
