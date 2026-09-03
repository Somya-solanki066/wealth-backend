export type LandingCourseId = "witweb" | "ssg";

export type LearnPoint = {
  icon: string;
  title: string;
  desc: string;
};

export type CoachStat = {
  value: string;
  label: string;
};

export type LandingCourse = {
  id: LandingCourseId;
  sectionLabel: string;
  title: string;
  bannerEmoji: string;
  bannerGradient: string;
  kicker: string;
  courseName: string;
  description: string;
  tags: string[];
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  miniCreatorLabel: string;
  miniCreatorBio: string;
  learnHeading: string;
  learnPoints: LearnPoint[];
  dividerSubtitle: string;
  coachSectionLabel: string;
  coachHeading: string;
  coachName: string;
  coachRole: string;
  coachBio: string;
  coachPhotoUrl: string;
  coachPhotoEmoji: string;
  coachAvatarGradient: string;
  stats: CoachStat[];
  youtubeHandle: string;
  youtubeUrl: string;
  coachEnrollLabel: string;
  coachEnrollHref: string;
  coachYoutubeButtonLabel: string;
};

export const COURSE_IDS: LandingCourseId[] = ["witweb", "ssg"];

export function isValidCourseId(id: string): id is LandingCourseId {
  return COURSE_IDS.includes(id as LandingCourseId);
}

