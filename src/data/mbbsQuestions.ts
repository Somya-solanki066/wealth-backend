import type { MbbsPhaseId, MbbsSubjectId } from "./mbbsCatalog";

export type MbbsOptionKey = "A" | "B" | "C" | "D";

export type MbbsQuestion = {
  id: string;
  phaseId: MbbsPhaseId;
  subjectId: MbbsSubjectId;
  topicId?: string;
  questionType: "mcq" | "clinical";
  clinicalTopic?: string;
  questionNumber: number;
  scenario?: string;
  questionText: string;
  options: Record<MbbsOptionKey, string>;
  correctAnswer: MbbsOptionKey;
  rationale: string;
  difficulty: "easy" | "medium" | "hard";
};

function q(
  phaseId: MbbsPhaseId,
  subjectId: MbbsSubjectId,
  n: number,
  questionText: string,
  options: Record<MbbsOptionKey, string>,
  correct: MbbsOptionKey,
  rationale: string,
  extra?: Partial<MbbsQuestion>
): MbbsQuestion {
  const topicId = extra?.topicId || subjectId;
  const type = extra?.questionType || "mcq";
  const id = extra?.id || `${phaseId}-${subjectId}-${topicId}-q${n}`;
  return {
    id,
    phaseId,
    subjectId,
    topicId,
    questionType: type,
    questionNumber: n,
    questionText,
    options,
    correctAnswer: correct,
    rationale,
    difficulty: extra?.difficulty || "medium",
    scenario: extra?.scenario,
    clinicalTopic: extra?.clinicalTopic,
  };
}

const TOPIC_BANK: MbbsQuestion[] = [
  q(
    "pre-clinical",
    "anatomy",
    1,
    "Which structure is NOT found in the carotid triangle?",
    {
      A: "Common carotid artery",
      B: "Internal jugular vein",
      C: "Submandibular gland",
      D: "Hypoglossal nerve",
    },
    "C",
    "The submandibular gland lies in the submandibular triangle, not the carotid triangle. The carotid triangle contains the carotid arteries, IJV, vagus, hypoglossal, and ansa cervicalis.",
    { topicId: "carotid-triangle" }
  ),
  q(
    "pre-clinical",
    "anatomy",
    2,
    "The common carotid artery bifurcates at the level of:",
    {
      A: "Cricoid cartilage",
      B: "Thyroid cartilage (C4)",
      C: "Hyoid bone",
      D: "C6 vertebral body",
    },
    "B",
    "The common carotid bifurcates at the upper border of the thyroid cartilage (C4) into internal and external carotid arteries.",
    { topicId: "carotid-triangle" }
  ),
  q(
    "pre-clinical",
    "anatomy",
    3,
    "Damage to the vagus nerve in the carotid triangle would result in:",
    {
      A: "Loss of tongue movement",
      B: "Hoarseness due to recurrent laryngeal nerve involvement",
      C: "Horner's syndrome only",
      D: "Loss of facial sensation",
    },
    "B",
    "The vagus nerve gives off the recurrent laryngeal nerve which supplies all intrinsic laryngeal muscles except cricothyroid. Injury causes hoarseness.",
    { topicId: "carotid-triangle" }
  ),
  q(
    "pre-clinical",
    "physiology",
    1,
    "Which factor most increases cardiac output during exercise?",
    {
      A: "Decreased venous return",
      B: "Increased heart rate and stroke volume",
      C: "Bradycardia",
      D: "Decreased sympathetic tone",
    },
    "B",
    "Exercise increases cardiac output primarily through increased heart rate and stroke volume via sympathetic activation.",
    { topicId: "cvs-physiology" }
  ),
  q(
    "pre-clinical",
    "physiology",
    2,
    "In the nephron, the majority of sodium reabsorption occurs in the:",
    {
      A: "Distal convoluted tubule",
      B: "Proximal convoluted tubule",
      C: "Loop of Henle only",
      D: "Collecting duct",
    },
    "B",
    "Approximately 65–70% of filtered sodium is reabsorbed in the proximal convoluted tubule.",
    { topicId: "renal-physiology" }
  ),
  q(
    "pre-clinical",
    "biochemistry",
    1,
    "Competitive inhibition of an enzyme is characterised by:",
    {
      A: "Decreased Vmax, unchanged Km",
      B: "Unchanged Vmax, increased apparent Km",
      C: "Decreased Vmax and Km",
      D: "Irreversible binding to active site",
    },
    "B",
    "Competitive inhibitors increase apparent Km but Vmax remains unchanged because high substrate can overcome inhibition.",
    { topicId: "enzymes" }
  ),
  q(
    "pre-clinical",
    "biochemistry",
    2,
    "Glycolysis yields a net gain of how many ATP per glucose molecule?",
    {
      A: "1 ATP",
      B: "2 ATP",
      C: "4 ATP",
      D: "36 ATP",
    },
    "B",
    "Aerobic glycolysis produces 2 net ATP per glucose (4 produced, 2 used in priming steps).",
    { topicId: "metabolism" }
  ),
];

