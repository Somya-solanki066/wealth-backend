export type NursingTopicId =
  | "fundamentals"
  | "anatomy-physiology"
  | "pharmacology"
  | "medsurg"
  | "medsurg-ii"
  | "mch"
  | "community-health"
  | "mental-health"
  | "icu"
  | "emergency-nursing"
  | "leadership-research";

export type NursingCourse = {
  id: string;
  name: string;
  topicId: NursingTopicId;
  subtopics: string[];
  totalQuestions: number;
};

export type NursingTopic = {
  id: NursingTopicId;
  name: string;
  shortName: string;
  description: string;
};

export type NursingYear = {
  year: number;
  label: string;
  courses: NursingCourse[];
};

export type ProfessionalExam = {
  id: string;
  name: string;
  description: string;
  access: "free" | "premium" | "premium_only";
  topicId: NursingTopicId;
};

export type ClinicalTopic = {
  id: string;
  name: string;
  courseId: string;
};

export const NURSING_UNIVERSITIES = [
  { id: "unn", label: "University of Nigeria, Enugu", shortName: "UNEC" },
  { id: "lasu", label: "Lagos State University", shortName: "LASU" },
  { id: "unilag", label: "University of Lagos", shortName: "UNILAG" },
  { id: "babcock", label: "Babcock University", shortName: "BU" },
];

export const NURSING_SCHOOLS = [
  "School of Nursing",
  "College of Nursing",
  "Department of Nursing Science",
];

export const NURSING_TOPICS: Record<NursingTopicId, NursingTopic> = {
  fundamentals: {
    id: "fundamentals",
    name: "Fundamentals of Nursing",
    shortName: "Fundamentals",
    description: "Core nursing skills, vital signs, hygiene, and patient care basics.",
  },
  "anatomy-physiology": {
    id: "anatomy-physiology",
    name: "Anatomy & Physiology",
    shortName: "A&P",
    description: "Body systems, homeostasis, and clinical application for nurses.",
  },
  pharmacology: {
    id: "pharmacology",
    name: "Pharmacology for Nurses",
    shortName: "Pharm",
    description: "Drug classes, routes, side effects, and safe medication administration.",
  },
  medsurg: {
    id: "medsurg",
    name: "Medical-Surgical Nursing",
    shortName: "MedSurg",
    description: "Adult medical and surgical conditions, perioperative care, and recovery.",
  },
  "medsurg-ii": {
    id: "medsurg-ii",
    name: "Medical-Surgical Nursing II",
    shortName: "MedSurg II",
    description: "Advanced med-surg: cardiovascular, respiratory, renal, and emergency nursing.",
  },
  mch: {
    id: "mch",
    name: "Maternal & Child Health",
    shortName: "MCH",
    description: "Antenatal, labour, postnatal care, paediatrics, and immunisation.",
  },
  "community-health": {
    id: "community-health",
    name: "Community Health Nursing",
    shortName: "Community Health",
    description: "Primary healthcare, PHC programmes, and community outreach in Nigeria.",
  },
  "mental-health": {
    id: "mental-health",
    name: "Mental Health Nursing",
    shortName: "Mental Health",
    description: "Psychiatric disorders, therapeutic communication, and crisis intervention.",
  },
  icu: {
    id: "icu",
    name: "ICU Nursing",
    shortName: "ICU",
    description: "Critical care monitoring, ventilators, haemodynamics, and emergency protocols.",
  },
  "emergency-nursing": {
    id: "emergency-nursing",
    name: "Emergency Nursing",
    shortName: "Emergency",
    description: "Triage, trauma, resuscitation, and acute emergency management.",
  },
  "leadership-research": {
    id: "leadership-research",
    name: "Leadership & Research",
    shortName: "Leadership",
    description: "Nursing management, ethics, evidence-based practice, and research methods.",
  },
};

const YEAR_1_COURSES: NursingCourse[] = [
  { id: "fundamentals", name: "Fundamentals of Nursing", topicId: "fundamentals", subtopics: ["Vital signs", "Hygiene", "Patient care"], totalQuestions: 100 },
  { id: "anatomy-physiology", name: "Anatomy & Physiology", topicId: "anatomy-physiology", subtopics: ["Body systems", "Homeostasis"], totalQuestions: 100 },
  { id: "pharmacology-y1", name: "Introduction to Pharmacology", topicId: "pharmacology", subtopics: ["Drug classes", "Routes"], totalQuestions: 80 },
];

const YEAR_2_COURSES: NursingCourse[] = [
  { id: "medsurg-i", name: "Medical-Surgical Nursing I", topicId: "medsurg", subtopics: ["Perioperative", "Wound care"], totalQuestions: 100 },
  { id: "mch-y2", name: "Maternal & Child Health I", topicId: "mch", subtopics: ["Antenatal", "Newborn"], totalQuestions: 100 },
  { id: "community-y2", name: "Community Health Nursing I", topicId: "community-health", subtopics: ["PHC", "Immunisation"], totalQuestions: 80 },
];