export const DEFAULT_LANDING_COURSES: Record<LandingCourseId, LandingCourse> = {
  witweb: {
    id: "witweb",
    sectionLabel: "Flagship Course",
    title: "WIT-WEB Academy",
    bannerEmoji: "📖",
    bannerGradient: "linear-gradient(135deg,#1a1200,#2e2000)",
    kicker: "WIT-WEB Academy",
    courseName: "Webnoveling Ink to Wealth Blueprint",
    description:
      "The complete guide to writing, publishing, and earning from serialized fiction on all 9 major platforms. Real editor standards. Real income strategies.",
    tags: ["12 Modules", "48 Lessons", "9 Platforms", "Lifetime Access"],
    primaryCtaLabel: "Enroll Now — ₦35,000",
    primaryCtaHref: "/witweb-landing",
    secondaryCtaLabel: "Get Bundle with App — ₦55,000",
    secondaryCtaHref: "/witweb-landing",
    miniCreatorLabel: "Victor Daniels — Course Creator",
    miniCreatorBio:
      "Teaching from live publishing experience on PocketFM, Dreame, GoodNovel and more. Real contracts. Real editors. Real income.",
    learnHeading: "What You Will Learn",
    learnPoints: [
      {
        icon: "📖",
        title: "How Each Platform Works",
        desc: "What PocketFM, Dreame, GoodNovel, WebNovel and 5 more platforms specifically want.",
      },
      {
        icon: "🎯",
        title: "Chapters That Convert",
        desc: "Hooks, tension, and cliffhangers that make readers pay to unlock every time.",
      },
      {
        icon: "📝",
        title: "Platform Submission and Contracts",
        desc: "Exact steps to submit, what editors want, and how to negotiate your contract.",
      },
      {
        icon: "💰",
        title: "Earning Consistently",
        desc: "How payment works on each platform and how to build a sustainable writing income.",
      },
    ],
    dividerSubtitle:
      "Go deeper with our flagship courses. Use the app to practise. Take the course to master it.",
    coachSectionLabel: "Your Coach",
    coachHeading: "Meet Coach Victor Daniels",
    coachName: "Victor Daniels",
    coachRole:
      "Serialized Fiction Expert · Writing Coach · Founder, Ink2Wealth Media Limited",
    coachBio:
      "Contracted author on PocketFM, Dreame, and GoodNovel. Founder of WIT-WEB Academy and coach to 2,400+ writers worldwide. Everything he teaches comes from live publishing experience — real contracts, real editors, real income.",
    coachPhotoUrl: "",
    coachPhotoEmoji: "👨‍🏫",
    coachAvatarGradient: "linear-gradient(135deg,#1e1500,#2a1e00)",
    stats: [
      { value: "2,400+", label: "Writers Coached" },
      { value: "9", label: "Platforms Mastered" },
      { value: "YouTube", label: "@CoachVictorDaniels" },
    ],
    youtubeHandle: "@CoachVictorDaniels",
    youtubeUrl: "https://www.youtube.com/@CoachVictorDaniels",
    coachEnrollLabel: "Enroll in WIT-WEB →",
    coachEnrollHref: "/witweb-landing",
    coachYoutubeButtonLabel: "▶️ YouTube Channel",
  },
  ssg: {
    id: "ssg",
    sectionLabel: "Flagship Course",
    title: "SSG Blueprint",
    bannerEmoji: "🎬",
    bannerGradient: "linear-gradient(135deg,#1a0006,#2e0010)",
    kicker: "SSG Blueprint",
    courseName: "Scriptwriting and Screenwriting Guide",
    description:
      "Master screenplay and script writing from concept to final draft. Feature films, TV series, audio drama — and how to get your script into the right hands.",
    tags: ["10 Modules", "40 Lessons", "Film + TV + Audio", "Lifetime Access"],
    primaryCtaLabel: "Enroll Now — ₦30,000",
    primaryCtaHref: "/ssg-landing",
    secondaryCtaLabel: "Get Both Courses — ₦55,000",
    secondaryCtaHref: "/ssg-landing",
    miniCreatorLabel: "Victor Daniels — Course Creator",
    miniCreatorBio:
      "Teaching screenwriting from professional experience. Nollywood, Hollywood and audio drama industry knowledge built into every lesson.",
    learnHeading: "What You Will Learn",
    learnPoints: [
      {
        icon: "📄",
        title: "Industry-Standard Formatting",
        desc: "Scene headings, action lines, dialogue, parentheticals — the Hollywood standard done correctly.",
      },
      {
        icon: "🎬",
        title: "Feature Film Structure",
        desc: "Three-act structure, character arcs, plot points, and the all-is-lost moment.",
      },
      {
        icon: "📺",
        title: "TV Series and Audio Drama",
        desc: "Pilot structure, series bible, and writing specifically for Nollywood and audio platforms.",
      },
      {
        icon: "🤝",
        title: "Getting Your Script Noticed",
        desc: "Query letters, pitch decks, competitions, networking with producers and directors.",
      },
    ],
    dividerSubtitle:
      "Go deeper with the SSG Blueprint course. Use the Script Editor to write. Take the course to master the craft.",
    coachSectionLabel: "Your Coach",
    coachHeading: "Meet Coach Victor Daniels",
    coachName: "Victor Daniels",
    coachRole: "Screenwriter · Coach · Founder, Ink2Wealth Media Limited",
    coachBio:
      "Screenwriter, writing coach and founder of SSG Blueprint. Teaches from professional experience across Nollywood, Hollywood format standards, and audio drama for platforms like PocketFM. Everything in the course is industry-tested.",
    coachPhotoUrl: "",
    coachPhotoEmoji: "👨‍🏫",
    coachAvatarGradient: "linear-gradient(135deg,#1a0006,#2a0010)",
    stats: [
      { value: "2,400+", label: "Writers Coached" },
      { value: "3", label: "Script Formats Taught" },
      { value: "YouTube", label: "@CoachVictorDaniels" },
    ],
    youtubeHandle: "@CoachVictorDaniels",
    youtubeUrl: "https://www.youtube.com/@CoachVictorDaniels",
    coachEnrollLabel: "Enroll in SSG Blueprint →",
    coachEnrollHref: "/ssg-landing",
    coachYoutubeButtonLabel: "▶️ YouTube Channel",
  },
};

export function getDefaultLandingCourse(courseId: LandingCourseId): LandingCourse {
  return structuredClone(DEFAULT_LANDING_COURSES[courseId]);
}