const CLINICAL_BANK: MbbsQuestion[] = [
  q(
    "clinical",
    "surgery",
    1,
    "What is the most likely diagnosis?",
    {
      A: "Pyloric stenosis",
      B: "Duodenal atresia",
      C: "Hirschsprung's disease",
      D: "Intussusception",
    },
    "B",
    "The double-bubble sign on abdominal X-ray with bile-stained vomiting and scaphoid abdomen in a neonate is classic for duodenal atresia. Obstruction is proximal to the ampulla of Vater, hence bile-stained vomitus. Definitive management is surgical (duodenoduodenostomy).",
    {
      questionType: "clinical",
      clinicalTopic: "neonatology",
      scenario:
        "A 6-hour-old neonate develops bile-stained vomiting. On examination there is a scaphoid abdomen. Abdominal X-ray shows a double-bubble sign.",
      id: "clinical-surgery-neonatology-q1",
    }
  ),
  q(
    "clinical",
    "internal-medicine",
    1,
    "What is the most likely diagnosis, and what is the immediate next step in management?",
    {
      A: "Anterior STEMI — start heparin infusion",
      B: "Inferior STEMI — activate cath lab / thrombolysis",
      C: "Unstable angina — start beta-blocker only",
      D: "Pericarditis — NSAIDs only",
    },
    "B",
    "ST elevation in II, III, aVF indicates inferior STEMI. Immediate reperfusion (PCI or thrombolysis) is indicated.",
    {
      questionType: "clinical",
      clinicalTopic: "cardiology",
      scenario:
        "A 54-year-old man presents with sudden crushing central chest pain radiating to the left arm, sweating, and nausea. ECG shows ST elevation in leads II, III, and aVF.",
      id: "clinical-medicine-cardiology-q1",
    }
  ),
  q(
    "clinical",
    "paediatrics",
    1,
    "What is the most likely diagnosis and immediate management?",
    {
      A: "Meningococcal sepsis — IV ceftriaxone immediately",
      B: "Viral meningitis — oral paracetamol and discharge",
      C: "Febrile convulsion — no antibiotics needed",
      D: "Measles — vitamin A only",
    },
    "A",
    "Fever + meningism + purpuric rash = meningococcal disease until proven otherwise. Immediate IV antibiotics save lives.",
    {
      questionType: "clinical",
      clinicalTopic: "infectious-disease",
      scenario:
        "A 2-year-old child presents with high fever, neck stiffness, and a non-blanching purpuric rash.",
      id: "clinical-paediatrics-infectious-q1",
    }
  ),
  q(
    "clinical",
    "obg",
    1,
    "What is the most likely diagnosis and immediate action?",
    {
      A: "Placenta praevia — expectant management at home",
      B: "Placental abruption — emergency caesarean section",
      C: "Normal labour — observe for 12 hours",
      D: "Uterine rupture — tocolysis",
    },
    "B",
    "Painful bleeding + tense uterus + fetal bradycardia = abruption with fetal compromise. Emergency delivery is required.",
    {
      questionType: "clinical",
      clinicalTopic: "labour",
      scenario:
        "A 26-year-old primigravida at 38 weeks has heavy vaginal bleeding, a tense tender uterus, and fetal heart rate of 80 bpm.",
      id: "clinical-obg-labour-q1",
    }
  ),
];

