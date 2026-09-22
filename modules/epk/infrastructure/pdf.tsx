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
import type { PublishedDocument } from "../application/publication";
const fonts = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans-arabic/files",
);
Font.register({
  family: "CuelanceArabic",
  src: path.join(fonts, "noto-sans-arabic-arabic-400-normal.woff"),
});
Font.register({
  family: "CuelanceLatin",
  src: path.join(fonts, "noto-sans-arabic-latin-400-normal.woff"),
});
Font.registerHyphenationCallback((word) => [word]);
function Copy({ children, size = 11 }: { children: string; size?: number }) {
  return (
    <Text
      style={{
        fontSize: size,
        lineHeight: 1.7,
        textAlign: /[\u0600-\u06ff]/.test(children) ? "right" : "left",
      }}
    >
      {children
        .split(/([\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\s]+)/)
        .map((part, i) => (
          <Text
            key={i}
            style={{
              fontFamily: /[\u0600-\u06ff]/.test(part)
                ? "CuelanceArabic"
                : "CuelanceLatin",
            }}
          >
            {part}
          </Text>
        ))}
    </Text>
  );
}
export async function renderEpkPdf(document: PublishedDocument) {
  const live = `https://www.cuelance.com/epk/${encodeURIComponent(document.epk.slug)}`;
  const qr = await QRCode.toDataURL(live, { width: 160, margin: 1 });
  const accent =
    (
      {
        underground: "#24300a",
        minimal: "#222222",
        festival: "#912157",
        luxury: "#80601e",
        experimental: "#4b28a4",
      } as Record<string, string>
    )[document.epk.template_id] || "#222222";
  return renderToBuffer(
    <Document
      title={document.dj.stage_name + " — Cuelance EPK"}
      author="Cuelance"
      language={document.epk.locale || "en"}
    >
      <Page
        size="A4"
        style={{
          padding: 42,
          paddingBottom: 65,
          fontFamily: "CuelanceLatin",
          color: "#141414",
        }}
      >
        <View
          style={{
            borderBottomWidth: 3,
            borderBottomColor: accent,
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <Copy size={10}>CUELANCE / ELECTRONIC PRESS KIT</Copy>
          <Copy size={28}>{document.dj.stage_name}</Copy>
          <Copy>
            {[document.dj.primary_city, document.dj.country]
              .filter(Boolean)
              .join(" · ")}
          </Copy>
          <Copy>{(document.dj.genres || []).join(" · ")}</Copy>
        </View>
        <View style={{ marginBottom: 20 }}>
          <Copy>{document.dj.long_bio || document.dj.short_bio || ""}</Copy>
        </View>
        {document.sections
          .filter((s) => !["hero", "bio", "booking"].includes(s.type))
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((section) => (
            <View key={section.id} style={{ marginBottom: 18 }}>
              <Copy size={16}>
                {section.content_json?.heading ||
                  section.type.replaceAll("_", " ")}
              </Copy>
              {section.content_json?.text && (
                <Copy>{section.content_json.text}</Copy>
              )}
              {section.content_json?.asset_ids?.map((id) => (
                <Link
                  key={id}
                  src={`https://www.cuelance.com/api/v1/media/${id}`}
                  style={{ fontSize: 10, color: accent, marginTop: 5 }}
                >
                  Media / {id.slice(0, 8)}
                </Link>
              ))}
            </View>
          ))}
        <View
          wrap={false}
          style={{
            borderTopWidth: 1,
            borderTopColor: "#dddddd",
            paddingTop: 14,
            marginTop: 15,
          }}
        >
          <Image src={qr} style={{ width: 85, height: 85 }} />
          <Link src={live} style={{ fontSize: 9, color: accent, marginTop: 8 }}>
            {live}
          </Link>
          <Copy
            size={9}
          >{`Published version ${document.version} · ${new Date(document.published_at).toISOString().slice(0, 10)}`}</Copy>
        </View>
        <Text
          fixed
          style={{
            position: "absolute",
            bottom: 28,
            left: 42,
            right: 42,
            fontSize: 8,
            color: "#777777",
          }}
          render={({ pageNumber, totalPages }) =>
            `CUELANCE · ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>,
  );
}
