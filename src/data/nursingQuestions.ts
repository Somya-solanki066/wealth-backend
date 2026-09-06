import type { NursingTopicId } from "./nursingCatalog";

export type NursingOptionKey = "A" | "B" | "C" | "D";

export type NursingQuestion = {
  id: string;
  topicId: NursingTopicId;
  year: number;
  questionNumber: number;
  questionText: string;
  options: Record<NursingOptionKey, string>;
  correctAnswer: NursingOptionKey;
  rationale: string;
  scenario?: string;
  clinicalTopic?: string;
  questionType?: "standard" | "clinical" | "exam";
  difficulty?: string;
};

function q(
  topicId: NursingTopicId,
  year: number,
  n: number,
  text: string,
  options: Record<NursingOptionKey, string>,
  correct: NursingOptionKey,
  rationale: string,
  extra?: Partial<NursingQuestion>
): NursingQuestion {
  return {
    id: `${topicId}-y${year}-q${n}`,
    topicId,
    year,
    questionNumber: n,
    questionText: text,
    options,
    correctAnswer: correct,
    rationale,
    questionType: "standard",
    difficulty: "medium",
    ...extra,
  };
}

const CLINICAL_SCENARIOS: NursingQuestion[] = [
  q(
    "medsurg-ii",
    3,
    100,
    "As the nurse, your IMMEDIATE priority action is:",
    {
      A: "Administer oral aspirin 300mg immediately",
      B: "Place patient in high Fowler's position and give oxygen",
      C: "Call the doctor and prepare for emergency cardiac care",
      D: "Take full nursing history before any intervention",
    },
    "C",
    "The patient shows classic STEMI signs. Immediate escalation to medical team is the nurse's priority while simultaneously positioning for comfort and preparing emergency equipment.",
    {
      scenario:
        "CLINICAL SCENARIO:\n\nA 52-year-old male patient is admitted with crushing chest pain radiating to his left arm. His BP is 160/100 mmHg, pulse 110 bpm, RR 22/min. He is diaphoretic and anxious. ECG shows ST elevation in leads II, III and aVF.",
      clinicalTopic: "cardiovascular",
      questionType: "clinical",
    }
  ),
  q(
    "medsurg-ii",
    3,
    101,
    "Which assessment finding is MOST concerning in this patient?",
    {
      A: "Mild anxiety",
      B: "ST elevation on ECG",
      C: "Elevated blood pressure",
      D: "Increased respiratory rate",
    },
    "B",
    "ST elevation indicates acute myocardial infarction requiring immediate intervention.",
    {
      scenario:
        "A 58-year-old woman presents with chest discomfort, nausea, and diaphoresis. ECG shows ST elevation in anterior leads.",
      clinicalTopic: "cardiovascular",
      questionType: "clinical",
    }
  ),
  q(
    "medsurg-ii",
    3,
    102,
    "The nurse's FIRST action for a patient with acute shortness of breath and wheezing is:",
    {
      A: "Administer IV fluids rapidly",
      B: "Assess airway and administer bronchodilator as ordered",
      C: "Place in supine position",
      D: "Restrict fluids",
    },
    "B",
    "Airway and breathing assessment is priority. Bronchodilators address bronchospasm in asthma/COPD exacerbation.",
    {
      scenario:
        "A 45-year-old male with history of asthma presents with acute dyspnoea, audible wheeze, and SpO2 of 88% on room air.",
      clinicalTopic: "respiratory",
      questionType: "clinical",
    }
  ),
];

