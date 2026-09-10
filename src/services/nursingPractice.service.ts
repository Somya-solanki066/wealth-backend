import { getFirestore } from "firebase-admin/firestore";
import {
  CLINICAL_TOPICS,
  NURSING_SCHOOLS,
  NURSING_UNIVERSITIES,
  NURSING_YEARS,
  PROFESSIONAL_EXAMS,
  examRequiresPremium,
  getNursingCourse,
  getNursingYear,
  getProfessionalExam,
  type NursingCourse,
  type NursingTopicId,
} from "../data/nursingCatalog";
import {
  checkNursingAnswer,
  getClinicalScenarios,
  getNursingQuestions,
  stripNursingAnswer,
  type NursingOptionKey,
} from "../data/nursingQuestions";

export type NursingProfile = {
  userId: string;
  university: string;
  universityLabel: string;
  school: string;
  year: number;
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CourseProgress = {
  courseId: string;
  courseName: string;
  topicId: string;
  subtopics: string[];
  attempted: number;
  correct: number;
  totalQuestions: number;
  accuracy: number;
  progress: number;
};

function nowIso() {
  return new Date().toISOString();
}

export async function getNursingProfile(userId: string): Promise<NursingProfile | null> {
  const db = getFirestore();
  const snap = await db.collection("nursingProfiles").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as NursingProfile;
}

export async function saveNursingProfile(
  userId: string,
  input: { university: string; school: string; year: number; customUniversityLabel?: string }
): Promise<NursingProfile> {
  const OTHER = "__other__";
  const uni = NURSING_UNIVERSITIES.find((u) => u.id === input.university);
  let university: string;
  let universityLabel: string;

  if (uni) {
    university = uni.id;
    universityLabel = uni.label;
  } else if (input.university === OTHER || Boolean(String(input.customUniversityLabel || "").trim())) {
    universityLabel = String(input.customUniversityLabel || "").trim();
    if (!universityLabel) throw new Error("Enter your university name.");
    university = "custom";
  } else {
    throw new Error("Invalid university.");
  }

  if (!NURSING_SCHOOLS.includes(input.school)) throw new Error("Invalid school.");
  if (!getNursingYear(input.year)) throw new Error("Invalid year.");

  const db = getFirestore();
  const ref = db.collection("nursingProfiles").doc(userId);
  const existing = await ref.get();
  const profile: NursingProfile = {
    userId,
    university,
    universityLabel,
    school: input.school,
    year: input.year,
    setupComplete: true,
    createdAt: existing.exists ? String(existing.data()?.createdAt || nowIso()) : nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(profile, { merge: true });
  return profile;
}

async function getCoursePerformance(userId: string, courseId: string) {
  const db = getFirestore();
  const snap = await db.collection("nursingCoursePerformance").doc(`${userId}_${courseId}`).get();
  if (!snap.exists) return { attempted: 0, correct: 0 };
  const data = snap.data() || {};
  return { attempted: Number(data.attempted || 0), correct: Number(data.correct || 0) };
}

export async function getCourseProgressList(userId: string, year: number): Promise<CourseProgress[]> {
  const yearData = getNursingYear(year);
  if (!yearData) return [];

  const results: CourseProgress[] = [];
  for (const course of yearData.courses) {
    const perf = await getCoursePerformance(userId, course.id);
    const accuracy = perf.attempted ? Math.round((perf.correct / perf.attempted) * 100) : 0;
    const progress = course.totalQuestions
      ? Math.min(100, Math.round((perf.attempted / course.totalQuestions) * 100))
      : 0;
    results.push({
      courseId: course.id,
      courseName: course.name,
      topicId: course.topicId,
      subtopics: course.subtopics,
      attempted: perf.attempted,
      correct: perf.correct,
      totalQuestions: course.totalQuestions,
      accuracy,
      progress: perf.attempted > 0 ? Math.max(progress, accuracy) : 0,
    });
  }
  return results.sort((a, b) => a.progress - b.progress);
}

export async function getNursingHome(userId: string, viewYear?: number) {
  const profile = await getNursingProfile(userId);
  const year = viewYear && getNursingYear(viewYear) ? viewYear : profile?.year || 3;
  const courses = profile ? await getCourseProgressList(userId, year) : [];
  const overallProgress = courses.length
    ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
    : 0;
  const weakAreas = courses.filter((c) => c.progress < 50).slice(0, 3);

  const perfSnap = await getFirestore()
    .collection("nursingPracticeSessions")
    .where("userId", "==", userId)
    .get();
  const examSessions = perfSnap.docs.filter((d) => d.data().type === "exam");
  const clinicalSessions = perfSnap.docs.filter((d) => d.data().type === "clinical");
  const examAvg = examSessions.length
    ? Math.round(
        examSessions.reduce((s, d) => s + Number(d.data().percentageScore || 0), 0) / examSessions.length
      )
    : null;
  const clinicalAvg = clinicalSessions.length
    ? Math.round(
        clinicalSessions.reduce((s, d) => s + Number(d.data().percentageScore || 0), 0) /
          clinicalSessions.length
      )
    : null;

  return {
    profile,
    setupRequired: !profile?.setupComplete,
    year,
    courses,
    overallProgress,
    weakAreas,
    performance: {
      examAverage: examAvg,
      clinicalAccuracy: clinicalAvg,
    },
    universities: NURSING_UNIVERSITIES,
    schools: NURSING_SCHOOLS,
    years: NURSING_YEARS.map((y) => ({ year: y.year, label: y.label })),
    professionalExams: PROFESSIONAL_EXAMS,
    clinicalTopics: CLINICAL_TOPICS,
  };
}

export async function updateCoursePerformance(
  userId: string,
  courseId: string,
  correctCount: number,
  attemptedCount: number
) {
  const db = getFirestore();
  const ref = db.collection("nursingCoursePerformance").doc(`${userId}_${courseId}`);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const attempted = Number(prev?.attempted || 0) + attemptedCount;
  const correct = Number(prev?.correct || 0) + correctCount;
  await ref.set(
    {
      userId,
      courseId,
      attempted,
      correct,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      lastPracticed: nowIso(),
    },
    { merge: true }
  );
}

export function startPracticeSession(opts: {
  topicId: NursingTopicId;
  year: number;
  courseId?: string;
  clinicalTopic?: string;
  questionType?: string;
  limit?: number;
  examId?: string;
}) {
  const topicId = opts.topicId;
  const year = opts.year;
  let questions = getNursingQuestions(topicId, year, {
    clinicalTopic: opts.clinicalTopic,
    questionType: opts.questionType,
    limit: opts.limit || 20,
  });

  if (opts.questionType === "clinical") {
    questions = getClinicalScenarios(topicId, opts.clinicalTopic, opts.limit || 10);
  }

  const questionIds = questions.map((q) => q.id);
  return {
    questionIds,
    questions: questions.map(stripNursingAnswer),
    totalQuestions: questions.length,
    durationMinutes: opts.questionType === "clinical" ? 0 : 30,
  };
}

export async function scoreNursingSession(
  userId: string,
  input: {
    topicId: NursingTopicId;
    year: number;
    courseId?: string;
    type: "course" | "clinical" | "exam";
    examId?: string;
    answers: Record<string, NursingOptionKey | null>;
    questionIds: string[];
  }
) {
  const bank = getNursingQuestions(input.topicId, input.year);
  const idSet = new Set(input.questionIds);
  const questions = bank.filter((q) => idSet.has(q.id));
  if (!questions.length) {
    const clinical = getClinicalScenarios(input.topicId).filter((q) => idSet.has(q.id));
    questions.push(...clinical);
  }

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
      scenario: qn.scenario || null,
      chosen,
      correctAnswer: qn.correctAnswer,
      isCorrect,
      rationale: qn.rationale,
      topic: qn.clinicalTopic || qn.topicId,
    };
  });

  const totalQuestions = questions.length;
  const percentageScore = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;

  if (input.courseId) {
    await updateCoursePerformance(userId, input.courseId, correctCount, totalQuestions - skippedCount);
  }

  const db = getFirestore();
  const ref = db.collection("nursingPracticeSessions").doc();
  const session = {
    userId,
    type: input.type,
    topicId: input.topicId,
    courseId: input.courseId || null,
    examId: input.examId || null,
    year: input.year,
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

export function checkAnswer(questionId: string, chosen: NursingOptionKey) {
  const result = checkNursingAnswer(questionId, chosen);
  if (!result) throw new Error("Question not found.");
  return result;
}

export function getExamAccess(examId: string, isPremium: boolean) {
  const exam = getProfessionalExam(examId);
  if (!exam) return null;
  return {
    exam,
    locked: examRequiresPremium(exam, isPremium),
  };
}

export function calculateDrugDose(type: string, params: Record<string, number>) {
  if (type === "iv-rate") {
    const volume = params.volume;
    const hours = params.hours;
    const dropFactor = params.dropFactor || 20;
    if (!volume || !hours || volume <= 0 || hours <= 0) {
      throw new Error("Volume and time must be positive values.");
    }
    const minutes = hours * 60;
    const gttsPerMin = (volume * dropFactor) / minutes;
    const mlPerHr = volume / hours;
    return {
      result: `${Math.round(gttsPerMin)} gtts/min`,
      secondary: `${mlPerHr.toFixed(1)} mL/hr`,
      formula: `${volume}mL ÷ (${hours}h × 60min) × ${dropFactor} gtts/mL = ${Math.round(gttsPerMin)} gtts/min`,
      disclaimer: "For educational purposes only. Always verify calculations independently before clinical use.",
    };
  }
  if (type === "dosage") {
    const orderedDose = params.orderedDose;
    const availableDose = params.availableDose;
    const availableVolume = params.availableVolume;
    if (!orderedDose || !availableDose || !availableVolume || availableDose <= 0) {
      throw new Error("All dosage fields must be positive values.");
    }
    const volumeToGive = (orderedDose / availableDose) * availableVolume;
    return {
      result: `${volumeToGive.toFixed(2)} mL`,
      formula: `(${orderedDose} ÷ ${availableDose}) × ${availableVolume}mL = ${volumeToGive.toFixed(2)} mL`,
      disclaimer: "For educational purposes only. Always verify calculations independently before clinical use.",
    };
  }
  if (type === "reconstitution") {
    const drugAmount = params.drugAmount;
    const diluentVolume = params.diluentVolume;
    if (!drugAmount || !diluentVolume || diluentVolume <= 0) {
      throw new Error("Drug amount and diluent volume must be positive.");
    }
    const concentration = drugAmount / diluentVolume;
    return {
      result: `${concentration.toFixed(2)} mg/mL`,
      formula: `${drugAmount}mg ÷ ${diluentVolume}mL = ${concentration.toFixed(2)} mg/mL`,
      disclaimer: "For educational purposes only. Follow manufacturer reconstitution instructions.",
    };
  }
  if (type === "paediatric") {
    const weight = params.weight;
    const dosePerKg = params.dosePerKg;
    const frequency = params.frequency || 1;
    const maxDose = params.maxDose;
    if (!weight || !dosePerKg || weight <= 0 || dosePerKg <= 0) {
      throw new Error("Weight and prescribed dose per kg must be positive.");
    }
    let calculatedDose = weight * dosePerKg * frequency;
    if (maxDose && calculatedDose > maxDose) calculatedDose = maxDose;
    return {
      result: `${calculatedDose.toFixed(2)} mg`,
      formula: `${weight}kg × ${dosePerKg}mg/kg × ${frequency} = ${calculatedDose.toFixed(2)} mg`,
      disclaimer: "For educational purposes only. Paediatric dosing requires verification against authoritative references.",
    };
  }
  throw new Error("Invalid calculator type.");
}
