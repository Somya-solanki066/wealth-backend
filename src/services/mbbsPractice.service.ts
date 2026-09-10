import { getFirestore } from "firebase-admin/firestore";
import {
  CLINICAL_SPECIALTIES,
  CURATED_TOPIC_VIDEOS,
  DRUG_REFERENCES,
  LAB_VALUE_CATEGORIES,
  MBBS_COLLEGES,
  MBBS_PHASES,
  MBBS_TOPICS,
  MBBS_UNIVERSITIES,
  MDCN_EXAMS,
  SCORING_TOOLS,
  getMbbsPhase,
  getMbbsSubject,
  getMbbsTopic,
  getMbbsTopicsForSubject,
  mdcnRequiresPremium,
  searchMbbsTopics,
  type MbbsPhaseId,
  type MbbsSubjectId,
} from "../data/mbbsCatalog";
import {
  checkMbbsAnswer,
  getMbbsQuestions,
  stripMbbsAnswer,
  type MbbsOptionKey,
} from "../data/mbbsQuestions";

export type MbbsProfile = {
  userId: string;
  university: string;
  universityLabel: string;
  college: string;
  year: number;
  phase: MbbsPhaseId;
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  icon: string;
  subtopics: string[];
  attempted: number;
  correct: number;
  totalQuestions: number;
  accuracy: number;
  progress: number;
};

export type WeakTopic = {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  progress: number;
};

function nowIso() {
  return new Date().toISOString();
}

export async function getMbbsProfile(userId: string): Promise<MbbsProfile | null> {
  const snap = await getFirestore().collection("mbbsProfiles").doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as MbbsProfile;
}

