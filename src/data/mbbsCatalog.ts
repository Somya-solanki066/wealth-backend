export type MbbsPhaseId = "pre-clinical" | "para-clinical" | "clinical";

export type MbbsSubjectId =
  | "anatomy"
  | "physiology"
  | "biochemistry"
  | "community-medicine-i"
  | "pathology"
  | "pharmacology"
  | "microbiology"
  | "medical-ethics"
  | "community-medicine"
  | "internal-medicine"
  | "surgery"
  | "obg"
  | "paediatrics"
  | "psychiatry";

export type MbbsSubject = {
  id: MbbsSubjectId;
  name: string;
  icon: string;
  subtopics: string[];
  description: string;
  totalQuestions: number;
};

export type MbbsPhase = {
  id: MbbsPhaseId;
  label: string;
  years: number[];
  yearLabel: string;
  description: string;
  subjects: MbbsSubject[];
};

export type MbbsTopic = {
  id: string;
  name: string;
  subjectId: MbbsSubjectId;
  parentTopic?: string;
  mcqCount: number;
  videoCount: number;
};

export type ClinicalSpecialty = {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
};

export type MdcnExam = {
  id: string;
  name: string;
  description: string;
  access: "free" | "premium";
  subjects: string[];
};

export const MBBS_UNIVERSITIES = [
  { id: "unn", label: "University of Nigeria, Enugu", shortName: "UNEC" },
  { id: "lasu", label: "Lagos State University", shortName: "LASU" },
  { id: "unilag", label: "University of Lagos", shortName: "UNILAG" },
  { id: "abu", label: "Ahmadu Bello University", shortName: "ABU" },
];

export const MBBS_COLLEGES = [
  "College of Medicine",
  "Faculty of Medicine",
  "College of Health Sciences",
];

export const MBBS_SUBJECTS: Record<MbbsSubjectId, MbbsSubject> = {
  anatomy: {
    id: "anatomy",
    name: "Anatomy",
    icon: "🦴",
    subtopics: ["Gross", "Embryology", "Histology", "Neuroanatomy"],
    description: "Structural organisation of the human body — systems, regions, and clinical correlations.",
    totalQuestions: 100,
  },
  physiology: {
    id: "physiology",
    name: "Physiology",
    icon: "⚡",
    subtopics: ["CVS", "Respiratory", "Renal", "Neuro", "GIT"],
    description: "Normal body function — cardiovascular, respiratory, renal, endocrine, and neurophysiology.",
    totalQuestions: 100,
  },
  biochemistry: {
    id: "biochemistry",
    name: "Biochemistry",
    icon: "🧬",
    subtopics: ["Proteins", "Enzymes", "Metabolism", "Molecular Bio"],
    description: "Metabolism, enzymes, nutrition, and molecular basis of disease.",
    totalQuestions: 100,
  },
  "community-medicine-i": {
    id: "community-medicine-i",
    name: "Community Medicine I",
    icon: "🌍",
    subtopics: ["Biostatistics", "Epidemiology basics", "PHC", "Health promotion"],
    description: "Introduction to public health, epidemiology, and community health in Nigeria.",
    totalQuestions: 80,
  },
  pathology: {
    id: "pathology",
    name: "Pathology",
    icon: "🔬",
    subtopics: ["General pathology", "Haematology", "Systemic pathology", "Cytopathology"],
    description: "Mechanisms of disease — inflammation, neoplasia, haematology, and systemic pathology.",
    totalQuestions: 100,
  },
  pharmacology: {
    id: "pharmacology",
    name: "Pharmacology",
    icon: "💊",
    subtopics: ["Autonomic", "Cardiovascular", "Antimicrobials", "CNS drugs"],
    description: "Drug mechanisms, interactions, adverse effects, and rational prescribing.",
    totalQuestions: 100,
  },
  microbiology: {
    id: "microbiology",
    name: "Medical Microbiology",
    icon: "🦠",
    subtopics: ["Bacteriology", "Virology", "Parasitology", "Mycology"],
    description: "Bacteria, viruses, parasites, and antimicrobial therapy in Nigerian context.",
    totalQuestions: 100,
  },
  "medical-ethics": {
    id: "medical-ethics",
    name: "Medical Ethics",
    icon: "⚖️",
    subtopics: ["Consent", "Confidentiality", "Professionalism", "MDCN code"],
    description: "Medical ethics, professionalism, and the MDCN code of conduct.",
    totalQuestions: 60,
  },
  "community-medicine": {
    id: "community-medicine",
    name: "Community Medicine",
    icon: "🌍",
    subtopics: ["Epidemiology", "PHC", "Preventive medicine", "Health systems"],
    description: "Epidemiology, public health, PHC, and preventive medicine.",
    totalQuestions: 80,
  },
  "internal-medicine": {
    id: "internal-medicine",
    name: "Internal Medicine",
    icon: "🫀",
    subtopics: ["Cardiology", "Respiratory", "Gastroenterology", "Endocrinology"],
    description: "Adult medicine — cardiology, gastroenterology, endocrinology, infectious disease.",
    totalQuestions: 120,
  },
  surgery: {
    id: "surgery",
    name: "Surgery",
    icon: "🔪",
    subtopics: ["General surgery", "Trauma", "GI surgery", "Vascular"],
    description: "General surgery, trauma, acute abdomen, and perioperative care.",
    totalQuestions: 120,
  },
  obg: {
    id: "obg",
    name: "Obstetrics & Gynaecology",
    icon: "👶",
    subtopics: ["Antenatal", "Labour", "Gynaecology", "Emergencies"],
    description: "Antenatal care, labour, gynaecological conditions, and emergencies.",
    totalQuestions: 100,
  },
  paediatrics: {
    id: "paediatrics",
    name: "Paediatrics",
    icon: "🧒",
    subtopics: ["Neonatology", "Growth & development", "Infectious disease", "Emergencies"],
    description: "Child health, growth, immunisation, and paediatric emergencies.",
    totalQuestions: 100,
  },
  psychiatry: {
    id: "psychiatry",
    name: "Psychiatry",
    icon: "🧠",
    subtopics: ["Mood disorders", "Psychosis", "Substance use", "Emergencies"],
    description: "Mental disorders, psychopharmacology, and psychiatric emergencies.",
    totalQuestions: 80,
  },
};

