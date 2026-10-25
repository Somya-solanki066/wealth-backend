/** Allowed values + normalization for world onboarding payloads. */

export const WRITER_PLATFORMS = [
  "PocketFM",
  "Dreame",
  "GoodNovel",
  "WebNovel",
  "MegaNovel",
  "AlphaNovel",
  "Letterlux",
  "Stary",
  "NovelSnack",
] as const;

export const WRITER_GENRES = [
  "Werewolf",
  "Mafia",
  "Billionaire",
  "Revenge",
  "Romance",
  "Vampire",
  "Fantasy",
  "Urban Fiction",
  "Thriller",
] as const;

export const WRITER_JOURNEY_LEVELS = [
  "I am already contracted",
  "Actively submitting",
  "Just starting out",
] as const;

export const WRITER_GOALS = [
  "Pass platform editor checks",
  "Write chapters faster",
  "Grow my writing income",
  "Learn serialized fiction craft",
] as const;

const SCREENWRITER_SCRIPT_TYPES = [
  "Feature Films",
  "TV Series / Pilot",
  "Audio Drama (PocketFM)",
  "Short Films",
  "All of the above",
] as const;

const SCREENWRITER_INDUSTRIES = [
  "Nollywood",
  "Hollywood",
  "BBC / UK",
  "African Film",
  "Netflix Africa",
  "Audio Platforms",
] as const;

const SCREENWRITER_GENRES = [
  "Drama",
  "Thriller",
  "Romance",
  "Horror",
  "Sci-Fi",
] as const;

export const SCREENWRITER_JOURNEY_LEVELS = [
  "Already produced / working",
  "Actively pitching",
  "Writing and building craft",
  "Just starting out",
] as const;

export const STUDENT_TYPES = [
  "Jambite — Preparing for JAMB UTME",
  "University Student — 100L to Final Year",
  "Professional Student",
] as const;

export const STUDENT_COURSES: Record<string, string[]> = {
  "Medicine and Surgery (MBBS)": ["English", "Biology", "Chemistry", "Physics"],
  Law: ["English", "Government", "Literature", "Economics"],
  Engineering: ["English", "Mathematics", "Physics", "Chemistry"],
  Nursing: ["English", "Biology", "Chemistry", "Physics"],
  Pharmacy: ["English", "Biology", "Chemistry", "Physics"],
};

