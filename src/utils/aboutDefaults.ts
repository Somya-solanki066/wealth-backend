export interface SocialLink {
  platform: string;
  title: string;
  text: string;
  url: string;
  cta: string;
}

export interface AboutInk2WealthContent {
  // Founder Card
  founderTitle: string;
  founderText: string;
  founderStory: string;
  founderPhoto0: string;
  founderPhoto1: string;
  founderCta: string;

  // Company / CAC Card
  companyTitle: string;
  companyBadge: string;
  companyText: string;
  companyRc: string;
  companyCertificateUrl: string;
  companyCta: string;

  // Bookshelf Card (no order button in UI)
  bookShelf: string;
  bookTitle: string;
  bookKind: string;
  bookText: string;
  bookCoverUrl: string;

  // Socials
  socials: SocialLink[];

  updatedAt?: string;
}

export const ABOUT_COLLECTION = "about_ink2wealth";
export const ABOUT_DOC_ID = "main";

export const DEFAULT_ABOUT_CONTENT: AboutInk2WealthContent = {
  founderTitle: "Meet the founder",
  founderText:
    "Coach Victor Daniels is a creative director who writes. Serial fiction writer, writing coach and founder of WIT-WEB Academy.",
  founderStory: `# The Journey of Coach Victor Daniels

Coach Victor Daniels is a creative director, serial fiction architect, and writing coach who has dedicated his career to turning the art of storytelling into viable, thriving businesses for indie creators worldwide.

As the founder of WIT-WEB Academy and visionary behind Ink2Wealth, Coach Victor pioneered practical monetization blueprints tailored specifically for writers navigating global platforms like PocketFM, GoodNovel, Dreame, Amazon KDP, and beyond.

Through his masterclasses, serial writing frameworks, and intensive coaching programs, he has trained more than 2,400 authors across Nigeria, the UK, the United States, and across the globe to craft binge-worthy serialized stories, build dedicated reader fandoms, and unlock predictable royalty incomes.

### The Mission
"Your story is not just a collection of words — it is intellectual property, an asset, and a beacon for your audience. Never stop writing. Your voice is the currency of your destiny."

### Highlights & Achievements
- **2,400+ Writers Mentored**: Across 9 global platforms and digital publishing ecosystems.
- **WIT-WEB Academy**: Founded to equip indie authors and screenwriters with real-world industry skills.
- **Author of 'Coleric Charles'**: Exploring deep character-driven narratives and serialized drama.`,
  founderPhoto0: "",
  founderPhoto1: "",
  founderCta: "Read his story",

  companyTitle: "Ink to Wealth Media Limited",
  companyBadge: "Registered with the CAC",
  companyText:
    "Ink2Wealth is owned and run by Ink to Wealth Media Limited, a company registered with the CAC.",
  companyRc: "",
  companyCertificateUrl: "",
  companyCta: "View certificate",

  bookShelf: "My Bookshelf",
  bookTitle: "Coleric Charles",
  bookKind: "Ebook",
  bookText: "A new ebook by Coach Victor Daniels.",
  bookCoverUrl: "",

  socials: [
    {
      platform: "youtube",
      title: "YouTube",
      text: "@CoachVictorDaniels. Free writing lessons.",
      url: "https://www.youtube.com/@CoachVictorDaniels",
      cta: "Watch",
    },
    {
      platform: "tiktok",
      title: "TikTok",
      text: "@CoachVictorDaniels. Quick tips and behind the scenes.",
      url: "https://www.tiktok.com/@CoachVictorDaniels",
      cta: "Follow",
    },
    {
      platform: "instagram",
      title: "Instagram",
      text: "@coachvictorbolum. Updates from the writing life.",
      url: "https://www.instagram.com/coachvictorbolum",
      cta: "Follow",
    },
    {
      platform: "facebook",
      title: "Facebook",
      text: "Join the Ink2Wealth community.",
      url: "https://www.facebook.com/ink2wealth",
      cta: "Follow",
    },
    {
      platform: "linkedin",
      title: "LinkedIn",
      text: "Connect with Coach Victor and the company.",
      url: "https://www.linkedin.com/in/coachvictordaniels",
      cta: "Connect",
    },
  ],
};

export function mergeAboutContent(
  stored?: Partial<AboutInk2WealthContent> | null
): AboutInk2WealthContent {
  const base = { ...DEFAULT_ABOUT_CONTENT, ...(stored || {}) };
  return {
    ...base,
    socials:
      Array.isArray(stored?.socials) && stored.socials.length > 0
        ? stored.socials.map((s) => ({
            platform: String(s?.platform ?? ""),
            title: String(s?.title ?? ""),
            text: String(s?.text ?? ""),
            url: String(s?.url ?? ""),
            cta: String(s?.cta ?? ""),
          }))
        : DEFAULT_ABOUT_CONTENT.socials,
  };
}
