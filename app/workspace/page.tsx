"use client";
import { Localized, useLegacy } from "@/modules/localization/ui/legacy";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useId,
  cloneElement,
  isValidElement,
} from "react";
import { Help } from "@/modules/ui/guided";
import { defaultSectionContent, normalizeContent, richSectionGuidance, richSectionLabels, type RichEntry, type RichLink, type RichSectionContent } from "@/modules/epk/application/rich-content";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { LanguageSwitch, useLocale } from "@/modules/localization/ui/provider";
const CompleteGuide = dynamic(() => import("@/modules/guide/ui/guide"));
const CameraScanner = dynamic(() => import("@/modules/checkin/ui/scanner"));
const Wallet = dynamic(() => import("@/modules/ticketing/ui/wallet"));
const Writer = dynamic(() => import("@/modules/ai/ui/writer"));
const MediaLibrary = dynamic(() => import("@/modules/media/ui/library"));
const Inbox = dynamic(() => import("@/modules/messaging/ui/inbox"));
const AdminConsole = dynamic(() => import("@/modules/admin/ui/console"));

type User = { id: string; email?: string };
type DJ = {
  id: string;
  user_id: string;
  stage_name: string;
  slug: string;
  short_bio: string | null;
  primary_city: string | null;
  country: string | null;
  genres: string[];
  marketplace_visibility: boolean;
  translations?: { ar?: { stage_name?: string; short_bio?: string } };
};
type Org = { id: string; name: string; slug: string; kind: string };
type Epk = {
  id: string;
  title: string;
  slug: string;
  template_id: Template;
  status: string;
  locale: string;
  theme: Record<string, string> | null;
};
type Opportunity = {
  id: string;
  title: string;
  description: string;
  city: string | null;
  country: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  status: string;
  event_date: string | null;
  organization_id: string;
};
type EventItem = {
  id: string;
  title: string;
  slug: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  status: string;
  ticketing_enabled: boolean;
  approval_required: boolean;
  organization_id: string;
};
type Community = {
  id: string;
  name: string;
  description: string | null;
  membership_mode: string;
  status: string;
  organization_id: string;
};
type TicketType = {
  id: string;
  event_id: string;
  name: string;
  price: number;
  currency: string;
  capacity: number;
  quantity_sold: number;
  status: string;
};
type Template =
  "underground" | "minimal" | "festival" | "luxury" | "experimental";
type Tab =
  | "overview"
  | "artist"
  | "epk"
  | "marketplace"
  | "promote"
  | "events"
  | "community"
  | "scanner"
  | "media"
  | "ai"
  | "messages"
  | "admin"
  | "wallet"
  | "guide";

const PLATFORM_DOMAIN = "cuelance.com";
const paymentProviderConfigured = false;

const templates: { id: Template; label: string; description: string }[] = [
  {
    id: "underground",
    label: "Underground",
    description: "Dark, kinetic and club-first.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Editorial restraint with strong type.",
  },
  {
    id: "festival",
    label: "Festival",
    description: "High impact for big-lineup moments.",
  },
  {
    id: "luxury",
    label: "Luxury",
    description: "Premium, warm and brand-ready.",
  },
  {
    id: "experimental",
    label: "Experimental",
    description: "Art-forward and unexpected.",
  },
];
const sectionTypes = [
  "hero",
  "bio",
  "music",
  "video",
  "gallery",
  "highlights",
  "press",
  "events",
  "social",
  "downloads",
  "technical_rider",
  "booking",
];
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const currency = (value: number | null, code = "SAR") =>
  value == null
    ? "TBC"
    : new Intl.NumberFormat("en-SA", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 0,
      }).format(value);

