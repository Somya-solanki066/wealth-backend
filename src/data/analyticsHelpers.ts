/** Tool categories for Smart Performance Analytics */

export const EXAM_TOOLS = [
  { id: "jamb", label: "JAMB UTME Practice", route: "jamb-practice" },
  { id: "university", label: "University Past Questions", route: "university-past" },
  { id: "nursing", label: "Nursing Hub", route: "nursing-hub" },
  { id: "mbbs", label: "MBBS Hub", route: "mbbs-hub" },
  { id: "professional", label: "All Professional Courses", route: "professional-courses" },
] as const;

export const LEARNING_TOOLS = [
  { id: "study-planner", label: "Study Planner", route: "study-planner" },
  { id: "flashcards", label: "Active Recall Flashcards", route: "flashcards" },
  { id: "video-finder", label: "Course Video Finder", route: "video-finder" },
  { id: "exam-techniques", label: "Exam Techniques", route: "exam-techniques" },
] as const;

export const PRODUCTIVITY_TOOLS = [
  { id: "citation", label: "Citation Generator", route: "citation" },
  { id: "essay-writer", label: "Essay & Project Writer", route: "essay-writer" },
] as const;

export const SESSION_COLLECTIONS: { source: string; name: string }[] = [
  { source: "jamb", name: "jambPracticeSessions" },
  { source: "university", name: "universityPastSessions" },
  { source: "nursing", name: "nursingPracticeSessions" },
  { source: "mbbs", name: "mbbsPracticeSessions" },
  { source: "professional", name: "professionalPracticeSessions" },
];

export const TOOL_ROUTE_MAP: Record<string, string> = {
  jamb: "jamb-practice",
  university: "university-past",
  nursing: "nursing-hub",
  mbbs: "mbbs-hub",
  professional: "professional-courses",
};

export type PerformanceStatus = "not_started" | "insufficient_data" | "needs_practice" | "reliable";

export function classifyPerformance(attempted: number, accuracy: number | null): PerformanceStatus {
  if (attempted === 0) return "not_started";
  if (attempted < 5) return "insufficient_data";
  if (attempted < 15) return "needs_practice";
  return "reliable";
}

export function weaknessLevel(accuracy: number | null, status: PerformanceStatus): "critical" | "warning" | "moderate" | "low" | "none" {
  if (status === "not_started" || status === "insufficient_data") return "none";
  if (accuracy === null) return "none";
  if (accuracy < 45) return "critical";
  if (accuracy < 55) return "warning";
  if (accuracy < 65) return "moderate";
  return "low";
}

export function weaknessScore(attempted: number, accuracy: number, daysSinceLast?: number): number {
  if (attempted < 5) return 0;
  const accuracyWeight = Math.max(0, 100 - accuracy);
  const attemptWeight = Math.min(attempted / 20, 1) * 30;
  const recencyWeight = daysSinceLast !== undefined && daysSinceLast > 7 ? 15 : 0;
  return Math.round(accuracyWeight * 0.7 + attemptWeight + recencyWeight);
}

export const SUBJECT_FOCUS_TOPICS: Record<string, string[]> = {
  Physics: ["Waves & Optics", "Electromagnetism", "Mechanics"],
  Mathematics: ["Algebra", "Calculus", "Statistics"],
  Chemistry: ["Organic Chemistry", "Stoichiometry", "Equilibrium"],
  Biology: ["Genetics", "Ecology", "Human Physiology"],
  English: ["Comprehension", "Lexis & Structure", "Oral Forms"],
  "Medical-Surgical Nursing II": ["Cardiovascular", "Respiratory", "Renal"],
  Physiology: ["Renal", "Respiratory", "CVS"],
  Biochemistry: ["Enzymes", "Metabolism", "Molecular Bio"],
  Anatomy: ["Head & Neck", "Thorax", "Upper Limb"],
  "Clinical Pharmacy": ["Drug therapy monitoring", "Patient counselling"],
  "Law of Contract": ["Offer & Acceptance", "Consideration", "Breach"],
};

export function getFocusTopics(subjectLabel: string): string[] {
  if (SUBJECT_FOCUS_TOPICS[subjectLabel]) return SUBJECT_FOCUS_TOPICS[subjectLabel];
  const key = Object.keys(SUBJECT_FOCUS_TOPICS).find((k) =>
    subjectLabel.toLowerCase().includes(k.toLowerCase())
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
  correctCount: number;
  incorrectCount: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export function normalizeSession(
  id: string,
  source: string,
  data: Record<string, unknown>
): NormalizedAttempt | null {
  const score = Number(data.percentageScore);
  if (Number.isNaN(score)) return null;

  let subjectLabel = "Practice";
  if (source === "jamb") subjectLabel = String(data.label || data.subjectLabel || "JAMB");
  else if (source === "university") subjectLabel = String(data.courseTitle || data.courseCode || "University");
  else if (source === "nursing") subjectLabel = String(data.courseId || data.topicId || "Nursing");
  else if (source === "mbbs") subjectLabel = String(data.subjectId || data.subjectName || "MBBS");
  else if (source === "professional") subjectLabel = String(data.subjectId || data.courseName || "Professional");

  return {
    id,
    source,
    subjectLabel,
    percentageScore: score,
    totalQuestions: Number(data.totalQuestions) || 0,
    correctCount: Number(data.correctCount) || 0,
    incorrectCount: Number(data.incorrectCount) || 0,
    createdAt: String(data.createdAt || ""),
    metadata: data,
  };
}

export type TopicStat = {
  subject: string;
  topic: string;
  source: string;
  attempted: number;
  correct: number;
  accuracy: number | null;
  status: PerformanceStatus;
  weaknessLevel: "critical" | "warning" | "moderate" | "low" | "none";
  weaknessScore: number;
  lastPracticed?: string;
};

export function buildTopicStat(
  subject: string,
  topic: string,
  source: string,
  attempted: number,
  correct: number,
  lastPracticed?: string
): TopicStat {
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
  const status = classifyPerformance(attempted, accuracy);
  const daysSince = lastPracticed
    ? Math.floor((Date.now() - new Date(lastPracticed).getTime()) / 86400000)
    : undefined;
  return {
    subject,
    topic,
    source,
    attempted,
    correct,
    accuracy,
    status,
    weaknessLevel: weaknessLevel(accuracy, status),
    weaknessScore: accuracy !== null ? weaknessScore(attempted, accuracy, daysSince) : 0,
    lastPracticed,
  };
}

export function computeStudyStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const uniqueDays = [...new Set(dates.map((d) => d.slice(0, 10)))].sort().reverse();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const latest = uniqueDays[0];
  if (latest !== todayStr && latest !== yesterdayStr) return 0;

  let streak = 0;
  const check = new Date(today);
  for (let i = 0; i < 365; i += 1) {
    const dayStr = check.toISOString().slice(0, 10);
    if (uniqueDays.includes(dayStr)) {
      streak += 1;
      check.setDate(check.getDate() - 1);
    } else break;
  }
  return streak;
}

export function buildWeekActivity(dates: string[]): boolean[] {
  const uniqueDays = new Set(dates.map((d) => d.slice(0, 10)));
  const result: boolean[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(uniqueDays.has(d.toISOString().slice(0, 10)));
  }
  return result;
}

export function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export function recommendedQuestionCount(accuracy: number | null, status: PerformanceStatus): number {
  if (status === "not_started") return 20;
  if (status === "insufficient_data") return 15;
  if (accuracy !== null && accuracy < 45) return 20;
  if (accuracy !== null && accuracy < 55) return 15;
  return 10;
}