const TOPIC_QUESTIONS: Partial<Record<NursingTopicId, NursingQuestion[]>> = {
  "medsurg-ii": [
    q("medsurg-ii", 3, 1, "A post-operative patient complains of sudden chest pain and shortness of breath. The PRIORITY nursing action is:", { A: "Administer analgesia", B: "Assess airway, breathing, circulation", C: "Encourage deep breathing", D: "Document and continue observations" }, "B", "ABCs first — rule out pulmonary embolism or respiratory compromise."),
    q("medsurg-ii", 3, 2, "Which finding is MOST characteristic of hypovolaemic shock?", { A: "Bounding pulse", B: "Warm flushed skin", C: "Tachycardia and hypotension", D: "Bradycardia" }, "C", "Compensatory tachycardia with falling BP indicates volume loss."),
    ...CLINICAL_SCENARIOS.filter((s) => s.topicId === "medsurg-ii"),
  ],
  medsurg: [
    q("medsurg", 3, 1, "A post-operative patient complains of sudden chest pain and shortness of breath. The PRIORITY nursing action is:", { A: "Administer analgesia", B: "Assess airway, breathing, circulation", C: "Encourage deep breathing", D: "Document and continue observations" }, "B", "ABCs first."),
    q("medsurg", 3, 2, "The normal range for adult respiratory rate is:", { A: "8–12/min", B: "12–20/min", C: "20–30/min", D: "30–40/min" }, "B", "12–20 breaths per minute at rest for adults."),
  ],
  mch: [
    q("mch", 3, 1, "During antenatal care in Nigeria, ferrous sulphate is given primarily to prevent:", { A: "Pre-eclampsia", B: "Iron-deficiency anaemia", C: "Gestational diabetes", D: "UTI" }, "B", "Routine iron supplementation reduces maternal anaemia."),
    q("mch", 3, 2, "The Apgar score is assessed at:", { A: "1 and 5 minutes after birth", B: "30 minutes only", C: "Before delivery", D: "24 hours after birth" }, "A", "Standard newborn assessment at 1 and 5 minutes."),
    q("mch", 3, 3, "Exclusive breastfeeding is recommended for the first:", { A: "3 months", B: "6 months", C: "9 months", D: "12 months" }, "B", "WHO/Nigeria guideline: exclusive breastfeeding for 6 months."),
  ],
  "community-health": [
    q("community-health", 3, 1, "Primary Health Care (PHC) in Nigeria emphasises:", { A: "Tertiary hospital care only", B: "Accessible, community-based preventive care", C: "Private specialist referrals", D: "International treatment abroad" }, "B", "PHC focuses on prevention and community access."),
    q("community-health", 3, 2, "Oral Rehydration Therapy (ORT) is FIRST-LINE treatment for:", { A: "Mild dehydration from diarrhoea", B: "Severe burns", C: "Hypertensive crisis", D: "Malaria with anaemia" }, "A", "ORT is cornerstone of diarrhoea management."),
  ],
  pharmacology: [
    q("pharmacology", 3, 1, "Before administering any medication, the nurse must verify:", { A: "Only patient name", B: "Right patient, drug, dose, route, time", C: "Only the prescription date", D: "Only doctor's signature" }, "B", "The five rights of medication administration."),
    q("pharmacology", 3, 2, "A patient prescribed 500mg paracetamol from 250mg/5mL suspension needs:", { A: "5 mL", B: "10 mL", C: "15 mL", D: "20 mL" }, "B", "500mg ÷ 250mg = 2 × 5mL = 10mL."),
  ],
  "mental-health": [
    q("mental-health", 3, 1, "Therapeutic communication with an anxious patient should:", { A: "Use clichés like 'calm down'", B: "Be calm, empathetic, and non-judgemental", C: "Avoid eye contact", D: "Change the subject quickly" }, "B", "Empathy and active listening build trust."),
  ],
  icu: [
    q("icu", 4, 1, "Normal adult MAP (Mean Arterial Pressure) is approximately:", { A: "40–50 mmHg", B: "70–100 mmHg", C: "120–140 mmHg", D: "160–180 mmHg" }, "B", "MAP 70–100 mmHg supports organ perfusion."),
  ],
  "emergency-nursing": [
    q("emergency-nursing", 5, 1, "In triage, a patient with airway compromise should be categorised as:", { A: "Green — non-urgent", B: "Red — immediate", C: "Blue — deceased", D: "White — administrative" }, "B", "Airway problems require immediate intervention."),
  ],
  fundamentals: [
    q("fundamentals", 1, 1, "The normal adult resting heart rate range is:", { A: "40–60 bpm", B: "60–100 bpm", C: "100–140 bpm", D: "140–180 bpm" }, "B", "60–100 beats per minute for adults at rest."),
  ],
  "anatomy-physiology": [
    q("anatomy-physiology", 1, 1, "The primary function of the kidneys is:", { A: "Digestion", B: "Filtration of blood and urine formation", C: "Gas exchange", D: "Hormone production only" }, "B", "Kidneys filter waste and regulate fluid/electrolytes."),
  ],
  "leadership-research": [
    q("leadership-research", 5, 1, "Evidence-based practice integrates:", { A: "Tradition only", B: "Best research, clinical expertise, and patient values", C: "Opinion only", D: "Social media advice" }, "B", "EBP combines research, expertise, and patient preference."),
  ],
};

function genericQuestions(topicId: NursingTopicId, year: number, count = 20): NursingQuestion[] {
  const existing = TOPIC_QUESTIONS[topicId] || [];
  const items = [...existing];
  for (let n = existing.length + 1; n <= count; n += 1) {
    items.push(
      q(
        topicId,
        year,
        n,
        `Clinical scenario ${n}: Which nursing action is MOST appropriate for this patient?`,
        {
          A: "Assess the patient first",
          B: "Document without assessment",
          C: "Delay intervention",
          D: "Ignore patient concerns",
        },
        "A",
        "Assessment precedes intervention in the nursing process."
      )
    );
  }
  return items;
}

export function getNursingQuestions(
  topicId: NursingTopicId,
  year: number,
  opts?: { clinicalTopic?: string; questionType?: string; limit?: number }
): NursingQuestion[] {
  let items = genericQuestions(topicId, year, 20);
  if (opts?.clinicalTopic) {
    items = items.filter((q) => q.clinicalTopic === opts.clinicalTopic || q.questionType === "clinical");
    if (!items.length) items = CLINICAL_SCENARIOS.filter((s) => s.clinicalTopic === opts.clinicalTopic);
  }
  if (opts?.questionType === "clinical") {
    items = [...CLINICAL_SCENARIOS.filter((s) => s.topicId === topicId), ...items.filter((q) => q.questionType === "clinical")];
  }
  if (opts?.limit) items = items.slice(0, opts.limit);
  return items;
}

export function getClinicalScenarios(topicId?: NursingTopicId, clinicalTopic?: string, limit = 10) {
  let items = CLINICAL_SCENARIOS;
  if (topicId) items = items.filter((s) => s.topicId === topicId);
  if (clinicalTopic) items = items.filter((s) => s.clinicalTopic === clinicalTopic);
  return items.slice(0, limit);
}

export function stripNursingAnswer(qn: NursingQuestion) {
  const { correctAnswer, rationale, ...rest } = qn;
  void correctAnswer;
  void rationale;
  return rest;
}

export function checkNursingAnswer(questionId: string, chosen: NursingOptionKey) {
  const all = [...CLINICAL_SCENARIOS, ...Object.values(TOPIC_QUESTIONS).flat()];
  const qn = all.find((q) => q.id === questionId) || genericQuestions("medsurg-ii", 3).find((q) => q.id === questionId);
  if (!qn) return null;
  return {
    isCorrect: chosen === qn.correctAnswer,
    correctAnswer: qn.correctAnswer,
    rationale: qn.rationale,
    topic: qn.clinicalTopic || qn.topicId,
  };
}
