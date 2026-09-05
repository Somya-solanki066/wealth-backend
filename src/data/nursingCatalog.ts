export type NursingTopicId =
  | "fundamentals"
  | "anatomy-physiology"
  | "pharmacology"
  | "medsurg"
  | "mch"
  | "community-health"
  | "mental-health"
  | "icu"
  | "emergency-nursing"
  | "leadership-research";

export type NursingTopic = {
  id: NursingTopicId;
  name: string;
  shortName: string;
  description: string;
};

export type NursingYear = {
  year: number;
  label: string;
  topics: NursingTopic[];
};

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
    name: "Pharmacology",
    shortName: "Pharm",
    description: "Drug classes, routes, side effects, and safe medication administration.",
  },
  medsurg: {
    id: "medsurg",
    name: "Medical-Surgical Nursing",
    shortName: "MedSurg",
    description: "Adult medical and surgical conditions, perioperative care, and recovery.",
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

export const NURSING_YEARS: NursingYear[] = [
  {
    year: 1,
    label: "Year 1",
    topics: [
      NURSING_TOPICS.fundamentals,
      NURSING_TOPICS["anatomy-physiology"],
      NURSING_TOPICS.pharmacology,
    ],
  },
  {
    year: 2,
    label: "Year 2",
    topics: [
      NURSING_TOPICS.medsurg,
      NURSING_TOPICS.mch,
      NURSING_TOPICS["community-health"],
    ],
  },
  {
    year: 3,
    label: "Year 3",
    topics: [
      NURSING_TOPICS.medsurg,
      NURSING_TOPICS.mch,
      NURSING_TOPICS["community-health"],
      NURSING_TOPICS["mental-health"],
    ],
  },
  {
    year: 4,
    label: "Year 4",
    topics: [
      NURSING_TOPICS.medsurg,
      NURSING_TOPICS.icu,
      NURSING_TOPICS["mental-health"],
      NURSING_TOPICS["community-health"],
    ],
  },
  {
    year: 5,
    label: "Year 5",
    topics: [
      NURSING_TOPICS["emergency-nursing"],
      NURSING_TOPICS.icu,
      NURSING_TOPICS["leadership-research"],
      NURSING_TOPICS.medsurg,
    ],
  },
];

export function getNursingYear(year: number) {
  return NURSING_YEARS.find((y) => y.year === year);
}

export function getNursingTopic(topicId: string) {
  return NURSING_TOPICS[topicId as NursingTopicId];
}
