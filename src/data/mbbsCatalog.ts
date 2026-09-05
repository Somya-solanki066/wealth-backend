export type MbbsPhaseId = "pre-clinical" | "para-clinical" | "clinical";

export type MbbsSubjectId =
  | "anatomy"
  | "physiology"
  | "biochemistry"
  | "histology"
  | "pathology"
  | "pharmacology"
  | "microbiology"
  | "community-medicine"
  | "internal-medicine"
  | "surgery"
  | "obg"
  | "paediatrics"
  | "psychiatry";

export type MbbsSubject = {
  id: MbbsSubjectId;
  name: string;
  description: string;
};

export type MbbsPhase = {
  id: MbbsPhaseId;
  label: string;
  years: number[];
  description: string;
  subjects: MbbsSubject[];
};

export const MBBS_SUBJECTS: Record<MbbsSubjectId, MbbsSubject> = {
  anatomy: {
    id: "anatomy",
    name: "Gross Anatomy",
    description: "Structural organisation of the human body — systems, regions, and clinical correlations.",
  },
  physiology: {
    id: "physiology",
    name: "Physiology",
    description: "Normal body function — cardiovascular, respiratory, renal, endocrine, and neurophysiology.",
  },
  biochemistry: {
    id: "biochemistry",
    name: "Medical Biochemistry",
    description: "Metabolism, enzymes, nutrition, and molecular basis of disease.",
  },
  histology: {
    id: "histology",
    name: "Histology & Embryology",
    description: "Microscopic structure of tissues and early human development.",
  },
  pathology: {
    id: "pathology",
    name: "Pathology",
    description: "Mechanisms of disease — inflammation, neoplasia, haematology, and systemic pathology.",
  },
  pharmacology: {
    id: "pharmacology",
    name: "Pharmacology",
    description: "Drug mechanisms, interactions, adverse effects, and rational prescribing.",
  },
  microbiology: {
    id: "microbiology",
    name: "Medical Microbiology",
    description: "Bacteria, viruses, parasites, and antimicrobial therapy in Nigerian context.",
  },
  "community-medicine": {
    id: "community-medicine",
    name: "Community Medicine",
    description: "Epidemiology, public health, PHC, and preventive medicine.",
  },
  "internal-medicine": {
    id: "internal-medicine",
    name: "Internal Medicine",
    description: "Adult medicine — cardiology, gastroenterology, endocrinology, infectious disease.",
  },
  surgery: {
    id: "surgery",
    name: "Surgery",
    description: "General surgery, trauma, acute abdomen, and perioperative care.",
  },
  obg: {
    id: "obg",
    name: "Obstetrics & Gynaecology",
    description: "Antenatal care, labour, gynaecological conditions, and emergencies.",
  },
  paediatrics: {
    id: "paediatrics",
    name: "Paediatrics",
    description: "Child health, growth, immunisation, and paediatric emergencies.",
  },
  psychiatry: {
    id: "psychiatry",
    name: "Psychiatry",
    description: "Mental disorders, psychopharmacology, and psychiatric emergencies.",
  },
};

export const MBBS_PHASES: MbbsPhase[] = [
  {
    id: "pre-clinical",
    label: "Pre-clinical",
    years: [1, 2],
    description: "Years 1–2. Foundation sciences — anatomy, physiology, biochemistry, histology.",
    subjects: [
      MBBS_SUBJECTS.anatomy,
      MBBS_SUBJECTS.physiology,
      MBBS_SUBJECTS.biochemistry,
      MBBS_SUBJECTS.histology,
    ],
  },
  {
    id: "para-clinical",
    label: "Para-clinical",
    years: [3, 4],
    description: "Years 3–4. Bridge to clinical medicine — pathology, pharmacology, microbiology, community medicine.",
    subjects: [
      MBBS_SUBJECTS.pathology,
      MBBS_SUBJECTS.pharmacology,
      MBBS_SUBJECTS.microbiology,
      MBBS_SUBJECTS["community-medicine"],
    ],
  },
  {
    id: "clinical",
    label: "Clinical",
    years: [5, 6],
    description: "Years 5–6. Ward-based medicine — internal medicine, surgery, OBG, paediatrics, psychiatry.",
    subjects: [
      MBBS_SUBJECTS["internal-medicine"],
      MBBS_SUBJECTS.surgery,
      MBBS_SUBJECTS.obg,
      MBBS_SUBJECTS.paediatrics,
      MBBS_SUBJECTS.psychiatry,
    ],
  },
];

export function getMbbsPhase(phaseId: string) {
  return MBBS_PHASES.find((p) => p.id === phaseId);
}

export function getMbbsSubject(subjectId: string) {
  return MBBS_SUBJECTS[subjectId as MbbsSubjectId];
}
