import type { ProfessionalCourseId } from "./professionalCatalog";
import { getProfessionalSubject } from "./professionalCatalog";

export type ProfessionalOptionKey = "A" | "B" | "C" | "D";

export type ProfessionalQuestion = {
  id: string;
  subjectId: string;
  courseId: ProfessionalCourseId;
  questionNumber: number;
  questionText: string;
  options: Record<ProfessionalOptionKey, string>;
  correctAnswer: ProfessionalOptionKey;
  rationale: string;
};

function q(
  subjectId: string,
  courseId: ProfessionalCourseId,
  n: number,
  text: string,
  options: Record<ProfessionalOptionKey, string>,
  correct: ProfessionalOptionKey,
  rationale: string
): ProfessionalQuestion {
  return {
    id: `${subjectId}-q${n}`,
    subjectId,
    courseId,
    questionNumber: n,
    questionText: text,
    options,
    correctAnswer: correct,
    rationale,
  };
}

const SUBJECT_QUESTIONS: Record<string, ProfessionalQuestion[]> = {
  "pharm-y4-clinical": [
    q("pharm-y4-clinical", "pharmacy", 1, "Therapeutic drug monitoring is most important for drugs with:", { A: "Wide therapeutic index", B: "Narrow therapeutic index", C: "No metabolism", D: "Topical use only" }, "B", "Narrow therapeutic index drugs (e.g. digoxin, phenytoin, warfarin) require close monitoring."),
    q("pharm-y4-clinical", "pharmacy", 2, "A patient on warfarin with INR 8.5 and no bleeding should receive:", { A: "Vitamin K and hold warfarin", B: "Increase warfarin dose", C: "No action needed", D: "Fresh frozen plasma immediately" }, "A", "Supratherapeutic INR without bleeding — hold warfarin and consider low-dose vitamin K."),
    q("pharm-y4-clinical", "pharmacy", 3, "The primary role of a clinical pharmacist in patient counselling includes:", { A: "Prescribing without physician approval", B: "Ensuring appropriate use and monitoring of medicines", C: "Performing surgery", D: "Ordering all laboratory tests independently" }, "B", "Clinical pharmacists optimise drug therapy through counselling, monitoring, and collaboration."),
  ],
  "pharm-y4-pk": [
    q("pharm-y4-pk", "pharmacy", 1, "Half-life of a drug is the time required for:", { A: "Complete elimination", B: "Plasma concentration to reduce by 50%", C: "Peak concentration to be reached", D: "First-pass metabolism to complete" }, "B", "Half-life is the time for plasma concentration to fall by 50%."),
    q("pharm-y4-pk", "pharmacy", 2, "Bioavailability refers to:", { A: "Fraction of drug reaching systemic circulation unchanged", B: "Total drug bound to plasma proteins", C: "Rate of renal excretion", D: "Volume of distribution only" }, "A", "Bioavailability = fraction of administered dose reaching systemic circulation."),
  ],
  "law-500-contract": [
    q("law-500-contract", "law", 1, "Which element is NOT essential for a valid contract under Nigerian law?", { A: "Offer and acceptance", B: "Consideration", C: "Registration with the court", D: "Intention to create legal relations" }, "C", "Registration is not a general requirement for contract validity."),
    q("law-500-contract", "law", 2, "A counter-offer operates as:", { A: "Acceptance of the original offer", B: "Rejection of the original offer", C: "A mere inquiry", D: "An invitation to treat" }, "B", "A counter-offer rejects the original offer (Hyde v Wrench principle)."),
    q("law-500-contract", "law", 3, "Past consideration is generally:", { A: "Valid consideration", B: "Invalid consideration", C: "Always sufficient", D: "Required for all contracts" }, "B", "Past consideration is not good consideration in English/Nigerian contract law."),
  ],
  "law-500-constitutional": [
    q("law-500-constitutional", "law", 1, "Fundamental human rights in Nigeria are primarily found in:", { A: "Chapter II of the 1999 Constitution", B: "Chapter IV of the 1999 Constitution", C: "The Evidence Act", D: "The Criminal Code only" }, "B", "Chapter IV contains fundamental rights."),
    q("law-500-constitutional", "law", 2, "The doctrine of separation of powers divides government into:", { A: "Executive, Legislature, Judiciary", B: "Federal, State, Local", C: "Civil, Criminal, Customary", D: "Public, Private, Mixed" }, "A", "Separation of powers among three arms of government."),
  ],
  "law-500-criminal": [
    q("law-500-criminal", "law", 1, "Mens rea refers to:", { A: "The guilty act", B: "The guilty mind", C: "The punishment", D: "The victim's consent" }, "B", "Mens rea is the mental element of a crime."),
    q("law-500-criminal", "law", 2, "The Criminal Code applies primarily in:", { A: "Northern Nigeria", B: "Southern Nigeria", C: "Only Lagos", D: "Only Abuja" }, "B", "The Criminal Code applies in Southern states; Penal Code in Northern states."),
  ],
  "law-500-land": [
    q("law-500-land", "law", 1, "Under the Land Use Act 1978, all land in urban areas is vested in:", { A: "Individual owners", B: "The Governor", C: "The Federal Government", D: "Local councils only" }, "B", "Urban land is held in trust by the Governor for the people."),
    q("law-500-land", "law", 2, "A Certificate of Occupancy is evidence of:", { A: "Freehold ownership", B: "Statutory right of occupancy", C: "Customary title only", D: "Lease exceeding 99 years automatically" }, "B", "C of O evidences statutory right of occupancy under the LUA."),
  ],
};

