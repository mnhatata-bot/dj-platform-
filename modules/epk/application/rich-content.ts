export type RichLink = { label: string; url: string };
export type RichEntry = {
  title: string;
  description?: string;
  meta?: string;
  url?: string;
};
export type RichSectionContent = {
  kicker?: string;
  heading?: string;
  subheading?: string;
  text?: string;
  badges?: string[];
  entries?: RichEntry[];
  links?: RichLink[];
  asset_ids?: string[];
  callout?: string;
  qr_label?: string;
};

export const richSectionLabels: Record<string, string> = {
  hero: "Cover",
  bio: "Artist profile",
  music: "Sound + releases",
  video: "Video",
  gallery: "Live performance",
  highlights: "Buyer gets",
  press: "Credentials + press",
  events: "Past events",
  social: "Links + social",
  downloads: "Media kit downloads",
  technical_rider: "Technical rider",
  booking: "Booking formats",
  custom_content: "Custom section",
};

export const richSectionGuidance: Record<string, string> = {
  hero: "Use this as the EPK cover: city, tagline, badge line and one strong hero image.",
  bio: "Tell the story promoters should remember. Add badges such as Licensed Artist, Arabic + English, Tech House.",
  music: "Define the sound, list releases, and add active streaming or buying links.",
  video: "Add live clips, visual reels or brand-event videos.",
  gallery: "Attach stage photos, crowd photos and behind-the-scenes media.",
  highlights: "Explain what the buyer receives: set length, promo assets, visuals, rider and collaboration.",
  press: "Upload credentials, licenses, press mentions and verification material.",
  events: "Show event history, venues, brands, festivals or private rooms.",
  social: "Add contact and platform links that should stay active on the EPK and PDF.",
  downloads: "Attach press photos, logos, rider, PDF kits or zip files.",
  technical_rider: "Summarize equipment needs, booth, sound, monitors and handover notes.",
  booking: "Package the artist into bookable formats: club/festival, premium events, brand/private and DJ+visual.",
};

export function safeLinks(links?: RichLink[]) {
  return (links || []).filter((link) => isSafeExternalUrl(link.url));
}

export function isSafeExternalUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" || url.protocol === "tel:" || url.protocol === "whatsapp:";
  } catch {
    return false;
  }
}

export function normalizeContent(value: unknown): RichSectionContent {
  const content = (value && typeof value === "object" ? value : {}) as RichSectionContent;
  return {
    ...content,
    badges: Array.isArray(content.badges) ? content.badges.filter(Boolean) : [],
    entries: Array.isArray(content.entries)
      ? content.entries.filter((entry) => entry?.title || entry?.description)
      : [],
    links: Array.isArray(content.links)
      ? content.links.filter((link) => link?.label || link?.url)
      : [],
    asset_ids: Array.isArray(content.asset_ids) ? content.asset_ids.filter(Boolean) : [],
  };
}

export function defaultSectionContent(type: string, artist?: { stageName?: string; city?: string; country?: string; genre?: string; bio?: string }): RichSectionContent {
  const name = artist?.stageName || "Your Artist Name";
  const place = [artist?.city || "Riyadh", artist?.country || "Saudi Arabia"].filter(Boolean).join(" / ");
  const genre = artist?.genre || "Tech House";
  const bio = artist?.bio || "Write the concise artist story that promoters and buyers can understand in seconds.";
  const defaults: Record<string, RichSectionContent> = {
    hero: {
      kicker: place,
      heading: name,
      subheading: "Where the crowd becomes the composer.",
      text: "Official electronic press kit with active media, booking formats, contact links and downloadable assets.",
      badges: ["Licensed artist", "Arabic + English", genre],
    },
    bio: {
      kicker: "Artist profile",
      heading: "Rhythm came first.",
      subheading: name,
      text: bio,
      badges: ["Club-ready", "Brand events", "Festival format"],
    },
    music: {
      kicker: "The sound",
      heading: "Percussive roots. Electronic instinct.",
      text: "Describe the sonic identity, groove language, emotional direction and what makes the artist different in the room.",
      entries: [
        { title: "Groove", description: "Rolling low-end, tactile percussion and clean negative space." },
        { title: "Tension", description: "Layered motifs, emotional cues and controlled pressure." },
        { title: "Release", description: "Decisive transitions and high-impact payoff moments." },
      ],
      badges: [genre, "Progressive", "Afro / Latin influence"],
    },
    video: {
      kicker: "Video",
      heading: "Real rooms. Real connection.",
      text: "Attach live videos, reels, brand-event cuts or visual-performance material.",
    },
    gallery: {
      kicker: "Live performance",
      heading: "Rooms, crowds and moments.",
      text: "Attach stage photos, portraits, booth shots, crowd energy and professional press images.",
      entries: [
        { title: "Club stage", description: "Late-night programming and peak-room control." },
        { title: "Creative rooms", description: "Premium/private and brand-sensitive settings." },
        { title: "After-hours energy", description: "Focused tension, release and connection." },
      ],
    },
    highlights: {
      kicker: "Buyer gets",
      heading: "A professional, programmable artist package.",
      entries: [
        { title: "Curated set direction", description: "Set flow designed around room, brand, audience and timing." },
        { title: "Media assets", description: "Approved photos, logos, press copy and social materials." },
        { title: "Technical readiness", description: "Clear rider, handover notes and show requirements." },
      ],
    },
    press: {
      kicker: "Credentials",
      heading: "Licensed, event-ready and verifiable.",
      text: "Upload licenses, certificates, press quotes and verification material. Add expiry dates or reference numbers where useful.",
      entries: [
        { title: "Artist license", description: "Add license number and expiry date." },
        { title: "Press mention", description: "Add publication, quote or reference link." },
      ],
    },
    events: {
      kicker: "Event history",
      heading: "Places already activated.",
      entries: [
        { title: "Club / venue", description: "Add venue, city and date." },
        { title: "Brand / private", description: "Add brand type and audience size." },
      ],
    },
    social: {
      kicker: "Contact + platforms",
      heading: "Listen. Stream. Book.",
      text: "Add active links for WhatsApp, Instagram, Apple Music, Beatport, YouTube, Deezer, SoundCloud, Spotify and booking contacts.",
      links: [
        { label: "Instagram", url: "https://instagram.com/" },
        { label: "Apple Music", url: "https://music.apple.com/" },
      ],
    },
    downloads: {
      kicker: "Media kit",
      heading: "Approved files for promoters and press.",
      text: "Attach downloadable photos, logo files, PDF riders, stage plots and zip packages.",
    },
    technical_rider: {
      kicker: "Technical rider",
      heading: "Setup requirements.",
      entries: [
        { title: "Booth", description: "DJ booth, stable power and clear monitor position." },
        { title: "Audio", description: "Professional PA, booth monitor and handover line check." },
        { title: "Visuals", description: "Optional visual feed and LED/projection requirements." },
      ],
    },
    booking: {
      kicker: "Booking formats",
      heading: "Program the right experience.",
      text: "Choose the package that matches the room, audience and brand moment.",
      entries: [
        { title: "Club / festival", description: "Peak-energy DJ set with room-aware progression." },
        { title: "Premium events", description: "Luxury, corporate and private-event format." },
        { title: "DJ + visual", description: "Audio-visual performance with prepared media direction." },
      ],
      callout: "Send a structured brief and it becomes a booking inquiry in the artist dashboard.",
    },
  };
  return defaults[type] || { heading: richSectionLabels[type] || type, text: "Add content for this section." };
}