export async function saveMbbsProfile(
  userId: string,
  input: {
    university: string;
    college: string;
    year: number;
    phase: MbbsPhaseId;
    customUniversityLabel?: string;
  }
): Promise<MbbsProfile> {
  const OTHER = "__other__";
  const uni = MBBS_UNIVERSITIES.find((u) => u.id === input.university);
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

  if (!MBBS_COLLEGES.includes(input.college)) throw new Error("Invalid college.");
  const phase = getMbbsPhase(input.phase);
  if (!phase) throw new Error("Invalid phase.");
  if (!phase.years.includes(input.year)) {
    throw new Error(`Year ${input.year} is not valid for ${phase.label}.`);
  }

  const db = getFirestore();
  const ref = db.collection("mbbsProfiles").doc(userId);
  const existing = await ref.get();
  const profile: MbbsProfile = {
    userId,
    university,
    universityLabel,
    college: input.college,
    year: input.year,
    phase: input.phase,
    setupComplete: true,
    createdAt: existing.exists ? String(existing.data()?.createdAt || nowIso()) : nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set(profile, { merge: true });
  return profile;
}

async function getSubjectPerformance(userId: string, subjectId: string) {
  const snap = await getFirestore()
    .collection("mbbsSubjectPerformance")
    .doc(`${userId}_${subjectId}`)
    .get();
  if (!snap.exists) return { attempted: 0, correct: 0 };
  const data = snap.data() || {};
  return { attempted: Number(data.attempted || 0), correct: Number(data.correct || 0) };
}

async function getTopicPerformance(userId: string, topicId: string) {
  const snap = await getFirestore()
    .collection("mbbsTopicPerformance")
    .doc(`${userId}_${topicId}`)
    .get();
  if (!snap.exists) return { attempted: 0, correct: 0 };
  const data = snap.data() || {};
  return { attempted: Number(data.attempted || 0), correct: Number(data.correct || 0) };
}

export async function getSubjectProgressList(
  userId: string,
  phaseId: MbbsPhaseId
): Promise<SubjectProgress[]> {
  const phase = getMbbsPhase(phaseId);
  if (!phase) return [];

  const results: SubjectProgress[] = [];
  for (const subject of phase.subjects) {
    const perf = await getSubjectPerformance(userId, subject.id);
    const accuracy = perf.attempted ? Math.round((perf.correct / perf.attempted) * 100) : 0;
    const completion = subject.totalQuestions
      ? Math.min(100, Math.round((perf.attempted / subject.totalQuestions) * 100))
      : 0;
    results.push({
      subjectId: subject.id,
      subjectName: subject.name,
      icon: subject.icon,
      subtopics: subject.subtopics,
      attempted: perf.attempted,
      correct: perf.correct,
      totalQuestions: subject.totalQuestions,
      accuracy,
      progress: perf.attempted > 0 ? Math.max(completion, accuracy) : completion,
    });
  }
  return results.sort((a, b) => a.progress - b.progress);
}

export async function getWeakTopics(userId: string, phaseId: MbbsPhaseId): Promise<WeakTopic[]> {
  const phase = getMbbsPhase(phaseId);
  if (!phase) return [];
  const weak: WeakTopic[] = [];

  for (const subject of phase.subjects) {
    const topics = getMbbsTopicsForSubject(subject.id);
    for (const topic of topics) {
      const perf = await getTopicPerformance(userId, topic.id);
      const total = topic.mcqCount || 30;
      const progress = perf.attempted
        ? Math.round((perf.correct / Math.max(perf.attempted, 1)) * 100)
        : 0;
      const completion = Math.min(100, Math.round((perf.attempted / total) * 100));
      const score = perf.attempted > 0 ? Math.min(progress, completion) : 0;
      if (score < 50) {
        weak.push({
          subjectId: subject.id,
          subjectName: subject.name,
          topicId: topic.id,
          topicName: topic.name,
          progress: score,
        });
      }
    }
  }
  return weak.sort((a, b) => a.progress - b.progress).slice(0, 6);
}

export async function getMbbsHome(userId: string, viewPhase?: MbbsPhaseId) {
  const profile = await getMbbsProfile(userId);
  const phaseId = viewPhase && getMbbsPhase(viewPhase) ? viewPhase : profile?.phase || "pre-clinical";
  const phase = getMbbsPhase(phaseId)!;
  const subjects = profile ? await getSubjectProgressList(userId, phaseId) : [];
  const overallProgress = subjects.length
    ? Math.round(subjects.reduce((sum, s) => sum + s.progress, 0) / subjects.length)
    : 0;
  const weakAreas = profile ? await getWeakTopics(userId, phaseId) : [];

  const perfSnap = await getFirestore()
    .collection("mbbsPracticeSessions")
    .where("userId", "==", userId)
    .get();
  const clinicalSessions = perfSnap.docs.filter((d) => d.data().type === "clinical");
  const mdcnSessions = perfSnap.docs.filter((d) => d.data().type === "mdcn");
  const clinicalAvg = clinicalSessions.length
    ? Math.round(
        clinicalSessions.reduce((s, d) => s + Number(d.data().percentageScore || 0), 0) /
          clinicalSessions.length
      )
    : null;
  const mdcnAvg = mdcnSessions.length
    ? Math.round(
        mdcnSessions.reduce((s, d) => s + Number(d.data().percentageScore || 0), 0) /
          mdcnSessions.length
      )
    : null;

  return {
    profile,
    setupRequired: !profile?.setupComplete,
    phaseId,
    phaseLabel: phase.label,
    yearLabel: phase.yearLabel,
    subjects,
    overallProgress,
    weakAreas,
    performance: { clinicalAccuracy: clinicalAvg, mdcnAverage: mdcnAvg },
    universities: MBBS_UNIVERSITIES,
    colleges: MBBS_COLLEGES,
    phases: MBBS_PHASES.map((p) => ({
      id: p.id,
      label: p.label,
      years: p.years,
      yearLabel: p.yearLabel,
    })),
    clinicalSpecialties: CLINICAL_SPECIALTIES,
    mdcnExams: MDCN_EXAMS,
    referenceTools: [
      { id: "lab-values", name: "Normal Lab Values", icon: "📊" },
      { id: "scoring-tools", name: "Clinical Scoring Tools", icon: "⚖️" },
      { id: "drug-reference", name: "Drug Reference", icon: "💊" },
      { id: "mdcn-prep", name: "MDCN Exam Prep", icon: "🏆" },
      { id: "study-planner", name: "Study Planner", icon: "📅" },
    ],
  };
}

export async function updateSubjectPerformance(
  userId: string,
  subjectId: string,
  correctCount: number,
  attemptedCount: number
) {
  const ref = getFirestore().collection("mbbsSubjectPerformance").doc(`${userId}_${subjectId}`);
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

export async function updateTopicPerformance(
  userId: string,
  topicId: string,
  correctCount: number,
  attemptedCount: number
) {
  const ref = getFirestore().collection("mbbsTopicPerformance").doc(`${userId}_${topicId}`);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const attempted = Number(prev?.attempted || 0) + attemptedCount;
  const correct = Number(prev?.correct || 0) + correctCount;
  await ref.set(
    {
      userId,
      topicId,
      attempted,
      correct,
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      lastPracticed: nowIso(),
    },
    { merge: true }
  );
}

export function startPracticeSession(opts: {
  phaseId: MbbsPhaseId;
  subjectId?: MbbsSubjectId;
  topicId?: string;
  questionType?: string;
  clinicalTopic?: string;
  limit?: number;
  mdcnExamId?: string;
}) {
  const questions = getMbbsQuestions({
    phaseId: opts.phaseId,
    subjectId: opts.subjectId,
    topicId: opts.topicId,
    questionType: opts.questionType,
    clinicalTopic: opts.clinicalTopic,
    limit: opts.limit || 20,
  });

  const questionIds = questions.map((q) => q.id);
  const isClinical = opts.questionType === "clinical";
  return {
    questionIds,
    questions: questions.map(stripMbbsAnswer),
    totalQuestions: questions.length,
    durationMinutes: isClinical ? 0 : 30,
  };
}

export async function scoreMbbsSession(
  userId: string,
  input: {
    phaseId: MbbsPhaseId;
    subjectId?: string;
    topicId?: string;
    type: "topic" | "clinical" | "mdcn" | "subject";
    mdcnExamId?: string;
    answers: Record<string, MbbsOptionKey | null>;
    questionIds: string[];
  }
) {
  const bank = getMbbsQuestions({ phaseId: input.phaseId });
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
      scenario: qn.scenario || null,
      chosen,
      correctAnswer: qn.correctAnswer,
      isCorrect,
      rationale: qn.rationale,
      topic: qn.topicId || qn.clinicalTopic || qn.subjectId,
    };
  });

  const totalQuestions = questions.length;
  const percentageScore = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const attemptedCount = totalQuestions - skippedCount;

  if (input.subjectId) {
    await updateSubjectPerformance(userId, input.subjectId, correctCount, attemptedCount);
  }
  if (input.topicId) {
    await updateTopicPerformance(userId, input.topicId, correctCount, attemptedCount);
  }

  const ref = getFirestore().collection("mbbsPracticeSessions").doc();
  const session = {
    userId,
    type: input.type,
    phaseId: input.phaseId,
    subjectId: input.subjectId || null,
    topicId: input.topicId || null,
    mdcnExamId: input.mdcnExamId || null,
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

export function checkAnswer(questionId: string, chosen: MbbsOptionKey) {
  const result = checkMbbsAnswer(questionId, chosen);
  if (!result) throw new Error("Question not found.");
  return result;
}

export function getTopicDetail(topicId: string) {
  const topic = getMbbsTopic(topicId);
  if (!topic) return null;
  const subject = getMbbsSubject(topic.subjectId);
  const parent = topic.parentTopic ? getMbbsTopic(topic.parentTopic) : null;
  const mcqs = getMbbsQuestions({ topicId, limit: 5 }).map((q) => ({
    id: q.id,
    preview: q.questionText,
  }));
  const videos = CURATED_TOPIC_VIDEOS[topicId] || [];
  return { topic, subject, parent, mcqPreviews: mcqs, mcqCount: topic.mcqCount, videos, videoCount: topic.videoCount };
}

export function searchTopics(query: string) {
  const results = searchMbbsTopics(query);
  return results.map((t) => {
    const subject = getMbbsSubject(t.subjectId);
    const parent = t.parentTopic ? getMbbsTopic(t.parentTopic) : null;
    return {
      ...t,
      subjectName: subject?.name || t.subjectId,
      parentName: parent?.name || null,
    };
  });
}

export function getLabValues() {
  return LAB_VALUE_CATEGORIES;
}

export function getScoringTools() {
  return SCORING_TOOLS;
}

export function calculateScoringTool(toolId: string, params: Record<string, number>) {
  if (toolId === "apgar") {
    const appearance = params.appearance ?? 0;
    const pulse = params.pulse ?? 0;
    const grimace = params.grimace ?? 0;
    const activity = params.activity ?? 0;
    const respiration = params.respiration ?? 0;
    const total = appearance + pulse + grimace + activity + respiration;
    let interpretation = "Moderately abnormal — may need resuscitation";
    if (total >= 7) interpretation = "Normal — routine care";
    else if (total <= 3) interpretation = "Severely abnormal — immediate resuscitation";
    return {
      result: `${total}/10`,
      interpretation,
      disclaimer: "APGAR is assessed at 1 and 5 minutes. For educational purposes only.",
    };
  }
  if (toolId === "gcs") {
    const eye = params.eye ?? 4;
    const verbal = params.verbal ?? 5;
    const motor = params.motor ?? 6;
    const total = eye + verbal + motor;
    let interpretation = "Minor head injury";
    if (total <= 8) interpretation = "Severe head injury — consider intubation";
    else if (total <= 12) interpretation = "Moderate head injury";
    return {
      result: `${total}/15`,
      interpretation,
      disclaimer: "GCS for educational purposes. Always assess airway, breathing, circulation.",
    };
  }
  if (toolId === "curb65") {
    const confusion = params.confusion ?? 0;
    const urea = params.urea ?? 0;
    const rr = params.rr ?? 0;
    const bp = params.bp ?? 0;
    const age = params.age65 ?? 0;
    const total = confusion + urea + rr + bp + age;
    let interpretation = "Low risk — consider home treatment";
    if (total >= 3) interpretation = "High risk — consider ICU admission";
    else if (total === 2) interpretation = "Moderate risk — consider hospital admission";
    return {
      result: `${total}/5`,
      interpretation,
      disclaimer: "CURB-65 for educational purposes. Use alongside clinical judgement.",
    };
  }
  if (toolId === "wells") {
    const total = Object.values(params).reduce((s, v) => s + (v || 0), 0);
    let interpretation = "Low probability — PE unlikely";
    if (total > 6) interpretation = "High probability — PE likely, investigate";
    else if (total >= 2) interpretation = "Moderate probability — consider D-dimer / imaging";
    return {
      result: `${total} points`,
      interpretation,
      disclaimer: "Wells score for educational purposes. Clinical context is essential.",
    };
  }
  if (toolId === "child-pugh") {
    const total = Object.values(params).reduce((s, v) => s + (v || 0), 0);
    let interpretation = "Class A — well-compensated";
    if (total > 9) interpretation = "Class C — poor prognosis";
    else if (total >= 7) interpretation = "Class B — significant functional compromise";
    return {
      result: `${total} points`,
      interpretation,
      disclaimer: "Child-Pugh for educational purposes. Verify with current guidelines.",
    };
  }
  throw new Error("Unknown scoring tool.");
}

export function searchDrugReference(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return DRUG_REFERENCES;
  return DRUG_REFERENCES.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.class.toLowerCase().includes(q) ||
      d.uses.toLowerCase().includes(q)
  );
}

export function getMdcnExam(examId: string) {
  return MDCN_EXAMS.find((e) => e.id === examId);
}

export function getMdcnAccess(examId: string, isPremium: boolean) {
  const exam = getMdcnExam(examId);
  if (!exam) return null;
  return { exam, locked: mdcnRequiresPremium(exam, isPremium) };
}
