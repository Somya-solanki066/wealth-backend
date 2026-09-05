export type PastOptionKey = "A" | "B" | "C" | "D";

export type UniversityPastQuestion = {
  id: string;
  courseId: string;
  year: number;
  questionNumber: number;
  questionText: string;
  options: Record<PastOptionKey, string>;
  correctAnswer: PastOptionKey;
  topic: string;
};

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function q(
  courseId: string,
  year: number,
  n: number,
  text: string,
  options: Record<PastOptionKey, string>,
  correct: PastOptionKey,
  topic: string
): UniversityPastQuestion {
  return {
    id: `${courseId}-${year}-q${n}`,
    courseId,
    year,
    questionNumber: n,
    questionText: text,
    options,
    correctAnswer: correct,
    topic,
  };
}

/** Fixed past-exam style questions — deterministic per course + year. */
export function getUniversityPastQuestions(courseId: string, year: number): UniversityPastQuestion[] {
  const seed = hashSeed(`${courseId}:${year}`);
  const count = 30;
  const questions: UniversityPastQuestion[] = [];

  const starters = [
    q(
      courseId,
      year,
      1,
      `(${year}) Which of the following best describes the primary learning outcome of this course?`,
      {
        A: "Memorisation of facts only",
        B: "Application of concepts to solve problems",
        C: "Avoiding practical work",
        D: "Ignoring prior knowledge",
      },
      "B",
      "Course objectives"
    ),
    q(
      courseId,
      year,
      2,
      `A student scores ${40 + (seed % 30)}% in continuous assessment and ${50 + (seed % 20)}% in the final exam (equal weight). Total score is closest to:`,
      {
        A: `${45 + (seed % 10)}%`,
        B: `${50 + (seed % 10)}%`,
        C: `${55 + (seed % 10)}%`,
        D: `${60 + (seed % 10)}%`,
      },
      "B",
      "Assessment"
    ),
    q(
      courseId,
      year,
      3,
      "In academic writing for this discipline, which practice is MOST appropriate?",
      {
        A: "Copying sources without citation",
        B: "Using evidence with proper referencing",
        C: "Submitting group work as individual work",
        D: "Ignoring the question rubric",
      },
      "B",
      "Academic skills"
    ),
    q(
      courseId,
      year,
      4,
      `If x + ${3 + (seed % 5)} = ${10 + (seed % 8)}, find x.`,
      {
        A: `${5 + (seed % 3)}`,
        B: `${7 + (seed % 4)}`,
        C: `${9 + (seed % 2)}`,
        D: `${11 + (seed % 3)}`,
      },
      "B",
      "Quantitative reasoning"
    ),
    q(
      courseId,
      year,
      5,
      "Which study strategy is MOST effective before a university exam?",
      {
        A: "Cramming the night before only",
        B: "Active recall with past questions",
        C: "Skipping tutorials",
        D: "Reading without practice",
      },
      "B",
      "Study skills"
    ),
  ];

  questions.push(...starters);

  for (let n = starters.length + 1; n <= count; n += 1) {
    const a = (seed + n * 7) % 12 + 2;
    const b = (seed + n * 3) % 8 + 1;
    questions.push(
      q(
        courseId,
        year,
        n,
        `Past question ${n} (${year}): Solve for the unknown value if ${a}x + ${b} = ${a * b + n}.`,
        {
          A: `x = ${b}`,
          B: `x = ${b + 1}`,
          C: `x = ${a}`,
          D: `x = ${n}`,
        },
        "B",
        "Problem solving"
      )
    );
  }

  return questions;
}

export function stripPastAnswer(qn: UniversityPastQuestion) {
  const { correctAnswer, ...rest } = qn;
  void correctAnswer;
  return rest;
}
