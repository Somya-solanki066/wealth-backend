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
};

function q(
  topicId: NursingTopicId,
  year: number,
  n: number,
  text: string,
  options: Record<NursingOptionKey, string>,
  correct: NursingOptionKey,
  rationale: string
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
  };
}

const TOPIC_QUESTIONS: Partial<Record<NursingTopicId, NursingQuestion[]>> = {
  medsurg: [
    q("medsurg", 3, 1, "A post-operative patient complains of sudden chest pain and shortness of breath. The PRIORITY nursing action is:", { A: "Administer analgesia", B: "Assess airway, breathing, circulation", C: "Encourage deep breathing", D: "Document and continue observations" }, "B", "ABCs first — rule out pulmonary embolism or respiratory compromise."),
    q("medsurg", 3, 2, "Which finding is MOST characteristic of hypovolaemic shock?", { A: "Bounding pulse", B: "Warm flushed skin", C: "Tachycardia and hypotension", D: "Bradycardia" }, "C", "Compensatory tachycardia with falling BP indicates volume loss."),
    q("medsurg", 3, 3, "The normal range for adult respiratory rate is:", { A: "8–12/min", B: "12–20/min", C: "20–30/min", D: "30–40/min" }, "B", "12–20 breaths per minute at rest for adults."),
  ],
  mch: [
    q("mch", 3, 1, "During antenatal care in Nigeria, ferrous sulphate is given primarily to prevent:", { A: "Pre-eclampsia", B: "Iron-deficiency anaemia", C: "Gestational diabetes", D: "UTI" }, "B", "Routine iron supplementation reduces maternal anaemia."),
    q("mch", 3, 2, "The Apgar score is assessed at:", { A: "1 and 5 minutes after birth", B: "30 minutes only", C: "Before delivery", D: "24 hours after birth" }, "A", "Standard newborn assessment at 1 and 5 minutes."),
    q("mch", 3, 3, "Exclusive breastfeeding is recommended for the first:", { A: "3 months", B: "6 months", C: "9 months", D: "12 months" }, "B", "WHO/Nigeria guideline: exclusive breastfeeding for 6 months."),
  ],
  "community-health": [
    q("community-health", 3, 1, "Primary Health Care (PHC) in Nigeria emphasises:", { A: "Tertiary hospital care only", B: "Accessible, community-based preventive care", C: "Private specialist referrals", D: "International treatment abroad" }, "B", "PHC focuses on prevention and community access."),
    q("community-health", 3, 2, "Oral Rehydration Therapy (ORT) is FIRST-LINE treatment for:", { A: "Mild dehydration from diarrhoea", B: "Severe burns", C: "Hypertensive crisis", D: "Malaria with anaemia" }, "A", "ORT is cornerstone of diarrhoea management."),
    q("community-health", 3, 3, "Immunisation at 9 months in Nigeria includes:", { A: "BCG only", B: "Yellow fever and measles", C: "HPV", D: "COVID-19 booster only" }, "B", "Measles and yellow fever at 9 months per NPI schedule."),
  ],
  "mental-health": [
    q("mental-health", 3, 1, "Therapeutic communication with an anxious patient should:", { A: "Use clichés like 'calm down'", B: "Be calm, empathetic, and non-judgemental", C: "Avoid eye contact", D: "Change the subject quickly" }, "B", "Empathy and active listening build trust."),
    q("mental-health", 3, 2, "A key nursing intervention for a patient experiencing auditory hallucinations is:", { A: "Argue that voices are not real", B: "Assess safety and provide a calm environment", C: "Isolate without observation", D: "Ignore all statements" }, "B", "Safety assessment and supportive environment are priorities."),
    q("mental-health", 3, 3, "Depression screening in clinical practice may use:", { A: "PHQ-9 or similar validated tools", B: "Only blood pressure", C: "X-ray", D: "ECG alone" }, "A", "Validated screening tools support early detection."),
  ],
  icu: [
    q("icu", 4, 1, "Normal adult MAP (Mean Arterial Pressure) is approximately:", { A: "40–50 mmHg", B: "70–100 mmHg", C: "120–140 mmHg", D: "160–180 mmHg" }, "B", "MAP 70–100 mmHg supports organ perfusion."),
    q("icu", 4, 2, "A patient on mechanical ventilation with rising peak pressures may indicate:", { A: "Improved compliance", B: "Airway obstruction or reduced compliance", C: "Ready for extubation", D: "Hypothermia" }, "B", "Rising pressures suggest obstruction, secretions, or worsening lung condition."),
  ],
  "emergency-nursing": [
    q("emergency-nursing", 5, 1, "In triage, a patient with airway compromise should be categorised as:", { A: "Green — non-urgent", B: "Red — immediate", C: "Blue — deceased", D: "White — administrative" }, "B", "Airway problems require immediate intervention."),
    q("emergency-nursing", 5, 2, "The first step in adult BLS (Basic Life Support) is:", { A: "Give two rescue breaths", B: "Check scene safety and responsiveness", C: "Apply AED immediately", D: "Start IV fluids" }, "B", "Ensure safety, then check responsiveness before CPR."),
  ],
  fundamentals: [
    q("fundamentals", 1, 1, "The normal adult resting heart rate range is:", { A: "40–60 bpm", B: "60–100 bpm", C: "100–140 bpm", D: "140–180 bpm" }, "B", "60–100 beats per minute for adults at rest."),
    q("fundamentals", 1, 2, "Hand hygiene before patient contact prevents:", { A: "Only viral infections", B: "Healthcare-associated infections", C: "Only fungal infections", D: "No infections" }, "B", "Hand hygiene is the single most effective infection prevention measure."),
  ],
  "anatomy-physiology": [
    q("anatomy-physiology", 1, 1, "The primary function of the kidneys is:", { A: "Digestion", B: "Filtration of blood and urine formation", C: "Gas exchange", D: "Hormone production only" }, "B", "Kidneys filter waste and regulate fluid/electrolytes."),
  ],
  pharmacology: [
    q("pharmacology", 1, 1, "Before administering any medication, the nurse must verify:", { A: "Only patient name", B: "Right patient, drug, dose, route, time", C: "Only the prescription date", D: "Only doctor's signature" }, "B", "The five rights of medication administration."),
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
        `(${topicId.replace(/-/g, " ")}) Clinical scenario ${n}: Which nursing action is MOST appropriate?`,
        {
          A: "Assess the patient first",
          B: "Document without assessment",
          C: "Delay intervention",
          D: "Ignore patient concerns",
        },
        "A",
        "Assessment precedes intervention in nursing process."
      )
    );
  }
  return items;
}

export function getNursingQuestions(topicId: NursingTopicId, year: number): NursingQuestion[] {
  return genericQuestions(topicId, year, 20);
}

export function stripNursingAnswer(qn: NursingQuestion) {
  const { correctAnswer, rationale, ...rest } = qn;
  void correctAnswer;
  void rationale;
  return rest;
}