export const MBBS_PHASES: MbbsPhase[] = [
  {
    id: "pre-clinical",
    label: "Pre-Clinical",
    years: [1, 2],
    yearLabel: "Year 1 & 2",
    description: "Foundation sciences — anatomy, physiology, biochemistry, community medicine.",
    subjects: [
      MBBS_SUBJECTS.anatomy,
      MBBS_SUBJECTS.physiology,
      MBBS_SUBJECTS.biochemistry,
      MBBS_SUBJECTS["community-medicine-i"],
    ],
  },
  {
    id: "para-clinical",
    label: "Para-Clinical",
    years: [3, 4],
    yearLabel: "Year 3 & 4",
    description: "Bridge to clinical medicine — pathology, pharmacology, microbiology, ethics.",
    subjects: [
      MBBS_SUBJECTS.pathology,
      MBBS_SUBJECTS.pharmacology,
      MBBS_SUBJECTS.microbiology,
      MBBS_SUBJECTS["medical-ethics"],
      MBBS_SUBJECTS["community-medicine"],
    ],
  },
  {
    id: "clinical",
    label: "Clinical",
    years: [5, 6],
    yearLabel: "Year 5 & 6",
    description: "Ward-based medicine — internal medicine, surgery, OBG, paediatrics, psychiatry.",
    subjects: [
      MBBS_SUBJECTS["internal-medicine"],
      MBBS_SUBJECTS.surgery,
      MBBS_SUBJECTS.obg,
      MBBS_SUBJECTS.paediatrics,
      MBBS_SUBJECTS.psychiatry,
    ],
  },
];

