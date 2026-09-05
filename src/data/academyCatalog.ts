export type AcademyLesson = {
  title: string;
  duration: string;
};

export type AcademyExamQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type AcademyCourseId = "witweb" | "ssg";

export type AcademyCourse = {
  id: AcademyCourseId;
  title: string;
  lede: string;
  icon: string;
  lessons: AcademyLesson[];
  exam: AcademyExamQuestion[];
  passScore: number;
  certPrefix: string;
};

export const ACADEMY_COURSES: Record<AcademyCourseId, AcademyCourse> = {
  witweb: {
    id: "witweb",
    title: "WIT-WEB",
    lede: "Webnoveling Ink to Wealth Blueprint",
    icon: "✍️",
    passScore: 70,
    certPrefix: "I2W-WW",
    lessons: [
      { title: "Choosing your platform", duration: "12 min" },
      { title: "Building your author profile", duration: "9 min" },
      { title: "Outlining a 300-chapter serial", duration: "18 min" },
      { title: "Writing your first hook chapter", duration: "15 min" },
      { title: "Pricing and monetization models", duration: "11 min" },
      { title: "Delegating to ghostwriters", duration: "14 min" },
      { title: "Editorial standards & rejections", duration: "10 min" },
      { title: "Scaling to multiple serials", duration: "13 min" },
    ],
    exam: [
      {
        question: "What should you nail down before outlining a 300-chapter serial?",
        options: ["Cover art", "Platform and hook premise", "Ghostwriter contracts", "Pricing tiers"],
        correctIndex: 1,
      },
      {
        question: "What is the main risk of delaying your hook chapter past chapter 1?",
        options: [
          "Higher editing cost",
          "Readers drop before the story earns them",
          "Slower AI generation",
          "Nothing — hooks can wait",
        ],
        correctIndex: 1,
      },
      {
        question: "On serialized platforms, what usually drives early monetization?",
        options: [
          "Chapter count alone",
          "Reader retention through the first few chapters",
          "Cover design only",
          "Publishing frequency alone",
        ],
        correctIndex: 1,
      },
      {
        question: "What is the safest way to scale to multiple serials?",
        options: [
          "Write everything solo, faster",
          "Delegate with clear editorial standards",
          "Skip outlining entirely",
          "Publish unedited drafts",
        ],
        correctIndex: 1,
      },
    ],
  },
  ssg: {
    id: "ssg",
    title: "SSG",
    lede: "Scriptwriting Screenwriting Guide",
    icon: "🎬",
    passScore: 70,
    certPrefix: "I2W-SSG",
    lessons: [
      { title: "Logline and premise", duration: "10 min" },
      { title: "Three-act structure", duration: "16 min" },
      { title: "Formatting like a professional", duration: "12 min" },
      { title: "Writing dialogue that sounds real", duration: "14 min" },
      { title: "Pitching to producers", duration: "11 min" },
      { title: "Submitting to Industry Hub", duration: "8 min" },
    ],
    exam: [
      {
        question: "What belongs in a strong logline?",
        options: ["Full cast list", "Protagonist, goal, and stakes", "Every plot twist", "Budget estimate"],
        correctIndex: 1,
      },
      {
        question: "In three-act structure, the midpoint usually…",
        options: [
          "Ends the story",
          "Raises stakes or shifts the protagonist's approach",
          "Introduces only subplots",
          "Replaces the climax",
        ],
        correctIndex: 1,
      },
      {
        question: "Professional screenplay dialogue should primarily…",
        options: [
          "Sound like real speech with purpose",
          "Explain backstory in every line",
          "Use only short one-word replies",
          "Avoid conflict",
        ],
        correctIndex: 0,
      },
      {
        question: "Before pitching, you should have ready…",
        options: ["Only a poster", "Logline, synopsis, and polished script sample", "Social media only", "Actor contracts"],
        correctIndex: 1,
      },
    ],
  },
};

export function courseIdsForEnrollment(courseId: string): AcademyCourseId[] {
  const ids: AcademyCourseId[] = [];
  if (courseId === "witweb" || courseId === "witweb-bundle") ids.push("witweb");
  if (courseId === "ssg") ids.push("ssg");
  return ids;
}

export function getAcademyCourse(id: string): AcademyCourse | null {
  return ACADEMY_COURSES[id as AcademyCourseId] || null;
}
