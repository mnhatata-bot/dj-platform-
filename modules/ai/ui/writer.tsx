"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useLocale } from "@/modules/localization/ui/provider";
import { GuidedField, ModuleHeading, Status } from "@/modules/ui/guided";
import type { WritingAction } from "../application/provider";
const actions: WritingAction[] = [
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
];
export default function Writer({
  initial,
  onAccept,
}: {
  initial: string;
  onAccept: (text: string, language: "en" | "ar") => void;
}) {
  const { t, locale } = useLocale();
  const [source, setSource] = useState(initial);
  const [action, setAction] = useState<WritingAction>("GENERATE_BIO");
  const [language, setLanguage] = useState<"en" | "ar">(locale);
  const [tone, setTone] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem("cuelance.ai.draft");
    if (saved) setDraft(saved);
  }, []);
  useEffect(() => {
    sessionStorage.setItem("cuelance.ai.draft", draft);
  }, [draft]);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ text: string }>("/api/v1/ai/write", {
        action,
        text: source,
        language,
        tone,
      });
      setDraft(result.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ModuleHeading title={t("ai.title")} help={t("ai.help")} />
      <section className="card module-form">
        <GuidedField label={t("ai.action")}>
          <select
            aria-label={t("ai.action")}
            value={action}
            onChange={(e) => setAction(e.target.value as WritingAction)}
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {t(`action.${a}`)}
              </option>
            ))}
          </select>
        </GuidedField>
        <GuidedField label={t("language")}>
          <select
            aria-label={t("language")}
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "ar")}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </GuidedField>
        <GuidedField label={t("ai.source")} help={t("ai.example")}>
          <textarea
            aria-label={t("ai.source")}
            minLength={10}
            maxLength={6000}
            rows={7}
            dir="auto"
            placeholder={t("ai.example")}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </GuidedField>
        <GuidedField label={t("ai.tone")} help={t("ai.toneExample")}>
          <input
            aria-label={t("ai.tone")}
            maxLength={80}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder={t("ai.toneExample")}
          />
        </GuidedField>
        <button
          className="button primary"
          disabled={busy || source.trim().length < 10}
          onClick={generate}
        >
          {busy ? t("working") : t("ai.generate")}
        </button>
        <Status text={error} error />
        {draft && (
          <>
            <GuidedField label={t("ai.draft")}>
              <textarea
                aria-label={t("ai.draft")}
                rows={9}
                dir={language === "ar" ? "rtl" : "ltr"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </GuidedField>
            <button
              className="button"
              onClick={() => onAccept(draft, language)}
            >
              {t("ai.accept")}
            </button>
          </>
        )}
      </section>
    </>
  );
}
