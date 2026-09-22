"use client";
import { Localized, useLegacy } from "@/modules/localization/ui/legacy";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LanguageSwitch, useLocale } from "@/modules/localization/ui/provider";
import "./public.css";

type PublicArtist = {
  id: string;
  stage_name: string;
  short_bio: string | null;
  long_bio: string | null;
  primary_city: string | null;
  country: string | null;
  genres: string[] | null;
  languages: string[] | null;
  links: Record<string, string> | null;
  profile_image_url: string | null;
  hero_url: string | null;
  translations?: { ar?: { stage_name?: string; short_bio?: string } };
};

type PublicSection = {
  id: string;
  type: string;
  enabled: boolean;
  sort_order: number;
  visibility: string;
  content_json?: { heading?: string; text?: string; asset_ids?: string[] };
};

type PublicEpk = {
  id: string;
  title: string;
  slug: string;
  template_id:
    "underground" | "minimal" | "festival" | "luxury" | "experimental";
  seo_description: string | null;
  published_at: string | null;
  dj_profiles: PublicArtist | PublicArtist[];
  epk_sections: PublicSection[];
};

const sectionLabel: Record<string, string> = {
  hero: "Artist profile",
  bio: "Biography",
  music: "Music",
  video: "Video",
  gallery: "Gallery",
  highlights: "Highlights",
  press: "Press",
  events: "Events",
  social: "Social",
  downloads: "Downloads",
  technical_rider: "Technical rider",
  booking: "Booking",
  custom_content: "More",
};

