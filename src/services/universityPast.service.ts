import { getFirestore } from "firebase-admin/firestore";
import {
  findCourse,
  findUniversity,
  getCourseYears,
  isCoursePremiumLocked,
  isYearFree,
  listFacultyCourses,
  listUniversities,
} from "../data/universityCatalog";
import {
  getPastExplanation,
  getUniversityPastQuestions,
  stripPastAnswer,
  type PastOptionKey,
  type UniversityPastQuestion,
} from "../data/universityQuestions";

export type PracticeMode = "study" | "exam";

export type SessionConfig = {
  courseId: string;
  year: number;
  mode: PracticeMode;
  questionIds: string[];
  durationMinutes: number;
  label: string;
  universityId: string;
  universityName: string;
  facultyName: string;
  departmentName: string;
  courseCode: string;
  courseTitle: string;
};

function nowIso() {
  return new Date().toISOString();
}

const QUESTION_BANK = new Map<string, UniversityPastQuestion>();

function ensureQuestionBank() {
  if (QUESTION_BANK.size > 0) return;
  // Pre-index is lazy-loaded per course/year via getUniversityPastQuestions
}

function loadQuestions(courseId: string, year: number): UniversityPastQuestion[] {
  const key = `${courseId}:${year}`;
  if (!QUESTION_BANK.has(key)) {
    const qs = getUniversityPastQuestions(courseId, year);
    qs.forEach((q) => QUESTION_BANK.set(q.id, q));
    return qs;
  }
  return getUniversityPastQuestions(courseId, year);
}

export function getUniversitiesList(search = "") {
  const { universities, grouped } = listUniversities(search);
  return {
    regions: Object.entries(grouped).map(([region, items]) => ({
      region,
      universities: items.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
        location: u.location,
        region: u.region,
        facultyCount: u.faculties.length,
      })),
    })),
    total: universities.length,
  };
}

export function getFaculties(universityId: string) {
  const uni = findUniversity(universityId);
  if (!uni) return null;
  return {
    university: { id: uni.id, name: uni.name, shortName: uni.shortName },
    faculties: uni.faculties.map((f) => ({
      id: f.id,
      name: f.name,
      departmentCount: f.departments.length,
      courseCount: f.departments.reduce((sum, d) => sum + d.courses.length, 0),
    })),
  };
}

export function getCourses(universityId: string, facultyId: string, search = "", level = "") {
  const result = listFacultyCourses(universityId, facultyId, search, level);
  if (!result) return null;
  const uni = findUniversity(universityId);
  return {
    university: uni ? { id: uni.id, name: uni.name, shortName: uni.shortName } : null,
    faculty: { id: result.faculty.id, name: result.faculty.name },
    courses: result.courses.map((c) => ({
      ...c,
      freeYearsCount: (c.availableYears || []).filter((y) => y >= 2022).length,
      totalYears: (c.availableYears || []).length,
    })),
    byLevel: result.byLevel,
  };
}

export function getYearsForCourse(courseId: string, isPremium: boolean) {
  const match = findCourse(courseId);
  if (!match) return null;
  const years = getCourseYears(courseId, isPremium);
  const courseLocked = isCoursePremiumLocked(courseId, isPremium);
  return {
    course: match.course,
    university: { id: match.university.id, name: match.university.name },
    faculty: { id: match.faculty.id, name: match.faculty.name },
    department: { id: match.department.id, name: match.department.name },
    years,
    coursePremiumLocked: courseLocked,
    freeYears: years?.filter((y) => y.free).map((y) => y.year) || [],
  };
}

export function assertYearAccess(courseId: string, year: number, isPremium: boolean) {
  const match = findCourse(courseId);
  if (!match) throw new Error("Course not found.");
  if (isCoursePremiumLocked(courseId, isPremium)) {
    throw Object.assign(new Error("This course requires a premium subscription."), {
      premiumRequired: true,
      coursePremium: true,
    });
  }
  if (!isYearFree(year, isPremium)) {
    throw Object.assign(new Error("This year requires a premium subscription."), {
      premiumRequired: true,
      yearPremium: true,
    });
  }
  return match;
}

export function buildSession(
  courseId: string,
  year: number,
  mode: PracticeMode,
  isPremium: boolean
): SessionConfig {
  const match = assertYearAccess(courseId, year, isPremium);
  const questions = loadQuestions(courseId, year);
  const questionIds = questions.map((q) => q.id);
  return {
    courseId,
    year,
    mode,
    questionIds,
    durationMinutes: mode === "study" ? 0 : 60,
    label: `${match.course.code} — ${year}`,
    universityId: match.university.id,
    universityName: match.university.name,
    facultyName: match.faculty.name,
    departmentName: match.department.name,
    courseCode: match.course.code,
    courseTitle: match.course.title,
  };
}

