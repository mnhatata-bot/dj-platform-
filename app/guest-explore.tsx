"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Section = "artists" | "events" | "opportunities" | "communities";
type Listing = { id: string; title: string; description: string; location?: string; slug?: string };
const labels: Record<Section, string> = { artists: "Artist EPKs", events: "Events", opportunities: "Opportunities", communities: "Communities" };

export default function GuestExplore() {
  const [section, setSection] = useState<Section>("artists");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]);
    async function load() {
      try {
        const result = section === "artists"
          ? await supabase.from("epks").select("id,title,slug,seo_description").eq("status", "PUBLISHED").limit(100)
          : section === "events"
            ? await supabase.from("events").select("id,title,description,city").in("status", ["PUBLISHED", "LIVE"]).eq("visibility", "PUBLIC").limit(100)
            : section === "opportunities"
              ? await supabase.from("opportunities").select("id,title,description,city").eq("status", "PUBLISHED").limit(100)
              : await supabase.from("communities").select("id,name,description").eq("status", "ACTIVE").eq("visibility", "PUBLIC").limit(100);
        if (result.error) throw result.error;
        if (active) setItems((result.data ?? []).map((row: any) => ({ id: row.id, title: row.title ?? row.name, description: row.seo_description ?? row.description ?? "", location: row.city, slug: row.slug })));
      } catch {
        if (active) setError("We couldn’t load these listings. Please try again.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [section, retry]);

  return <div className="app">
    <header className="topbar"><div className="brand">CUE<span>LANCE</span></div><span>Guest access · No sign-in required</span></header>
    <main className="content" style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 20px" }}>
      <header className="page-heading"><div><p className="eyebrow">DISCOVER CUELANCE</p><h1>Find your next connection.</h1><p>Explore published artist press kits, events, opportunities and communities.</p></div></header>
      <div className="notice">Sign-in is temporarily unavailable. Browsing is open; creating profiles, applying, buying tickets and managing records require an account and are unavailable in guest access.</div>
      <nav aria-label="Explore Cuelance" style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "24px 0" }}>{(Object.keys(labels) as Section[]).map(key => <button key={key} className={`button ${section === key ? "primary" : "secondary"}`} aria-pressed={section === key} onClick={() => setSection(key)}>{labels[key]}</button>)}</nav>
      <section aria-live="polite" aria-busy={loading}>
        <h2>{labels[section]}</h2>
        {loading ? <p role="status">Loading listings…</p> : error ? <div className="card"><p role="alert">{error}</p><button className="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : items.length === 0 ? <div className="card"><h3>Nothing published yet</h3><p>Public listings will appear here when they are published.</p></div> : <div className="card-grid">{items.map(item => <article className="card" key={item.id}><h3>{item.title}</h3><p>{item.description}</p>{item.location && <p>{item.location}</p>}{section === "artists" && item.slug && <a className="button primary" href={`/epk/${encodeURIComponent(item.slug)}`}>View EPK</a>}</article>)}</div>}
      </section>
    </main>
  </div>;
}
