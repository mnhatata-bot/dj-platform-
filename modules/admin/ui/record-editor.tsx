"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { GuidedField, Status } from "@/modules/ui/guided";
export const editableFields: Record<string, string[]> = {
  organizations: ["name", "kind"],
  events: [
    "title",
    "description",
    "venue",
    "address",
    "city",
    "country",
    "status",
    "visibility",
  ],
  communities: [
    "name",
    "description",
    "visibility",
    "membership_mode",
    "status",
  ],
  opportunities: ["title", "description", "city", "country", "status"],
  dj_profiles: [
    "stage_name",
    "short_bio",
    "long_bio",
    "primary_city",
    "country",
  ],
};
const options: Record<string, string[]> = {
  "organizations.kind": [
    "PROMOTER",
    "VENUE",
    "AGENCY",
    "BRAND",
    "EVENT_COMPANY",
    "COMMUNITY_OPERATOR",
  ],
  "events.status": ["DRAFT", "PUBLISHED", "LIVE", "ENDED", "CANCELLED"],
  "events.visibility": ["PUBLIC", "PRIVATE", "UNLISTED"],
  "opportunities.status": [
    "DRAFT",
    "PUBLISHED",
    "CLOSED",
    "FILLED",
    "CANCELLED",
  ],
  "communities.membership_mode": [
    "OPEN",
    "APPLICATION",
    "INVITE_ONLY",
    "CLOSED",
  ],
  "communities.visibility": ["PUBLIC", "PRIVATE"],
  "communities.status": ["ACTIVE", "ARCHIVED"],
};
export default function RecordEditor({
  entity,
  row,
  onDone,
}: {
  entity: string;
  row: Record<string, unknown>;
  onDone: () => void;
}) {
  const { t, locale } = useLocale();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editableFields[entity].map((k) => [k, String(row[k] ?? "")]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!confirm(t("admin.confirm"))) return;
    setBusy(true);
    setError("");
    try {
      const changes = Object.fromEntries(
        Object.entries(values).filter(([k, v]) => String(row[k] ?? "") !== v),
      );
      if (!Object.keys(changes).length) {
        onDone();
        return;
      }
      const { error } = await supabase.rpc("admin_update_entity", {
        p_entity: entity,
        p_id: row.id,
        p_changes: changes,
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="card module-form"
      aria-label={locale === "ar" ? "تعديل السجل" : "Edit record"}
    >
      <h2>{String(row.title || row.name || row.stage_name || row.id)}</h2>
      <p>
        {locale === "ar"
          ? "تُحفظ التغييرات في سجل التدقيق. لا يمكن تعديل الملكية أو البيانات المالية هنا."
          : "Changes are audited. Ownership and financial data are not editable here."}
      </p>
      {editableFields[entity].map((field) => (
        <GuidedField
          key={field}
          label={field}
          help={
            field === "status"
              ? locale === "ar"
                ? "يقبل الخادم الانتقالات المسموح بها فقط. مثال: منشور إلى مباشر ثم منتهٍ."
                : "The server permits valid transitions only. Example: PUBLISHED → LIVE → ENDED."
              : undefined
          }
        >
          {options[entity + "." + field] ? (
            <select
              aria-label={field}
              value={values[field]}
              onChange={(e) =>
                setValues({ ...values, [field]: e.target.value })
              }
            >
              {options[entity + "." + field].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <textarea
              aria-label={field}
              maxLength={10000}
              rows={field.includes("bio") || field === "description" ? 4 : 1}
              value={values[field]}
              onChange={(e) =>
                setValues({ ...values, [field]: e.target.value })
              }
            />
          )}
        </GuidedField>
      ))}
      <Status text={error} error />
      <div className="actions">
        <button className="button primary" disabled={busy} onClick={save}>
          {busy ? t("working") : t("save")}
        </button>
        <button className="button" disabled={busy} onClick={onDone}>
          {t("cancel")}
        </button>
      </div>
    </section>
  );
}
