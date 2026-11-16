export type BannerWorld = "writer" | "screenwriter" | "student" | "all";
export type BannerKind = "identity" | "announcement" | "promo" | "sponsored";

export interface WorldBanner {
  id: string;
  world: BannerWorld;
  kind: BannerKind;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  sortOrder: number;
  enabled: boolean;
  isUrgent: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorldBannerSettings {
  autoPlay: boolean;
  intervalMs: number;
  updatedAt: string;
}

export const WORLD_BANNERS_COLLECTION = "worldBanners";
export const WORLD_BANNER_SETTINGS_COLLECTION = "worldBannerSettings";
export const WORLD_BANNER_SETTINGS_DOC = "global";

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

type SeedBanner = Omit<WorldBanner, "createdAt" | "updatedAt">;

export const SEED_WORLD_BANNERS: SeedBanner[] = [
  {
    id: "writer-1",
    world: "writer",
    kind: "identity",
    title: "Write the chapter they cannot skip",
    description:
      "Manuscripts, midnight drafts, and the craft of serialized fiction — Ink2Wealth is built for novelists who ship chapters.",
    ctaLabel: "Open Writer Hub",
    ctaHref: "/dashboard?tab=writer",
    imageUrl: IMG("photo-1455390582262-044cdead277a"),
    sortOrder: 1,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "writer-2",
    world: "writer",
    kind: "identity",
    title: "Laptop open. Story moving.",
    description:
      "Draft on any device. Chapter Analyzer, Smart Edit, and Ghost Writer stay with you from first line to cliffhanger.",
    ctaLabel: "Start writing",
    ctaHref: "/dashboard?tab=writer",
    imageUrl: IMG("photo-1516414447565-b14be0adf13e"),
    sortOrder: 2,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "writer-3",
    world: "writer",
    kind: "identity",
    title: "Edit like a platform editor",
    description:
      "Professional proofreading checks — grammar, pacing, show-don't-tell — the same notes PocketFM and Dreame editors care about.",
    ctaLabel: "Try Smart Edit",
    ctaHref: "/dashboard?tab=smart-edit",
    imageUrl: IMG("photo-1456324504439-367cee3b3c32"),
    sortOrder: 3,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "writer-4",
    world: "writer",
    kind: "identity",
    title: "Books, serials, and the business of story",
    description:
      "Covers, publishing checklists, KDP and Draft2Digital — turn finished work into a product readers can buy.",
    ctaLabel: "WEALTH Engine",
    ctaHref: "/wealth",
    imageUrl: IMG("photo-1481627834876-b7833e8f5570"),
    sortOrder: 4,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "writer-5",
    world: "writer",
    kind: "identity",
    title: "Your literary community",
    description:
      "Prompts, vaults, and writers who ship together. Contests, collabs, and paid gigs land here first.",
    ctaLabel: "Writing Vault",
    ctaHref: "/dashboard?tab=writing-vault",
    imageUrl: IMG("photo-1529156069898-49953e39b3ac"),
    sortOrder: 5,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "writer-6",
    world: "writer",
    kind: "identity",
    title: "Contracts, contests, sponsored posts",
    description:
      "When a brand collaboration or writing contest opens, it rotates here. Watch this space for paid gigs and launches.",
    ctaLabel: "See opportunities",
    ctaHref: "/wealth",
    imageUrl: IMG("photo-1522202176988-66273c2fd55f"),
    sortOrder: 6,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "script-1",
    world: "screenwriter",
    kind: "identity",
    title: "From page to production",
    description:
      "Cinematic craft for Nollywood, Hollywood, and streamers — script, pitch, and get in the room.",
    ctaLabel: "Open Script Hub",
    ctaHref: "/dashboard?tab=script-hub",
    imageUrl: IMG("photo-1485846234645-a62644f84728"),
    sortOrder: 1,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "script-2",
    world: "screenwriter",
    kind: "identity",
    title: "Write the scene they film",
    description:
      "Courier Prime, scene headings, action, dialogue — Hollywood-standard formatting built into Script Editor.",
    ctaLabel: "Script Editor",
    ctaHref: "/dashboard?tab=scripts-list",
    imageUrl: IMG("photo-1516321318423-f06f85e504b3"),
    sortOrder: 2,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "script-3",
    world: "screenwriter",
    kind: "identity",
    title: "Directors, producers, the table read",
    description:
      "Industry Hub and Open Calls refresh twice daily. Filter by genre, budget, and territory — then apply.",
    ctaLabel: "Industry Hub",
    ctaHref: "/dashboard?tab=industry-hub",
    imageUrl: IMG("photo-1551836022-d5d88e9218df"),
    sortOrder: 3,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "script-4",
    world: "screenwriter",
    kind: "identity",
    title: "Cameras rolling. Script locked.",
    description:
      "Behind-the-scenes production energy — short films, collabs, and the crew that needs your pages.",
    ctaLabel: "Short Film Showcase",
    ctaHref: "/dashboard?tab=short-film-showcase",
    imageUrl: IMG("photo-1478720568477-152d9b164e26"),
    sortOrder: 4,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "script-5",
    world: "screenwriter",
    kind: "identity",
    title: "Rehearse. Pitch. Get produced.",
    description:
      "Pitch decks, query letters, and a marketplace where producers preview the first ten pages.",
    ctaLabel: "Pitch builder",
    ctaHref: "/dashboard?tab=pitch-query-builder",
    imageUrl: IMG("photo-1514306191717-452ec28c7814"),
    sortOrder: 5,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "script-6",
    world: "screenwriter",
    kind: "identity",
    title: "Festivals, gigs, brand films",
    description:
      "Sponsored briefs, festival deadlines, and paid writing gigs appear in this rotation the moment we publish them.",
    ctaLabel: "Open Calls",
    ctaHref: "/wealth/industry",
    imageUrl: IMG("photo-1493804714600-6edb1cd93080"),
    sortOrder: 6,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "student-1",
    world: "student",
    kind: "identity",
    title: "Study it. Pass it. Own your future.",
    description:
      "JAMB, university past questions, Nursing and MBBS — built for Nigerian students who mean business.",
    ctaLabel: "Open Student Hub",
    ctaHref: "/dashboard?tab=student",
    imageUrl: IMG("photo-145651308080-af98cd03c20f"),
    sortOrder: 1,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "student-2",
    world: "student",
    kind: "identity",
    title: "Exam season, handled",
    description:
      "CBT that mirrors real JAMB. Timer, mark for review, auto-submit — then drill the topics you missed.",
    ctaLabel: "JAMB practice",
    ctaHref: "/dashboard?tab=student&tool=jamb-practice",
    imageUrl: IMG("photo-1434030216411-0b793f4b4173"),
    sortOrder: 2,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "student-3",
    world: "student",
    kind: "identity",
    title: "Study groups that actually study",
    description:
      "Flashcards, planners, and past questions you can share. Learn together without losing the streak.",
    ctaLabel: "Study planner",
    ctaHref: "/dashboard?tab=student&tool=study-planner",
    imageUrl: IMG("photo-1523240795612-9a054b0db644"),
    sortOrder: 3,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "student-4",
    world: "student",
    kind: "identity",
    title: "Medicine, nursing, the wards",
    description:
      "Clinical scenarios, drug calculations, year-by-year hubs — not generic MCQs.",
    ctaLabel: "MBBS Hub",
    ctaHref: "/dashboard?tab=student&tool=mbbs-hub",
    imageUrl: IMG("photo-1576091160399-112ba8d25d1d"),
    sortOrder: 4,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "student-5",
    world: "student",
    kind: "identity",
    title: "Lectures, laptops, late nights",
    description:
      "Video finder, citations, essay writer — educational tech that keeps up with your timetable.",
    ctaLabel: "Study tools",
    ctaHref: "/dashboard?tab=student",
    imageUrl: IMG("photo-1523580846011-d3a5bc25702b"),
    sortOrder: 5,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
  {
    id: "student-6",
    world: "student",
    kind: "identity",
    title: "Scholarships, webinars, exam drops",
    description:
      "Academic opportunities and sponsored learning offers rotate here. Celebrate the pass — then take the next one.",
    ctaLabel: "See courses",
    ctaHref: "/student/courses",
    imageUrl: IMG("photo-1523050854058-8df90110c9f1"),
    sortOrder: 6,
    enabled: true,
    isUrgent: false,
    startsAt: "",
    endsAt: "",
  },
];

export const DEFAULT_BANNER_SETTINGS: WorldBannerSettings = {
  autoPlay: true,
  intervalMs: 5500,
  updatedAt: "",
};

export function normalizeBannerWorld(value: unknown): BannerWorld {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "screenwriter" || raw === "script" || raw === "screen") return "screenwriter";
  if (raw === "student") return "student";
  if (raw === "all") return "all";
  return "writer";
}

export function normalizeBannerKind(value: unknown): BannerKind {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "announcement" || raw === "promo" || raw === "sponsored") return raw;
  return "identity";
}

export function isBannerLive(banner: WorldBanner, now = Date.now()): boolean {
  if (!banner.enabled) return false;
  if (banner.startsAt) {
    const start = Date.parse(banner.startsAt);
    if (!Number.isNaN(start) && now < start) return false;
  }
  if (banner.endsAt) {
    const end = Date.parse(banner.endsAt);
    if (!Number.isNaN(end) && now > end) return false;
  }
  return true;
}

export function sortBanners(a: WorldBanner, b: WorldBanner): number {
  if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
  return (a.sortOrder || 0) - (b.sortOrder || 0);
}

export function mergeBannerSettings(
  raw?: Partial<WorldBannerSettings> | null
): WorldBannerSettings {
  const interval = Number(raw?.intervalMs);
  return {
    autoPlay: raw?.autoPlay !== false,
    intervalMs:
      Number.isFinite(interval) && interval >= 2000 ? Math.min(interval, 30000) : 5500,
    updatedAt: raw?.updatedAt || "",
  };
}
