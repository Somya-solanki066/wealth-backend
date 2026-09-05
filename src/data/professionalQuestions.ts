import type { ProfessionalCourseId } from "./professionalCatalog";

export type ProfessionalOptionKey = "A" | "B" | "C" | "D";

export type ProfessionalQuestion = {
  id: string;
  moduleId: string;
  courseId: ProfessionalCourseId;
  questionNumber: number;
  questionText: string;
  options: Record<ProfessionalOptionKey, string>;
  correctAnswer: ProfessionalOptionKey;
  rationale: string;
};

function q(
  moduleId: string,
  courseId: ProfessionalCourseId,
  n: number,
  text: string,
  options: Record<ProfessionalOptionKey, string>,
  correct: ProfessionalOptionKey,
  rationale: string
): ProfessionalQuestion {
  return {
    id: `${moduleId}-q${n}`,
    moduleId,
    courseId,
    questionNumber: n,
    questionText: text,
    options,
    correctAnswer: correct,
    rationale,
  };
}

const MODULE_QUESTIONS: Record<string, ProfessionalQuestion[]> = {
  "law-200-contract-1": [
    q("law-200-contract-1", "law", 1, "Which element is NOT essential for a valid contract under Nigerian law?", { A: "Offer and acceptance", B: "Consideration", C: "Registration with the court", D: "Intention to create legal relations" }, "C", "Registration is not a general requirement for contract validity."),
    q("law-200-contract-1", "law", 2, "A counter-offer operates as:", { A: "Acceptance of the original offer", B: "Rejection of the original offer", C: "A mere inquiry", D: "An invitation to treat" }, "B", "A counter-offer rejects the original offer (Hyde v Wrench principle)."),
    q("law-200-contract-1", "law", 3, "Past consideration is generally:", { A: "Valid consideration", B: "Invalid consideration", C: "Always sufficient", D: "Required for all contracts" }, "B", "Past consideration is not good consideration in English/Nigerian contract law."),
  ],
  "law-200-nls": [
    q("law-200-nls", "law", 1, "The highest court in Nigeria is the:", { A: "Court of Appeal", B: "Supreme Court", C: "Federal High Court", D: "National Industrial Court" }, "B", "The Supreme Court is the apex court under the 1999 Constitution."),
    q("law-200-nls", "law", 2, "Customary law applies in Nigeria subject to:", { A: "No limitations", B: "Repugnancy to natural justice, equity and good conscience", C: "Only federal legislation", D: "International law only" }, "B", "Customary law must not be repugnant to natural justice, equity and good conscience."),
  ],
  "law-200-constitutional-1": [
    q("law-200-constitutional-1", "law", 1, "Fundamental human rights in Nigeria are primarily found in:", { A: "Chapter II of the 1999 Constitution", B: "Chapter IV of the 1999 Constitution", C: "The Evidence Act", D: "The Criminal Code only" }, "B", "Chapter IV contains fundamental rights."),
    q("law-200-constitutional-1", "law", 2, "The doctrine of separation of powers divides government into:", { A: "Executive, Legislature, Judiciary", B: "Federal, State, Local", C: "Civil, Criminal, Customary", D: "Public, Private, Mixed" }, "A", "Separation of powers among three arms of government."),
  ],
  "pharmacy-200-pharmacology-1": [
    q("pharmacy-200-pharmacology-1", "pharmacy", 1, "The therapeutic index is defined as:", { A: "LD50/ED50", B: "ED50/LD50", C: "ED50 × LD50", D: "ED50 − LD50" }, "B", "Therapeutic index = LD50/ED50; higher values indicate wider safety margin."),
    q("pharmacy-200-pharmacology-1", "pharmacy", 2, "A beta-blocker used in hypertension is:", { A: "Salbutamol", B: "Atenolol", C: "Atropine", D: "Adrenaline" }, "B", "Atenolol is a cardioselective beta-blocker."),
  ],
  "med-lab-science-200-haematology-1": [
    q("med-lab-science-200-haematology-1", "med-lab-science", 1, "The normal adult haemoglobin range is approximately:", { A: "4–6 g/dL", B: "12–16 g/dL (women) / 13–17 g/dL (men)", C: "20–25 g/dL", D: "8–10 g/dL only" }, "B", "Reference ranges vary slightly by sex and lab."),
    q("med-lab-science-200-haematology-1", "med-lab-science", 2, "Sickle cell disease is characterised by:", { A: "HbAA", B: "HbAS", C: "HbSS", D: "HbAC only" }, "C", "HbSS is homozygous sickle cell disease."),
  ],
};

function genericQuestions(
  moduleId: string,
  courseId: ProfessionalCourseId,
  moduleName: string,
  count = 15
): ProfessionalQuestion[] {
  const existing = MODULE_QUESTIONS[moduleId] || [];
  const items = [...existing];
  for (let n = existing.length + 1; n <= count; n += 1) {
    items.push(
      q(
        moduleId,
        courseId,
        n,
        `(${moduleName}) Professional exam question ${n}: Which statement is MOST correct?`,
        {
          A: "The first option — apply core principles from this module",
          B: "An incorrect distractor based on common student errors",
          C: "Another plausible but wrong answer",
          D: "A partially correct but incomplete answer",
        },
        "A",
        "Review the core concepts of this module to understand why option A is correct."
      )
    );
  }
  return items;
}

export function getProfessionalQuestions(moduleId: string, courseId: ProfessionalCourseId, moduleName: string) {
  return genericQuestions(moduleId, courseId, moduleName, 15);
}

export function stripProfessionalAnswer(qn: ProfessionalQuestion) {
  const { correctAnswer, rationale, ...rest } = qn;
  void correctAnswer;
  void rationale;
  return rest;
}
