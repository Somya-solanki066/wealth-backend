/** Focus topics shown when a subject is flagged as weakest */
export const SUBJECT_FOCUS_TOPICS: Record<string, string[]> = {
  Physics: ["Waves & Optics", "Electromagnetism", "Mechanics"],
  Mathematics: ["Algebra", "Calculus", "Statistics"],
  Chemistry: ["Organic Chemistry", "Stoichiometry", "Equilibrium"],
  Biology: ["Genetics", "Ecology", "Human Physiology"],
  English: ["Comprehension", "Lexis & Structure", "Oral Forms"],
  Economics: ["Demand & Supply", "National Income", "International Trade"],
  Government: ["Constitution", "Political Ideologies", "Public Administration"],
  "Medical-Surgical Nursing": ["Perioperative Care", "Cardiovascular", "Respiratory"],
  "Internal Medicine": ["Cardiology", "Endocrinology", "Infectious Disease"],
  Law: ["Contract Law", "Constitutional Law", "Criminal Law"],
};

export function getFocusTopics(subjectLabel: string): string[] {
  if (SUBJECT_FOCUS_TOPICS[subjectLabel]) return SUBJECT_FOCUS_TOPICS[subjectLabel];
  const key = Object.keys(SUBJECT_FOCUS_TOPICS).find(
    (k) => subjectLabel.toLowerCase().includes(k.toLowerCase())
  );
  if (key) return SUBJECT_FOCUS_TOPICS[key];
  return ["Core concepts", "Past questions review", "Timed practice"];
}

export type NormalizedAttempt = {
  id: string;
  source: string;
  subjectLabel: string;
  percentageScore: number;
  totalQuestions: number;
  incorrectCount: number;
  createdAt: string;
};

export function normalizeSession(
  id: string,
  source: string,
  data: Record<string, unknown>
): NormalizedAttempt | null {
  const score = Number(data.percentageScore);
  if (Number.isNaN(score)) return null;

  let subjectLabel = "Practice";
  if (source === "jamb") subjectLabel = String(data.subjectLabel || data.subject || "JAMB");
  else if (source === "university") subjectLabel = String(data.courseTitle || data.courseCode || "University");
  else if (source === "nursing") subjectLabel = String(data.topicName || "Nursing");
  else if (source === "mbbs") subjectLabel = String(data.subjectName || "MBBS");
  else if (source === "professional") subjectLabel = String(data.moduleName || data.courseName || "Professional");

  return {
    id,
    source,
    subjectLabel,
    percentageScore: score,
    totalQuestions: Number(data.totalQuestions) || 0,
    incorrectCount: Number(data.incorrectCount) || 0,
    createdAt: String(data.createdAt || ""),
  };
}

export function computeStudyStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const uniqueDays = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let streak = 0;
  const check = new Date(today);

  // Allow streak if practiced today or yesterday (grace for same day start)
  const latest = uniqueDays[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (latest !== todayStr && latest !== yesterdayStr) return 0;

  for (let i = 0; i < 365; i += 1) {
    const dayStr = check.toISOString().slice(0, 10);
    if (uniqueDays.includes(dayStr)) {
      streak += 1;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function buildWeekStreak(dates: string[]): boolean[] {
  const uniqueDays = new Set(dates.map((d) => d.slice(0, 10)));
  const result: boolean[] = [];
  const today = new Date();
  // Last 7 days ending today (Mon-Sun style from 6 days ago to today)
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(uniqueDays.has(d.toISOString().slice(0, 10)));
  }
  return result;
}