const YEAR_3_COURSES: NursingCourse[] = [
  {
    id: "medsurg-ii",
    name: "Medical-Surgical Nursing II",
    topicId: "medsurg-ii",
    subtopics: ["Cardiovascular", "Respiratory", "Renal"],
    totalQuestions: 100,
  },
  {
    id: "mch-y3",
    name: "Maternal & Child Health",
    topicId: "mch",
    subtopics: ["Antenatal", "Labour", "Postnatal"],
    totalQuestions: 100,
  },
  {
    id: "community-y3",
    name: "Community Health Nursing",
    topicId: "community-health",
    subtopics: ["PHC", "Health promotion"],
    totalQuestions: 80,
  },
  {
    id: "pharmacology-y3",
    name: "Pharmacology for Nurses",
    topicId: "pharmacology",
    subtopics: ["Drug classes", "Calculations"],
    totalQuestions: 100,
  },
];

const YEAR_4_COURSES: NursingCourse[] = [
  { id: "medsurg-y4", name: "Advanced MedSurg", topicId: "medsurg", subtopics: ["Critical care", "Emergency"], totalQuestions: 100 },
  { id: "icu-y4", name: "ICU Nursing", topicId: "icu", subtopics: ["Ventilators", "Haemodynamics"], totalQuestions: 80 },
  { id: "mental-y4", name: "Mental Health Nursing", topicId: "mental-health", subtopics: ["Psychiatric care", "Crisis"], totalQuestions: 80 },
];

const YEAR_5_COURSES: NursingCourse[] = [
  { id: "emergency-y5", name: "Emergency Nursing", topicId: "emergency-nursing", subtopics: ["Triage", "Trauma", "BLS"], totalQuestions: 100 },
  { id: "leadership-y5", name: "Leadership & Research", topicId: "leadership-research", subtopics: ["Management", "EBP"], totalQuestions: 80 },
  { id: "medsurg-y5", name: "MedSurg Consolidation", topicId: "medsurg", subtopics: ["Board prep", "Clinical reasoning"], totalQuestions: 100 },
];

export const NURSING_YEARS: NursingYear[] = [
  { year: 1, label: "Yr 1", courses: YEAR_1_COURSES },
  { year: 2, label: "Yr 2", courses: YEAR_2_COURSES },
  { year: 3, label: "Yr 3", courses: YEAR_3_COURSES },
  { year: 4, label: "Yr 4", courses: YEAR_4_COURSES },
  { year: 5, label: "Yr 5", courses: YEAR_5_COURSES },
];

export const PROFESSIONAL_EXAMS: ProfessionalExam[] = [
  {
    id: "nannm-state-board",
    name: "NANNM State Board Exam",
    description: "Nigerian Association of Nurses — Licensing exam",
    access: "free",
    topicId: "medsurg",
  },
  {
    id: "post-basic",
    name: "Post-Basic Nursing Exam",
    description: "NMCN Specialist nursing qualification",
    access: "premium",
    topicId: "icu",
  },
  {
    id: "nclex-rn",
    name: "NCLEX-RN Preparation",
    description: "For nurses going to US, Canada, UK — US Board exam standard questions",
    access: "premium_only",
    topicId: "medsurg-ii",
  },
  {
    id: "clinical-skills",
    name: "Clinical Skills Checklist",
    description: "NG tube insertion, IV cannulation, wound dressing, catheterisation, and more",
    access: "free",
    topicId: "fundamentals",
  },
];

export const CLINICAL_TOPICS: ClinicalTopic[] = [
  { id: "cardiovascular", name: "Cardiovascular", courseId: "medsurg-ii" },
  { id: "respiratory", name: "Respiratory", courseId: "medsurg-ii" },
  { id: "neurological", name: "Neurological", courseId: "medsurg-ii" },
  { id: "renal", name: "Renal", courseId: "medsurg-ii" },
  { id: "gastrointestinal", name: "Gastrointestinal", courseId: "medsurg-ii" },
  { id: "endocrine", name: "Endocrine", courseId: "medsurg-ii" },
  { id: "emergency", name: "Emergency Nursing", courseId: "emergency-nursing" },
];

export function getNursingYear(year: number) {
  return NURSING_YEARS.find((y) => y.year === year);
}

export function getNursingTopic(topicId: string) {
  return NURSING_TOPICS[topicId as NursingTopicId];
}

export function getNursingCourse(courseId: string, year?: number) {
  for (const y of NURSING_YEARS) {
    if (year && y.year !== year) continue;
    const course = y.courses.find((c) => c.id === courseId);
    if (course) return { year: y.year, course };
  }
  return null;
}

export function getProfessionalExam(examId: string) {
  return PROFESSIONAL_EXAMS.find((e) => e.id === examId);
}

export function examRequiresPremium(exam: ProfessionalExam, isPremium: boolean) {
  if (exam.access === "free") return false;
  if (isPremium) return false;
  return true;
}
