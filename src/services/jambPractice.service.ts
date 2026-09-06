import { getFirestore } from "firebase-admin/firestore";
import {
  JAMB_COURSES,
  JAMB_INSTITUTIONS,
  JAMB_TOPICS,
  JAMB_PRACTICE_YEARS,
  POST_UTME_UNIVERSITIES,
  daysUntilExam,
  getCourseById,
  getInstitutionById,
  getPostUtmeYears,
  type JambPracticeMode,
} from "../data/jambCatalog";
import {
  JAMB_SUBJECTS,
  getExplanation,
  getJambQuestions,
  getJambSubjectMeta,
  selectJambQuestions,
  stripAnswer,
  type JambOptionKey,
  type JambQuestion,
  type JambSubjectId,
} from "../data/jambQuestions";

export type JambProfile = {
  userId: string;
  targetCourse: string;
  targetCourseLabel: string;
  targetInstitution: string;
  targetInstitutionLabel: string;
  targetInstitutionShort: string;
  examDate: string;
  subjects: JambSubjectId[];
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TopicPerformance = {
  subject: JambSubjectId;
  subjectLabel: string;
  topic: string;
  attempted: number;
  correct: number;
  accuracy: number;
  lastPracticed: string;
};

export type WeakArea = {
  subject: string;
  subjectLabel: string;
  topic: string;
  accuracy: number;
};

export type StartSessionInput = {
  mode: JambPracticeMode;
  subjects: JambSubjectId[];
  subject?: JambSubjectId;
  topic?: string;
  year?: number;
  questionCount?: number;
  universityId?: string;
};

export type SessionConfig = {
  mode: JambPracticeMode;
  questionIds: string[];
  durationMinutes: number;
  totalQuestions: number;
  subjects: JambSubjectId[];
  label: string;
  topic?: string;
  year?: number;
  universityId?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function topicKey(subject: JambSubjectId, topic: string) {
  return `${subject}::${topic}`;
}

export function getCatalogData() {
  return {
    courses: JAMB_COURSES,
    institutions: JAMB_INSTITUTIONS,
    subjects: JAMB_SUBJECTS,
    topics: JAMB_TOPICS,
    years: JAMB_PRACTICE_YEARS,
    postUtmeUniversities: POST_UTME_UNIVERSITIES,
  };
}

export async function getJambProfile(userId: string): Promise<JambProfile | null> {
  const db = getFirestore();
  const snap = await db.collection("jambProfiles").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as JambProfile;
}

export async function saveJambProfile(
  userId: string,
  input: {
    targetCourse: string;
    targetInstitution: string;
    examDate: string;
    subjects?: JambSubjectId[];
  }
): Promise<JambProfile> {
  const course = getCourseById(input.targetCourse);
  const institution = getInstitutionById(input.targetInstitution);
  if (!course) throw new Error("Invalid target course.");
  if (!institution) throw new Error("Invalid target institution.");
  if (!input.examDate) throw new Error("Exam date is required.");

  const subjects = (input.subjects?.length ? input.subjects : course.subjects) as JambSubjectId[];
  const invalid = subjects.find((s) => !course.subjects.includes(s));
  if (invalid) {
    throw new Error(`Subject "${invalid}" is not valid for ${course.label}.`);
  }

  const db = getFirestore();
  const ref = db.collection("jambProfiles").doc(userId);
  const existing = await ref.get();
  const profile: JambProfile = {
    userId,
    targetCourse: course.id,
    targetCourseLabel: course.label,
    targetInstitution: institution.id,
    targetInstitutionLabel: institution.label,
    targetInstitutionShort: institution.shortName,
    examDate: input.examDate,
    subjects,
    setupComplete: true,
    createdAt: existing.exists ? String(existing.data()?.createdAt || nowIso()) : nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(profile, { merge: true });
  return profile;
}

export async function getTopicPerformance(userId: string): Promise<TopicPerformance[]> {
  const db = getFirestore();
  const snap = await db.collection("jambTopicPerformance").where("userId", "==", userId).get();
  return snap.docs
    .map((d) => d.data() as TopicPerformance)
    .sort((a, b) => a.accuracy - b.accuracy);
}

export async function getWeakAreas(userId: string, limit = 3): Promise<WeakArea[]> {
  const perf = await getTopicPerformance(userId);
  return perf
    .filter((p) => p.attempted >= 3)
    .slice(0, limit)
    .map((p) => ({
      subject: p.subject,
      subjectLabel: p.subjectLabel,
      topic: p.topic,
      accuracy: p.accuracy,
    }));
}

export async function getJambHome(userId: string) {
  const profile = await getJambProfile(userId);
  const weakAreas = profile ? await getWeakAreas(userId) : [];
  const daysToExam = profile ? daysUntilExam(profile.examDate) : null;

  return {
    profile,
    setupRequired: !profile?.setupComplete,
    daysToExam,
    weakAreas,
    subjects: profile?.subjects || [],
    subjectLabels: (profile?.subjects || []).map(
      (id) => getJambSubjectMeta(id)?.label || id
    ),
  };
}

export function buildSessionConfig(input: StartSessionInput): SessionConfig {
  const { mode, subjects } = input;

  if (mode === "full_mock") {
    const perSubject = 25;
    const selected = selectJambQuestions({
      subjects,
      count: 100,
      perSubject,
    });
    return {
      mode,
      questionIds: selected.map((q) => q.id),
      durationMinutes: 100,
      totalQuestions: selected.length,
      subjects,
      label: "Full Mock JAMB",
    };
  }

  if (mode === "quick20") {
    const selected = selectJambQuestions({ subjects, count: 20 });
    return {
      mode,
      questionIds: selected.map((q) => q.id),
      durationMinutes: 20,
      totalQuestions: selected.length,
      subjects,
      label: "Quick 20 Questions",
    };
  }

  if (mode === "subject") {
    const subject = input.subject || subjects[0];
    const count = input.questionCount || 20;
    const selected = selectJambQuestions({
      subjects: [subject],
      topic: input.topic || "all",
      count,
    });
    const meta = getJambSubjectMeta(subject);
    const topicLabel = input.topic && input.topic !== "all" ? ` — ${input.topic}` : "";
    return {
      mode,
      questionIds: selected.map((q) => q.id),
      durationMinutes: Math.max(15, Math.round(count * 1.5)),
      totalQuestions: selected.length,
      subjects: [subject],
      label: `${meta?.label || subject} Practice${topicLabel}`,
      topic: input.topic,
    };
  }

  if (mode === "year") {
    const subject = input.subject || subjects[0];
    const year = input.year || 2024;
    const selected = selectJambQuestions({
      subjects: [subject],
      year,
      count: input.questionCount || 40,
    });
    const meta = getJambSubjectMeta(subject);
    return {
      mode,
      questionIds: selected.map((q) => q.id),
      durationMinutes: 60,
      totalQuestions: selected.length,
      subjects: [subject],
      label: `${year} ${meta?.label || subject}`,
      year,
    };
  }

  if (mode === "post_utme") {
    const year = input.year || 2024;
    const selected = selectJambQuestions({
      subjects,
      year,
      count: input.questionCount || 50,
    });
    return {
      mode,
      questionIds: selected.map((q) => q.id),
      durationMinutes: 60,
      totalQuestions: selected.length,
      subjects,
      label: `Post-UTME ${year}`,
      year,
      universityId: input.universityId,
    };
  }

  throw new Error("Invalid practice mode.");
}

export function loadQuestionsByIds(ids: string[]): JambQuestion[] {
  const map = new Map(JAMB_QUESTION_BANK_BY_ID);
  return ids
    .map((id) => map.get(id))
    .filter((q): q is JambQuestion => Boolean(q))
    .map((q, i) => ({ ...q, questionNumber: i + 1 }));
}

const JAMB_QUESTION_BANK_BY_ID = new Map<string, JambQuestion>();
for (const subject of JAMB_SUBJECTS) {
  getJambQuestions(subject.id).forEach((q) => JAMB_QUESTION_BANK_BY_ID.set(q.id, q));
}

export type ScoreResult = {
  sessionId: string;
  mode: JambPracticeMode;
  label: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  jambScore: number;
  percentageScore: number;
  timeUsedSeconds: number;
  subjectScores: Array<{
    subject: JambSubjectId;
    subjectLabel: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
  topicScores: Array<{
    subject: JambSubjectId;
    subjectLabel: string;
    topic: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
  weakestArea: WeakArea | null;
  breakdown: Array<{
    questionId: string;
    questionNumber: number;
    questionText: string;
    subject: JambSubjectId;
    subjectLabel: string;
    topic: string;
    chosen: JambOptionKey | null;
    correctAnswer: JambOptionKey;
    isCorrect: boolean;
    explanation: string;
    options: Record<JambOptionKey, string>;
  }>;
};

export async function scoreJambSession(
  userId: string,
  config: SessionConfig,
  answers: Record<string, JambOptionKey | null>,
  markedForReview: string[],
  timeUsedSeconds: number
): Promise<ScoreResult> {
  const questions = loadQuestionsByIds(config.questionIds);
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  const subjectStats = new Map<JambSubjectId, { correct: number; total: number }>();
  const topicStats = new Map<string, { subject: JambSubjectId; topic: string; correct: number; total: number }>();

  const breakdown = questions.map((qn) => {
    const chosen = answers[qn.id] ?? null;
    const isCorrect = Boolean(chosen && chosen === qn.correctAnswer);
    if (!chosen) skippedCount += 1;
    else if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    const subStat = subjectStats.get(qn.subject) || { correct: 0, total: 0 };
    subStat.total += 1;
    if (isCorrect) subStat.correct += 1;
    subjectStats.set(qn.subject, subStat);

    const tKey = topicKey(qn.subject, qn.topic);
    const topStat = topicStats.get(tKey) || { subject: qn.subject, topic: qn.topic, correct: 0, total: 0 };
    topStat.total += 1;
    if (isCorrect) topStat.correct += 1;
    topicStats.set(tKey, topStat);

    return {
      questionId: qn.id,
      questionNumber: qn.questionNumber,
      questionText: qn.questionText,
      subject: qn.subject,
      subjectLabel: getJambSubjectMeta(qn.subject)?.label || qn.subject,
      topic: qn.topic,
      chosen,
      correctAnswer: qn.correctAnswer,
      isCorrect,
      explanation: getExplanation(qn),
      options: qn.options,
    };
  });

  const totalQuestions = questions.length;
  const percentageScore = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const jambScore = Math.round((correctCount / totalQuestions) * 400);

  const subjectScores = [...subjectStats.entries()].map(([subject, stats]) => ({
    subject,
    subjectLabel: getJambSubjectMeta(subject)?.label || subject,
    correct: stats.correct,
    total: stats.total,
    percentage: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  const topicScores = [...topicStats.values()]
    .map((stats) => ({
      subject: stats.subject,
      subjectLabel: getJambSubjectMeta(stats.subject)?.label || stats.subject,
      topic: stats.topic,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage);

  const weakest = topicScores[0]
    ? {
        subject: topicScores[0].subject,
        subjectLabel: topicScores[0].subjectLabel,
        topic: topicScores[0].topic,
        accuracy: topicScores[0].percentage,
      }
    : null;

  const db = getFirestore();
  const sessionRef = db.collection("jambPracticeSessions").doc();
  const session = {
    userId,
    mode: config.mode,
    label: config.label,
    subjects: config.subjects,
    topic: config.topic || null,
    year: config.year || null,
    universityId: config.universityId || null,
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    percentageScore,
    jambScore,
    timeUsedSeconds,
    markedForReview,
    subjectScores,
    topicScores,
    weakestArea: weakest,
    status: "completed",
    createdAt: nowIso(),
  };
  await sessionRef.set(session);

  await updateTopicPerformance(userId, topicStats);

  return {
    sessionId: sessionRef.id,
    mode: config.mode,
    label: config.label,
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    jambScore,
    percentageScore,
    timeUsedSeconds,
    subjectScores,
    topicScores,
    weakestArea: weakest,
    breakdown,
  };
}

async function updateTopicPerformance(
  userId: string,
  topicStats: Map<string, { subject: JambSubjectId; topic: string; correct: number; total: number }>
) {
  const db = getFirestore();
  const batch = db.batch();

  for (const [, stats] of topicStats) {
    const docId = `${userId}_${stats.subject}_${stats.topic.replace(/\s+/g, "_")}`;
    const ref = db.collection("jambTopicPerformance").doc(docId);
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : null;
    const attempted = Number(prev?.attempted || 0) + stats.total;
    const correct = Number(prev?.correct || 0) + stats.correct;
    batch.set(
      ref,
      {
        userId,
        subject: stats.subject,
        subjectLabel: getJambSubjectMeta(stats.subject)?.label || stats.subject,
        topic: stats.topic,
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

export function questionsForClient(ids: string[]) {
  return loadQuestionsByIds(ids).map(stripAnswer);
}

export { getPostUtmeYears };