export const MBBS_TOPICS: MbbsTopic[] = [
  { id: "head-neck", name: "Head & Neck", subjectId: "anatomy", mcqCount: 60, videoCount: 8 },
  { id: "carotid-triangle", name: "Carotid Triangle", subjectId: "anatomy", parentTopic: "head-neck", mcqCount: 42, videoCount: 5 },
  { id: "upper-limb", name: "Upper Limb", subjectId: "anatomy", mcqCount: 50, videoCount: 6 },
  { id: "lower-limb", name: "Lower Limb", subjectId: "anatomy", mcqCount: 50, videoCount: 6 },
  { id: "thorax", name: "Thorax", subjectId: "anatomy", mcqCount: 45, videoCount: 5 },
  { id: "abdomen", name: "Abdomen", subjectId: "anatomy", mcqCount: 45, videoCount: 5 },
  { id: "cvs-physiology", name: "Cardiovascular", subjectId: "physiology", mcqCount: 40, videoCount: 5 },
  { id: "respiratory-physiology", name: "Respiratory", subjectId: "physiology", mcqCount: 40, videoCount: 5 },
  { id: "renal-physiology", name: "Renal", subjectId: "physiology", mcqCount: 35, videoCount: 4 },
  { id: "enzymes", name: "Enzymes", subjectId: "biochemistry", mcqCount: 30, videoCount: 4 },
  { id: "metabolism", name: "Metabolism", subjectId: "biochemistry", mcqCount: 35, videoCount: 5 },
  { id: "proteins", name: "Proteins", subjectId: "biochemistry", mcqCount: 30, videoCount: 4 },
  { id: "biostatistics", name: "Biostatistics", subjectId: "community-medicine-i", mcqCount: 25, videoCount: 3 },
  { id: "epidemiology", name: "Epidemiology", subjectId: "community-medicine-i", mcqCount: 25, videoCount: 3 },
];

export const CLINICAL_SPECIALTIES: ClinicalSpecialty[] = [
  {
    id: "medicine",
    name: "Medicine",
    topics: [
      { id: "cardiology", name: "Cardiology" },
      { id: "respiratory", name: "Respiratory" },
      { id: "gastroenterology", name: "Gastroenterology" },
      { id: "neurology", name: "Neurology" },
      { id: "endocrinology", name: "Endocrinology" },
    ],
  },
  {
    id: "surgery",
    name: "Surgery",
    topics: [
      { id: "trauma", name: "Trauma" },
      { id: "gi-surgery", name: "GI Surgery" },
      { id: "vascular", name: "Vascular" },
      { id: "neurosurgery", name: "Neurosurgery" },
    ],
  },
  {
    id: "paediatrics",
    name: "Paediatrics",
    topics: [
      { id: "neonatology", name: "Neonatology" },
      { id: "infectious-disease", name: "Infectious Disease" },
      { id: "growth-development", name: "Growth & Development" },
    ],
  },
  {
    id: "obg",
    name: "Obstetrics & Gynaecology",
    topics: [
      { id: "antenatal", name: "Antenatal" },
      { id: "labour", name: "Labour" },
      { id: "gynaecology", name: "Gynaecology" },
    ],
  },
  {
    id: "emergency",
    name: "Emergency",
    topics: [
      { id: "resuscitation", name: "Resuscitation" },
      { id: "shock", name: "Shock" },
    ],
  },
];

export const MDCN_EXAMS: MdcnExam[] = [
  {
    id: "mdcn-primary",
    name: "MDCN Primary",
    description: "Medical and Dental Council of Nigeria — Primary MBBS examination",
    access: "free",
    subjects: ["Anatomy", "Physiology", "Biochemistry", "Pathology", "Pharmacology", "Microbiology"],
  },
  {
    id: "mdcn-final",
    name: "MDCN Final",
    description: "Medical and Dental Council of Nigeria — Final MBBS professional examination",
    access: "premium",
    subjects: ["Medicine", "Surgery", "Paediatrics", "OBG", "Community Medicine"],
  },
];

