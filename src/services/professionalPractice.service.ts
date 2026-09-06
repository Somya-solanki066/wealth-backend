import { getFirestore } from "firebase-admin/firestore";
import {
  PROFESSIONAL_CATEGORIES,
  PROFESSIONAL_COURSES,
  PROFESSIONAL_INSTITUTIONS,
  getCoursesByCategory,
  getProfessionalCourse,
  getProfessionalSubject,
  getSubjectsForCourse,
  searchCourses,
  subjectRequiresPremium,
  type ProfessionalCategoryId,
  type ProfessionalCourseId,
} from "../data/professionalCatalog";
import {
  checkProfessionalAnswer,
  getProfessionalQuestions,
  stripProfessionalAnswer,
  type ProfessionalOptionKey,
} from "../data/professionalQuestions";

export type ProfessionalProfile = {
  userId: string;
  courseId: ProfessionalCourseId;
  courseName: string;
  institution: string;
  institutionLabel: string;
  currentYear: number;
  currentLevel: number;
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  subtopics: string[];
  access: "free" | "premium";
  attempted: number;
  correct: number;
  totalQuestions: number;
  accuracy: number;
  progress: number;
};

function nowIso() {
  return new Date().toISOString();
}

export async function getProfessionalProfile(userId: string): Promise<ProfessionalProfile | null> {
  const snap = await getFirestore().collection("professionalProfiles").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as ProfessionalProfile;
}

