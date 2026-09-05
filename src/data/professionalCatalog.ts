export type ProfessionalCourseId =
  | "law"
  | "pharmacy"
  | "med-lab-science"
  | "radiography"
  | "physiotherapy"
  | "dentistry"
  | "optometry"
  | "nutrition"
  | "public-health"
  | "environmental-health";

export type ProfessionalModule = {
  id: string;
  courseId: ProfessionalCourseId;
  name: string;
  level: number;
};

export type ProfessionalCourse = {
  id: ProfessionalCourseId;
  name: string;
  shortName: string;
  description: string;
  levels: number[];
  modules: ProfessionalModule[];
};

function mod(courseId: ProfessionalCourseId, level: number, slug: string, name: string): ProfessionalModule {
  return { id: `${courseId}-${level}-${slug}`, courseId, name, level };
}

export const PROFESSIONAL_COURSES: ProfessionalCourse[] = [
  {
    id: "law",
    name: "Law",
    shortName: "Law",
    description: "LLB programme — Nigerian legal system, contracts, constitutional and criminal law.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("law", 100, "legal-method", "Legal Method & Nigerian Legal System"),
      mod("law", 100, "contract-intro", "Introduction to Law of Contract"),
      mod("law", 200, "contract-1", "Law of Contract I"),
      mod("law", 200, "nls", "Nigerian Legal System"),
      mod("law", 200, "constitutional-1", "Constitutional Law I"),
      mod("law", 300, "criminal-1", "Criminal Law I"),
      mod("law", 300, "torts-1", "Law of Torts I"),
      mod("law", 400, "company-law", "Company Law"),
      mod("law", 500, "jurisprudence", "Jurisprudence & Legal Theory"),
    ],
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    shortName: "Pharmacy",
    description: "PharmD programme — pharmaceutics, pharmacology, clinical pharmacy, and drug regulation in Nigeria.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("pharmacy", 100, "pharm-chem", "Pharmaceutical Chemistry I"),
      mod("pharmacy", 100, "anatomy", "Human Anatomy for Pharmacy"),
      mod("pharmacy", 200, "pharmaceutics-1", "Pharmaceutics I"),
      mod("pharmacy", 200, "pharmacology-1", "Pharmacology I"),
      mod("pharmacy", 300, "pharm-analysis", "Pharmaceutical Analysis"),
      mod("pharmacy", 400, "clinical-pharm", "Clinical Pharmacy & Therapeutics"),
      mod("pharmacy", 500, "pharm-practice", "Pharmacy Practice & PCN Regulations"),
    ],
  },
  {
    id: "med-lab-science",
    name: "Medical Lab Science",
    shortName: "Med Lab Science",
    description: "MLS programme — haematology, microbiology, chemical pathology, and laboratory practice.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("med-lab-science", 100, "intro-mls", "Introduction to Medical Laboratory Science"),
      mod("med-lab-science", 200, "haematology-1", "Haematology I"),
      mod("med-lab-science", 200, "microbiology-1", "Medical Microbiology I"),
      mod("med-lab-science", 300, "chemical-path", "Chemical Pathology"),
      mod("med-lab-science", 400, "histopathology", "Histopathology & Cytology"),
      mod("med-lab-science", 500, "lab-management", "Laboratory Management & Quality Assurance"),
    ],
  },
  {
    id: "radiography",
    name: "Radiography",
    shortName: "Radiography",
    description: "Radiography programme — imaging physics, radiographic techniques, and radiation safety.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("radiography", 100, "intro-rad", "Introduction to Radiography"),
      mod("radiography", 200, "imaging-physics", "Imaging Physics I"),
      mod("radiography", 200, "radiographic-anatomy", "Radiographic Anatomy"),
      mod("radiography", 300, "special-procedures", "Special Radiographic Procedures"),
      mod("radiography", 400, "ct-mri", "CT & MRI Imaging"),
      mod("radiography", 500, "radiation-protection", "Radiation Protection & Safety"),
    ],
  },
  {
    id: "physiotherapy",
    name: "Physiotherapy",
    shortName: "Physiotherapy",
    description: "Physiotherapy programme — musculoskeletal, neurological, cardiorespiratory rehabilitation.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("physiotherapy", 100, "intro-physio", "Introduction to Physiotherapy"),
      mod("physiotherapy", 200, "kinesiology", "Kinesiology & Biomechanics"),
      mod("physiotherapy", 200, "electrotherapy", "Electrotherapy I"),
      mod("physiotherapy", 300, "msk", "Musculoskeletal Physiotherapy"),
      mod("physiotherapy", 400, "neuro-rehab", "Neurological Rehabilitation"),
      mod("physiotherapy", 500, "cardio-resp", "Cardiorespiratory Physiotherapy"),
    ],
  },
  {
    id: "dentistry",
    name: "Dentistry",
    shortName: "Dentistry",
    description: "BDS programme — oral anatomy, restorative dentistry, oral surgery, and community dentistry.",
    levels: [100, 200, 300, 400, 500, 600],
    modules: [
      mod("dentistry", 100, "oral-anatomy", "Oral Anatomy & Histology"),
      mod("dentistry", 200, "dental-materials", "Dental Materials Science"),
      mod("dentistry", 300, "operative", "Operative Dentistry I"),
      mod("dentistry", 400, "oral-surgery", "Oral & Maxillofacial Surgery"),
      mod("dentistry", 500, "prosthodontics", "Prosthodontics"),
      mod("dentistry", 600, "community-dent", "Community Dentistry"),
    ],
  },
  {
    id: "optometry",
    name: "Optometry",
    shortName: "Optometry",
    description: "Optometry programme — visual science, refraction, ocular disease, and primary eye care.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("optometry", 100, "visual-science", "Visual Science I"),
      mod("optometry", 200, "geometric-optics", "Geometric & Physical Optics"),
      mod("optometry", 200, "refraction", "Refraction & Binocular Vision"),
      mod("optometry", 300, "ocular-anatomy", "Ocular Anatomy & Physiology"),
      mod("optometry", 400, "ocular-disease", "Ocular Disease & Pharmacology"),
      mod("optometry", 500, "primary-eye-care", "Primary Eye Care & Contact Lenses"),
    ],
  },
  {
    id: "nutrition",
    name: "Nutrition",
    shortName: "Nutrition",
    description: "Human nutrition — dietetics, community nutrition, food science, and malnutrition in Nigeria.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("nutrition", 100, "intro-nutrition", "Introduction to Human Nutrition"),
      mod("nutrition", 200, "food-science", "Food Science & Technology"),
      mod("nutrition", 200, "biochem-nutrition", "Biochemistry of Nutrition"),
      mod("nutrition", 300, "community-nutrition", "Community & Public Health Nutrition"),
      mod("nutrition", 400, "clinical-nutrition", "Clinical Nutrition & Diet Therapy"),
      mod("nutrition", 500, "nutr-epidemiology", "Nutritional Epidemiology"),
    ],
  },
  {
    id: "public-health",
    name: "Public Health",
    shortName: "Public Health",
    description: "Public health — epidemiology, health policy, PHC, and disease control programmes in Nigeria.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("public-health", 100, "intro-ph", "Introduction to Public Health"),
      mod("public-health", 200, "epidemiology-1", "Epidemiology I"),
      mod("public-health", 200, "health-promotion", "Health Promotion & Education"),
      mod("public-health", 300, "phc", "Primary Health Care Systems"),
      mod("public-health", 400, "health-policy", "Health Policy & Planning"),
      mod("public-health", 500, "disease-control", "Disease Surveillance & Control"),
    ],
  },
  {
    id: "environmental-health",
    name: "Environmental Health",
    shortName: "Environmental Health",
    description: "Environmental health — sanitation, water quality, waste management, and occupational health.",
    levels: [100, 200, 300, 400, 500],
    modules: [
      mod("environmental-health", 100, "intro-eh", "Introduction to Environmental Health"),
      mod("environmental-health", 200, "water-sanitation", "Water Supply & Sanitation"),
      mod("environmental-health", 200, "waste-mgmt", "Waste Management"),
      mod("environmental-health", 300, "food-hygiene", "Food Hygiene & Safety"),
      mod("environmental-health", 400, "occupational-health", "Occupational Health & Safety"),
      mod("environmental-health", 500, "env-pollution", "Environmental Pollution & Control"),
    ],
  },
];

export function getProfessionalCourse(courseId: string) {
  return PROFESSIONAL_COURSES.find((c) => c.id === courseId);
}

export function getProfessionalModule(moduleId: string) {
  for (const course of PROFESSIONAL_COURSES) {
    const found = course.modules.find((m) => m.id === moduleId);
    if (found) return { course, module: found };
  }
  return null;
}

export function getModulesForCourseLevel(courseId: ProfessionalCourseId, level: number) {
  const course = getProfessionalCourse(courseId);
  if (!course) return [];
  return course.modules.filter((m) => m.level === level);
}
