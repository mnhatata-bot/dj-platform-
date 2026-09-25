"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LanguageSwitch, useLocale } from "@/modules/localization/ui/provider";

import {Visual} from "@/modules/providers/ui/visual";

type Section = "artists" | "events" | "opportunities" | "communities";
type Listing = {
  id: string;
  title: string;
  description: string;
  location?: string;
  slug?: string;
  banner?: string;
};
const labels: Record<Section, string> = {
  artists: "Artist EPKs",
  events: "Events",
  opportunities: "Opportunities",
  communities: "Communities",
};

export default function GuestExplore() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const label = (key: Section) =>
    ar
      ? {
          artists: "ملفات الفنانين",
          events: "الفعاليات",
          opportunities: "الفرص",
          communities: "المجتمعات",
        }[key]
      : labels[key];
  const [section, setSection] = useState<Section>("artists");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    async function load() {
      try {
        const result =
          section === "artists"
            ? await supabase
                .from("epks")
                .select("id,title,slug,seo_description")
                .eq("status", "PUBLISHED")
                .limit(100)
            : section === "events"
              ? await supabase
                  .from("events")
                  .select("id,title,description,city,slug,banner_url")
                  .in("status", ["PUBLISHED", "LIVE"])
                  .eq("visibility", "PUBLIC")
                  .limit(100)
              : section === "opportunities"
                ? await supabase
                    .from("opportunities")
                    .select("id,title,description,city")
                    .eq("status", "PUBLISHED")
                    .limit(100)
                : await supabase
                    .from("communities")
                    .select("id,name,description")
                    .eq("status", "ACTIVE")
                    .eq("visibility", "PUBLIC")
                    .limit(100);
        if (result.error) throw result.error;
        if (active)
          setItems(
            (result.data ?? []).map((row: any) => ({
              id: row.id,
              title: row.title ?? row.name,
              description: row.seo_description ?? row.description ?? "",
              location: row.city,
              slug: row.slug,
              banner: row.banner_url,
            })),
          );
      } catch {
        if (active)
          setError("We couldn’t load these listings. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [section, retry]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          CUE<span>LANCE</span>
        </div>
        <div className="actions">
          <LanguageSwitch />
          <a className="button" href="/guide">
            {ar ? "دليل المستخدم" : "User guide"}
          </a>
          <a className="button primary" href="/workspace">
            {ar ? "مساحة العمل" : "Open workspace"}
          </a>
        </div>
      </header>
      <main
        className="content"
        style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 20px" }}
      >
        <header className="page-heading">
          <div>
            <p className="eyebrow">
              {ar ? "اكتشف كيولانس" : "DISCOVER CUELANCE"}
            </p>
            <h1>
              {ar ? "اعثر على تواصلك القادم." : "Find your next connection."}
            </h1>
            <p>
              {ar
                ? "استكشف ملفات الفنانين والفعاليات والفرص والمجتمعات المنشورة."
                : "Explore published artist press kits, events, opportunities and communities."}
            </p>
          </div>
        </header>
        <div className="notice">
          {ar
            ? "التصفح متاح للجميع. سجل الدخول إلى مساحة العمل لإنشاء ملفك وإدارة أعمالك."
            : "Browsing is open to everyone. Sign in to the workspace to create your profile and manage your work."}
        </div>
        <a className="button primary" href="/marketplace">{ar?"سوق مقدمي الخدمات":"Provider marketplace"} ↗</a>
        <nav
          aria-label={ar ? "استكشف كيولانس" : "Explore Cuelance"}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            margin: "24px 0",
          }}
        >
          {(Object.keys(labels) as Section[]).map((key) => (
            <button
              key={key}
              className={`button ${section === key ? "primary" : "secondary"}`}
              aria-pressed={section === key}
              onClick={() => setSection(key)}
            >
              {label(key)}
            </button>
          ))}
        </nav>
        <section aria-live="polite" aria-busy={loading}>
          <h2>{label(section)}</h2>
          {loading ? (
            <p role="status">Loading listings…</p>
          ) : error ? (
            <div className="card">
              <p role="alert">{error}</p>
              <button
                className="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="card">
              <h3>Nothing published yet</h3>
              <p>Public listings will appear here when they are published.</p>
            </div>
          ) : (
            <div className="card-grid">
              {items.map((item) => (
                <article className="card" key={item.id}>
                  <Visual src={item.banner} alt={item.title}/>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  {item.location && <p>{item.location}</p>}
                  {section === "events" && item.slug && <a className="button primary" href={`/events/${item.slug}`}>{ar?"الفعالية والتذاكر":"Event & tickets"} ↗</a>}
                  {section === "artists" && item.slug && (
                    <a
                      className="button primary"
                      href={`/epk/${encodeURIComponent(item.slug)}`}
                    >
                      View EPK
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
