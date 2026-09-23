"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api-client";
import { useLocale } from "@/modules/localization/ui/provider";
import { GuidedField, ModuleHeading, Status } from "@/modules/ui/guided";
import { richSectionLabels } from "@/modules/epk/application/rich-content";
type Asset = {
  id: string;
  kind: string;
  mime_type: string;
  file_size: number;
  storage_key: string;
  visibility: string;
  metadata: { name?: string; alt?: string };
};
export default function MediaLibrary({ epkId, onAttached }: { epkId?: string; onAttached?: () => void }) {
  const { t } = useLocale();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [targetSection, setTargetSection] = useState("gallery");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("owner_user_id", user.user?.id)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setAssets(data || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file) return;
    await run(async () => {
      if (file.size > 26214400 || file.size === 0)
        throw new Error(t("media.help"));
      const extensions: Record<string, string[]> = {
        "image/jpeg": ["jpg", "jpeg"],
        "image/png": ["png"],
        "image/webp": ["webp"],
        "image/gif": ["gif"],
        "video/mp4": ["mp4"],
        "video/webm": ["webm"],
        "audio/mpeg": ["mp3"],
        "audio/wav": ["wav"],
        "audio/ogg": ["ogg"],
        "application/pdf": ["pdf"],
        "application/zip": ["zip"],
      };
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const mime = Object.keys(extensions).find((m) =>
        extensions[m].includes(ext),
      );
      if (!mime) throw new Error(t("media.help"));
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error(t("signin"));
      const key = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(key, file, { contentType: mime, upsert: false });
      if (uploadError) throw uploadError;
      try {
        await api("/api/v1/media/complete", {
          key,
          name: file.name.slice(0, 160),
          alt,
        });
      } catch (e) {
        await supabase.storage.from("media").remove([key]);
        throw e;
      }
      setFile(null);
      setAlt("");
      if (input.current) input.current.value = "";
      setNotice(t("saved"));
      await load();
    });
  }
  async function visibility(asset: Asset) {
    await run(async () => {
      const next = asset.visibility === "PRIVATE" ? "PUBLIC" : "PRIVATE";
      if (next === "PUBLIC" && !confirm(t("media.confirm"))) return;
      const { error } = await supabase
        .from("media_assets")
        .update({ visibility: next })
        .eq("id", asset.id);
      if (error) throw error;
      await load();
    });
  }
  async function preview(asset: Asset) {
    await run(async () => {
      const { data, error } = await supabase.storage
        .from("media")
        .createSignedUrl(asset.storage_key, 60);
      if (error) throw error;
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    });
  }
  async function attach(asset: Asset) {
    await run(async () => {
      if (!epkId) throw new Error(t("media.noEpk"));
      if (asset.visibility !== "PUBLIC") {
        if (!confirm(t("media.confirm"))) return;
        const { error } = await supabase
          .from("media_assets")
          .update({ visibility: "PUBLIC" })
          .eq("id", asset.id);
        if (error) throw error;
      }
      const type = targetSection || (
        asset.kind === "IMAGE"
          ? "gallery"
          : asset.kind === "AUDIO"
            ? "music"
            : asset.kind === "VIDEO"
              ? "video"
              : "downloads");
      const { data: section, error } = await supabase
        .from("epk_sections")
        .select("id,content_json")
        .eq("epk_id", epkId)
        .eq("type", type)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const content = {
        ...(section?.content_json || {}),
        asset_ids: Array.from(
          new Set([...(section?.content_json?.asset_ids || []), asset.id]),
        ),
      };
      const result = section
        ? await supabase
            .from("epk_sections")
            .update({ content_json: content, enabled: true })
            .eq("id", section.id)
        : await supabase
            .from("epk_sections")
            .insert({
              epk_id: epkId,
              type,
              enabled: true,
              sort_order: 5,
              visibility: "PUBLIC",
              content_json: content,
            });
      if (result.error) throw result.error;
      setNotice(`${t("media.attached")} ${richSectionLabels[type] || type}.`);
      onAttached?.();
      await load();
    });
  }
  return (
    <>
      <ModuleHeading title={t("media.title")} help={t("media.help")} />
      <section className="card module-form">
        <GuidedField label={t("media.file")} help={t("media.help")}>
          <input
            ref={input}
            aria-label={t("media.file")}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.wav,.ogg,.pdf,.zip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </GuidedField>
        <GuidedField label={t("media.alt")} help={t("media.altHelp")}>
          <input
            aria-label={t("media.alt")}
            maxLength={300}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
        </GuidedField>
        {epkId && (
          <GuidedField label="Attach uploads to EPK section" help="Choose where the next Attach action places the selected asset. Images can go to cover/profile/gallery/credentials/downloads; audio should go to sound; documents to downloads or credentials.">
            <select value={targetSection} onChange={(event) => setTargetSection(event.target.value)}>
              {["hero", "bio", "music", "video", "gallery", "highlights", "press", "events", "social", "downloads", "technical_rider", "booking"].map((type) => (
                <option key={type} value={type}>{richSectionLabels[type] || type}</option>
              ))}
            </select>
          </GuidedField>
        )}
        <button
          className="button primary"
          disabled={!file || busy}
          onClick={upload}
        >
          {busy ? t("working") : t("media.upload")}
        </button>
        <Status text={notice} />
        <Status text={error} error />
      </section>
      {loading ? (
        <p>{t("loading")}</p>
      ) : assets.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="guide-grid">
          {assets.map((asset) => (
            <article className="card" key={asset.id}>
              <h3 className="break-text">
                {asset.metadata?.name || asset.kind}
              </h3>
              <p>
                {(asset.file_size / 1024 / 1024).toFixed(2)} MB ·{" "}
                {asset.visibility === "PUBLIC"
                  ? t("media.public")
                  : t("media.private")}
              </p>
              <p>{asset.metadata?.alt}</p>
              <div className="actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => preview(asset)}
                >
                  {t("media.preview")}
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => visibility(asset)}
                >
                  {asset.visibility === "PRIVATE"
                    ? t("media.publish")
                    : t("media.unpublish")}
                </button>
                <button
                  className="button"
                  disabled={busy || !epkId}
                  onClick={() => attach(asset)}
                >
                  {t("media.attach")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
