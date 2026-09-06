import type { JambSubjectId } from "./jambQuestions";

export type JambCourse = {
  id: string;
  label: string;
  subjects: JambSubjectId[];
};

export type JambInstitution = {
  id: string;
  label: string;
  shortName: string;
};

export type PostUtmeUniversity = {
  id: string;
  label: string;
  shortName: string;
  location: string;
  yearFrom: number;
  yearTo: number;
  papersAvailable: number;
};

export const JAMB_COURSES: JambCourse[] = [
  {
    id: "medicine-surgery",
    label: "Medicine & Surgery",
    subjects: ["english", "biology", "chemistry", "physics"],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    subjects: ["english", "biology", "chemistry", "physics"],
  },
  {
    id: "nursing",
    label: "Nursing Science",
    subjects: ["english", "biology", "chemistry", "physics"],
  },
  {
    id: "engineering",
    label: "Engineering",
    subjects: ["english", "mathematics", "physics", "chemistry"],
  },
  {
    id: "law",
    label: "Law",
    subjects: ["english", "government", "economics", "mathematics"],
  },
  {
    id: "accounting",
    label: "Accounting",
    subjects: ["english", "economics", "mathematics", "government"],
  },
  {
    id: "computer-science",
    label: "Computer Science",
    subjects: ["english", "mathematics", "physics", "chemistry"],
  },
  {
    id: "mass-communication",
    label: "Mass Communication",
    subjects: ["english", "government", "economics", "biology"],
  },
];

export const JAMB_INSTITUTIONS: JambInstitution[] = [
  { id: "unn", label: "University of Nigeria, Nsukka", shortName: "UNEC" },
  { id: "unilag", label: "University of Lagos", shortName: "UNILAG" },
  { id: "ui", label: "University of Ibadan", shortName: "UI" },
  { id: "oau", label: "Obafemi Awolowo University", shortName: "OAU" },
  { id: "abu", label: "Ahmadu Bello University", shortName: "ABU" },
  { id: "uniben", label: "University of Benin", shortName: "UNIBEN" },
  { id: "lasu", label: "Lagos State University", shortName: "LASU" },
  { id: "unilorin", label: "University of Ilorin", shortName: "UNILORIN" },
];

export const JAMB_TOPICS: Record<JambSubjectId, string[]> = {
  english: ["Grammar", "Lexis", "Spelling", "Literature", "Comprehension"],
  biology: ["Cell biology", "Genetics", "Plant physiology", "Human biology", "Ecology"],
  chemistry: [
    "Organic Chemistry",
    "Atomic Structure",
    "Periodic Table",
    "Chemical Bonding",
    "Acids & Bases",
    "Stoichiometry",
    "Mole concept",
    "Reactions",
    "Valency",
  ],
  physics: ["Mechanics", "Motion", "Wave Motion", "Optics", "Electricity", "Heat"],
  mathematics: [
    "Algebra",
    "Indices",
    "Trigonometry",
    "Geometry",
    "Statistics",
    "Probability",
    "Coordinate geometry",
  ],
  economics: ["Basic concepts", "Demand", "Supply", "Market structures", "National income", "Public finance"],
  government: ["Constitution", "Political theory", "Elections", "Nigerian history", "International relations"],
};

export const JAMB_PRACTICE_YEARS = Array.from({ length: 25 }, (_, i) => 2024 - i);

export const POST_UTME_UNIVERSITIES: PostUtmeUniversity[] = [
  {
    id: "unn",
    label: "University of Nigeria, Nsukka",
    shortName: "UNEC",
    location: "Enugu",
    yearFrom: 2010,
    yearTo: 2024,
    papersAvailable: 15,
  },
  {
    id: "unilag",
    label: "University of Lagos",
    shortName: "UNILAG",
    location: "Lagos",
    yearFrom: 2008,
    yearTo: 2024,
    papersAvailable: 17,
  },
  {
    id: "ui",
    label: "University of Ibadan",
    shortName: "UI",
    location: "Oyo",
    yearFrom: 2010,
    yearTo: 2024,
    papersAvailable: 15,
  },
  {
    id: "oau",
    label: "Obafemi Awolowo University",
    shortName: "OAU",
    location: "Osun",
    yearFrom: 2010,
    yearTo: 2024,
    papersAvailable: 15,
  },
  {
    id: "abu",
    label: "Ahmadu Bello University",
    shortName: "ABU",
    location: "Kaduna",
    yearFrom: 2012,
    yearTo: 2024,
    papersAvailable: 13,
  },
];

export type JambPracticeMode =
  | "full_mock"
  | "subject"
  | "year"
  | "quick20"
  | "post_utme";

export function getCourseById(id: string): JambCourse | undefined {
  return JAMB_COURSES.find((c) => c.id === id);
}

export function getInstitutionById(id: string): JambInstitution | undefined {
  return JAMB_INSTITUTIONS.find((i) => i.id === id);
}

export function getPostUtmeUniversity(id: string): PostUtmeUniversity | undefined {
  return POST_UTME_UNIVERSITIES.find((u) => u.id === id);
}

export function getPostUtmeYears(universityId: string): number[] {
  const uni = getPostUtmeUniversity(universityId);
  if (!uni) return [];
  const years: number[] = [];
  for (let y = uni.yearTo; y >= uni.yearFrom; y -= 1) years.push(y);
  return years;
}

export function validateSubjectCombination(
  courseId: string,
  subjects: JambSubjectId[]
): { valid: boolean; expected?: JambSubjectId[] } {
  const course = getCourseById(courseId);
  if (!course) return { valid: false };
  const expected = course.subjects;
  const valid =
    subjects.length === expected.length &&
    expected.every((s) => subjects.includes(s));
  return { valid, expected };
}

export function daysUntilExam(examDate: string): number | null {
  if (!examDate) return null;
  const exam = new Date(examDate);
  if (Number.isNaN(exam.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exam.setHours(0, 0, 0, 0);
  const diff = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
