export type CoachStat = {
  value: string;
  label: string;
};

export type CoachPageContent = {
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  stats: CoachStat[];
  youtubeHandle: string;
  youtubeLabel: string;
  youtubeDescription: string;
  youtubeButtonLabel: string;
  youtubeUrl: string;
  communityTitle: string;
  communityBadge: string;
  communityDescription: string;
  communityButtonLabel: string;
  communityUrl: string;
};

export const COACH_PAGE_DOC_ID = "main";
export const COACH_PAGE_COLLECTION = "coach_page";

export const DEFAULT_COACH_PAGE: CoachPageContent = {
  name: "Victor Daniels",
  role: "Writing Coach · Screenwriter · Author · Founder",
  bio: "WIT-WEB Academy founder. Serialized fiction expert. Helping writers across Nigeria, the UK, the US, and beyond turn their words into sustainable income through coaching, courses, and community.",
  photoUrl: "",
  stats: [
    { value: "2,400+", label: "Community Writers" },
    { value: "9", label: "Platforms Mastered" },
    { value: "2", label: "Flagship Courses" },
  ],
  youtubeHandle: "@CoachVictorDaniels",
  youtubeLabel: "YouTube Channel",
  youtubeDescription:
    "Free writing tutorials, platform guides, and live coaching sessions every week. Subscribe and never miss an upload.",
  youtubeButtonLabel: "▶ Subscribe on YouTube",
  youtubeUrl: "https://www.youtube.com/@CoachVictorDaniels",
  communityTitle: "WIT-WEB Community",
  communityBadge: "2,400+ Active Writers",
  communityDescription:
    "Connect with writers worldwide. Get feedback, find accountability partners, and access exclusive coaching sessions from Coach Victor.",
  communityButtonLabel: "Join the Community",
  communityUrl: "https://www.ink2wealth.com/community",
};

export function mergeCoachPage(
  stored?: Partial<CoachPageContent> | null
): CoachPageContent {
  const base = { ...DEFAULT_COACH_PAGE, ...(stored || {}) };
  return {
    ...base,
    stats:
      Array.isArray(stored?.stats) && stored.stats.length > 0
        ? stored.stats.map((s) => ({
            value: String(s?.value ?? ""),
            label: String(s?.label ?? ""),
          }))
        : DEFAULT_COACH_PAGE.stats,
  };
}