export const LAB_VALUE_CATEGORIES = [
  {
    id: "cbc",
    name: "Full Blood Count",
    source: "Adult reference ranges — verify with local lab",
    values: [
      { test: "Haemoglobin (male)", range: "13.5–17.5 g/dL" },
      { test: "Haemoglobin (female)", range: "12.0–15.5 g/dL" },
      { test: "WBC", range: "4.0–11.0 × 10⁹/L" },
      { test: "Platelets", range: "150–400 × 10⁹/L" },
      { test: "MCV", range: "80–100 fL" },
    ],
  },
  {
    id: "electrolytes",
    name: "Electrolytes",
    source: "Adult reference ranges — verify with local lab",
    values: [
      { test: "Sodium", range: "135–145 mmol/L" },
      { test: "Potassium", range: "3.5–5.0 mmol/L" },
      { test: "Chloride", range: "95–105 mmol/L" },
      { test: "Bicarbonate", range: "22–28 mmol/L" },
    ],
  },
  {
    id: "lft",
    name: "Liver Function Tests",
    source: "Adult reference ranges — verify with local lab",
    values: [
      { test: "ALT", range: "7–56 U/L" },
      { test: "AST", range: "10–40 U/L" },
      { test: "ALP", range: "44–147 U/L" },
      { test: "Bilirubin (total)", range: "3–17 μmol/L" },
      { test: "Albumin", range: "35–50 g/L" },
    ],
  },
  {
    id: "rft",
    name: "Renal Function Tests",
    source: "Adult reference ranges — verify with local lab",
    values: [
      { test: "Creatinine (male)", range: "62–115 μmol/L" },
      { test: "Creatinine (female)", range: "53–97 μmol/L" },
      { test: "Urea", range: "2.5–7.1 mmol/L" },
      { test: "eGFR", range: "> 90 mL/min/1.73m²" },
    ],
  },
];

export const SCORING_TOOLS = [
  { id: "apgar", name: "APGAR Score", description: "Neonatal assessment at 1 and 5 minutes" },
  { id: "gcs", name: "Glasgow Coma Scale", description: "Level of consciousness assessment" },
  { id: "wells", name: "Wells Score", description: "Pulmonary embolism probability" },
  { id: "curb65", name: "CURB-65", description: "Community-acquired pneumonia severity" },
  { id: "child-pugh", name: "Child-Pugh", description: "Liver cirrhosis severity" },
];

export const DRUG_REFERENCES = [
  {
    id: "amoxicillin",
    name: "Amoxicillin",
    class: "Penicillin antibiotic",
    uses: "Respiratory tract infections, otitis media, H. pylori eradication",
    adverseEffects: "Diarrhoea, rash, nausea; anaphylaxis (rare)",
    contraindications: "Penicillin allergy",
    interactions: "Probenecid increases levels; may reduce efficacy of oral contraceptives",
  },
  {
    id: "metformin",
    name: "Metformin",
    class: "Biguanide antidiabetic",
    uses: "Type 2 diabetes mellitus, PCOS",
    adverseEffects: "GI upset, lactic acidosis (rare), B12 deficiency",
    contraindications: "eGFR < 30, acute metabolic acidosis, severe hepatic impairment",
    interactions: "Contrast media (hold 48h), alcohol increases lactic acidosis risk",
  },
  {
    id: "amlodipine",
    name: "Amlodipine",
    class: "Calcium channel blocker",
    uses: "Hypertension, angina",
    adverseEffects: "Peripheral oedema, flushing, headache, gingival hyperplasia",
    contraindications: "Cardiogenic shock, severe aortic stenosis",
    interactions: "CYP3A4 inhibitors (e.g. clarithromycin) increase levels",
  },
];

export const CURATED_TOPIC_VIDEOS: Record<string, { title: string; channel: string; duration: string; helpful: string; url: string }[]> = {
  "carotid-triangle": [
    { title: "Carotid Triangle — Anatomy Wizard", channel: "Anatomy Wizard", duration: "12 min", helpful: "94%", url: "https://www.youtube.com/results?search_query=carotid+triangle+anatomy+tutorial" },
    { title: "Head & Neck Anatomy — Acland's", channel: "Acland Anatomy", duration: "28 min", helpful: "97%", url: "https://www.youtube.com/results?search_query=acland+head+neck+carotid+triangle" },
  ],
};

export function getMbbsPhase(phaseId: string) {
  return MBBS_PHASES.find((p) => p.id === phaseId);
}

export function getMbbsSubject(subjectId: string) {
  return MBBS_SUBJECTS[subjectId as MbbsSubjectId];
}

export function getMbbsTopicsForSubject(subjectId: string) {
  return MBBS_TOPICS.filter((t) => t.subjectId === subjectId);
}

export function getMbbsTopic(topicId: string) {
  return MBBS_TOPICS.find((t) => t.id === topicId);
}

export function searchMbbsTopics(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return MBBS_TOPICS;
  return MBBS_TOPICS.filter(
    (t) => t.name.toLowerCase().includes(q) || t.subjectId.includes(q)
  );
}

export function mdcnRequiresPremium(exam: MdcnExam, isPremium: boolean) {
  return exam.access === "premium" && !isPremium;
}
