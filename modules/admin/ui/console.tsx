"use client";
import { useEffect, useState } from "react";
import RecordEditor, { editableFields } from "./record-editor";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/modules/localization/ui/provider";
import { GuidedField, ModuleHeading, Status } from "@/modules/ui/guided";
import { ContentBlocks, type ContentBlock } from "@/modules/cms/ui/blocks";
type PageDocument = {
  id?: string;
  slug: string;
  language: string;
  title: string;
  seo_title: string;
  seo_description: string;
  status: string;
  blocks: ContentBlock[];
};
type Row = Record<string, unknown>;
const blank: PageDocument = {
  slug: "",
  language: "en",
  title: "",
  seo_title: "",
  seo_description: "",
  status: "DRAFT",
  blocks: [],
};
const resources = [
  "profiles",
  "dj_profiles",
  "organizations",
  "events",
  "communities",
  "tickets",
  "ticket_orders",
  "opportunities",
  "cms_pages",
  "audit_logs",
  "feature_flags",
  "user_roles",
  "ai_requests",
  "vendor_profiles",
  "vendor_products",
  "vendor_quote_requests",
  "vendor_quotes",
  "my_cuelance_items",
  "operational_logs",
  "provider_pages",
  "provider_offerings",
  "provider_inquiries",
];
const roles = [
  "USER",
  "DJ",
  "PROMOTER",
  "COMMUNITY_MANAGER",
  "EVENT_MANAGER",
  "EVENT_STAFF",
  "ORGANIZATION_ADMIN",
  "PLATFORM_SUPPORT",
  "PLATFORM_MODERATOR",
  "PLATFORM_ADMIN",
];
export default function AdminConsole() {
  const { t, locale } = useLocale();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"pages" | "records" | "logs" | "settings">("pages");
  const [pages, setPages] = useState<PageDocument[]>([]);
  const [document, setDocument] = useState<PageDocument>(blank);
  const [preview, setPreview] = useState(false);
  const [revisions, setRevisions] = useState<
    { id: string; created_at: string; document: PageDocument }[]
  >([]);
  const [resource, setResource] = useState("profiles");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [role, setRole] = useState("USER");
  const [key, setKey] = useState("branding");
  const [config, setConfig] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void supabase.rpc("platform_admin").then(({ data, error }) => {
      setAllowed(Boolean(data));
      if (error) setError(error.message);
    });
  }, []);
  async function pageList() {
    const { data, error } = await supabase
      .from("cms_pages")
      .select("*")
      .order("title");
    if (error) throw error;
    setPages(data || []);
  }
  async function recordList(entity = resource) {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list", {
      p_entity: entity,
      p_page: page,
      p_search: appliedSearch,
    });
    if (error) setError(error.message);
    else {
      setRows(data.rows);
      setTotal(data.total);
    }
    setLoading(false);
  }
  useEffect(() => {
    if (allowed) void pageList().catch((e) => setError(e.message));
  }, [allowed]);
  useEffect(() => {
    if (allowed && tab === "records") void recordList();
  }, [allowed, tab, resource, page, appliedSearch]);
  useEffect(() => {
    if (!allowed || tab !== "logs") return;
    setResource("operational_logs");
    void recordList("operational_logs");
  }, [allowed, tab, page, appliedSearch]);
  useEffect(() => {
    if (!document.id) {
      setRevisions([]);
      return;
    }
    void supabase
      .from("cms_revisions")
      .select("id,created_at,document")
      .eq("page_id", document.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRevisions(data || []);
      });
  }, [document.id, notice]);
  useEffect(() => {
    if (!allowed || tab !== "settings") return;
    setLoading(true);
    void supabase
      .rpc("admin_list", { p_entity: "platform_settings", p_search: "" })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else
          setConfig(
            JSON.stringify(
              data.rows.find((r: Row) => r.key === key)?.value || {},
              null,
              2,
            ),
          );
        setLoading(false);
      });
  }, [key, allowed, tab]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function savePage() {
    if (document.status === "PUBLISHED" && !confirm(t("admin.publishConfirm")))
      return;
    await run(async () => {
      const { data, error } = await supabase.rpc("admin_save_page", {
        p_document: document,
      });
      if (error) throw error;
      setDocument({ ...document, id: data });
      await pageList();
      setNotice(t("saved"));
      sessionStorage.removeItem("cuelance.cms.draft");
    });
  }
  function edit(value: PageDocument) {
    setDocument(value);
    sessionStorage.setItem("cuelance.cms.draft", JSON.stringify(value));
  }
  useEffect(() => {
    const draft = sessionStorage.getItem("cuelance.cms.draft");
    if (draft) {
      try {
        setDocument(JSON.parse(draft));
      } catch {}
    }
  }, []);
  function block(index: number, patch: Partial<ContentBlock>) {
    edit({
      ...document,
      blocks: document.blocks.map((b, i) =>
        i === index ? { ...b, ...patch } : b,
      ),
    });
  }
  function move(index: number, delta: number) {
    const blocks = [...document.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    edit({ ...document, blocks });
  }
  async function action(command: string, id: string, value: string) {
    if (!confirm(t("admin.confirm"))) return;
    await run(async () => {
      const { error } = await supabase.rpc("admin_action", {
        p_action: command,
        p_id: id,
        p_value: value,
      });
      if (error) throw error;
      setNotice(t("saved"));
      await recordList();
    });
  }
  function exportRows() {
    const fields = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const cell = (v: unknown) => {
      let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const csv = [
      fields.map(cell).join(","),
      ...rows.map((r) => fields.map((f) => cell(r[f])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `cuelance-${resource}-${page + 1}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (allowed === null) return <p>{t("loading")}</p>;
  if (!allowed) return <Status error text={t("admin.denied")} />;
  return (
    <>
      <ModuleHeading title={t("admin.title")} help={t("admin.help")} />
      <nav className="actions" aria-label={t("admin.title")}>
        {(["pages", "records", "logs", "settings"] as const).map((id) => (
          <button
            className={`button ${tab === id ? "primary" : ""}`}
            key={id}
            onClick={() => setTab(id)}
          >
            {id === "logs" ? "Operations log" : t(`admin.${id}`)}
          </button>
        ))}
      </nav>
      <Status text={error} error />
      <Status text={notice} />
      {tab === "pages" && (
        <div className="messaging-grid">
          <aside className="card">
            <button
              className="button primary"
              onClick={() => edit({ ...blank, language: locale })}
            >
              {t("admin.new")}
            </button>
            {pages.map((p) => (
              <button
                className={`nav-button ${p.id === document.id ? "active" : ""}`}
                key={p.id}
                onClick={() => {
                  if (
                    sessionStorage.getItem("cuelance.cms.draft") &&
                    !confirm(
                      locale === "ar"
                        ? "تجاهل التعديلات غير المحفوظة؟"
                        : "Discard unsaved page edits?",
                    )
                  )
                    return;
                  setDocument({
                    ...p,
                    seo_title: p.seo_title || "",
                    seo_description: p.seo_description || "",
                  });
                  sessionStorage.removeItem("cuelance.cms.draft");
                }}
              >
                {p.title} · {p.language} · {p.status}
              </button>
            ))}
          </aside>
          <section className="card module-form">
            <GuidedField label={t("title")}>
              <input
                aria-label={t("title")}
                value={document.title}
                maxLength={160}
                onChange={(e) => edit({ ...document, title: e.target.value })}
              />
            </GuidedField>
            <GuidedField label={t("admin.slug")} help={t("admin.slugHelp")}>
              <input
                aria-label={t("admin.slug")}
                dir="ltr"
                value={document.slug}
                maxLength={80}
                onChange={(e) => edit({ ...document, slug: e.target.value })}
              />
            </GuidedField>
            <div className="form-grid">
              <GuidedField label={t("language")}>
                <select
                  aria-label={t("language")}
                  value={document.language}
                  onChange={(e) =>
                    edit({ ...document, language: e.target.value })
                  }
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </GuidedField>
              <GuidedField label={t("admin.status")}>
                <select
                  aria-label={t("admin.status")}
                  value={document.status}
                  onChange={(e) =>
                    edit({ ...document, status: e.target.value })
                  }
                >
                  <option value="DRAFT">{t("admin.draft")}</option>
                  <option value="PUBLISHED">{t("admin.published")}</option>
                  <option value="ARCHIVED">{t("admin.archived")}</option>
                </select>
              </GuidedField>
            </div>
            <GuidedField label={t("admin.seoTitle")}>
              <input
                aria-label={t("admin.seoTitle")}
                value={document.seo_title}
                maxLength={160}
                onChange={(e) =>
                  edit({ ...document, seo_title: e.target.value })
                }
              />
            </GuidedField>
            <GuidedField label={t("admin.seoDescription")}>
              <textarea
                aria-label={t("admin.seoDescription")}
                value={document.seo_description}
                maxLength={320}
                onChange={(e) =>
                  edit({ ...document, seo_description: e.target.value })
                }
              />
            </GuidedField>
            {document.blocks.map((b, i) => (
              <fieldset className="cms-editor-block" key={b.id}>
                <legend>
                  {i + 1}. {b.type}
                </legend>
                <GuidedField label={t("admin.blockType")}>
                  <select
                    aria-label={`${t("admin.blockType")} ${i + 1}`}
                    value={b.type}
                    onChange={(e) =>
                      block(i, { type: e.target.value as ContentBlock["type"] })
                    }
                  >
                    {[
                      "hero",
                      "text",
                      "image",
                      "cta",
                      "faq",
                      "feature-grid",
                    ].map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </GuidedField>
                {(["heading", "body", "url", "alt"] as const).map((field) => (
                  <GuidedField
                    key={field}
                    label={
                      field === "heading"
                        ? t("title")
                        : field === "body"
                          ? t("body")
                          : field === "url"
                            ? t("url")
                            : t("media.alt")
                    }
                  >
                    <textarea
                      aria-label={`${field} ${i + 1}`}
                      rows={field === "body" ? 4 : 1}
                      value={b[field] || ""}
                      onChange={(e) => block(i, { [field]: e.target.value })}
                    />
                  </GuidedField>
                ))}
                <div className="actions">
                  <button
                    className="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    {t("up")}
                  </button>
                  <button
                    className="button"
                    disabled={i === document.blocks.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    {t("down")}
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      edit({
                        ...document,
                        blocks: document.blocks.filter((_, n) => n !== i),
                      })
                    }
                  >
                    {t("remove")}
                  </button>
                </div>
              </fieldset>
            ))}
            <div className="actions">
              <button
                className="button"
                disabled={document.blocks.length >= 50}
                onClick={() =>
                  edit({
                    ...document,
                    blocks: [
                      ...document.blocks,
                      {
                        id: crypto.randomUUID(),
                        type: "text",
                        heading: "",
                        body: "",
                        url: "",
                        alt: "",
                      },
                    ],
                  })
                }
              >
                {t("admin.addBlock")}
              </button>
              <button className="button" onClick={() => setPreview(!preview)}>
                {t("admin.preview")}
              </button>
              <button
                className="button primary"
                disabled={busy || !document.title || !document.slug}
                onClick={savePage}
              >
                {busy ? t("working") : t("save")}
              </button>
              {document.id && document.status === "PUBLISHED" && (
                <a
                  className="button"
                  target="_blank"
                  rel="noreferrer"
                  href={`/pages/${document.language}/${document.slug}`}
                >
                  {t("open")}
                </a>
              )}
            </div>
            {preview && (
              <div
                className="cms-preview"
                dir={document.language === "ar" ? "rtl" : "ltr"}
              >
                <ContentBlocks blocks={document.blocks} />
              </div>
            )}
            <details>
              <summary>{t("admin.history")}</summary>
              {revisions.map((r) => (
                <div key={r.id}>
                  <time>{new Date(r.created_at).toLocaleString()}</time>
                  <button
                    className="button"
                    onClick={() =>
                      edit({ ...r.document, id: document.id, status: "DRAFT" })
                    }
                  >
                    {t("admin.restore")}
                  </button>
                </div>
              ))}
            </details>
          </section>
        </div>
      )}
      {tab === "records" && editing && (
        <RecordEditor
          entity={resource}
          row={editing}
          onDone={() => {
            setEditing(null);
            void recordList();
          }}
        />
      )}
      {tab === "logs" && (
        <OperationsLog
          rows={rows}
          total={total}
          page={page}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          setAppliedSearch={setAppliedSearch}
          loading={loading}
          reload={recordList}
        />
      )}
      {tab === "records" && (
        <section className="card">
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setAppliedSearch(search);
            }}
          >
            <select
              aria-label={t("admin.entity")}
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                setPage(0);
                setSelected([]);
                setEditing(null);
              }}
            >
              {resources.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <input
              aria-label={t("search")}
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
            />
            <button className="button">{t("search")}</button>
            <button
              type="button"
              className="button"
              onClick={exportRows}
              disabled={!rows.length}
            >
              {t("admin.export")}
            </button>
          </form>
          <p>
            {total.toLocaleString(locale)}{" "}
            {locale === "ar" ? "سجلاً" : "records"}
          </p>
          {loading ? (
            <p>{t("loading")}</p>
          ) : !rows.length ? (
            <p>{t("empty")}</p>
          ) : (
            <div className="admin-records">
              {rows.map((row, i) => (
                <article
                  key={String(row.id || row.key || i)}
                  className="admin-record"
                >
                  <div>
                    <strong>
                      {String(
                        row.display_name ||
                          row.stage_name ||
                          row.title ||
                          row.name ||
                          row.key ||
                          row.id ||
                          row.user_id ||
                          "",
                      )}
                    </strong>
                    {Object.entries(row).map(([key, value]) => (
                      <details key={key}>
                        <summary>
                          {key}:{" "}
                          {typeof value === "object"
                            ? "…"
                            : String(value ?? "").slice(0, 100)}
                        </summary>
                        <pre className="break-text">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                  <div className="actions">
                    {editableFields[resource] && (
                      <button
                        className="button"
                        onClick={() => setEditing(row)}
                      >
                        {locale === "ar" ? "تعديل" : "Edit"}
                      </button>
                    )}
                    {resource === "profiles" && (
                      <>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            action(
                              "suspend",
                              String(row.id),
                              String(!row.is_suspended),
                            )
                          }
                        >
                          {row.is_suspended
                            ? t("admin.restoreUser")
                            : t("admin.suspend")}
                        </button>
                        <select
                          aria-label={t("admin.role")}
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                        >
                          {roles.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            action("grant_role", String(row.id), role)
                          }
                        >
                          {t("admin.grant")}
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            action("revoke_role", String(row.id), role)
                          }
                        >
                          {t("admin.revokeRole")}
                        </button>
                      </>
                    )}
                    {resource === "dj_profiles" && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          action("verify_artist", String(row.id), "VERIFIED")
                        }
                      >
                        {t("admin.verify")}
                      </button>
                    )}
                    {resource === "tickets" &&
                      ["ACTIVE", "ISSUED"].includes(String(row.status)) && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            action("revoke_ticket", String(row.id), "REVOKED")
                          }
                        >
                          {t("admin.revoke")}
                        </button>
                      )}
                    {resource === "feature_flags" && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          action(
                            "feature",
                            String(row.key),
                            String(!row.enabled),
                          )
                        }
                      >
                        {row.enabled ? "ON → OFF" : "OFF → ON"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="actions">
            <button
              className="button"
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
            >
              {t("previous")}
            </button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(total / 25))}
            </span>
            <button
              className="button"
              disabled={(page + 1) * 25 >= total || loading}
              onClick={() => setPage(page + 1)}
            >
              {t("next")}
            </button>
          </div>
        </section>
      )}
      {tab === "settings" && (
        <section className="card module-form">
          <GuidedField label={t("admin.settings")} help={t("admin.configHelp")}>
            <select
              aria-label={t("admin.settings")}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            >
              {[
                "branding",
                "navigation",
                "locales",
                "email_templates",
                "notification_templates",
                "template_settings",
              ].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </GuidedField>
          <p>{t("admin.configHelp")}</p>
          <GuidedField label={t("admin.json")}>
            <textarea
              aria-label={t("admin.json")}
              rows={16}
              dir="ltr"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
            />
          </GuidedField>
          <button
            className="button primary"
            disabled={busy || loading}
            onClick={() =>
              run(async () => {
                const value = JSON.parse(config);
                const { error } = await supabase.rpc("admin_save_setting", {
                  p_key: key,
                  p_value: value,
                });
                if (error) throw error;
                setNotice(t("saved"));
              })
            }
          >
            {t("save")}
          </button>
        </section>
      )}
    </>
  );
}

function OperationsLog({
  rows,
  total,
  page,
  setPage,
  search,
  setSearch,
  setAppliedSearch,
  loading,
  reload,
}: {
  rows: Row[];
  total: number;
  page: number;
  setPage: (value: number) => void;
  search: string;
  setSearch: (value: string) => void;
  setAppliedSearch: (value: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const unresolved = rows.filter((row) => !row.resolved_at).length;
  async function resolve(id: unknown) {
    const note = prompt("Resolution note or optimization action taken") || "";
    const { error } = await supabase.rpc("resolve_operational_log", {
      p_id: id,
      p_note: note,
    });
    if (error) alert(error.message);
    else void reload();
  }
  return (
    <section className="card">
      <div className="card-title">
        <h3>Operations log</h3>
        <span>
          {unresolved} unresolved · {total.toLocaleString(locale)} total
        </span>
      </div>
      <form
        className="actions"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setAppliedSearch(search);
        }}
      >
        <input
          aria-label={t("search")}
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search error, area, route, user or context"
        />
        <button className="button">{t("search")}</button>
        <button className="button" type="button" onClick={() => void reload()}>
          {t("refresh")}
        </button>
      </form>
      {loading ? (
        <p>{t("loading")}</p>
      ) : !rows.length ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="admin-records">
          {rows.map((row, index) => (
            <article
              className={`admin-record ops-log ${String(row.level || "").toLowerCase()}`}
              key={String(row.id || index)}
            >
              <div className="card-title">
                <h3>
                  {String(row.level)} · {String(row.area)}
                </h3>
                <span>
                  {row.created_at
                    ? new Date(String(row.created_at)).toLocaleString()
                    : ""}
                </span>
              </div>
              <p className="break-text">{String(row.message || "")}</p>
              <div className="actions">
                <span className="pill">{String(row.request_path || "no route")}</span>
                <span className="pill">{row.user_id ? "user-linked" : "anonymous"}</span>
                <span className="pill">
                  {row.resolved_at ? "resolved" : "unresolved"}
                </span>
              </div>
              <details>
                <summary>Context and debug data</summary>
                <pre className="break-text">
                  {JSON.stringify(row.context || {}, null, 2)}
                </pre>
              </details>
              {!row.resolved_at && (
                <button className="button" onClick={() => resolve(row.id)}>
                  Mark resolved
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="actions">
        <button
          className="button"
          disabled={page === 0 || loading}
          onClick={() => setPage(page - 1)}
        >
          {t("previous")}
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="button"
          disabled={(page + 1) * 25 >= total || loading}
          onClick={() => setPage(page + 1)}
        >
          {t("next")}
        </button>
      </div>
    </section>
  );
}