function genericMcqs(
  phaseId: MbbsPhaseId,
  subjectId: MbbsSubjectId,
  topicId: string,
  count = 15
): MbbsQuestion[] {
  const existing = TOPIC_BANK.filter((q) => q.topicId === topicId || q.subjectId === subjectId);
  const items = [...existing];
  for (let n = existing.length + 1; n <= count; n += 1) {
    items.push(
      q(
        phaseId,
        subjectId,
        n,
        `Question ${n}: Which statement is correct regarding ${topicId.replace(/-/g, " ")}?`,
        {
          A: "Option A — assess systematically before acting",
          B: "Option B — treat without full assessment",
          C: "Option C — discharge without follow-up",
          D: "Option D — ignore clinical findings",
        },
        "A",
        "Systematic assessment and evidence-based reasoning are the foundation of safe clinical practice.",
        { topicId }
      )
    );
  }
  return items;
}

function genericClinical(
  phaseId: MbbsPhaseId,
  subjectId: MbbsSubjectId,
  clinicalTopic: string,
  count = 10
): MbbsQuestion[] {
  const existing = CLINICAL_BANK.filter(
    (q) => q.clinicalTopic === clinicalTopic || q.subjectId === subjectId
  );
  const items = [...existing];
  for (let n = existing.length + 1; n <= count; n += 1) {
    items.push(
      q(
        phaseId,
        subjectId,
        n,
        "What is the most likely diagnosis, and what is the most appropriate next step in management?",
        {
          A: "Assess systematically — history, examination, and targeted investigations",
          B: "Treat empirically without assessment",
          C: "Discharge without follow-up",
          D: "Delay management for 24 hours",
        },
        "A",
        "Systematic clinical assessment before definitive management is essential for patient safety.",
        {
          questionType: "clinical",
          clinicalTopic,
          scenario: `Clinical vignette ${n}: A patient presents with symptoms relevant to ${clinicalTopic.replace(/-/g, " ")}. Examination and investigations guide your clinical reasoning.`,
          id: `clinical-${subjectId}-${clinicalTopic}-q${n}`,
        }
      )
    );
  }
  return items;
}

const ALL_QUESTIONS: MbbsQuestion[] = [
  ...TOPIC_BANK,
  ...CLINICAL_BANK,
  ...genericMcqs("pre-clinical", "anatomy", "head-neck", 10),
  ...genericMcqs("pre-clinical", "biochemistry", "metabolism", 10),
  ...genericMcqs("pre-clinical", "biochemistry", "enzymes", 10),
  ...genericMcqs("pre-clinical", "physiology", "renal-physiology", 10),
  ...genericClinical("clinical", "surgery", "gi-surgery", 8),
  ...genericClinical("clinical", "internal-medicine", "cardiology", 8),
];

export function getMbbsQuestions(opts: {
  phaseId?: MbbsPhaseId;
  subjectId?: MbbsSubjectId;
  topicId?: string;
  questionType?: string;
  clinicalTopic?: string;
  limit?: number;
}): MbbsQuestion[] {
  let pool = ALL_QUESTIONS;
  if (opts.phaseId) pool = pool.filter((q) => q.phaseId === opts.phaseId);
  if (opts.subjectId) pool = pool.filter((q) => q.subjectId === opts.subjectId);
  if (opts.topicId) pool = pool.filter((q) => q.topicId === opts.topicId || q.subjectId === opts.topicId);
  if (opts.questionType === "clinical") {
    pool = pool.filter((q) => q.questionType === "clinical");
    if (opts.clinicalTopic) pool = pool.filter((q) => q.clinicalTopic === opts.clinicalTopic);
  } else if (opts.questionType === "mcq") {
    pool = pool.filter((q) => q.questionType === "mcq");
  }
  const limit = opts.limit || pool.length;
  return pool.slice(0, limit);
}

/** Legacy scenario API */
export function getMbbsScenarios(phaseId: MbbsPhaseId, subjectId: MbbsSubjectId): MbbsQuestion[] {
  return getMbbsQuestions({ phaseId, subjectId, questionType: "clinical", limit: 15 });
}

export function stripMbbsAnswer(qn: MbbsQuestion) {
  const { correctAnswer, rationale, ...rest } = qn;
  void correctAnswer;
  void rationale;
  return rest;
}

export function checkMbbsAnswer(questionId: string, chosen: MbbsOptionKey) {
  const qn = ALL_QUESTIONS.find((q) => q.id === questionId);
  if (!qn) return null;
  const isCorrect = chosen === qn.correctAnswer;
  return {
    isCorrect,
    correctAnswer: qn.correctAnswer,
    rationale: qn.rationale,
    topic: qn.topicId || qn.clinicalTopic || qn.subjectId,
  };
}

export function getQuestionById(id: string) {
  return ALL_QUESTIONS.find((q) => q.id === id);
}