function genericQuestions(
  subjectId: string,
  courseId: ProfessionalCourseId,
  subjectName: string,
  count = 15
): ProfessionalQuestion[] {
  const existing = SUBJECT_QUESTIONS[subjectId] || [];
  const items = [...existing];
  for (let n = existing.length + 1; n <= count; n += 1) {
    items.push(
      q(
        subjectId,
        courseId,
        n,
        `(${subjectName}) Professional exam question ${n}: Which statement is MOST correct?`,
        {
          A: "The first option — apply core principles from this subject",
          B: "An incorrect distractor based on common student errors",
          C: "Another plausible but wrong answer",
          D: "A partially correct but incomplete answer",
        },
        "A",
        "Review the core concepts of this subject to understand why option A is correct."
      )
    );
  }
  return items;
}

const ALL_QUESTIONS: ProfessionalQuestion[] = [
  ...Object.values(SUBJECT_QUESTIONS).flat(),
];

export function getProfessionalQuestions(subjectId: string, courseId?: ProfessionalCourseId, subjectName?: string) {
  const subject = getProfessionalSubject(subjectId);
  const cid = courseId || subject?.courseId || "pharmacy";
  const name = subjectName || subject?.name || subjectId;
  const fromBank = SUBJECT_QUESTIONS[subjectId];
  if (fromBank) return fromBank;
  const generated = genericQuestions(subjectId, cid, name, 15);
  ALL_QUESTIONS.push(...generated);
  return generated;
}

export function stripProfessionalAnswer(qn: ProfessionalQuestion) {
  const { correctAnswer, rationale, ...rest } = qn;
  void correctAnswer;
  void rationale;
  return rest;
}

export function checkProfessionalAnswer(questionId: string, chosen: ProfessionalOptionKey) {
  const bank = [...ALL_QUESTIONS, ...Object.values(SUBJECT_QUESTIONS).flat()];
  const qn = bank.find((q) => q.id === questionId);
  if (!qn) {
    const subjectId = questionId.replace(/-q\d+$/, "");
    const generated = getProfessionalQuestions(subjectId);
    const found = generated.find((q) => q.id === questionId);
    if (!found) return null;
    return {
      isCorrect: chosen === found.correctAnswer,
      correctAnswer: found.correctAnswer,
      rationale: found.rationale,
      topic: found.subjectId,
    };
  }
  return {
    isCorrect: chosen === qn.correctAnswer,
    correctAnswer: qn.correctAnswer,
    rationale: qn.rationale,
    topic: qn.subjectId,
  };
}

/** Legacy: moduleId maps to subjectId */
export function getQuestionsByModuleId(moduleId: string) {
  const subject = getProfessionalSubject(moduleId);
  if (!subject) return [];
  return getProfessionalQuestions(moduleId, subject.courseId, subject.name);
}
