import type { LandingCourse } from "./landingCoursesDefaults";
import { DEFAULT_LANDING_COURSES } from "./landingCoursesDefaults";

export type WorldCourseId = "writer" | "screenwriter" | "student";

/** Same shape as landing course (course card + coach card), with free-form id */
export type WorldFlagshipCourse = Omit<LandingCourse, "id"> & { id: string };

export type WorldCoursesPage = {
  id: WorldCourseId;
  courses: WorldFlagshipCourse[];
};

export const WORLD_COURSE_IDS: WorldCourseId[] = ["writer", "screenwriter", "student"];

export function isValidWorldCourseId(id: string): id is WorldCourseId {
  return WORLD_COURSE_IDS.includes(id as WorldCourseId);
}

function cloneLandingAsWorldCourse(
  sourceId: "witweb" | "ssg",
  newId: string
): WorldFlagshipCourse {
  const src = structuredClone(DEFAULT_LANDING_COURSES[sourceId]);
  return { ...src, id: newId };
}

export function createEmptyWorldCourse(id?: string): WorldFlagshipCourse {
  const courseId = id || `course-${Date.now()}`;
  return {
    id: courseId,
    sectionLabel: "Flagship Course",
    title: "New Course",
    bannerEmoji: "📖",
    bannerGradient: "linear-gradient(135deg,#1a1200,#2e2000)",
    kicker: "New Course",
    courseName: "Course Name",
    description: "Add your course description here.",
    tags: ["Modules", "Lessons", "Lifetime Access"],
    primaryCtaLabel: "Enroll Now",
    primaryCtaHref: "/register",
    secondaryCtaLabel: "Learn More",
    secondaryCtaHref: "/register",
    miniCreatorLabel: "Coach — Course Creator",
    miniCreatorBio: "Add a short creator bio.",
    learnHeading: "What You Will Learn",
    learnPoints: [
      { icon: "✨", title: "Point one", desc: "Describe this learning outcome." },
      { icon: "🎯", title: "Point two", desc: "Describe this learning outcome." },
    ],
    dividerSubtitle: "Go deeper with this course. Practice in the app. Master the craft.",
    coachSectionLabel: "Your Coach",
    coachHeading: "Meet Your Coach",
    coachName: "Coach Name",
    coachRole: "Expert · Coach · Founder",
    coachBio: "Add the coach biography and credentials here.",
    coachPhotoUrl: "",
    coachPhotoEmoji: "👨‍🏫",
    coachAvatarGradient: "linear-gradient(135deg,#1e1500,#2a1e00)",
    stats: [
      { value: "0", label: "Students" },
      { value: "0", label: "Modules" },
      { value: "YouTube", label: "@handle" },
    ],
    youtubeHandle: "@handle",
    youtubeUrl: "https://www.youtube.com/",
    coachEnrollLabel: "Enroll →",
    coachEnrollHref: "/register",
    coachYoutubeButtonLabel: "▶️ YouTube Channel",
  };
}

const BOTH_FLAGSHIP = (): WorldFlagshipCourse[] => [
  cloneLandingAsWorldCourse("witweb", "witweb"),
  cloneLandingAsWorldCourse("ssg", "ssg"),
];

/** Writer, Script, and Student pages all include both flagship courses by default */
export const DEFAULT_WORLD_COURSES: Record<WorldCourseId, WorldCoursesPage> = {
  writer: { id: "writer", courses: BOTH_FLAGSHIP() },
  screenwriter: { id: "screenwriter", courses: BOTH_FLAGSHIP() },
  student: { id: "student", courses: BOTH_FLAGSHIP() },
};

export function getDefaultWorldCourses(worldId: WorldCourseId): WorldCoursesPage {
  return structuredClone(DEFAULT_WORLD_COURSES[worldId]);
}

function isFlagshipCourseShape(c: unknown): c is WorldFlagshipCourse {
  if (!c || typeof c !== "object") return false;
  const row = c as Record<string, unknown>;
  // Old simple course cards had icon/href/meta — skip those
  return (
    typeof row.courseName === "string" ||
    typeof row.coachName === "string" ||
    typeof row.primaryCtaLabel === "string"
  );
}

function normalizeCourse(c: WorldFlagshipCourse, i: number): WorldFlagshipCourse {
  const id = String(c?.id || `course-${i}`);
  const empty = createEmptyWorldCourse(id);
  return {
    ...empty,
    ...c,
    id,
    tags: Array.isArray(c?.tags) && c.tags.length ? c.tags : empty.tags,
    learnPoints:
      Array.isArray(c?.learnPoints) && c.learnPoints.length
        ? c.learnPoints
        : empty.learnPoints,
    stats: Array.isArray(c?.stats) && c.stats.length ? c.stats : empty.stats,
  };
}

/**
 * Overlay saved courses onto defaults so missing flagship courses
 * (e.g. SSG under Writer) still appear, while custom admin-added courses stay.
 */
export function mergeWorldCoursesPage(
  worldId: WorldCourseId,
  stored: Record<string, unknown> | undefined
): WorldCoursesPage {
  const defaults = getDefaultWorldCourses(worldId);
  const rawList = Array.isArray(stored?.courses) ? stored.courses : null;
  const storedCourses =
    rawList && rawList.length > 0 && rawList.every(isFlagshipCourseShape)
      ? (rawList as WorldFlagshipCourse[]).map(normalizeCourse)
      : null;

  if (!storedCourses) {
    return defaults;
  }

  const storedById = new Map(storedCourses.map((c) => [c.id, c]));
  const defaultIds = new Set(defaults.courses.map((c) => c.id));

  const mergedDefaults = defaults.courses.map(
    (def) => storedById.get(def.id) || def
  );
  const extras = storedCourses.filter((c) => !defaultIds.has(c.id));

  return {
    id: worldId,
    courses: [...mergedDefaults, ...extras],
  };
}
