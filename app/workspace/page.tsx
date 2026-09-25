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

const MyInquiries = dynamic(() => import("@/modules/providers/ui/inquiries"));
const ProviderEditor = dynamic(() => import("@/modules/providers/ui/editor"));
import EventArtwork from "@/modules/events/ui/artwork-editor";
import ImageInput from "@/modules/providers/ui/image-input";
import { Visual } from "@/modules/providers/ui/visual";
import { mediaUrl } from "@/modules/providers/application/catalog";

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
  banner_url?: string;
  description?: string;
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
type OpportunityApplication = {
  id: string;
  opportunity_id: string;
  dj_profile_id: string;
  cover_note: string | null;
  proposed_fee: number | null;
  currency: string;
  status: string;
  created_at: string;
  opportunities?: { id: string; title: string; organization_id: string };
  dj_profiles?: { stage_name: string; primary_city: string | null; genres: string[] };
};
type CommunityMember = {
  community_id: string;
  user_id: string;
  status: string;
  joined_at: string | null;
  communities?: { id: string; name: string; organization_id: string };
  profiles?: { display_name: string | null; avatar_url: string | null };
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
type VendorProfile = {
  id: string;
  organization_id: string;
  capabilities: string[];
  service_categories: string[];
  service_areas: string[];
  verification_status: string;
  storefront_status: string;
};
type VendorProduct = {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  offering_type: string;
  description: string | null;
  price: number;
  currency: string;
  deposit_amount: number;
  inventory_quantity: number;
  status: string;
};
type VendorRfq = {
  id: string;
  requirement: string;
  city: string | null;
  status: string;
  created_at: string;
};
type MyItem = {
  id: string;
  item_type: string;
  title: string;
  status: string;
  resource_type: string | null;
  starts_at: string | null;
  created_at: string;
};
type Template =
  "underground" | "minimal" | "festival" | "luxury" | "experimental";
type RoleOS =
  | "artist"
  | "promoter"
  | "venue"
  | "community"
  | "fan"
  | "agency"
  | "production"
  | "vendor"
  | "staff"
  | "admin";
type Tab =
  | "inquiries"
  | "publicpage"
  | "overview"
  | "artist"
  | "epk"
  | "marketplace"
  | "bookings"
  | "promote"
  | "events"
  | "community"
  | "scanner"
  | "vendor"
  | "my"
  | "media"
  | "ai"
  | "messages"
  | "admin"
  | "wallet"
  | "guide";

const PLATFORM_DOMAIN = "cuelance.com";
const paymentProviderConfigured = false;

const workspaceDefs: Record<
  RoleOS,
  {
    label: string;
    os: string;
    promise: string;
    home: string;
    nav: Tab[];
    next: { label: string; tab: Tab }[];
    metrics: string[];
  }
> = {
  artist: {
    label: "Artist",
    os: "Career OS",
    promise: "Get booked, look credible, and turn every event into career proof.",
    home: "Profile, EPK, opportunities, bookings, money and analytics.",
    nav: ["overview", "artist", "epk", "marketplace", "bookings", "messages", "media", "ai", "wallet", "guide"],
    next: [
      { label: "Complete artist profile", tab: "artist" },
      { label: "Publish living EPK", tab: "epk" },
      { label: "Apply to opportunities", tab: "marketplace" },
    ],
    metrics: ["EPK readiness", "Applications", "Bookings", "Media vault"],
  },
  promoter: {
    label: "Promoter",
    os: "Promoter OS",
    promise: "Find talent, publish events, manage audience and control entry.",
    home: "Events, talent pipeline, ticketing, readiness, finance and analytics.",
    nav: ["overview", "promote", "marketplace", "events", "community", "vendor", "messages", "scanner", "admin", "guide"],
    next: [
      { label: "Create organization", tab: "promote" },
      { label: "Publish opportunity", tab: "promote" },
      { label: "Build event + tickets", tab: "events" },
    ],
    metrics: ["Listings", "Events", "Ticket inventory", "Entry readiness"],
  },
  venue: {
    label: "Venue",
    os: "Venue OS",
    promise: "Fill dates and make operational requirements clear before offers.",
    home: "Calendar, event requests, specs, equipment, teams and finance.",
    nav: ["overview", "promote", "events", "vendor", "messages", "admin", "guide"],
    next: [
      { label: "Create venue organization", tab: "promote" },
      { label: "Publish availability event", tab: "events" },
      { label: "Add production vendors", tab: "vendor" },
    ],
    metrics: ["Availability", "Requests", "Venue specs", "Operations"],
  },
  community: {
    label: "Community",
    os: "Community OS",
    promise: "Grow members, approve access and convert attendance into relationships.",
    home: "Members, events, forms, presales, engagement, revenue and analytics.",
    nav: ["overview", "community", "events", "my", "messages", "admin", "guide"],
    next: [
      { label: "Create community", tab: "community" },
      { label: "Publish member event", tab: "events" },
      { label: "Review member hub", tab: "my" },
    ],
    metrics: ["Members", "Requests", "Events", "Segments"],
  },
  fan: {
    label: "Fan",
    os: "Scene OS",
    promise: "Discover nights, hold tickets, follow scenes and remember experiences.",
    home: "For-you events, tickets, communities, follows and scene history.",
    nav: ["overview", "my", "marketplace", "community", "wallet", "guide"],
    next: [
      { label: "Open My Cuelance", tab: "my" },
      { label: "Save an event", tab: "my" },
      { label: "Open wallet", tab: "wallet" },
    ],
    metrics: ["Saved", "Tickets", "Communities", "History"],
  },
  agency: {
    label: "Agency",
    os: "Roster OS",
    promise: "Operate multiple artists through one pipeline and one reporting layer.",
    home: "Roster health, calendars, offers, revenue, tasks and analytics.",
    nav: ["overview", "artist", "epk", "marketplace", "promote", "messages", "admin", "guide"],
    next: [
      { label: "Set roster identity", tab: "artist" },
      { label: "Review opportunities", tab: "marketplace" },
      { label: "Open admin records", tab: "admin" },
    ],
    metrics: ["Roster", "Offers", "Calendars", "Revenue"],
  },
  production: {
    label: "Production",
    os: "Production OS",
    promise: "Run the show safely with tasks, credentials, incidents and files.",
    home: "Live mode, run-of-show, tasks, artists, production, access and incidents.",
    nav: ["overview", "events", "vendor", "scanner", "media", "messages", "admin", "guide"],
    next: [
      { label: "Select event", tab: "events" },
      { label: "Validate entry", tab: "scanner" },
      { label: "Coordinate vendors", tab: "vendor" },
    ],
    metrics: ["Run sheet", "Tasks", "Access", "Incidents"],
  },
  vendor: {
    label: "Vendor", os: "Vendor workspace", promise: "Show your products and services, and receive customer inquiries.",
    home: "Public page, offerings, quote requests and media.", nav: ["overview","publicpage","vendor","media","messages","guide"],
    next: [{label:"Build public storefront",tab:"publicpage"},{label:"Manage vendor catalog",tab:"vendor"},{label:"Upload product photos",tab:"media"}],
    metrics: ["Products","Requests","Media","Events"],
  },
  staff: {
    label: "Event professional", os: "Professional workspace", promise: "Present your experience and services, and manage authorized event entry.",
    home: "Public profile, services, event entry and messages.", nav: ["overview","publicpage","scanner","media","messages","guide"],
    next: [{label:"Build public profile",tab:"publicpage"},{label:"Open entry scanner",tab:"scanner"},{label:"Upload portfolio",tab:"media"}],
    metrics: ["Profile","Services","Entry","Media"],
  },
  admin: {
    label: "Admin",
    os: "Cuelance Command",
    promise: "Operate the network through CMS, support, trust, settings and logs.",
    home: "System health, users, organizations, marketplace, events, money, trust and CMS.",
    nav: ["overview", "admin", "guide", "messages", "media", "scanner"],
    next: [
      { label: "Open Cuelance Command", tab: "admin" },
      { label: "Inspect operations log", tab: "admin" },
      { label: "Review guide coverage", tab: "guide" },
    ],
    metrics: ["Users", "Content", "Risk", "System"],
  },
};

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
  const [activeRole, setActiveRole] = useState<RoleOS>("artist");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [dj, setDj] = useState<DJ | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [organizations,setOrganizations] = useState<Org[]>([]);
  const [canAdmin,setCanAdmin] = useState(false);
  const [epk, setEpk] = useState<Epk | null>(null);
  const [sections, setSections] = useState<
    { id: string; type: string; enabled: boolean; sort_order: number }[]
  >([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [managedApplications, setManagedApplications] = useState<OpportunityApplication[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [managedMembers, setManagedMembers] = useState<CommunityMember[]>([]);
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
    eventCover: null as string | null,
    eventDescription: "",
    venue: "",
    eventDate: "",
    communityName: "",
    ticketName: "General admission",
    ticketPrice: "100",
    ticketCapacity: "100",
    scannerToken: "",
    vendorCategories: "Sound, Lighting, F&B",
    vendorAreas: "Riyadh, Jeddah",
    productName: "Premium sound system rental",
    productCategory: "Sound",
    productType: "B2B_RENTAL",
    productPrice: "2500",
    productInventory: "3",
    rfqRequirement: "Need sound, lighting and DJ booth setup for a 300-person event.",
  });
  const [theme, setTheme] = useState<Template>("underground");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [vendorRfqs, setVendorRfqs] = useState<VendorRfq[]>([]);
  const [myItems, setMyItems] = useState<MyItem[]>([]);
  async function recordOperationalLog(
    level: "INFO" | "WARNING" | "ERROR" | "FATAL",
    area: string,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    try {
      await supabase.rpc("record_operational_log", {
        p_level: level,
        p_area: area,
        p_message: message.slice(0, 1900),
        p_context: context,
        p_request_path:
          typeof window === "undefined" ? null : window.location.pathname,
        p_user_agent:
          typeof navigator === "undefined" ? null : navigator.userAgent,
      });
    } catch {
      // Logging must never break the workflow it is observing.
    }
  }
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "wallet") setTab("wallet");
    if (requested === "publicpage") setTab("publicpage");
  }, []);
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
    const onError = (event: ErrorEvent) => {
      void recordOperationalLog("ERROR", "client.runtime", event.message, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      void recordOperationalLog("ERROR", "client.promise", "Unhandled promise rejection", {
        reason:
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason ?? "unknown"),
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`cuelance.workspace.${user.id}`);
      if (saved && saved in workspaceDefs) setActiveRole(saved as RoleOS);
      void load();
    }
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

  async function load(preferredOrg?: string) {
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
        .eq("user_id", user.id),
    ]);
    const currentDj = existingDj as DJ | null;
    const available = ((membership || []) as unknown as {organizations:Org}[]).map(m=>m.organizations).filter(Boolean);
    setOrganizations(available);
    const preferred = preferredOrg || localStorage.getItem(`cuelance.organization.${user.id}`);
    const currentOrg = available.find(o=>o.id===preferred) || available[0] || null;
    const adminAccess = await supabase.rpc("platform_admin");
    setCanAdmin(adminAccess.data === true);
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
          .select("id,type,enabled,sort_order")
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
      { data: publicProducts },
      { data: personalItems },
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
      supabase
        .from("vendor_products")
        .select("*")
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false }),
      supabase
        .from("my_cuelance_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setOpportunities((allOpportunities ?? []) as Opportunity[]);
    setEvents((allEvents ?? []) as EventItem[]);
    setCommunities((allCommunities ?? []) as Community[]);
    setVendorProducts((publicProducts ?? []) as VendorProduct[]);
    setMyItems((personalItems ?? []) as MyItem[]);
    if (currentOrg) {
      const [{data:currentVendor},{data:orgApplications},{data:orgMembers}] = await Promise.all([
        supabase.from("vendor_profiles").select("*").eq("organization_id", currentOrg.id).maybeSingle(),
        supabase.from("applications").select("*, opportunities!inner(id,title,organization_id), dj_profiles(stage_name,primary_city,genres)").eq("opportunities.organization_id",currentOrg.id).order("created_at",{ascending:false}),
        supabase.from("community_members").select("*, communities!inner(id,name,organization_id), profiles(display_name,avatar_url)").eq("communities.organization_id",currentOrg.id)
      ]);
      setVendor(currentVendor as VendorProfile | null);
      setManagedApplications((orgApplications ?? []) as unknown as OpportunityApplication[]);
      setManagedMembers((orgMembers ?? []) as unknown as CommunityMember[]);
      const { data: rfqs } = await supabase
        .from("vendor_quote_requests")
        .select("id,requirement,city,status,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setVendorRfqs((rfqs ?? []) as VendorRfq[]);
      if (currentVendor) {
        const { data: products } = await supabase
          .from("vendor_products")
          .select("*")
          .eq("vendor_id", (currentVendor as VendorProfile).id)
          .order("created_at", { ascending: false });
        setVendorProducts((products ?? []) as VendorProduct[]);
      }
    } else {
      setVendor(null);
      setVendorRfqs([]);
      setManagedApplications([]);
      setManagedMembers([]);
    }
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
    if (result.error) {
      void recordOperationalLog("WARNING", "auth", result.error.message, {
        mode,
        email,
      });
      return tell(result.error.message);
    }
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
          enabled: ["hero", "bio", "music", "gallery", "booking"].includes(
            type,
          ),
          sort_order: index,
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
  async function transitionApplication(id: string, status: string) {
    setBusy(true);
    const {error}=await supabase.rpc("transition_application",{p_application:id,p_status:status});
    setBusy(false);
    tell(error ? error.message : `Application moved to ${status.toLowerCase()}.`);
    if (!error) await load();
  }
  async function transitionBooking(id:string,status:string){
    setBusy(true);
    const {error}=await supabase.rpc("transition_booking",{p_booking:id,p_status:status});
    setBusy(false);
    tell(error?error.message:`Booking moved to ${status.toLowerCase()}.`);
    if(!error) await load();
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
        description: form.eventDescription,
        banner_url: mediaUrl(form.eventCover) || null,
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
    if (!error) await load();
  }
  async function transitionMember(communityId:string,userId:string,status:string){
    setBusy(true);
    const {error}=await supabase.rpc("transition_community_member",{p_community:communityId,p_user:userId,p_status:status});
    setBusy(false);
    tell(error?error.message:`Member moved to ${status.toLowerCase()}.`);
    if(!error) await load();
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
  const csv = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  async function saveVendorProfile() {
    if (!org) return tell("Create an organization before opening Vendor OS.");
    setBusy(true);
    const { data, error } = await supabase.rpc("upsert_vendor_profile", {
      p_organization: org.id,
      p_capabilities: ["B2B", "B2C"],
      p_categories: csv(form.vendorCategories),
      p_areas: csv(form.vendorAreas),
    });
    setBusy(false);
    if (error)
      void recordOperationalLog("ERROR", "vendor.profile", error.message, {
        organization_id: org.id,
      });
    tell(error ? error.message : `Vendor storefront saved (${String(data).slice(0, 8)}).`);
    await load();
  }
  async function createVendorProduct() {
    if (!vendor) return tell("Publish your vendor profile first.");
    setBusy(true);
    const { error } = await supabase.from("vendor_products").insert({
      vendor_id: vendor.id,
      name: form.productName,
      category: form.productCategory,
      offering_type: form.productType,
      description: "Production-ready catalog item managed from Vendor OS.",
      price: Number(form.productPrice) || 0,
      currency: "SAR",
      deposit_amount: Math.round((Number(form.productPrice) || 0) * 0.25),
      inventory_quantity: Number(form.productInventory) || 1,
      status: "ACTIVE",
    });
    setBusy(false);
    if (error)
      void recordOperationalLog("ERROR", "vendor.catalog", error.message, {
        vendor_id: vendor.id,
        product: form.productName,
      });
    tell(error ? error.message : "Vendor catalog item is live.");
    await load();
  }
  async function createRfq() {
    if (!form.rfqRequirement.trim())
      return tell("Describe what you need from vendors first.");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_vendor_rfq", {
      p_buyer_org: org?.id ?? null,
      p_requirement: form.rfqRequirement,
      p_city: form.city,
      p_needed_at: form.eventDate || null,
      p_event: selectedEventId || null,
    });
    setBusy(false);
    if (error)
      void recordOperationalLog("ERROR", "vendor.rfq", error.message, {
        organization_id: org?.id,
        requirement: form.rfqRequirement,
      });
    tell(error ? error.message : `RFQ created (${String(data).slice(0, 8)}).`);
    await load();
  }
  async function saveMyItem(title: string, itemType = "FOLLOW") {
    if (!user) return;
    const { error } = await supabase.from("my_cuelance_items").insert({
      user_id: user.id,
      item_type: itemType,
      title,
      status: "SAVED",
      metadata: { source: "workspace" },
    });
    if (error)
      void recordOperationalLog("ERROR", "my_cuelance", error.message, {
        itemType,
        title,
      });
    tell(error ? error.message : "Saved to My Cuelance.");
    await load();
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
          <a className="button small" href="/marketplace">{t("page.marketplace")}</a>
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
  const allNav: { id: Tab; label: string; tag?: string }[] = [
    { id: "overview", label: "Command center" },
    { id: "artist", label: "Artist profile" },
    { id: "epk", label: "EPK studio" },
    { id: "marketplace", label: "Marketplace" },
    { id: "promote", label: "Promoter desk" },
    { id: "events", label: "Events & tickets" },
    { id: "community", label: "Community" },
    { id: "vendor", label: "Vendor OS", tag: "V2" },
    { id: "my", label: "My Cuelance", tag: "USER" },
    { id: "scanner", label: "Entry scanner", tag: "PWA" },
    { id: "guide", label: "Guide & examples", tag: "HELP" },
    { id: "media", label: t("nav.media") },
    { id: "ai", label: t("nav.ai") },
    { id: "wallet", label: t("nav.wallet") },
    { id: "messages", label: t("nav.messages") },
    { id: "admin", label: t("nav.admin") },
  ];
  const activeWorkspace = workspaceDefs[activeRole];
  const nav = allNav.filter((item) => activeWorkspace.nav.includes(item.id) && (item.id !== "admin" || canAdmin));
  if (activeRole !== "fan" && activeRole !== "admin") nav.splice(1, 0, {id:"publicpage",label:t("page.title")});
  nav.push({id:"inquiries",label:t("page.myInquiries")});
  function switchRole(role: RoleOS) {
    setActiveRole(role);
    if (user) localStorage.setItem(`cuelance.workspace.${user.id}`, role);
    setTab("overview");
  }
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
            <Localized text={activeWorkspace.os.toUpperCase()} />
          </div>
          <div className="role-switcher" aria-label="Cuelance workspace switcher">
            {(Object.keys(workspaceDefs) as RoleOS[]).filter(role=>role!=="admin" || canAdmin).map((role) => (
              <button
                key={role}
                className={activeRole === role ? "active" : ""}
                onClick={() => switchRole(role)}
                title={workspaceDefs[role].promise}
              >
                {workspaceDefs[role].label}
              </button>
            ))}
          </div>
          {organizations.length>1 && <label className="organization-switch">{t("page.organization")}<select value={org?.id || ""} onChange={e=>{localStorage.setItem(`cuelance.organization.${user.id}`,e.target.value);setSelectedEventId("");void load(e.target.value);}}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
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
                        bookings: "طلبات الحجز",
                        promote: "مكتب المروج",
                        events: "الفعاليات والتذاكر",
                        community: "المجتمع",
                        vendor: "مساحة الموردين",
                        my: "مساحتي",
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
            <b>{activeWorkspace.os}</b>
            <span>{org ? `${org.name} connected` : activeWorkspace.home}</span>
          </div>
        </aside>
        <main className="content">
          {notice && <div className="notice floating">{notice}</div>}
          {tab === "overview" && (
            <Overview
              activeRole={activeRole}
              dj={dj}
              org={org}
              epk={epk}
              events={events}
              communities={communities}
              vendorProducts={vendorProducts}
              myItems={myItems}
              applications={applications}
              bookings={bookings}
              ownedEvents={ownedEvents}
              onNavigate={setTab}
              onRole={switchRole}
            />
          )}
          {tab === "inquiries" && <MyInquiries/>}
          {tab === "publicpage" && activeRole !== "fan" && activeRole !== "admin" && <ProviderEditor key={activeRole} role={activeRole} />}
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
            />
          )}
          {tab === "marketplace" && (
            <Marketplace
              opportunities={opportunities}
              dj={dj}
              applications={applications}
              onApply={apply}
              onTransition={transitionApplication}
            />
          )}
          {tab === "bookings" && <BookingDesk bookings={bookings} busy={busy} onTransition={transitionBooking}/>} 
          {tab === "promote" && (
            <PromoterDesk
              org={org}
              form={form}
              setForm={setForm}
              ownedOpportunities={ownedOpportunities}
              busy={busy}
              onCreateOrganization={createOrganization}
              onCreateOpportunity={createOpportunity}
              applications={managedApplications}
              onTransition={transitionApplication}
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
              onRefresh={() => {void load();}}
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
              members={managedMembers}
              onTransition={transitionMember}
            />
          )}
          {tab === "vendor" && (
            <VendorDesk
              org={org}
              vendor={vendor}
              products={vendorProducts}
              rfqs={vendorRfqs}
              form={form}
              setForm={setForm}
              busy={busy}
              onSaveVendor={saveVendorProfile}
              onCreateProduct={createVendorProduct}
              onCreateRfq={createRfq}
              onSaveItem={saveMyItem}
            />
          )}
          {tab === "my" && (
            <MyCuelance
              items={myItems}
              tickets={ticketTypes}
              events={events}
              communities={communities}
              products={vendorProducts}
              onSaveItem={saveMyItem}
            />
          )}
          {tab === "scanner" && <CameraScanner />}
          {tab === "wallet" && <Wallet />}
          {tab === "media" && <MediaLibrary epkId={epk?.id} />}
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
  activeRole,
  dj,
  org,
  epk,
  events,
  communities,
  vendorProducts,
  myItems,
  applications,
  bookings,
  ownedEvents,
  onNavigate,
  onRole,
}: any) {
  const workspace = workspaceDefs[activeRole as RoleOS];
  const readiness = [
    { label: "Identity", done: Boolean(dj || org) },
    { label: "Public presence", done: Boolean(epk?.status === "PUBLISHED" || org) },
    { label: "Transaction path", done: Boolean(applications.length || ownedEvents.length || myItems.length) },
    { label: "Operations", done: Boolean(ownedEvents.length || communities.length || vendorProducts.length) },
  ];
  return (
    <>
      <PageHeading
        eyebrow={workspace.os}
        title={`${workspace.label} cockpit`}
        description={workspace.promise}
        actionLabel={workspace.next[0]?.label}
        onAction={() => onNavigate(workspace.next[0]?.tab ?? "artist")}
      />
      <section className="os-hero card">
        <div>
          <p className="eyebrow">ROLE-NATIVE WORKSPACE</p>
          <h2>{workspace.home}</h2>
          <p>
            Cuelance is structured as one shared platform kernel rendered as
            purpose-built operating systems. Switch roles on the left to see the
            same records become different jobs-to-be-done.
          </p>
        </div>
        <div className="os-next">
          {workspace.next.map((item) => (
            <button
              className="button primary"
              key={item.label}
              onClick={() => onNavigate(item.tab)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <div className="metric-grid">
        <Metric
          label={workspace.metrics[0]}
          value={dj ? "Ready" : "Missing"}
          status={dj ? "positive" : "warn"}
        />
        <Metric
          label={workspace.metrics[1]}
          value={epk?.status === "PUBLISHED" ? "Live" : "Draft"}
          status={epk?.status === "PUBLISHED" ? "positive" : "warn"}
        />
        <Metric label={workspace.metrics[2]} value={String(applications.length + ownedEvents.length + myItems.length)} />
        <Metric label={workspace.metrics[3]} value={String(bookings.length + vendorProducts.length + communities.length)} />
        <Metric label="BRD readiness" value={`${readiness.filter((item) => item.done).length}/4`} status="positive" />
      </div>
      <div className="two-column">
        <section className="card">
          <div className="card-title">
            <h3>
              <Localized text="Workflow rail" />
            </h3>
            <span>
              <Localized text="Live data" />
            </span>
          </div>
          {readiness.map((item, index) => (
              <div className="list-row" key={item.label}>
                <div>
                  <b>{index + 1}. {item.label}</b>
                  <small>{item.done ? "Operational record exists" : "Needs setup before this role is complete"}</small>
                </div>
                <Pill value={item.done ? "READY" : "PENDING"} />
              </div>
          ))}
        </section>
        <section className="card dark-card">
          <p className="eyebrow">
            <Localized text="BRD COMPLIANCE NEXT MOVE" />
          </p>
          <h2>
            {workspace.next[0]?.label ?? "Continue setup"}
          </h2>
          <p>
            Each role must reach first value quickly: identity, public or
            organizational presence, transaction path and operational follow-up.
          </p>
          <button
            className="button light"
            onClick={() => onNavigate(workspace.next[0]?.tab ?? "artist")}
          >
            <Localized text="Continue setup" />{" "}
          </button>
        </section>
      </div>
      <section className="card os-map">
        <div className="card-title">
          <h3>Role-native operating systems</h3>
          <span>BRD v1.4 model</span>
        </div>
        <div className="os-grid">
          {(Object.keys(workspaceDefs) as RoleOS[]).map((role) => (
            <button
              key={role}
              className={`os-card ${role === activeRole ? "active" : ""}`}
              onClick={() => onRole(role)}
            >
              <b>{workspaceDefs[role].os}</b>
              <span>{workspaceDefs[role].promise}</span>
            </button>
          ))}
        </div>
      </section>
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
}: any) {
  const selected = templates.find((item) => item.id === theme)!;
  const { t } = useLocale();
  return (
    <>
      <PageHeading
        eyebrow="EPK MODULE"
        title="EPK studio"
        description="Content is stored separately from presentation, so templates can evolve without losing the artist record."
        actionLabel={busy ? "Saving…" : epk ? "Save EPK" : "Create EPK"}
        onAction={onSave}
      />
      <div className="epk-layout">
        <section className="card section-panel">
          <div className="card-title">
            <h3>
              <Localized text="Sections" />
            </h3>
            <span>
              {sections.filter((s: any) => s.enabled).length}/
              {sections.length || sectionTypes.length}{" "}
              <Localized text="active" />{" "}
            </span>
          </div>
          {sections.length ? (
            sections.map((section: any) => (
              <button
                className="section-toggle"
                onClick={() => onToggle(section)}
                key={section.id}
              >
                <span>
                  <i className={section.enabled ? "dot active" : "dot"} />
                  {section.type.replace(/_/g, " ")}
                </span>
                <small>{section.enabled ? "On" : "Off"}</small>
              </button>
            ))
          ) : (
            <Empty
              title="Create the EPK"
              body="It will generate schema-driven sections you can control."
            />
          )}
        </section>
        <section className={`epk-preview ${theme}`}>
          <div className="preview-top">
            <Pill value={epk?.status ?? "DRAFT"} />
            <span>
              <Localized text="PUBLIC EPK" />
            </span>
          </div>
          <div className="preview-copy">
            <p>{dj?.primary_city?.toUpperCase() ?? "RIYADH"}</p>
            <h1>{dj?.stage_name ?? "YOUR NAME"}</h1>
            <div className="preview-line" />
            <span>
              {dj?.short_bio ?? "Your artist narrative will appear here."}
            </span>
          </div>
          <div className="preview-footer">
            <span>{selected.label}</span>
            <span>{PLATFORM_DOMAIN}</span>
          </div>
        </section>
        <section className="card template-panel">
          <p className="eyebrow">
            <Localized text="PRESENTATION" />
          </p>
          <h3>
            <Localized text="Choose a template" />
          </h3>
          {templates.map((item) => (
            <button
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={`template-option ${theme === item.id ? "selected" : ""}`}
            >
              <b>{item.label}</b>
              <small>{item.description}</small>
            </button>
          ))}
          {epk && (
            <button className="button primary full" onClick={onPublish}>
              <Localized text="Publish EPK" />{" "}
            </button>
          )}
          {epk?.status === "PUBLISHED" && (
            <a
              className="button full epk-public-link"
              href={`/epk/${epk.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              <Localized text="Open live EPK" />{" "}
            </a>
          )}
          {epk?.status === "PUBLISHED" && (
            <a className="button full" href={`/api/v1/epks/${epk.slug}/pdf`}>
              {t("pdf.download")}
            </a>
          )}
          <p className="helper">
            <Localized text="Publishing creates an immutable publication version in the database." />{" "}
          </p>
        </section>
      </div>
    </>
  );
}
function Marketplace({ opportunities, dj, applications, onApply, onTransition }: any) {
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
      {applications.length > 0 && <section className="card workflow-board"><div className="card-title"><h2><Localized text="My applications" /></h2><span>{applications.length}</span></div><div className="workflow-list">{applications.map((application:any)=><article className="workflow-item" key={application.id}><div><b>{application.opportunities?.title || "Opportunity"}</b><small>{application.opportunities?.city || ""} · {new Date(application.created_at).toLocaleDateString()}</small></div><div className="row-actions"><Pill value={application.status}/>{["SUBMITTED","VIEWED","SHORTLISTED"].includes(application.status)&&<button className="button small" onClick={()=>onTransition(application.id,"WITHDRAWN")}><Localized text="Withdraw" /></button>}</div></article>)}</div></section>}
    </>
  );
}
function BookingDesk({bookings,busy,onTransition}:any){
  const groups=["NEW","CONTACTED","NEGOTIATING","CONFIRMED","COMPLETED"];
  const next:Record<string,{label:string,status:string}[]>={NEW:[{label:"Contacted",status:"CONTACTED"},{label:"Decline",status:"DECLINED"}],CONTACTED:[{label:"Negotiate",status:"NEGOTIATING"},{label:"Confirm",status:"CONFIRMED"},{label:"Decline",status:"DECLINED"}],NEGOTIATING:[{label:"Confirm",status:"CONFIRMED"},{label:"Decline",status:"DECLINED"}],CONFIRMED:[{label:"Complete",status:"COMPLETED"},{label:"Cancel",status:"CANCELLED"}]};
  return <><PageHeading eyebrow="BOOKING PIPELINE" title="Move enquiries into confirmed work." description="Every status change is validated and recorded. Open Messages when the requester signed in to continue the private conversation."/><div className="booking-board">{groups.map(status=><section className="booking-column" key={status}><div className="card-title"><h3>{status.replaceAll('_',' ')}</h3><span>{bookings.filter((b:any)=>b.status===status).length}</span></div>{bookings.filter((b:any)=>b.status===status).map((booking:any)=><article className="card booking-card" key={booking.id}><Pill value={booking.status}/><h3>{booking.requester_name}</h3><small>{booking.organization_name||booking.requester_email}</small><p>{booking.message}</p><dl><dt>Event</dt><dd>{booking.event_date?new Date(booking.event_date).toLocaleString():"Date not set"}</dd><dt>Location</dt><dd>{booking.city||"Not set"}</dd><dt>Budget</dt><dd>{booking.budget||"Not set"}</dd></dl><div className="workflow-actions">{(next[booking.status]||[]).map(action=><button key={action.status} className={`button small ${action.status==="DECLINED"||action.status==="CANCELLED"?"danger":""}`} disabled={busy} onClick={()=>onTransition(booking.id,action.status)}>{action.label}</button>)}</div></article>)}</section>)}<section className="booking-column"><div className="card-title"><h3>CLOSED</h3><span>{bookings.filter((b:any)=>["DECLINED","CANCELLED"].includes(b.status)).length}</span></div>{bookings.filter((b:any)=>["DECLINED","CANCELLED"].includes(b.status)).map((booking:any)=><article className="card booking-card" key={booking.id}><Pill value={booking.status}/><h3>{booking.requester_name}</h3><small>{booking.organization_name||booking.requester_email}</small></article>)}</section></div></>;
}
function PromoterDesk({
  org,
  form,
  setForm,
  ownedOpportunities,
  busy,
  onCreateOrganization,
  onCreateOpportunity,
  applications,
  onTransition,
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
        <><div className="two-column">
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
        </div><section className="card workflow-board"><div className="card-title"><div><p className="eyebrow"><Localized text="APPLICATION PIPELINE" /></p><h2><Localized text="Review and select artists" /></h2></div><span>{applications.length}</span></div>{applications.length===0?<Empty title="No applications yet" body="Applications will appear here as soon as an artist applies."/>:<div className="workflow-list">{applications.map((application:OpportunityApplication)=><article className="workflow-item application-review" key={application.id}><div><b>{application.dj_profiles?.stage_name || "Artist"}</b><small>{application.opportunities?.title} · {application.dj_profiles?.primary_city || "Location not set"}</small><p>{application.cover_note || "No cover note."}</p></div><div className="workflow-actions"><Pill value={application.status}/>{application.status==="SUBMITTED"&&<><button className="button small" onClick={()=>onTransition(application.id,"VIEWED")} disabled={busy}>Mark viewed</button><button className="button small" onClick={()=>onTransition(application.id,"SHORTLISTED")} disabled={busy}>Shortlist</button></>}{application.status==="VIEWED"&&<button className="button small" onClick={()=>onTransition(application.id,"SHORTLISTED")} disabled={busy}>Shortlist</button>}{application.status==="SHORTLISTED"&&<button className="button primary small" onClick={()=>onTransition(application.id,"SELECTED")} disabled={busy}>Select artist</button>}{["SUBMITTED","VIEWED","SHORTLISTED"].includes(application.status)&&<button className="button small danger" onClick={()=>onTransition(application.id,"DECLINED")} disabled={busy}>Decline</button>}</div></article>)}</div>}</section></>
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
  onRefresh,
  onCreateTicket,
  onTestTicket,
}: any) {
  const { t } = useLocale();
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
          <div className="visual-grid event-management-grid">{ownedEvents.map((event: EventItem)=><article className="visual-card" key={event.id}><a href={`/events/${event.slug}`}><Visual src={event.banner_url} alt={event.title}/><div className="visual-card-body"><span className="eyebrow">{event.city} · {event.status}</span><h3>{event.title}</h3><p>{event.venue} · {new Date(event.starts_at).toLocaleString()}</p><span>{t("event.public")} ↗</span></div></a><details className="event-art-edit"><summary>{t("page.edit")}</summary><EventArtwork event={event} onSaved={onRefresh}/></details></article>)}</div>
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
              <ImageInput label={t("event.cover")} value={form.eventCover} onChange={(id) => setForm({...form,eventCover:id})} />
              <label>{t("event.description")}<textarea rows={4} maxLength={6000} value={form.eventDescription} onChange={(e)=>setForm({...form,eventDescription:e.target.value})}/></label>
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
  members,
  onTransition,
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
      {org&&<section className="card workflow-board"><div className="card-title"><div><p className="eyebrow"><Localized text="MEMBERSHIP QUEUE" /></p><h2><Localized text="Review community members" /></h2></div><span>{members.length}</span></div>{members.length===0?<Empty title="No membership requests" body="New applications will appear here for review."/>:<div className="workflow-list">{members.map((member:CommunityMember)=><article className="workflow-item" key={`${member.community_id}-${member.user_id}`}><div><b>{member.profiles?.display_name || "Cuelance member"}</b><small>{member.communities?.name}</small></div><div className="workflow-actions"><Pill value={member.status}/>{member.status==="PENDING"&&<><button className="button primary small" disabled={busy} onClick={()=>onTransition(member.community_id,member.user_id,"ACTIVE")}>Approve</button><button className="button small danger" disabled={busy} onClick={()=>onTransition(member.community_id,member.user_id,"REJECTED")}>Reject</button></>}{member.status==="ACTIVE"&&<button className="button small" disabled={busy} onClick={()=>onTransition(member.community_id,member.user_id,"SUSPENDED")}>Suspend</button>}{member.status==="SUSPENDED"&&<button className="button small" disabled={busy} onClick={()=>onTransition(member.community_id,member.user_id,"ACTIVE")}>Restore</button>}</div></article>)}</div>}</section>}
    </>
  );
}
function VendorDesk({
  org,
  vendor,
  products,
  rfqs,
  form,
  setForm,
  busy,
  onSaveVendor,
  onCreateProduct,
  onCreateRfq,
  onSaveItem,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="VENDOR OS"
        title="Sell rentals, services and event supplies."
        description="Vendor OS covers B2B procurement and B2C commerce without creating another disconnected marketplace."
        actionLabel={vendor ? "Update storefront" : "Publish vendor profile"}
        onAction={onSaveVendor}
      />
      {!org && (
        <section className="card empty-wide">
          <Empty
            title="Organization required"
            body="Create an organization first, then turn it into a vendor storefront."
          />
        </section>
      )}
      {org && (
        <div className="three-column">
          <section className="card form-card">
            <p className="eyebrow">01 / STOREFRONT</p>
            <h3>{org.name}</h3>
            <Field label="Vendor categories">
              <input
                value={form.vendorCategories}
                onChange={(e) =>
                  setForm({ ...form, vendorCategories: e.target.value })
                }
                placeholder="Sound, Lighting, F&B"
              />
            </Field>
            <Field label="Service areas">
              <input
                value={form.vendorAreas}
                onChange={(e) =>
                  setForm({ ...form, vendorAreas: e.target.value })
                }
                placeholder="Riyadh, Jeddah"
              />
            </Field>
            <button className="button primary full" onClick={onSaveVendor}>
              {vendor ? "Update storefront" : "Publish vendor profile"}
            </button>
            {vendor && (
              <div className="module-note">
                {vendor.verification_status} · {vendor.storefront_status} ·{" "}
                {vendor.service_categories.join(", ")}
              </div>
            )}
          </section>
          <section className="card form-card">
            <p className="eyebrow">02 / CATALOG</p>
            <Field label="Product or service name">
              <input
                value={form.productName}
                onChange={(e) =>
                  setForm({ ...form, productName: e.target.value })
                }
              />
            </Field>
            <div className="mini-grid">
              <Field label="Category">
                <input
                  value={form.productCategory}
                  onChange={(e) =>
                    setForm({ ...form, productCategory: e.target.value })
                  }
                />
              </Field>
              <Field label="Offering type">
                <select
                  value={form.productType}
                  onChange={(e) =>
                    setForm({ ...form, productType: e.target.value })
                  }
                >
                  {[
                    "B2B_RENTAL",
                    "B2B_SERVICE",
                    "B2C_PRODUCT",
                    "B2C_EXPERIENCE",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field label="Catalog price">
                <input
                  type="number"
                  value={form.productPrice}
                  onChange={(e) =>
                    setForm({ ...form, productPrice: e.target.value })
                  }
                />
              </Field>
              <Field label="Inventory">
                <input
                  type="number"
                  value={form.productInventory}
                  onChange={(e) =>
                    setForm({ ...form, productInventory: e.target.value })
                  }
                />
              </Field>
            </div>
            <button
              className="button primary full"
              onClick={onCreateProduct}
              disabled={busy || !vendor}
            >
              Add live catalog item
            </button>
          </section>
          <section className="card form-card">
            <p className="eyebrow">03 / PROCUREMENT</p>
            <Field label="RFQ requirement">
              <textarea
                value={form.rfqRequirement}
                onChange={(e) =>
                  setForm({ ...form, rfqRequirement: e.target.value })
                }
              />
            </Field>
            <button className="button primary full" onClick={onCreateRfq}>
              Request vendor quotes
            </button>
            <p className="helper">
              RFQs are stored in the backend and also added to My Cuelance as a
              tracked form/activity item.
            </p>
          </section>
        </div>
      )}
      <div className="two-column">
        <section className="card">
          <div className="card-title">
            <h3>Marketplace catalog</h3>
            <span>{products.length}</span>
          </div>
          {products.length ? (
            products.map((product: VendorProduct) => (
              <div className="list-row" key={product.id}>
                <div>
                  <b>{product.name}</b>
                  <small>
                    {product.offering_type} · {product.category} ·{" "}
                    {currency(product.price, product.currency)}
                  </small>
                </div>
                <button
                  className="button small"
                  onClick={() => onSaveItem(product.name, "ORDER")}
                >
                  Save
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="No catalog items yet"
              body="Publish a storefront, then add B2B rental or B2C items."
            />
          )}
        </section>
        <section className="card">
          <div className="card-title">
            <h3>RFQ board</h3>
            <span>{rfqs.length}</span>
          </div>
          {rfqs.length ? (
            rfqs.map((rfq: VendorRfq) => (
              <div className="list-row" key={rfq.id}>
                <div>
                  <b>{rfq.requirement}</b>
                  <small>{rfq.city ?? "City TBC"}</small>
                </div>
                <Pill value={rfq.status} />
              </div>
            ))
          ) : (
            <Empty
              title="No RFQs yet"
              body="Create a procurement request to compare vendor responses."
            />
          )}
        </section>
      </div>
    </>
  );
}
function MyCuelance({
  items,
  events,
  communities,
  products,
  onSaveItem,
}: any) {
  return (
    <>
      <PageHeading
        eyebrow="MY CUELANCE"
        title="Your personal live-music hub."
        description="Tickets, communities, vendor orders, forms, follows and event history belong in one consumer workspace."
      />
      <div className="metric-grid">
        <Metric label="Saved activity" value={String(items.length)} />
        <Metric label="Events" value={String(events.length)} />
        <Metric label="Communities" value={String(communities.length)} />
        <Metric label="Marketplace items" value={String(products.length)} />
        <Metric label="Workspace" value="Consumer" status="positive" />
      </div>
      <div className="three-column">
        <section className="card">
          <div className="card-title">
            <h3>For you</h3>
            <span>events</span>
          </div>
          {events.slice(0, 4).map((event: EventItem) => (
            <div className="list-row" key={event.id}>
              <div>
                <b>{event.title}</b>
                <small>{event.city ?? event.venue ?? "Location TBC"}</small>
              </div>
              <button
                className="button small"
                onClick={() => onSaveItem(event.title, "EVENT")}
              >
                Save
              </button>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-title">
            <h3>Communities</h3>
            <span>member layer</span>
          </div>
          {communities.slice(0, 4).map((community: Community) => (
            <div className="list-row" key={community.id}>
              <div>
                <b>{community.name}</b>
                <small>{community.membership_mode}</small>
              </div>
              <button
                className="button small"
                onClick={() => onSaveItem(community.name, "COMMUNITY")}
              >
                Save
              </button>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-title">
            <h3>Marketplace</h3>
            <span>B2C/B2B</span>
          </div>
          {products.slice(0, 4).map((product: VendorProduct) => (
            <div className="list-row" key={product.id}>
              <div>
                <b>{product.name}</b>
                <small>{currency(product.price, product.currency)}</small>
              </div>
              <button
                className="button small"
                onClick={() => onSaveItem(product.name, "ORDER")}
              >
                Save
              </button>
            </div>
          ))}
        </section>
      </div>
      <section className="card table-card">
        <div className="card-title">
          <h3>Activity timeline</h3>
          <span>{items.length}</span>
        </div>
        {items.length ? (
          items.map((item: MyItem) => (
            <div className="list-row" key={item.id}>
              <div>
                <b>{item.title}</b>
                <small>
                  {item.item_type} · {new Date(item.created_at).toLocaleString()}
                </small>
              </div>
              <Pill value={item.status} />
            </div>
          ))
        ) : (
          <Empty
            title="No personal activity yet"
            body="Save an event, community or marketplace item to start your consumer hub."
          />
        )}
      </section>
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
  "Vendor categories": {
    tip: "List the vendor categories this storefront should be found under.",
    example: "Example: Sound, Lighting, F&B",
  },
  "Service areas": {
    tip: "Cities or markets where the vendor can operate.",
    example: "Example: Riyadh, Jeddah",
  },
  "Product or service name": {
    tip: "Name the rental, service or product buyers will request.",
    example: "Example: Premium sound system rental",
  },
  Category: {
    tip: "The marketplace category used for filtering.",
    example: "Example: Sound",
  },
  "Offering type": {
    tip: "Choose whether this is B2B rental, B2B service, B2C product or B2C experience.",
    example: "Example: B2B_RENTAL for event equipment.",
  },
  "Catalog price": {
    tip: "Reference price shown to buyers before quote or checkout.",
    example: "Example: 2500 SAR",
  },
  Inventory: {
    tip: "Available quantity for the catalog item.",
    example: "Example: 3 sound systems.",
  },
  "RFQ requirement": {
    tip: "Describe the procurement need, date, scale and specifications.",
    example: "Example: Sound, lighting and DJ booth for a 300-person event.",
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