export async function saveProfessionalProfile(
  userId: string,
  input: {
    courseId: ProfessionalCourseId;
    institution: string;
    currentYear: number;
    currentLevel: number;
  }
): Promise<ProfessionalProfile> {
  const course = getProfessionalCourse(input.courseId);
  if (!course) throw new Error("Invalid course.");
  const inst = PROFESSIONAL_INSTITUTIONS.find((i) => i.id === input.institution);
  if (!inst) throw new Error("Invalid institution.");

  const ref = getFirestore().collection("professionalProfiles").doc(userId);
  const existing = await ref.get();
  const profile: ProfessionalProfile = {
    userId,
    courseId: course.id,
    courseName: course.name,
    institution: inst.id,
    institutionLabel: inst.label,
    currentYear: input.currentYear,
    currentLevel: input.currentLevel,
    setupComplete: true,
    createdAt: existing.exists ? String(existing.data()?.createdAt || nowIso()) : nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(profile, { merge: true });
  return profile;
}

async function getSubjectPerformance(userId: string, subjectId: string) {
  const snap = await getFirestore()
    .collection("professionalSubjectPerformance")
    .doc(`${userId}_${subjectId}`)
    .get();
  if (!snap.exists) return { attempted: 0, correct: 0 };
  const data = snap.data() || {};
  return { attempted: Number(data.attempted || 0), correct: Number(data.correct || 0) };
}

export async function getSubjectProgressList(
  userId: string,
  courseId: ProfessionalCourseId,
  yearOrLevel: number,
  category?: string
): Promise<SubjectProgress[]> {
  const subjects = getSubjectsForCourse(courseId, yearOrLevel, category);
  const results: SubjectProgress[] = [];

  for (const subject of subjects) {
    const perf = await getSubjectPerformance(userId, subject.id);
    const accuracy = perf.attempted ? Math.round((perf.correct / perf.attempted) * 100) : 0;
    const completion = subject.totalQuestions
      ? Math.min(100, Math.round((perf.attempted / subject.totalQuestions) * 100))
      : 0;
    results.push({
      subjectId: subject.id,
      subjectName: subject.name,
      subtopics: subject.subtopics,
      access: subject.access,
      attempted: perf.attempted,
      correct: perf.correct,
      totalQuestions: subject.totalQuestions,
      accuracy,
      progress: perf.attempted > 0 ? Math.max(completion, accuracy) : completion,
    });
  }
  return results.sort((a, b) => a.progress - b.progress);
}

export async function getProHubHome(userId: string) {
  const profile = await getProfessionalProfile(userId);
  const featured = {
    health: getCoursesByCategory("health").slice(0, 5),
    lawSocial: getCoursesByCategory("law-social").slice(0, 3),
    business: getCoursesByCategory("business").slice(0, 2),
  };

  let courseHub = null;
  if (profile?.setupComplete) {
    const course = getProfessionalCourse(profile.courseId);
    const yearOrLevel = course?.levelType === "year" ? profile.currentYear : profile.currentLevel;
    const subjects = await getSubjectProgressList(userId, profile.courseId, yearOrLevel);
    const overallProgress = subjects.length
      ? Math.round(subjects.reduce((s, sub) => s + sub.progress, 0) / subjects.length)
      : 0;
    courseHub = {
      course,
      profile,
      yearOrLevel,
      subjects,
      overallProgress,
      weakAreas: subjects.filter((s) => s.progress < 50).slice(0, 3),
    };
  }

  return {
    profile,
    setupRequired: !profile?.setupComplete,
    categories: PROFESSIONAL_CATEGORIES,
    featured,
    courseHub,
    institutions: PROFESSIONAL_INSTITUTIONS,
    totalCourses: PROFESSIONAL_COURSES.length,
  };
}

export async function getCourseHub(
  userId: string,
  courseId: ProfessionalCourseId,
  yearOrLevel: number,
  category?: string
) {
  const course = getProfessionalCourse(courseId);
  if (!course) throw new Error("Course not found.");
  const subjects = await getSubjectProgressList(userId, courseId, yearOrLevel, category);
  const overallProgress = subjects.length
    ? Math.round(subjects.reduce((s, sub) => s + sub.progress, 0) / subjects.length)
    : 0;

  return {
    course,
    yearOrLevel,
    category,
    subjects,
    overallProgress,
    weakAreas: subjects.filter((s) => s.progress < 50).slice(0, 3),
    lawCategories: course.lawCategories || null,
    licensingPrep: course.licensingPrep || null,
  };
}

export function searchCatalog(query: string, category?: string) {
  const cat = category && category !== "all" ? category as ProfessionalCategoryId : undefined;
  const courses = searchCourses(query, cat);
  return courses.map((c) => ({
    id: c.id,
    name: c.name,
    degree: c.degree,
    icon: c.icon,
    category: c.category,
    durationYears: c.durationYears,
    highlights: c.highlights,
    description: c.description,
    licensingPrep: c.licensingPrep?.name || null,
  }));
}

export async function updateSubjectPerformance(
  userId: string,
  subjectId: string,
  correctCount: number,
  attemptedCount: number
) {
  const ref = getFirestore().collection("professionalSubjectPerformance").doc(`${userId}_${subjectId}`);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const attempted = Number(prev?.attempted || 0) + attemptedCount;
  const correct = Number(prev?.correct || 0) + correctCount;
  await ref.set(
    {
      userId,
      subjectId,
      attempted,
      correct,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      lastPracticed: nowIso(),
    },
    { merge: true }
  );
}

export function startPracticeSession(opts: {
  subjectId: string;
  limit?: number;
  licensingPrepId?: string;
}) {
  const subject = getProfessionalSubject(opts.subjectId);
  if (!subject && !opts.licensingPrepId) throw new Error("Subject not found.");

  const subjectId = opts.subjectId || `${opts.licensingPrepId}-practice`;
  const courseId = subject?.courseId || "pharmacy";
  const questions = getProfessionalQuestions(subjectId, courseId, subject?.name).slice(0, opts.limit || 20);

  return {
    questionIds: questions.map((q) => q.id),
    questions: questions.map(stripProfessionalAnswer),
    totalQuestions: questions.length,
    durationMinutes: 30,
  };
}

export async function scoreProfessionalSession(
  userId: string,
  input: {
    subjectId: string;
    courseId: ProfessionalCourseId;
    type: "subject" | "licensing";
    licensingPrepId?: string;
    answers: Record<string, ProfessionalOptionKey | null>;
    questionIds: string[];
  }
) {
  const subject = getProfessionalSubject(input.subjectId);
  const bank = getProfessionalQuestions(
    input.subjectId,
    input.courseId,
    subject?.name
  );
  const idSet = new Set(input.questionIds);
  const questions = bank.filter((q) => idSet.has(q.id));

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  const breakdown = questions.map((qn) => {
    const chosen = input.answers[qn.id] ?? null;
    const isCorrect = Boolean(chosen && chosen === qn.correctAnswer);
    if (!chosen) skippedCount += 1;
    else if (isCorrect) correctCount += 1;
    else incorrectCount += 1;
    return {
      questionId: qn.id,
      questionNumber: qn.questionNumber,
      questionText: qn.questionText,
      chosen,
      correctAnswer: qn.correctAnswer,
      isCorrect,
      rationale: qn.rationale,
    };
  });

  const totalQuestions = questions.length;
  const percentageScore = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const attemptedCount = totalQuestions - skippedCount;

  if (input.subjectId && subject) {
    await updateSubjectPerformance(userId, input.subjectId, correctCount, attemptedCount);
  }

  const ref = getFirestore().collection("professionalPracticeSessions").doc();
  const session = {
    userId,
    type: input.type,
    courseId: input.courseId,
    subjectId: input.subjectId || null,
    licensingPrepId: input.licensingPrepId || null,
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    percentageScore,
    status: "completed",
    createdAt: nowIso(),
  };
  await ref.set(session);

  return { sessionId: ref.id, ...session, breakdown };
}

export function checkAnswer(questionId: string, chosen: ProfessionalOptionKey) {
  const result = checkProfessionalAnswer(questionId, chosen);
  if (!result) throw new Error("Question not found.");
  return result;
}

export function getSubjectAccess(subjectId: string, isPremium: boolean) {
  const subject = getProfessionalSubject(subjectId);
  if (!subject) return null;
  return {
    subject,
    locked: subjectRequiresPremium(subject, isPremium),
  };
}

export function getLicensingPrepAccess(courseId: ProfessionalCourseId, isPremium: boolean) {
  const course = getProfessionalCourse(courseId);
  if (!course?.licensingPrep) return null;
  const prep = course.licensingPrep;
  return {
    prep,
    locked: prep.access === "premium" && !isPremium,
  };
}