function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function PublicEpkPage() {
  const { t, locale } = useLocale();
  const tr = useLegacy();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [epk, setEpk] = useState<PublicEpk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    eventDate: "",
    city: "",
    budget: "",
    message: "",
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function loadPublishedEpk() {
      setLoading(true);
      const { data, error: queryError } = await supabase.rpc("get_public_epk", {
        p_slug: slug,
      });
      if (cancelled) return;
      setLoading(false);
      if (queryError || !data) {
        setError("This EPK is not available.");
        return;
      }
      setEpk({
        ...data.epk,
        published_at: data.published_at,
        dj_profiles: data.dj,
        epk_sections: data.sections,
      } as PublicEpk);
    }
    void loadPublishedEpk();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const artist = useMemo(() => {
    if (!epk) return null;
    const original = Array.isArray(epk.dj_profiles)
      ? epk.dj_profiles[0]
      : epk.dj_profiles;
    return locale === "ar"
      ? {
          ...original,
          stage_name:
            original.translations?.ar?.stage_name || original.stage_name,
          short_bio: original.translations?.ar?.short_bio || original.short_bio,
          long_bio: original.translations?.ar?.short_bio || original.long_bio,
        }
      : original;
  }, [epk, locale]);
  const visibleSections = useMemo(
    () =>
      (epk?.epk_sections ?? [])
        .filter((section) => section.enabled && section.visibility === "PUBLIC")
        .sort((a, b) => a.sort_order - b.sort_order),
    [epk],
  );
  const bookingEnabled = visibleSections.some(
    (section) => section.type === "booking",
  );

  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    if (
      !artist ||
      !form.name.trim() ||
      !form.email.trim() ||
      !form.message.trim()
    ) {
      setNotice("Name, email and a short brief are required.");
      return;
    }
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase
      .from("booking_inquiries")
      .insert({
        dj_profile_id: artist.id,
        requester_user_id: auth.user?.id ?? null,
        requester_name: form.name.trim(),
        requester_email: form.email.trim(),
        organization_name: form.organization.trim() || null,
        event_date: form.eventDate
          ? new Date(form.eventDate).toISOString()
          : null,
        city: form.city.trim() || null,
        budget: form.budget.trim() || null,
        message: form.message.trim(),
      });
    setBusy(false);
    if (insertError) {
      setNotice("We could not send your booking enquiry. Please try again.");
      return;
    }
    setForm({
      name: "",
      email: "",
      organization: "",
      eventDate: "",
      city: "",
      budget: "",
      message: "",
    });
    setNotice("Your booking enquiry was sent to the artist.");
  }

  if (loading)
    return (
      <main className="public-epk-status">
        <Localized text="Loading Cuelance EPK…" />
      </main>
    );
  if (error || !epk || !artist)
    return (
      <main className="public-epk-status">
        <div>
          <b>
            <Localized text="EPK unavailable" />
          </b>
          <p>{error || "This EPK is not available."}</p>
          <a href="/">
            <Localized text="Go to Cuelance" />
          </a>
        </div>
      </main>
    );

  const socialLinks = Object.entries(artist.links ?? {}).filter(
    ([, url]) => typeof url === "string" && isSafeExternalUrl(url),
  );
  const heroImage = artist.hero_url || artist.profile_image_url;

  return (
    <main className={`public-epk ${epk.template_id}`}>
      <header className="public-epk-nav">
        <a className="public-brand" href="/">
          CUE<span>LANCE</span>
        </a>
        <div>
          <LanguageSwitch />
          <a
            className="public-print"
            href={`/api/v1/epks/${epk.slug}/pdf?language=${locale}`}
          >
            {t("pdf.download")}
          </a>
          <span>
            <Localized text="Electronic press kit" />
          </span>
        </div>
      </header>
      <section className="public-epk-hero">
        <div className="public-epk-copy">
          <p className="public-kicker">
            {[artist.primary_city, artist.country]
              .filter(Boolean)
              .join(" · ") || "Cuelance artist"}
          </p>
          <h1>{artist.stage_name}</h1>
          <p className="public-bio">
            {artist.short_bio ||
              epk.seo_description ||
              "Artist profile published on Cuelance."}
          </p>
          <div className="public-tags">
            {(artist.genres ?? []).map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          {socialLinks.length > 0 && (
            <div className="public-links">
              {socialLinks.map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="public-hero-art" aria-hidden={!heroImage}>
          {heroImage ? (
            <img src={heroImage} alt="" />
          ) : (
            <div className="public-monogram">
              {artist.stage_name.slice(0, 1)}
            </div>
          )}
        </div>
      </section>
      <section className="public-epk-details">
        <article>
          <p className="public-kicker">
            <Localized text="ABOUT" />
          </p>
          <h2>
            <Localized text="Built for the room." />
          </h2>
          <p>
            {artist.long_bio ||
              artist.short_bio ||
              "This artist has not added a long biography yet."}
          </p>
        </article>
        <article>
          <p className="public-kicker">
            <Localized text="EPK FORMAT" />
          </p>
          <h2>{epk.template_id}</h2>
          <p>
            {visibleSections
              .filter((section) => section.type !== "booking")
              .map((section) => sectionLabel[section.type] ?? section.type)
              .join(" · ") || "Artist profile"}
          </p>
          {artist.languages?.length ? (
            <p className="public-languages">
              <Localized text="Languages:" /> {artist.languages.join(", ")}
            </p>
          ) : null}
        </article>
      </section>
      {bookingEnabled && (
        <section className="public-booking" id="booking">
          <div>
            <p className="public-kicker">
              <Localized text="BOOKING" />
            </p>
            <h2>
              <Localized text="Bring" /> {artist.stage_name}{" "}
              <Localized text="to your next room." />
            </h2>
            <p>
              <Localized text="Send a structured brief. It becomes a real booking record in the artist’s Cuelance workspace." />
            </p>
          </div>
          <form onSubmit={submitBooking}>
            <label>
              <Localized text="Name" />
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label>
              <Localized text="Email" />
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label>
              <Localized text="Organization" />
              <input
                value={form.organization}
                onChange={(event) =>
                  setForm({ ...form, organization: event.target.value })
                }
              />
            </label>
            <label>
              <Localized text="Event date" />
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(event) =>
                  setForm({ ...form, eventDate: event.target.value })
                }
              />
            </label>
            <label>
              <Localized text="City" />
              <input
                value={form.city}
                onChange={(event) =>
                  setForm({ ...form, city: event.target.value })
                }
              />
            </label>
            <label>
              <Localized text="Budget" />
              <input
                value={form.budget}
                onChange={(event) =>
                  setForm({ ...form, budget: event.target.value })
                }
                placeholder="e.g. 6,000 SAR"
              />
            </label>
            <label className="public-booking-wide">
              <Localized text="Brief" />
              <textarea
                required
                value={form.message}
                onChange={(event) =>
                  setForm({ ...form, message: event.target.value })
                }
                placeholder="Venue, audience, set time and what you need from the artist."
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send booking enquiry"}
            </button>
            {notice && (
              <p className="public-notice" role="status">
                {notice}
              </p>
            )}
          </form>
        </section>
      )}
      {visibleSections
        .filter(
          (s) => s.content_json?.text || s.content_json?.asset_ids?.length,
        )
        .map((section) => (
          <section className="public-media-section" key={section.id}>
            <h2>
              {section.content_json?.heading ||
                sectionLabel[section.type] ||
                section.type}
            </h2>
            <p dir="auto">{section.content_json?.text}</p>
            <div className="public-media-grid">
              {section.content_json?.asset_ids?.map((id) => (
                <PublicAsset id={id} key={id} />
              ))}
            </div>
          </section>
        ))}
      <footer className="public-epk-footer">
        <span>
          <Localized text="Published on Cuelance" />
        </span>
        <span>
          {epk.published_at
            ? new Date(epk.published_at).toLocaleDateString()
            : "Published"}
        </span>
      </footer>
    </main>
  );
}
function PublicAsset({ id }: { id: string }) {
  const [asset, setAsset] = useState<{
    kind: string;
    metadata: { name?: string; alt?: string };
  } | null>(null);
  useEffect(() => {
    void supabase
      .from("media_assets")
      .select("kind,metadata")
      .eq("id", id)
      .eq("visibility", "PUBLIC")
      .maybeSingle()
      .then(({ data }) => setAsset(data));
  }, [id]);
  if (!asset) return null;
  const url = `/api/v1/media/${id}`;
  return (
    <figure>
      {asset.kind === "IMAGE" ? (
        <img src={url} alt={asset.metadata?.alt || ""} loading="lazy" />
      ) : asset.kind === "VIDEO" ? (
        <video controls preload="none" src={url} />
      ) : asset.kind === "AUDIO" ? (
        <audio controls preload="none" src={url} />
      ) : (
        <a href={url} target="_blank" rel="noreferrer">
          {asset.metadata?.name || asset.kind}
        </a>
      )}
      <figcaption>{asset.metadata?.alt || asset.metadata?.name}</figcaption>
    </figure>
  );
}