export default function AccountWorkspace() {
  const { t, locale } = useLocale();
  const tr = useLegacy();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [dj, setDj] = useState<DJ | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [epk, setEpk] = useState<Epk | null>(null);
  const [sections, setSections] = useState<
    { id: string; type: string; enabled: boolean; visibility?: string; sort_order: number; content_json?: RichSectionContent }[]
  >([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [form, setForm] = useState({
    stageName: "",
    city: "Riyadh",
    country: "Saudi Arabia",
    bio: "",
    bioAr: "",
    stageNameAr: "",
    genre: "Tech House",
    orgName: "",
    orgKind: "PROMOTER",
    opportunityTitle: "",
    opportunityDescription: "",
    eventTitle: "",
    venue: "",
    eventDate: "",
    communityName: "",
    ticketName: "General admission",
    ticketPrice: "100",
    ticketCapacity: "100",
    scannerToken: "",
  });
  const [theme, setTheme] = useState<Template>("underground");
  const [selectedEventId, setSelectedEventId] = useState("");
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user as User | null));
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user as User | null),
    );
    return () => auth.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user]);
  const ownedEvents = useMemo(
    () => events.filter((event) => event.organization_id === org?.id),
    [events, org],
  );
  const ownedOpportunities = useMemo(
    () =>
      opportunities.filter(
        (opportunity) => opportunity.organization_id === org?.id,
      ),
    [opportunities, org],
  );

  async function load() {
    if (!user) return;
    const [{ data: existingDj }, { data: membership }] = await Promise.all([
      supabase
        .from("dj_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select("organizations(*)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);
    const currentDj = existingDj as DJ | null;
    const currentOrg = (membership as any)?.organizations as Org | null;
    setDj(currentDj);
    setOrg(currentOrg ?? null);
    if (currentDj) {
      setForm((prev) => ({
        ...prev,
        stageName: currentDj.stage_name,
        city: currentDj.primary_city ?? "",
        country: currentDj.country ?? "",
        bio: currentDj.short_bio ?? "",
        bioAr: currentDj.translations?.ar?.short_bio ?? "",
        stageNameAr: currentDj.translations?.ar?.stage_name ?? "",
        genre: currentDj.genres?.[0] ?? "Tech House",
      }));
      const [
        { data: currentEpk },
        { data: currentBookings },
        { data: currentApps },
      ] = await Promise.all([
        supabase
          .from("epks")
          .select("*")
          .eq("dj_profile_id", currentDj.id)
          .maybeSingle(),
        supabase
          .from("booking_inquiries")
          .select("*")
          .eq("dj_profile_id", currentDj.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("applications")
          .select("*, opportunities(title, city, event_date, status)")
          .eq("dj_profile_id", currentDj.id)
          .order("created_at", { ascending: false }),
      ]);
      setEpk(currentEpk as Epk | null);
      setBookings(currentBookings ?? []);
      setApplications(currentApps ?? []);
      if (currentEpk) {
        setTheme((currentEpk as Epk).template_id);
        const { data: currentSections } = await supabase
          .from("epk_sections")
          .select("id,type,enabled,visibility,sort_order,content_json")
          .eq("epk_id", (currentEpk as Epk).id)
          .order("sort_order");
        setSections(currentSections ?? []);
      } else setSections([]);
    } else {
      setEpk(null);
      setSections([]);
      setBookings([]);
      setApplications([]);
    }
    const [
      { data: allOpportunities },
      { data: allEvents },
      { data: allCommunities },
    ] = await Promise.all([
      supabase
        .from("opportunities")
        .select("*")
        .in("status", ["PUBLISHED", "CLOSED", "FILLED"])
        .order("event_date", { ascending: true }),
      supabase
        .from("events")
        .select("*")
        .in("status", ["PUBLISHED", "LIVE", "ENDED", "DRAFT"])
        .order("starts_at", { ascending: true }),
      supabase
        .from("communities")
        .select("*")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false }),
    ]);
    setOpportunities((allOpportunities ?? []) as Opportunity[]);
    setEvents((allEvents ?? []) as EventItem[]);
    setCommunities((allCommunities ?? []) as Community[]);
    const eventIds = (allEvents ?? [])
      .filter((event: any) => event.organization_id === currentOrg?.id)
      .map((event: any) => event.id);
    if (eventIds.length) {
      const { data } = await supabase
        .from("ticket_types")
        .select("*")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });
      setTicketTypes((data ?? []) as TicketType[]);
    } else setTicketTypes([]);
  }
  function tell(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 5000);
  }
  function authRedirectUrl() {
    return typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/`;
  }
  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: authRedirectUrl(),
              data: { display_name: email.split("@")[0] },
            },
          });
    setBusy(false);
    if (result.error) return tell(result.error.message);
    if (mode === "signup" && !result.data.session) {
      setVerificationEmail(email);
      return tell(
        "If this is a new email address, check for a verification email. If you already have an account, use Sign in instead.",
      );
    }
    tell("You are signed in.");
  }
  async function resendVerification() {
    const target = verificationEmail || email;
    if (!target)
      return tell("Enter the email address you used to sign up first.");
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: target,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    setBusy(false);
    tell(
      error
        ? error.message
        : "If this is a pending signup, a verification email was requested. Check spam/junk as well.",
    );
  }
  async function saveArtist() {
    if (!user || !form.stageName.trim()) return tell("Add a stage name first.");
    setBusy(true);
    const slug = `${slugify(form.stageName)}-${user.id.slice(0, 6)}`;
    const payload = {
      user_id: user.id,
      stage_name: form.stageName.trim(),
      slug,
      short_bio: form.bio,
      long_bio: form.bio,
      translations: {
        ar: { stage_name: form.stageNameAr, short_bio: form.bioAr },
      },
      primary_city: form.city,
      country: form.country,
      genres: [form.genre],
      marketplace_visibility: true,
    };
    const result = dj
      ? await supabase
          .from("dj_profiles")
          .update(payload)
          .eq("id", dj.id)
          .select()
          .single()
      : await supabase.from("dj_profiles").insert(payload).select().single();
    setBusy(false);
    tell(
      result.error
        ? result.error.message
        : dj
          ? "Artist profile saved."
          : "Artist profile created.",
    );
    await load();
  }
  async function saveEpk() {
    if (!dj) return tell("Create your artist profile first.");
    setBusy(true);
    const payload = {
      dj_profile_id: dj.id,
      title: `${dj.stage_name} EPK`,
      slug: `${dj.slug}-epk`,
      template_id: theme,
      locale: "en",
      seo_description: form.bio,
    };
    const result = epk
      ? await supabase
          .from("epks")
          .update(payload)
          .eq("id", epk.id)
          .select()
          .single()
      : await supabase.from("epks").insert(payload).select().single();
    if (!result.error && !epk) {
      const newEpk = result.data as Epk;
      await supabase.from("epk_sections").insert(
        sectionTypes.map((type, index) => ({
          epk_id: newEpk.id,
          type,
          enabled: ["hero", "bio", "music", "gallery", "booking", "press", "social", "downloads"].includes(
            type,
          ),
          sort_order: index,
          visibility: "PUBLIC",
          content_json: defaultSectionContent(type, {
            stageName: dj.stage_name,
            city: dj.primary_city ?? form.city,
            country: dj.country ?? form.country,
            genre: dj.genres?.[0] ?? form.genre,
            bio: dj.short_bio ?? form.bio,
          }),
        })),
      );
    }
    setBusy(false);
    tell(result.error ? result.error.message : "EPK saved.");
    await load();
  }
  async function publishEpk() {
    if (!epk) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("publish_epk", {
      p_epk: epk.id,
    });
    setBusy(false);
    tell(error ? error.message : `EPK published as version ${data}.`);
    await load();
  }
  async function toggleSection(section: { id: string; enabled: boolean }) {
    const { error } = await supabase
      .from("epk_sections")
      .update({ enabled: !section.enabled })
      .eq("id", section.id);
    tell(error ? error.message : "Section updated.");
    await load();
  }
  async function updateSectionContent(sectionId: string, content: RichSectionContent) {
    const { error } = await supabase
      .from("epk_sections")
      .update({ content_json: content, enabled: true, visibility: "PUBLIC" })
      .eq("id", sectionId);
    tell(error ? error.message : "EPK section saved.");
    await load();
  }
  async function createOrganization() {
    if (!form.orgName.trim()) return tell("Add an organization name.");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: form.orgName.trim(),
      p_slug: `${slugify(form.orgName)}-${user?.id.slice(0, 5)}`,
      p_kind: form.orgKind,
    });
    setBusy(false);
    tell(
      error
        ? error.message
        : `Organization created (${String(data).slice(0, 8)}).`,
    );
    await load();
  }
  async function createOpportunity() {
    if (!org || !form.opportunityTitle.trim())
      return tell("Create an organization and complete the opportunity first.");
    setBusy(true);
    const result = await supabase.from("opportunities").insert({
      organization_id: org.id,
      title: form.opportunityTitle,
      description:
        form.opportunityDescription || "Details shared with selected artists.",
      city: form.city,
      country: form.country,
      genres: [form.genre],
      performance_type: "DJ set",
      budget_min: 2500,
      budget_max: 6000,
      currency: "SAR",
      event_date: form.eventDate || null,
      status: "PUBLISHED",
    });
    setBusy(false);
    tell(result.error ? result.error.message : "Opportunity published.");
    await load();
  }
  async function apply(opportunity: Opportunity) {
    if (!dj) return tell("Create your artist profile before applying.");
    const { error } = await supabase.from("applications").insert({
      opportunity_id: opportunity.id,
      dj_profile_id: dj.id,
      cover_note: `Available for ${opportunity.title}.`,
      currency: opportunity.currency,
      status: "SUBMITTED",
    });
    tell(error ? error.message : "Application submitted.");
    await load();
  }
  async function createEvent() {
    if (!org || !form.eventTitle.trim() || !form.eventDate)
      return tell("Add an organization, event title and event date.");
    setBusy(true);
    const result = await supabase
      .from("events")
      .insert({
        organization_id: org.id,
        title: form.eventTitle,
        slug: `${slugify(form.eventTitle)}-${Date.now().toString().slice(-5)}`,
        venue: form.venue,
        city: form.city,
        country: form.country,
        timezone: "Asia/Riyadh",
        starts_at: new Date(form.eventDate).toISOString(),
        capacity: Number(form.ticketCapacity) || 100,
        status: "PUBLISHED",
        ticketing_enabled: true,
        approval_required: false,
      })
      .select()
      .single();
    setBusy(false);
    if (!result.error) setSelectedEventId((result.data as EventItem).id);
    tell(result.error ? result.error.message : "Event published.");
    await load();
  }
  async function createTicketType() {
    const eventId = selectedEventId || ownedEvents[0]?.id;
    if (!eventId) return tell("Create or select an event first.");
    setBusy(true);
    const result = await supabase.from("ticket_types").insert({
      event_id: eventId,
      name: form.ticketName,
      description: "Digital ticket with secure QR credential.",
      price: Number(form.ticketPrice) || 0,
      currency: "SAR",
      capacity: Number(form.ticketCapacity) || 100,
      status: "ACTIVE",
    });
    setBusy(false);
    tell(result.error ? result.error.message : "Ticket type is live.");
    await load();
  }
  async function createCommunity() {
    if (!org || !form.communityName.trim())
      return tell("Create an organization and name your community.");
    setBusy(true);
    const result = await supabase.from("communities").insert({
      organization_id: org.id,
      name: form.communityName,
      slug: `${slugify(form.communityName)}-${Date.now().toString().slice(-5)}`,
      description: "A curated community for event access and member updates.",
      visibility: "PUBLIC",
      membership_mode: "APPLICATION",
      status: "ACTIVE",
    });
    setBusy(false);
    tell(result.error ? result.error.message : "Community created.");
    await load();
  }
  async function requestMembership(community: Community) {
    if (!user) return;
    const { error } = await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: user.id,
      status: "PENDING",
    });
    tell(error ? error.message : "Membership request submitted.");
  }
  async function issueComplimentaryTicket(ticket: TicketType) {
    if (!user) return;
    if (Number(ticket.price) > 0)
      return tell(
        "Paid ticket checkout is unavailable until Cuelance has a verified payment provider.",
      );
    const { data, error } = await supabase.rpc("reserve_ticket", {
      p_ticket_type: ticket.id,
      p_buyer_email: user.email ?? "guest@cuelance.com",
    });
    tell(
      error
        ? error.message
        : `Complimentary ticket issued: ${String(data).slice(0, 8)}.`,
    );
    if (!error) setTab("wallet");
  }
  async function validateScan() {
    const eventId = selectedEventId || ownedEvents[0]?.id;
    if (!eventId || !form.scannerToken.trim())
      return tell("Select an event and enter a credential token.");
    setBusy(true);
    const { data, error } = await supabase.rpc("validate_ticket_checkin", {
      p_token: form.scannerToken.trim(),
      p_event: eventId,
      p_device: "web-pwa",
    });
    setBusy(false);
    tell(error ? error.message : `Scanner result: ${data}`);
  }
  async function signOut() {
    await supabase.auth.signOut();
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("cuelance.")) sessionStorage.removeItem(key);
    setUser(null);
  }

  if (!user)
    return (
      <main className="auth-shell">
        <section className="auth-intro">
          <div className="brand">
            CUE<span>LANCE</span>
          </div>
          <p className="eyebrow">
            <Localized text="THE OPERATING SYSTEM FOR LIVE MUSIC" />
          </p>
          <h1>
            <Localized text="Build your" />{" "}
            <em>
              <Localized text="career." />
            </em>
            <br />
            <Localized text="Run the" />{" "}
            <em>
              <Localized text="room." />
            </em>
          </h1>
          <p>
            <Localized text="Artist EPKs, booking discovery, promoter operations, communities and controlled entry—one connected platform." />{" "}
          </p>
          <div className="flow-note">
            <Localized text="Artist → opportunity → event → ticket → secure entry" />{" "}
          </div>
        </section>
        <form className="card auth-card" onSubmit={submitAuth}>
          <LanguageSwitch />
          <p className="eyebrow">
            <Localized text="ACCESS CUELANCE" />
          </p>
          <h2>
            {tr(mode === "login" ? "Welcome back" : "Create your account")}
          </h2>
          <label>
            <Localized text="Email" />{" "}
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <Localized text="Password" />{" "}
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {tr(
              busy
                ? "Working…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account",
            )}
          </button>
          {verificationEmail && (
            <button
              className="button secondary full"
              type="button"
              onClick={resendVerification}
              disabled={busy}
            >
              <Localized text="Resend verification email" />{" "}
            </button>
          )}
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setVerificationEmail("");
            }}
          >
            {tr(
              mode === "login"
                ? "New here? Create an account"
                : "Already have an account? Sign in",
            )}
          </button>
          {notice && <div className="notice">{notice}</div>}
        </form>
      </main>
    );
  const nav: { id: Tab; label: string; tag?: string }[] = [
    { id: "overview", label: "Command center" },
    { id: "artist", label: "Artist profile" },
    { id: "epk", label: "EPK studio" },
    { id: "marketplace", label: "Marketplace" },
    { id: "promote", label: "Promoter desk" },
    { id: "events", label: "Events & tickets" },
    { id: "community", label: "Community" },
    { id: "scanner", label: "Entry scanner", tag: "PWA" },
    { id: "guide", label: "Guide & examples", tag: "HELP" },
    { id: "media", label: t("nav.media") },
    { id: "ai", label: t("nav.ai") },
    { id: "wallet", label: t("nav.wallet") },
    { id: "messages", label: t("nav.messages") },
    { id: "admin", label: t("nav.admin") },
  ];
  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand logo-button"
          onClick={() => setTab("overview")}
        >
          CUE<span>LANCE</span>
        </button>
        <div className="top-actions">
          <LanguageSwitch />
          <button className="help-button" onClick={() => setTab("guide")}>
            <Localized text="? Guide" />{" "}
          </button>
          <span className="online">
            <i /> <Localized text="Live backend" />{" "}
          </span>
          <span className="user-email">{user.email}</span>
          <button className="icon-button" onClick={signOut} title="Sign out">
            ↗
          </button>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <div className="workspace-label">
            <Localized text="CUELANCE WORKSPACE" />
          </div>
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-button ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span>
                {locale === "ar"
                  ? (
                      {
                        overview: "لوحة التحكم",
                        artist: "ملف الفنان",
                        epk: "استوديو الملف الصحفي",
                        marketplace: "سوق الفرص",
                        promote: "مكتب المروج",
                        events: "الفعاليات والتذاكر",
                        community: "المجتمع",
                        scanner: "ماسح الدخول",
                        guide: "الدليل والأمثلة",
                      } as Record<string, string>
                    )[item.id] || item.label
                  : item.label}
              </span>
              {item.tag && <small>{item.tag}</small>}
            </button>
          ))}
          <div className="sidebar-status">
            <b>{dj ? "Artist ready" : "Artist setup"}</b>
            <span>{org ? `${org.name} connected` : "No organization yet"}</span>
          </div>
        </aside>
        <main className="content">
          {notice && <div className="notice floating">{notice}</div>}
          {tab === "overview" && (
            <Overview
              dj={dj}
              org={org}
              epk={epk}
              applications={applications}
              bookings={bookings}
              ownedEvents={ownedEvents}
              onNavigate={setTab}
            />
          )}
          {tab === "artist" && (
            <ArtistEditor
              form={form}
              setForm={setForm}
              dj={dj}
              busy={busy}
              onSave={saveArtist}
            />
          )}
          {tab === "epk" && (
            <EpkStudio
              dj={dj}
              epk={epk}
              theme={theme}
              setTheme={setTheme}
              sections={sections}
              busy={busy}
              onSave={saveEpk}
              onPublish={publishEpk}
              onToggle={toggleSection}
              onSectionSave={updateSectionContent}
            />
          )}
          {tab === "marketplace" && (
            <Marketplace
              opportunities={opportunities}
              dj={dj}
              applications={applications}
              onApply={apply}
            />
          )}
          {tab === "promote" && (
            <PromoterDesk
              org={org}
              form={form}
              setForm={setForm}
              ownedOpportunities={ownedOpportunities}
              busy={busy}
              onCreateOrganization={createOrganization}
              onCreateOpportunity={createOpportunity}
            />
          )}
          {tab === "events" && (
            <EventsDesk
              org={org}
              form={form}
              setForm={setForm}
              ownedEvents={ownedEvents}
              ticketTypes={ticketTypes}
              selectedEventId={selectedEventId}
              setSelectedEventId={setSelectedEventId}
              busy={busy}
              onCreateEvent={createEvent}
              onCreateTicket={createTicketType}
              onTestTicket={issueComplimentaryTicket}
            />
          )}
          {tab === "community" && (
            <CommunityDesk
              org={org}
              form={form}
              setForm={setForm}
              communities={communities}
              busy={busy}
              onCreate={createCommunity}
              onJoin={requestMembership}
            />
          )}
          {tab === "scanner" && <CameraScanner />}
          {tab === "wallet" && <Wallet />}
          {tab === "media" && <MediaLibrary epkId={epk?.id} onAttached={load} />}
          {tab === "ai" && (
            <Writer
              initial={locale === "ar" ? form.bioAr : form.bio}
              onAccept={(text, language) => {
                setForm({
                  ...form,
                  [language === "ar" ? "bioAr" : "bio"]: text,
                });
                setTab("artist");
                tell(t("ai.accepted"));
              }}
            />
          )}
          {tab === "messages" && <Inbox />}
          {tab === "admin" && <AdminConsole />}
          {tab === "guide" && <CompleteGuide />}
        </main>
      </div>
    </div>
  );
}

function Overview({
  dj,
  org,
  epk,
  applications,
  bookings,
  ownedEvents,
  onNavigate,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="CAREER + OPERATIONS"
        title={
          dj ? `Good evening, ${dj.stage_name}.` : "Start with your identity."
        }
        description="This is one operational record—not a collection of disconnected tools."
        actionLabel={dj ? "Open EPK studio" : "Create artist profile"}
        onAction={() => onNavigate(dj ? "epk" : "artist")}
      />
      <div className="metric-grid">
        <Metric
          label="Artist profile"
          value={dj ? "Ready" : "Missing"}
          status={dj ? "positive" : "warn"}
        />
        <Metric
          label="Published EPK"
          value={epk?.status === "PUBLISHED" ? "Live" : "Draft"}
          status={epk?.status === "PUBLISHED" ? "positive" : "warn"}
        />
        <Metric label="Applications" value={String(applications.length)} />
        <Metric label="Bookings" value={String(bookings.length)} />
        <Metric label="Your live events" value={String(ownedEvents.length)} />
      </div>
      <div className="two-column">
        <section className="card">
          <div className="card-title">
            <h3>
              <Localized text="Pipeline" />
            </h3>
            <span>
              <Localized text="Live data" />
            </span>
          </div>
          {applications.length ? (
            applications.slice(0, 5).map((application: any) => (
              <div className="list-row" key={application.id}>
                <div>
                  <b>{application.opportunities?.title ?? "Opportunity"}</b>
                  <small>
                    {application.opportunities?.city ?? "Location TBC"}
                  </small>
                </div>
                <Pill value={application.status} />
              </div>
            ))
          ) : (
            <Empty
              title="No applications yet"
              body="Your opportunity responses will land here with their current state."
            />
          )}
        </section>
        <section className="card dark-card">
          <p className="eyebrow">
            <Localized text="NEXT BEST MOVE" />
          </p>
          <h2>
            {!dj
              ? "Build the artist profile."
              : !epk
                ? "Create the first EPK."
                : !org
                  ? "Open your promoter organization."
                  : "Create an event and ticket type."}
          </h2>
          <p>
            <Localized text="A platform becomes valuable when each record leads to the next operational action." />{" "}
          </p>
          <button
            className="button light"
            onClick={() =>
              onNavigate(
                !dj ? "artist" : !epk ? "epk" : !org ? "promote" : "events",
              )
            }
          >
            <Localized text="Continue setup" />{" "}
          </button>
        </section>
      </div>
    </>
  );
}
function ArtistEditor({ form, setForm, dj, busy, onSave }: any) {
  return (
    <>
      <PageHeading
        eyebrow="ARTIST MODULE"
        title="Own the professional record."
        description="Your reusable artist data powers the public EPK, marketplace search, booking and event lineups."
        actionLabel={
          busy ? "Saving…" : dj ? "Save changes" : "Create artist profile"
        }
        onAction={onSave}
      />
      <section className="card form-card">
        <div className="form-grid">
          <Field label="Stage name">
            <input
              value={form.stageName}
              onChange={(e) => setForm({ ...form, stageName: e.target.value })}
              placeholder="e.g. Motata"
            />
          </Field>
          <Field label="Primary genre">
            <input
              value={form.genre}
              onChange={(e) => setForm({ ...form, genre: e.target.value })}
            />
          </Field>
          <Field label="Primary city">
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="Country">
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </Field>
          <Field label="Short professional bio" wide>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="The concise story promoters should understand in 15 seconds."
            />
          </Field>
          <Field label="Arabic stage name">
            <input
              dir="rtl"
              value={form.stageNameAr}
              onChange={(e) =>
                setForm({ ...form, stageNameAr: e.target.value })
              }
            />
          </Field>
          <Field label="Arabic biography" wide>
            <textarea
              dir="rtl"
              value={form.bioAr}
              onChange={(e) => setForm({ ...form, bioAr: e.target.value })}
            />
          </Field>
        </div>
        <div className="module-note">
          <Localized text="Profile ownership is enforced by the database: an artist cannot edit another DJ’s record." />{" "}
        </div>
      </section>
    </>
  );
}
function EpkStudio({
  dj,
  epk,
  theme,
  setTheme,
  sections,
  busy,
  onSave,
  onPublish,
  onToggle,
  onSectionSave,
}: any) {
  const selected = templates.find((item) => item.id === theme)!;
  const { t } = useLocale();
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [draft, setDraft] = useState<RichSectionContent>({});
  const orderedSections = [...sections].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const selectedSection = orderedSections.find((section: any) => section.id === selectedSectionId) || orderedSections[0];
  useEffect(() => {
    if (!selectedSection) return;
    setSelectedSectionId(selectedSection.id);
    setDraft(normalizeContent(selectedSection.content_json || defaultSectionContent(selectedSection.type, {
      stageName: dj?.stage_name,
      city: dj?.primary_city,
      country: dj?.country,
      genre: dj?.genres?.[0],
      bio: dj?.short_bio,
    })));
  }, [selectedSection?.id]);
  const setDraftField = (key: keyof RichSectionContent, value: any) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const parseList = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const parseLinks = (value: string): RichLink[] =>
    value.split("\n").map((line) => {
      const [label, ...rest] = line.split("|");
      return { label: (label || "").trim(), url: rest.join("|").trim() };
    }).filter((link) => link.label || link.url);
  const parseEntries = (value: string): RichEntry[] =>
    value.split("\n").map((line) => {
      const [title, description, meta, url] = line.split("|").map((item) => item?.trim() || "");
      return { title, description, meta, url };
    }).filter((entry) => entry.title || entry.description);
  const linksText = (draft.links || []).map((link) => `${link.label || ""}|${link.url || ""}`).join("\n");
  const entriesText = (draft.entries || []).map((entry) => `${entry.title || ""}|${entry.description || ""}|${entry.meta || ""}|${entry.url || ""}`).join("\n");
  return (
    <>
      <PageHeading
        eyebrow="EPK MODULE"
        title="Press-kit studio"
        description="Build the public EPK and PDF from the same saved sections: cover, profile, sound, releases, booking formats, credentials, downloads and contact links."
        actionLabel={busy ? "Saving…" : epk ? "Save EPK shell" : "Create EPK"}
        onAction={onSave}
      />
      <div className="epk-layout rich-epk-layout">
        <section className="card section-panel">
          <div className="card-title">
            <h3><Localized text="Workflow sections" /></h3>
            <span>{orderedSections.filter((s: any) => s.enabled).length}/{orderedSections.length || sectionTypes.length} <Localized text="active" /></span>
          </div>
          {orderedSections.length ? (
            orderedSections.map((section: any) => (
              <div className={`section-toggle-row ${selectedSection?.id === section.id ? "selected" : ""}`} key={section.id}>
                <button className="section-toggle" onClick={() => setSelectedSectionId(section.id)}>
                  <span><i className={section.enabled ? "dot active" : "dot"} />{richSectionLabels[section.type] || section.type.replace(/_/g, " ")}</span>
                  <small>{section.enabled ? "On" : "Off"}</small>
                </button>
                <button className="mini-action" onClick={() => onToggle(section)}>{section.enabled ? "Hide" : "Show"}</button>
              </div>
            ))
          ) : (
            <Empty title="Create the EPK" body="It will generate rich schema-driven press-kit sections." />
          )}
        </section>
        <section className="card rich-section-editor">
          {selectedSection ? (
            <>
              <p className="eyebrow">{richSectionLabels[selectedSection.type] || selectedSection.type}</p>
              <h3><Localized text="Section content" /></h3>
              <p className="helper">{richSectionGuidance[selectedSection.type] || "Add the saved content for this public EPK section."}</p>
              <div className="form-grid">
                <Field label="Kicker / small label">
                  <input value={draft.kicker || ""} onChange={(e) => setDraftField("kicker", e.target.value)} placeholder="ARTIST PROFILE" />
                </Field>
                <Field label="Heading">
                  <input value={draft.heading || ""} onChange={(e) => setDraftField("heading", e.target.value)} placeholder="Rhythm came first." />
                </Field>
                <Field label="Subheading">
                  <input value={draft.subheading || ""} onChange={(e) => setDraftField("subheading", e.target.value)} placeholder="Saudi DJ / Producer / VJ" />
                </Field>
                <Field label="Badges">
                  <textarea value={(draft.badges || []).join("\n")} onChange={(e) => setDraftField("badges", parseList(e.target.value))} />
                </Field>
                <Field label="Main copy" wide>
                  <textarea value={draft.text || ""} onChange={(e) => setDraftField("text", e.target.value)} placeholder="Write the story, sound direction, credentials or booking note." />
                </Field>
                <Field label="Entries" wide>
                  <textarea value={entriesText} onChange={(e) => setDraftField("entries", parseEntries(e.target.value))} placeholder="Club / Festival | Peak-energy DJ set | 90-120 min | https://..." />
                </Field>
                <Field label="Active links" wide>
                  <textarea value={linksText} onChange={(e) => setDraftField("links", parseLinks(e.target.value))} placeholder="Apple Music | https://music.apple.com/..." />
                </Field>
                <Field label="Callout" wide>
                  <input value={draft.callout || ""} onChange={(e) => setDraftField("callout", e.target.value)} placeholder="Send a structured brief and we will reply with availability." />
                </Field>
              </div>
              {(draft.asset_ids || []).length > 0 && (
                <div className="module-note">{draft.asset_ids?.length} media asset(s) attached. Manage uploads from the Media tab; attached public assets render in this section and the PDF.</div>
              )}
              <button className="button primary" disabled={busy} onClick={() => onSectionSave(selectedSection.id, draft)}>
                Save this section
              </button>
            </>
          ) : (
            <Empty title="Create the EPK first" body="Then each section becomes editable with examples and guidance." />
          )}
        </section>
        <section className={`epk-preview ${theme}`}>
          <div className="preview-top"><Pill value={epk?.status ?? "DRAFT"} /><span><Localized text="PUBLIC EPK" /></span></div>
          <div className="preview-copy">
            <p>{draft.kicker || dj?.primary_city?.toUpperCase() || "RIYADH"}</p>
            <h1>{draft.heading || dj?.stage_name || "YOUR NAME"}</h1>
            <div className="preview-line" />
            <span>{draft.subheading || draft.text || dj?.short_bio || "Your artist narrative will appear here."}</span>
          </div>
          <div className="preview-footer"><span>{selected.label}</span><span>{PLATFORM_DOMAIN}</span></div>
        </section>
        <section className="card template-panel">
          <p className="eyebrow"><Localized text="PRESENTATION" /></p>
          <h3><Localized text="Choose a template" /></h3>
          {templates.map((item) => (
            <button key={item.id} onClick={() => setTheme(item.id)} className={`template-option ${theme === item.id ? "selected" : ""}`}>
              <b>{item.label}</b><small>{item.description}</small>
            </button>
          ))}
          {epk && <button className="button primary full" onClick={onPublish}><Localized text="Publish EPK" /></button>}
          {epk?.status === "PUBLISHED" && <a className="button full epk-public-link" href={`/epk/${epk.slug}`} target="_blank" rel="noreferrer"><Localized text="Open live EPK" /></a>}
          {epk?.status === "PUBLISHED" && <a className="button full" href={`/api/v1/epks/${epk.slug}/pdf`}>{t("pdf.download")}</a>}
          <p className="helper"><Localized text="Publishing creates an immutable publication version in the database." /></p>
        </section>
      </div>
    </>
  );
}
function Marketplace({ opportunities, dj, applications, onApply }: any) {
  return (
    <>
      <PageHeading
        eyebrow="MARKETPLACE MODULE"
        title="Find the right rooms."
        description="Published opportunities are searchable and applications move through validated states."
      />
      <div className="filter-row">
        <span>
          <Localized text="All genres" />
        </span>
        <span>
          <Localized text="Saudi Arabia" />
        </span>
        <span>
          <Localized text="Available dates" />
        </span>
        <span>
          <Localized text="Verified promoters" />
        </span>
      </div>
      <div className="card-grid">
        {opportunities.filter((o: Opportunity) => o.status === "PUBLISHED")
          .length ? (
          opportunities
            .filter((o: Opportunity) => o.status === "PUBLISHED")
            .map((opportunity: Opportunity) => (
              <article className="card opportunity" key={opportunity.id}>
                <div className="card-title">
                  <Pill value={opportunity.status} />
                  <span>
                    {opportunity.event_date
                      ? new Date(opportunity.event_date).toLocaleDateString()
                      : "Date TBC"}
                  </span>
                </div>
                <h3>{opportunity.title}</h3>
                <p>{opportunity.description}</p>
                <div className="opportunity-meta">
                  <span>{opportunity.city ?? "Location TBC"}</span>
                  <b>
                    {currency(opportunity.budget_min, opportunity.currency)} –{" "}
                    {currency(opportunity.budget_max, opportunity.currency)}
                  </b>
                </div>
                <button
                  className="button primary full"
                  onClick={() => onApply(opportunity)}
                  disabled={
                    !dj ||
                    applications.some(
                      (a: any) => a.opportunity_id === opportunity.id,
                    )
                  }
                >
                  {!dj
                    ? "Create artist profile to apply"
                    : applications.some(
                          (a: any) => a.opportunity_id === opportunity.id,
                        )
                      ? "Applied"
                      : "Apply"}
                </button>
              </article>
            ))
        ) : (
          <section className="card empty-wide">
            <Empty
              title="No published opportunities"
              body="Promoters can create the first listing from their workspace."
            />
          </section>
        )}
      </div>
    </>
  );
}
function PromoterDesk({
  org,
  form,
  setForm,
  ownedOpportunities,
  busy,
  onCreateOrganization,
  onCreateOpportunity,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZATIONS + MARKETPLACE"
        title={org ? org.name : "Open your promoter workspace."}
        description="Organizations separate promoters, venues, agencies and brands from individual creator accounts."
      />
      {!org ? (
        <section className="card form-card narrow">
          <div className="form-grid">
            <Field label="Organization name">
              <input
                value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                placeholder="e.g. After Dark Riyadh"
              />
            </Field>
            <Field label="Organization type">
              <select
                value={form.orgKind}
                onChange={(e) => setForm({ ...form, orgKind: e.target.value })}
              >
                {[
                  "PROMOTER",
                  "VENUE",
                  "AGENCY",
                  "BRAND",
                  "EVENT_COMPANY",
                  "COMMUNITY_OPERATOR",
                ].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </Field>
          </div>
          <button
            className="button primary"
            onClick={onCreateOrganization}
            disabled={busy}
          >
            <Localized text="Create organization" />{" "}
          </button>
        </section>
      ) : (
        <div className="two-column">
          <section className="card form-card">
            <p className="eyebrow">
              <Localized text="PUBLISH OPPORTUNITY" />
            </p>
            <h3>
              <Localized text="Bring artists into the pipeline." />
            </h3>
            <Field label="Opportunity title">
              <input
                value={form.opportunityTitle}
                onChange={(e) =>
                  setForm({ ...form, opportunityTitle: e.target.value })
                }
                placeholder="Riyadh warehouse closing set"
              />
            </Field>
            <Field label="Brief">
              <textarea
                value={form.opportunityDescription}
                onChange={(e) =>
                  setForm({ ...form, opportunityDescription: e.target.value })
                }
                placeholder="Set time, music direction, experience and selection criteria."
              />
            </Field>
            <Field label="Event date">
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) =>
                  setForm({ ...form, eventDate: e.target.value })
                }
              />
            </Field>
            <button
              className="button primary"
              onClick={onCreateOpportunity}
              disabled={busy}
            >
              <Localized text="Publish opportunity" />{" "}
            </button>
          </section>
          <section className="card">
            <div className="card-title">
              <h3>
                <Localized text="Your listings" />
              </h3>
              <span>{ownedOpportunities.length}</span>
            </div>
            {ownedOpportunities.length ? (
              ownedOpportunities.map((opportunity: Opportunity) => (
                <div className="list-row" key={opportunity.id}>
                  <div>
                    <b>{opportunity.title}</b>
                    <small>{opportunity.city ?? "Location TBC"}</small>
                  </div>
                  <Pill value={opportunity.status} />
                </div>
              ))
            ) : (
              <Empty
                title="No listings yet"
                body="Create one above; its status and applications will remain auditable."
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
function EventsDesk({
  org,
  form,
  setForm,
  ownedEvents,
  ticketTypes,
  selectedEventId,
  setSelectedEventId,
  busy,
  onCreateEvent,
  onCreateTicket,
  onTestTicket,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="EVENTS + TICKETING"
        title="Build an event people can enter."
        description="Inventory, orders, tickets and entry are treated as one controlled workflow—not independent pages."
      />
      {!org ? (
        <section className="card empty-wide">
          <Empty
            title="Organization required"
            body="Create your promoter organization before publishing events or issuing tickets."
          />
        </section>
      ) : (
        <>
          <div className="event-layout">
            <section className="card form-card">
              <p className="eyebrow">
                <Localized text="01 / EVENT" />
              </p>
              <Field label="Event title">
                <input
                  value={form.eventTitle}
                  onChange={(e) =>
                    setForm({ ...form, eventTitle: e.target.value })
                  }
                  placeholder="After Dark — Opening Night"
                />
              </Field>
              <Field label="Venue">
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Venue or district"
                />
              </Field>
              <Field label="Starts at">
                <input
                  type="datetime-local"
                  value={form.eventDate}
                  onChange={(e) =>
                    setForm({ ...form, eventDate: e.target.value })
                  }
                />
              </Field>
              <button
                className="button primary"
                onClick={onCreateEvent}
                disabled={busy}
              >
                <Localized text="Publish event" />{" "}
              </button>
            </section>
            <section className="card form-card">
              <p className="eyebrow">
                <Localized text="02 / TICKET TYPE" />
              </p>
              <Field label="Event">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                >
                  <option value="">
                    <Localized text="Select event" />
                  </option>
                  {ownedEvents.map((event: EventItem) => (
                    <option value={event.id} key={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ticket name">
                <input
                  value={form.ticketName}
                  onChange={(e) =>
                    setForm({ ...form, ticketName: e.target.value })
                  }
                />
              </Field>
              <div className="mini-grid">
                <Field label="Price (SAR)">
                  <input
                    type="number"
                    value={form.ticketPrice}
                    onChange={(e) =>
                      setForm({ ...form, ticketPrice: e.target.value })
                    }
                  />
                </Field>
                <Field label="Capacity">
                  <input
                    type="number"
                    value={form.ticketCapacity}
                    onChange={(e) =>
                      setForm({ ...form, ticketCapacity: e.target.value })
                    }
                  />
                </Field>
              </div>
              <button
                className="button primary"
                onClick={onCreateTicket}
                disabled={busy}
              >
                {"Activate ticket type"}
              </button>
            </section>
          </div>
          <section className="card table-card">
            <div className="card-title">
              <h3>
                <Localized text="Ticket inventory" />
              </h3>
              <span>
                <Localized text="Transaction-protected" />
              </span>
            </div>
            {!paymentProviderConfigured && (
              <div className="module-note">
                <Localized text="Paid ticket checkout is intentionally disabled until Cuelance connects a verified payment provider. Complimentary tickets remain available and are issued as real credentials." />{" "}
              </div>
            )}
            {ticketTypes.length ? (
              ticketTypes.map((ticket: TicketType) => (
                <div className="list-row" key={ticket.id}>
                  <div>
                    <b>{ticket.name}</b>
                    <small>
                      {ticket.quantity_sold}/{ticket.capacity}{" "}
                      <Localized text="issued ·" />{" "}
                      {currency(ticket.price, ticket.currency)}
                    </small>
                  </div>
                  <div className="row-actions">
                    <Pill value={ticket.status} />
                    {Number(ticket.price) === 0 ? (
                      <button
                        className="button small"
                        onClick={() => onTestTicket(ticket)}
                      >
                        <Localized text="Issue complimentary ticket" />{" "}
                      </button>
                    ) : (
                      <span className="pill">
                        <Localized text="Checkout pending provider" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="No ticket types"
                body="Activate a ticket type after publishing an event."
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
function CommunityDesk({
  org,
  form,
  setForm,
  communities,
  busy,
  onCreate,
  onJoin,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="COMMUNITY MODULE"
        title="Turn attendance into a durable audience."
        description="Members move through an explicit pending → active workflow under organization control."
      />
      {org && (
        <section className="card create-strip">
          <div>
            <p className="eyebrow">
              <Localized text="NEW COMMUNITY" />
            </p>
            <h3>
              <Localized text="Build a member layer around your events." />
            </h3>
          </div>
          <input
            value={form.communityName}
            onChange={(e) =>
              setForm({ ...form, communityName: e.target.value })
            }
            placeholder="e.g. After Dark Residents"
          />
          <button className="button primary" onClick={onCreate} disabled={busy}>
            <Localized text="Create" />{" "}
          </button>
        </section>
      )}
      <div className="card-grid">
        {communities.length ? (
          communities.map((community: Community) => (
            <article className="card community-card" key={community.id}>
              <Pill value={community.membership_mode} />
              <h3>{community.name}</h3>
              <p>{community.description}</p>
              <small>
                <Localized text="Managed status:" /> {community.status}
              </small>
              <button className="button full" onClick={() => onJoin(community)}>
                <Localized text="Request membership" />{" "}
              </button>
            </article>
          ))
        ) : (
          <section className="card empty-wide">
            <Empty
              title="No communities yet"
              body="Create one from a promoter workspace."
            />
          </section>
        )}
      </div>
    </>
  );
}
function GuideDesk({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { t } = useLocale();
  const guides: {
    tab: Tab;
    title: string;
    action: string;
    body: string;
    example: string;
    state: string;
  }[] = [
    {
      tab: "artist",
      title: "1. Artist profile",
      action: "Create your artist profile",
      body: "Start here. This record feeds your EPK, marketplace applications and booking presence.",
      example:
        "Example: Motata · Tech House · Riyadh · 3-sentence professional bio.",
      state: "Live",
    },
    {
      tab: "epk",
      title: "2. EPK studio",
      action: "Create, configure and publish",
      body: "Choose one of five templates, turn sections on or off, save the draft, then publish to create a public EPK version.",
      example:
        "Example: Underground template with hero, bio, music, gallery and booking enabled.",
      state: "Live",
    },
    {
      tab: "marketplace",
      title: "3. Marketplace",
      action: "Apply to an opportunity",
      body: "Published opportunities appear here. Create your profile first, then apply once to each opportunity.",
      example:
        "Example: Apply to a Riyadh closing-set opportunity after checking its date and budget.",
      state: "Live",
    },
    {
      tab: "promote",
      title: "4. Promoter desk",
      action: "Create your organization and listing",
      body: "Organizations own promoter work. Create one, then publish a structured opportunity for artists to apply to.",
      example: "Example: After Dark Riyadh → PROMOTER → Warehouse Closing Set.",
      state: "Live",
    },
    {
      tab: "events",
      title: "5. Events and tickets",
      action: "Publish event → add ticket type",
      body: "Create an event with a start time, choose it in the ticket form, and activate inventory. Use price 0 to issue a real complimentary credential during testing.",
      example:
        "Example: Opening Night → General Admission → SAR 0 → capacity 100.",
      state: "Live, free tickets",
    },
    {
      tab: "community",
      title: "6. Community",
      action: "Create or request membership",
      body: "An organization can create a public application-based community. Members request access and records are stored as pending.",
      example:
        "Example: After Dark Residents, for event announcements and eligibility.",
      state: "Live",
    },
    {
      tab: "scanner",
      title: "7. Entry scanner",
      action: "Validate a credential",
      body: "Select the matching event and paste a ticket credential. Online validation prevents a credential from being admitted twice.",
      example:
        "Result: valid, already checked in, invalid, revoked or wrong event.",
      state: "Live, manual token",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="USER GUIDE"
        title="Run Cuelance from first profile to entry."
        description="Every action below writes to the live backend. Field-level info buttons show what to enter and an example."
      />
      <a className="button primary" href="/guide">
        {t("guide.full")}
      </a>
      <section className="card guide-start">
        <h2>{t("guide.newTitle")}</h2>
        <div className="actions">
          {(["media", "ai", "wallet", "messages", "admin"] as const).map(
            (id) => (
              <button
                className="button"
                key={id}
                onClick={() => onNavigate(id)}
              >
                {t(`nav.${id}`)}
              </button>
            ),
          )}
        </div>
        <p>{t("pdf.help")}</p>
      </section>
      <section className="guide-start card">
        <div>
          <p className="eyebrow">
            <Localized text="RECOMMENDED FIRST RUN" />
          </p>
          <h2>
            <Localized text="Artist profile → EPK → organization → event → complimentary ticket → scanner" />{" "}
          </h2>
          <p>
            <Localized text="Use the same demo account to explore both the artist and promoter workflow." />{" "}
          </p>
        </div>
        <button className="button primary" onClick={() => onNavigate("artist")}>
          <Localized text="Start at artist profile" />{" "}
        </button>
      </section>
      <div className="guide-grid">
        {guides.map((guide) => (
          <article className="card guide-card" key={guide.tab}>
            <div className="card-title">
              <h3>{guide.title}</h3>
              <Pill value={guide.state} />
            </div>
            <p>{guide.body}</p>
            <div className="guide-example">
              <b>
                <Localized text="Try it" />
              </b>
              <span>{guide.example}</span>
            </div>
            <button
              className="button full"
              onClick={() => onNavigate(guide.tab)}
            >
              {guide.action}
            </button>
          </article>
        ))}
      </div>
      <section className="card guide-limits">
        <h3>
          <Localized text="Current operating boundaries" />
        </h3>
        <p>
          <Localized text="Paid checkout is deliberately unavailable until a verified payment provider is connected. Offline admission is not enabled. See the complete guide for camera scanning, PDF downloads, media uploads, AI writing, Arabic, messaging and administration." />{" "}
        </p>
      </section>
    </>
  );
}
function Scanner({
  ownedEvents,
  selectedEventId,
  setSelectedEventId,
  form,
  setForm,
  busy,
  onValidate,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="ENTRY / PWA"
        title="Fast, controlled admission."
        description="The default V1 is online validation; duplicate QR scans are rejected server-side after entry."
      />
      <section className="scanner-shell">
        <div className="scanner-frame">
          <div className="scanner-corners">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span>
            <Localized text="Manual credential entry is live. Camera scanning is not enabled yet." />{" "}
          </span>
        </div>
        <section className="card scanner-control">
          <p className="eyebrow">
            <Localized text="VALIDATE CREDENTIAL" />
          </p>
          <Field label="Event">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">
                <Localized text="Select event" />
              </option>
              {ownedEvents.map((event: EventItem) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="QR credential token">
            <input
              value={form.scannerToken}
              onChange={(e) =>
                setForm({ ...form, scannerToken: e.target.value })
              }
              placeholder="Paste or scan an opaque token"
            />
          </Field>
          <button
            className="button primary full"
            onClick={onValidate}
            disabled={busy}
          >
            <Localized text="Validate entry" />{" "}
          </button>
          <p className="helper">
            <Localized text="Valid → green · already used → amber · invalid/revoked/wrong event → red." />{" "}
          </p>
        </section>
      </section>
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const tr = useLegacy();
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{tr(eyebrow)}</p>
        <h1>{tr(title)}</h1>
        <p>{tr(description)}</p>
      </div>
      {actionLabel && (
        <button className="button primary" onClick={onAction}>
          {tr(actionLabel)}
        </button>
      )}
    </header>
  );
}
const fieldHelp: Record<string, { tip: string; example: string }> = {
  "Stage name": {
    tip: "Your public professional name. It creates your profile identity.",
    example: "Example: Motata",
  },
  "Primary genre": {
    tip: "Use the genre a promoter should filter you by first.",
    example: "Example: Tech House",
  },
  "Primary city": {
    tip: "Your usual operating city, used for discovery.",
    example: "Example: Riyadh",
  },
  Country: {
    tip: "Your main country of operation.",
    example: "Example: Saudi Arabia",
  },
  "Short professional bio": {
    tip: "Write 2–4 sentences describing your sound, experience and fit.",
    example:
      "Example: Riyadh-based Tech House DJ known for high-energy late-night sets.",
  },
  "Organization name": {
    tip: "The legal or public name of the promoter, venue, agency or brand.",
    example: "Example: After Dark Riyadh",
  },
  "Organization type": {
    tip: "Choose the role that best represents this organization.",
    example: "Example: PROMOTER for an event operator",
  },
  "Opportunity title": {
    tip: "Describe the exact artist requirement.",
    example: "Example: Warehouse closing set — Riyadh",
  },
  Brief: {
    tip: "Tell artists the music direction, set time and decision criteria.",
    example:
      "Example: 90-minute peak-time Tech House set; festival experience preferred.",
  },
  "Event date": {
    tip: "The performance or opportunity date. Leave blank only when it is genuinely undecided.",
    example: "Example: 18 December, 22:00",
  },
  "Event title": {
    tip: "Use the public event name attendees will recognize.",
    example: "Example: After Dark — Opening Night",
  },
  Venue: {
    tip: "Add the venue name or district so the event can be identified later.",
    example: "Example: JAX District",
  },
  "Starts at": {
    tip: "This becomes the event’s scheduled start time.",
    example: "Example: 18 December, 21:00",
  },
  "Ticket name": {
    tip: "Name the admission product clearly.",
    example: "Example: General Admission",
  },
  "Price (SAR)": {
    tip: "Set 0 for a complimentary, testable ticket. Paid checkout stays unavailable until payment setup is complete.",
    example: "Example: 0 for a guest-list ticket",
  },
  Capacity: {
    tip: "The maximum number of tickets available for this ticket type.",
    example: "Example: 100",
  },
  Event: {
    tip: "Select the event that this ticket or scan belongs to.",
    example: "Create an event first if this list is empty.",
  },
  "QR credential token": {
    tip: "Paste the secure ticket token. Each successful scan can only be used once.",
    example: "Use a credential issued by a complimentary ticket.",
  },
};
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const help = fieldHelp[label];
  const id = useId();
  const tr = useLegacy();
  return (
    <div className={wide ? "field wide" : "field"}>
      <span>
        <label htmlFor={id}>{tr(label)}</label>
        {help && <Help text={`${tr(help.tip)} ${tr(help.example)}`} />}
      </span>
      {isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<{
              id: string;
              placeholder?: string;
            }>,
            {
              id,
              placeholder: (children.props as { placeholder?: string })
                .placeholder
                ? tr((children.props as { placeholder: string }).placeholder)
                : undefined,
            },
          )
        : children}
      {help && <small className="field-example">{tr(help.example)}</small>}
    </div>
  );
}
function Pill({ value }: { value: string }) {
  return (
    <span
      className={`pill ${value.toLowerCase().includes("publish") || value === "ACTIVE" || value === "READY" ? "good" : ""}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
function Metric({
  label,
  value,
  status = "",
}: {
  label: string;
  value: string;
  status?: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <b className={status}>{value}</b>
    </article>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  const tr = useLegacy();
  return (
    <div className="empty">
      <b>{tr(title)}</b>
      <p>{tr(body)}</p>
    </div>
  );
}