export function questionsForClient(ids: string[], courseId: string, year: number) {
  const bank = loadQuestions(courseId, year);
  const map = new Map(bank.map((q) => [q.id, q]));
  return ids
    .map((id) => map.get(id))
    .filter((q): q is UniversityPastQuestion => Boolean(q))
    .map(stripPastAnswer);
}

export function checkAnswer(questionId: string, chosen: PastOptionKey, courseId: string, year: number) {
  const bank = loadQuestions(courseId, year);
  const qn = bank.find((q) => q.id === questionId);
  if (!qn) throw new Error("Question not found.");
  const isCorrect = chosen === qn.correctAnswer;
  return {
    isCorrect,
    correctAnswer: qn.correctAnswer,
    correctText: qn.options[qn.correctAnswer],
    explanation: getPastExplanation(qn),
    topic: qn.topic,
  };
}

export type ScoreResult = {
  sessionId: string;
  mode: PracticeMode;
  label: string;
  courseCode: string;
  courseTitle: string;
  year: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  percentageScore: number;
  timeUsedSeconds: number;
  subjectScores: never[];
  topicScores: Array<{
    topic: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
  weakestArea: { topic: string; accuracy: number } | null;
  breakdown: Array<{
    questionId: string;
    questionNumber: number;
    questionText: string;
    topic: string;
    chosen: PastOptionKey | null;
    correctAnswer: PastOptionKey;
    isCorrect: boolean;
    explanation: string;
    options: Record<PastOptionKey, string>;
  }>;
};

export async function scoreSession(
  userId: string,
  config: SessionConfig,
  answers: Record<string, PastOptionKey | null>,
  markedForReview: string[],
  timeUsedSeconds: number
): Promise<ScoreResult> {
  const bank = loadQuestions(config.courseId, config.year);
  const questions = config.questionIds
    .map((id) => bank.find((q) => q.id === id))
    .filter((q): q is UniversityPastQuestion => Boolean(q));

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  const topicStats = new Map<string, { correct: number; total: number }>();

  const breakdown = questions.map((qn) => {
    const chosen = answers[qn.id] ?? null;
    const isCorrect = Boolean(chosen && chosen === qn.correctAnswer);
    if (!chosen) skippedCount += 1;
    else if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    const stat = topicStats.get(qn.topic) || { correct: 0, total: 0 };
    stat.total += 1;
    if (isCorrect) stat.correct += 1;
    topicStats.set(qn.topic, stat);

    return {
      questionId: qn.id,
      questionNumber: qn.questionNumber,
      questionText: qn.questionText,
      topic: qn.topic,
      chosen,
      correctAnswer: qn.correctAnswer,
      isCorrect,
      explanation: getPastExplanation(qn),
      options: qn.options,
    };
  });

  const totalQuestions = questions.length;
  const percentageScore = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const topicScores = [...topicStats.entries()]
    .map(([topic, stats]) => ({
      topic,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage);

  const weakestArea = topicScores[0]
    ? { topic: topicScores[0].topic, accuracy: topicScores[0].percentage }
    : null;

  const db = getFirestore();
  const sessionRef = db.collection("universityPastSessions").doc();
  await sessionRef.set({
    userId,
    mode: config.mode,
    courseId: config.courseId,
    courseCode: config.courseCode,
    courseTitle: config.courseTitle,
    universityId: config.universityId,
    universityName: config.universityName,
    facultyName: config.facultyName,
    departmentName: config.departmentName,
    year: config.year,
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    percentageScore,
    timeUsedSeconds,
    markedForReview,
    topicScores,
    weakestArea,
    status: "completed",
    createdAt: nowIso(),
  });

  await updateTopicPerformance(userId, config.courseId, topicStats);

  return {
    sessionId: sessionRef.id,
    mode: config.mode,
    label: config.label,
    courseCode: config.courseCode,
    courseTitle: config.courseTitle,
    year: config.year,
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    percentageScore,
    timeUsedSeconds,
    subjectScores: [],
    topicScores,
    weakestArea,
    breakdown,
  };
}

async function updateTopicPerformance(
  userId: string,
  courseId: string,
  topicStats: Map<string, { correct: number; total: number }>
) {
  const db = getFirestore();
  const batch = db.batch();
  for (const [topic, stats] of topicStats) {
    const docId = `${userId}_${courseId}_${topic.replace(/\s+/g, "_")}`;
    const ref = db.collection("universityTopicPerformance").doc(docId);
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : null;
    const attempted = Number(prev?.attempted || 0) + stats.total;
    const correct = Number(prev?.correct || 0) + stats.correct;
    batch.set(
      ref,
      {
        userId,
        courseId,
        topic,
        attempted,
        correct,
        accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
        lastPracticed: nowIso(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

export async function getSessionHistory(userId: string, limit = 20) {
  const db = getFirestore();
  const snap = await db.collection("universityPastSessions").where("userId", "==", userId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limit);
}

ensureQuestionBank();