export const STUDENT_UNIVERSITIES = [
  "UNEC",
  "UNILAG",
  "UI",
  "ABU",
  "OAU",
  "UNIBEN",
] as const;

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function pickAllowed(values: string[], allowed: readonly string[]): string[] {
  const allow = new Map(allowed.map((a) => [a.toLowerCase(), a]));
  const out: string[] = [];
  for (const v of values) {
    const canonical = allow.get(v.toLowerCase());
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

function pickOne(value: unknown, allowed: readonly string[]): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hit = allowed.find((a) => a.toLowerCase() === trimmed.toLowerCase());
  return hit ?? null;
}

export type NormalizedOnboarding = {
  data: Record<string, unknown>;
  error?: string;
};

/** Sanitize + optionally require fields when marking onboarding complete. */
export function normalizeOnboardingData(
  world: "writer" | "screenwriter" | "student",
  raw: unknown,
  complete: boolean
): NormalizedOnboarding {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (world === "writer") {
    const platforms = pickAllowed(asStringList(input.platforms), WRITER_PLATFORMS);
    const genres = pickAllowed(
      asStringList(input.genres ?? input.favoriteGenres),
      WRITER_GENRES
    );
    const writingLevel =
      pickOne(input.writingLevel ?? input.journeyStatus, WRITER_JOURNEY_LEVELS) ??
      null;
    const primaryGoal = pickOne(input.primaryGoal, WRITER_GOALS);

    if (complete) {
      if (platforms.length === 0) {
        return { data: {}, error: "Select at least one writing platform." };
      }
      if (genres.length === 0) {
        return { data: {}, error: "Select at least one favourite genre." };
      }
      if (!writingLevel) {
        return { data: {}, error: "Select where you are in your writing journey." };
      }
      if (!primaryGoal) {
        return { data: {}, error: "Select what you want help with first." };
      }
    }

    const data: Record<string, unknown> = {
      platforms,
      genres,
      favoriteGenres: genres,
    };
    if (writingLevel) {
      data.writingLevel = writingLevel;
      data.journeyStatus = writingLevel;
    }
    if (primaryGoal) {
      data.primaryGoal = primaryGoal;
    }
    return { data };
  }

  if (world === "screenwriter") {
    const hasScriptTypes =
      input.scriptTypes !== undefined || input.writingType !== undefined;
    const hasIndustries =
      input.industries !== undefined || input.targetIndustries !== undefined;
    const hasGenres =
      input.genres !== undefined || input.genreFocus !== undefined;

    const scriptTypes = pickAllowed(
      asStringList(input.scriptTypes ?? input.writingType),
      SCREENWRITER_SCRIPT_TYPES
    );
    const industries = pickAllowed(
      asStringList(input.industries ?? input.targetIndustries),
      SCREENWRITER_INDUSTRIES
    );
    const genres = pickAllowed(
      asStringList(input.genres ?? input.genreFocus),
      SCREENWRITER_GENRES
    );
    const experienceLevel =
      pickOne(
        input.experienceLevel ?? input.journeyStatus ?? input.writingLevel,
        SCREENWRITER_JOURNEY_LEVELS
      ) ?? null;

    if (complete) {
      if (scriptTypes.length === 0) {
        return { data: {}, error: "Select at least one script type." };
      }
      if (industries.length === 0) {
        return { data: {}, error: "Select at least one industry." };
      }
      if (genres.length === 0) {
        return { data: {}, error: "Select at least one genre focus." };
      }
      if (!experienceLevel) {
        return {
          data: {},
          error: "Select where you are in your screenwriting journey.",
        };
      }
    }

    const data: Record<string, unknown> = {};
    if (hasScriptTypes || complete) {
      data.scriptTypes = scriptTypes;
    }
    if (hasIndustries || complete) {
      data.industries = industries;
      data.targetIndustries = industries;
    }
    if (hasGenres || complete) {
      data.genres = genres;
      data.genreFocus = genres;
    }
    if (experienceLevel) {
      data.experienceLevel = experienceLevel;
      data.journeyStatus = experienceLevel;
    }
    return { data };
  }

  // student
  const studentTypeRaw =
    typeof input.studentType === "string"
      ? input.studentType.trim()
      : typeof input.stage === "string"
        ? input.stage.trim()
        : "";
  const studentType =
    pickOne(studentTypeRaw, STUDENT_TYPES) ||
    STUDENT_TYPES.find((t) =>
      studentTypeRaw.toLowerCase().startsWith(t.split(" —")[0].toLowerCase())
    ) ||
    (studentTypeRaw || null);

  const courseRaw =
    typeof input.course === "string" ? input.course.trim() : "";
  const courseKeys = Object.keys(STUDENT_COURSES);
  const course =
    courseKeys.find((c) => c.toLowerCase() === courseRaw.toLowerCase()) ||
    (courseRaw || null);

  const examDate =
    typeof input.examDate === "string" ? input.examDate.trim() : "";
  const universities = pickAllowed(
    asStringList(input.universities ?? input.targetUniversities),
    STUDENT_UNIVERSITIES
  ).slice(0, 3);

  let subjects = asStringList(input.subjects);
  if (course && STUDENT_COURSES[course]) {
    subjects = STUDENT_COURSES[course];
  }

  const hasType = input.studentType !== undefined || input.stage !== undefined;
  const hasCourse = input.course !== undefined;
  const hasExam = input.examDate !== undefined;
  const hasUnis =
    input.universities !== undefined || input.targetUniversities !== undefined;

  if (complete) {
    if (!studentType) {
      return { data: {}, error: "Select your student stage." };
    }
    if (!course) {
      return { data: {}, error: "Select the course you are applying for." };
    }
    if (!examDate) {
      return { data: {}, error: "Select your exam date." };
    }
    if (universities.length === 0) {
      return { data: {}, error: "Select at least one target university." };
    }
  }

  const data: Record<string, unknown> = {};
  if (hasType || complete) {
    data.studentType = studentType;
    data.stage = studentType;
  }
  if (hasCourse || complete) {
    data.course = course;
  }
  if (hasExam || complete) {
    data.examDate = examDate || null;
  }
  if (hasUnis || complete) {
    data.universities = universities;
    data.targetUniversities = universities;
  }
  if (
    subjects.length > 0 &&
    (hasCourse || complete || input.subjects !== undefined)
  ) {
    data.subjects = subjects;
  }
  return { data };
}
