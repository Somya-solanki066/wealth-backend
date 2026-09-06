export type ProfessionalCategoryId =
  | "health"
  | "law-social"
  | "business"
  | "science-engineering"
  | "arts-education";

export type ProfessionalCourseId =
  | "pharmacy"
  | "med-lab-science"
  | "radiography"
  | "physiotherapy"
  | "dentistry"
  | "optometry"
  | "nutrition"
  | "public-health"
  | "environmental-health"
  | "health-info-management"
  | "law"
  | "political-science"
  | "international-relations"
  | "mass-communication"
  | "sociology"
  | "psychology"
  | "accounting"
  | "finance"
  | "banking"
  | "economics"
  | "marketing"
  | "business-admin"
  | "insurance"
  | "chemistry"
  | "biology"
  | "physics"
  | "mathematics"
  | "computer-science"
  | "civil-engineering"
  | "mechanical-engineering"
  | "electrical-engineering"
  | "english"
  | "history"
  | "theatre-arts"
  | "linguistics"
  | "education"
  | "agriculture";

export type LevelType = "year" | "level";

export type ProfessionalSubject = {
  id: string;
  courseId: ProfessionalCourseId;
  name: string;
  subtopics: string[];
  year?: number;
  level?: number;
  category?: string;
  access: "free" | "premium";
  totalQuestions: number;
};

export type LicensingPrep = {
  id: string;
  name: string;
  description: string;
  access: "free" | "premium";
};

export type ProfessionalCourse = {
  id: ProfessionalCourseId;
  name: string;
  degree: string;
  icon: string;
  category: ProfessionalCategoryId;
  levelType: LevelType;
  levels: number[];
  durationYears: number;
  description: string;
  highlights: string[];
  licensingPrep?: LicensingPrep;
  lawCategories?: { id: string; label: string }[];
};

export const PROFESSIONAL_CATEGORIES = [
  { id: "health" as ProfessionalCategoryId, label: "Health & Clinical", icon: "🏥" },
  { id: "law-social" as ProfessionalCategoryId, label: "Law & Social Sciences", icon: "⚖️" },
  { id: "business" as ProfessionalCategoryId, label: "Business & Commerce", icon: "💼" },
  { id: "science-engineering" as ProfessionalCategoryId, label: "Sciences & Engineering", icon: "🔬" },
  { id: "arts-education" as ProfessionalCategoryId, label: "Arts & Education", icon: "📚" },
];

export const PROFESSIONAL_INSTITUTIONS = [
  { id: "ui", label: "University of Ibadan", shortName: "UI" },
  { id: "unilag", label: "University of Lagos", shortName: "UNILAG" },
  { id: "unn", label: "University of Nigeria, Enugu", shortName: "UNEC" },
  { id: "abu", label: "Ahmadu Bello University", shortName: "ABU" },
  { id: "lasu", label: "Lagos State University", shortName: "LASU" },
];

function sub(
  courseId: ProfessionalCourseId,
  opts: Omit<ProfessionalSubject, "courseId">
): ProfessionalSubject {
  return { courseId, ...opts };
}

export const PROFESSIONAL_SUBJECTS: ProfessionalSubject[] = [
  // Pharmacy Year 4
  sub("pharmacy", { id: "pharm-y4-clinical", name: "Clinical Pharmacy", subtopics: ["Drug therapy monitoring", "Patient counselling"], year: 4, access: "free", totalQuestions: 80 }),
  sub("pharmacy", { id: "pharm-y4-pk", name: "Pharmacokinetics", subtopics: ["ADME", "Half-life", "Bioavailability"], year: 4, access: "free", totalQuestions: 60 }),
  sub("pharmacy", { id: "pharm-y4-industrial", name: "Industrial Pharmacy", subtopics: ["Formulation", "GMP", "Quality control"], year: 4, access: "premium", totalQuestions: 50 }),
  sub("pharmacy", { id: "pharm-y4-pharmacognosy", name: "Pharmacognosy", subtopics: ["Herbal medicines", "Natural products"], year: 4, access: "premium", totalQuestions: 50 }),
  sub("pharmacy", { id: "pharm-y3-pharmaceutics", name: "Pharmaceutics III", subtopics: ["Dosage forms", "Biopharmaceutics"], year: 3, access: "free", totalQuestions: 60 }),
  sub("pharmacy", { id: "pharm-y3-pharmacology", name: "Pharmacology III", subtopics: ["Autonomic", "CNS", "Antimicrobials"], year: 3, access: "free", totalQuestions: 70 }),
  sub("pharmacy", { id: "pharm-y2-pharm-chem", name: "Pharmaceutical Chemistry II", subtopics: ["Medicinal chemistry", "Drug analysis"], year: 2, access: "free", totalQuestions: 50 }),
  sub("pharmacy", { id: "pharm-y1-intro", name: "Introduction to Pharmacy", subtopics: ["History", "Ethics", "PCN regulations"], year: 1, access: "free", totalQuestions: 40 }),
  // Law 500 Level Core
  sub("law", { id: "law-500-constitutional", name: "Constitutional Law", subtopics: ["1999 Constitution", "CFRN", "Federal structure"], level: 500, category: "core-courses", access: "free", totalQuestions: 80 }),
  sub("law", { id: "law-500-contract", name: "Law of Contract", subtopics: ["Offer", "Acceptance", "Consideration", "Breach"], level: 500, category: "core-courses", access: "free", totalQuestions: 80 }),
  sub("law", { id: "law-500-criminal", name: "Criminal Law", subtopics: ["Criminal Code", "Penal Code", "Offences", "Defences"], level: 500, category: "core-courses", access: "free", totalQuestions: 70 }),
  sub("law", { id: "law-500-land", name: "Land Law", subtopics: ["Land Use Act", "Tenure", "Conveyancing"], level: 500, category: "core-courses", access: "free", totalQuestions: 60 }),
  sub("law", { id: "law-500-company", name: "Company Law", subtopics: ["Incorporation", "Directors", "Shareholders"], level: 500, category: "commercial", access: "premium", totalQuestions: 50 }),
  sub("law", { id: "law-500-banking", name: "Banking & Finance Law", subtopics: ["CBN Act", "Banking regulations"], level: 500, category: "commercial", access: "premium", totalQuestions: 40 }),
  sub("law", { id: "law-500-admin", name: "Administrative Law", subtopics: ["Judicial review", "Natural justice"], level: 500, category: "public-law", access: "free", totalQuestions: 50 }),
  sub("law", { id: "law-500-intl", name: "International Law", subtopics: ["Treaties", "State sovereignty"], level: 500, category: "public-law", access: "premium", totalQuestions: 40 }),
  sub("law", { id: "law-bar-evidence", name: "Evidence Law", subtopics: ["Admissibility", "Hearsay", "Burden of proof"], level: 500, category: "bar-part-1", access: "free", totalQuestions: 60 }),
  sub("law", { id: "law-bar-procedure", name: "Civil Procedure", subtopics: ["Pleadings", "Service", "Trial"], level: 500, category: "bar-part-1", access: "premium", totalQuestions: 50 }),
  // Med Lab Science
  sub("med-lab-science", { id: "mls-y3-haematology", name: "Haematology", subtopics: ["FBC", "Coagulation", "Blood films"], year: 3, access: "free", totalQuestions: 60 }),
  sub("med-lab-science", { id: "mls-y3-micro", name: "Medical Microbiology", subtopics: ["Bacteriology", "Parasitology"], year: 3, access: "free", totalQuestions: 60 }),
  sub("med-lab-science", { id: "mls-y4-chemical-path", name: "Chemical Pathology", subtopics: ["LFT", "RFT", "Electrolytes"], year: 4, access: "free", totalQuestions: 50 }),
  // Dentistry
  sub("dentistry", { id: "dent-y4-operative", name: "Operative Dentistry", subtopics: ["Caries", "Restorations", "Endodontics"], year: 4, access: "free", totalQuestions: 60 }),
  sub("dentistry", { id: "dent-y5-oral-surgery", name: "Oral & Maxillofacial Surgery", subtopics: ["Extractions", "Impactions"], year: 5, access: "premium", totalQuestions: 50 }),
  // Accounting
  sub("accounting", { id: "acct-y3-financial", name: "Financial Accounting", subtopics: ["IFRS", "Financial statements"], year: 3, access: "free", totalQuestions: 60 }),
  sub("accounting", { id: "acct-y4-audit", name: "Auditing", subtopics: ["Internal control", "Audit evidence"], year: 4, access: "premium", totalQuestions: 50 }),
];

function course(
  id: ProfessionalCourseId,
  name: string,
  degree: string,
  icon: string,
  category: ProfessionalCategoryId,
  levelType: LevelType,
  levels: number[],
  durationYears: number,
  description: string,
  highlights: string[],
  extra?: Partial<ProfessionalCourse>
): ProfessionalCourse {
  return {
    id,
    name,
    degree,
    icon,
    category,
    levelType,
    levels,
    durationYears,
    description,
    highlights,
    ...extra,
  };
}

export const PROFESSIONAL_COURSES: ProfessionalCourse[] = [
  course("pharmacy", "Pharmacy", "B.Pharm / PharmD", "💊", "health", "year", [1, 2, 3, 4, 5], 5,
    "PharmD programme — pharmaceutics, pharmacology, clinical pharmacy, and PCN licensing prep.",
    ["5 years", "PCN licensing prep included"],
    { licensingPrep: { id: "pcn-licensing", name: "PCN Licensing Prep", description: "Pharmacists Council of Nigeria — past questions and practice exams", access: "free" } }
  ),
  course("med-lab-science", "Medical Lab Science", "B.MLS", "🔬", "health", "year", [1, 2, 3, 4, 5], 5,
    "MLS programme — haematology, microbiology, chemical pathology, and laboratory practice.",
    ["Haematology", "Microbiology", "Chemical pathology"]
  ),
  course("radiography", "Radiography", "B.Rad", "📡", "health", "year", [1, 2, 3, 4, 5], 5,
    "Radiography programme — imaging physics, radiographic techniques, and radiation safety.",
    ["Diagnostic", "Therapeutic", "Radiation safety"]
  ),
  course("physiotherapy", "Physiotherapy", "B.PT", "🦵", "health", "year", [1, 2, 3, 4, 5], 5,
    "Physiotherapy programme — musculoskeletal, neurological, cardiorespiratory rehabilitation.",
    ["Musculoskeletal", "Neuro", "Cardiorespiratory"]
  ),
  course("dentistry", "Dentistry", "BDS", "🦷", "health", "year", [1, 2, 3, 4, 5, 6], 6,
    "BDS programme — oral anatomy, restorative dentistry, oral surgery, and community dentistry.",
    ["Oral Surgery", "Orthodontics", "Community dentistry"]
  ),
  course("optometry", "Optometry", "B.Optom", "👁️", "health", "year", [1, 2, 3, 4, 5], 5,
    "Optometry programme — visual science, refraction, ocular disease, and primary eye care.",
    ["Refraction", "Ocular disease", "Primary eye care"]
  ),
  course("nutrition", "Nutrition & Dietetics", "B.Sc Nutrition", "🥗", "health", "year", [1, 2, 3, 4, 5], 5,
    "Human nutrition — dietetics, community nutrition, food science, and malnutrition.",
    ["Clinical nutrition", "Food science", "Community nutrition"]
  ),
  course("public-health", "Public Health", "B.Sc Public Health", "🌍", "health", "year", [1, 2, 3, 4, 5], 5,
    "Public health — epidemiology, health policy, PHC, and disease control.",
    ["Epidemiology", "PHC", "Health policy"]
  ),
  course("environmental-health", "Environmental Health", "B.Env Health", "🌿", "health", "year", [1, 2, 3, 4, 5], 5,
    "Environmental health — sanitation, water quality, waste management, occupational health.",
    ["Sanitation", "Water quality", "Occupational health"]
  ),
  course("health-info-management", "Health Info Management", "B.HIM", "📋", "health", "year", [1, 2, 3, 4], 4,
    "Health information management — medical records, coding, health data systems.",
    ["Medical records", "Health data", "ICD coding"]
  ),
  course("law", "Law", "LLB + Bar Part 1", "⚖️", "law-social", "level", [100, 200, 300, 400, 500], 5,
    "LLB programme — Nigerian legal system, contracts, constitutional and criminal law.",
    ["Constitutional", "Contract", "Criminal", "Land", "Equity"],
    {
      lawCategories: [
        { id: "core-courses", label: "Core Courses" },
        { id: "commercial", label: "Commercial" },
        { id: "public-law", label: "Public Law" },
        { id: "bar-part-1", label: "Bar Part 1" },
      ],
      licensingPrep: { id: "nls-prep", name: "Nigerian Law School Prep", description: "Bar Part 1 preparation — past questions and mock exams", access: "free" },
    }
  ),
  course("political-science", "Political Science", "B.Sc", "🏛️", "law-social", "level", [100, 200, 300, 400], 4, "Political theory, governance, and Nigerian politics.", ["Governance", "Political theory"]),
  course("international-relations", "International Relations", "B.Sc", "🌐", "law-social", "level", [100, 200, 300, 400], 4, "Diplomacy, foreign policy, and global affairs.", ["Diplomacy", "Foreign policy"]),
  course("mass-communication", "Mass Communication", "B.Sc", "📺", "law-social", "level", [100, 200, 300, 400], 4, "Journalism, broadcasting, and media studies.", ["Journalism", "Broadcasting"]),
  course("sociology", "Sociology", "B.Sc", "👥", "law-social", "level", [100, 200, 300, 400], 4, "Social structures, culture, and Nigerian society.", ["Social theory", "Research methods"]),
  course("psychology", "Psychology", "B.Sc", "🧠", "law-social", "level", [100, 200, 300, 400], 4, "Behaviour, cognition, and mental health foundations.", ["Cognitive", "Developmental", "Clinical"]),
  course("accounting", "Accounting", "B.Sc + ICAN", "📊", "business", "year", [1, 2, 3, 4], 4,
    "Accounting programme — financial, management, audit, tax, and ICAN prep.",
    ["Financial", "Management", "Audit", "Tax", "ICAN prep"],
    { licensingPrep: { id: "ican-prep", name: "ICAN Exam Prep", description: "Institute of Chartered Accountants of Nigeria preparation", access: "premium" } }
  ),
  course("finance", "Finance", "B.Sc", "💰", "business", "year", [1, 2, 3, 4], 4, "Corporate finance, investments, and financial markets.", ["Corporate finance", "Investments"]),
  course("banking", "Banking & Finance", "B.Sc", "🏦", "business", "year", [1, 2, 3, 4], 4, "Banking operations, monetary policy, and financial services.", ["Banking", "Monetary policy"]),
  course("economics", "Economics", "B.Sc", "📈", "business", "year", [1, 2, 3, 4], 4, "Microeconomics, macroeconomics, and development economics.", ["Micro", "Macro", "Development"]),
  course("marketing", "Marketing", "B.Sc", "📣", "business", "year", [1, 2, 3, 4], 4, "Consumer behaviour, branding, and digital marketing.", ["Branding", "Digital marketing"]),
  course("business-admin", "Business Administration", "B.Sc", "🏢", "business", "year", [1, 2, 3, 4], 4, "Management, strategy, operations, and entrepreneurship.", ["Management", "Strategy"]),
  course("insurance", "Insurance", "B.Sc", "🛡️", "business", "year", [1, 2, 3, 4], 4, "Risk management, underwriting, and insurance law.", ["Underwriting", "Risk management"]),
  course("chemistry", "Chemistry", "B.Sc", "⚗️", "science-engineering", "year", [1, 2, 3, 4], 4, "Organic, inorganic, physical, and analytical chemistry.", ["Organic", "Inorganic", "Physical"]),
  course("biology", "Biology", "B.Sc", "🧫", "science-engineering", "year", [1, 2, 3, 4], 4, "Cell biology, genetics, ecology, and microbiology.", ["Genetics", "Ecology", "Microbiology"]),
  course("physics", "Physics", "B.Sc", "⚛️", "science-engineering", "year", [1, 2, 3, 4], 4, "Mechanics, electromagnetism, thermodynamics, and modern physics.", ["Mechanics", "EM", "Thermodynamics"]),
  course("mathematics", "Mathematics", "B.Sc", "📐", "science-engineering", "year", [1, 2, 3, 4], 4, "Calculus, algebra, statistics, and applied mathematics.", ["Calculus", "Statistics", "Applied maths"]),
  course("computer-science", "Computer Science", "B.Sc", "💻", "science-engineering", "year", [1, 2, 3, 4], 4, "Programming, algorithms, databases, and software engineering.", ["Programming", "Algorithms", "Databases"]),
  course("civil-engineering", "Civil Engineering", "B.Eng", "🏗️", "science-engineering", "year", [1, 2, 3, 4, 5], 5, "Structures, geotechnics, transportation, and water resources.", ["Structures", "Geotechnics"]),
  course("mechanical-engineering", "Mechanical Engineering", "B.Eng", "⚙️", "science-engineering", "year", [1, 2, 3, 4, 5], 5, "Thermodynamics, mechanics, manufacturing, and design.", ["Thermodynamics", "Design"]),
  course("electrical-engineering", "Electrical Engineering", "B.Eng", "⚡", "science-engineering", "year", [1, 2, 3, 4, 5], 5, "Circuits, power systems, electronics, and control.", ["Circuits", "Power systems"]),
  course("english", "English", "B.A", "📖", "arts-education", "year", [1, 2, 3, 4], 4, "Literature, linguistics, and creative writing.", ["Literature", "Linguistics"]),
  course("history", "History", "B.A", "📜", "arts-education", "year", [1, 2, 3, 4], 4, "Nigerian history, African history, and historiography.", ["Nigerian history", "African history"]),
  course("theatre-arts", "Theatre Arts", "B.A", "🎭", "arts-education", "year", [1, 2, 3, 4], 4, "Drama, performance, and stagecraft.", ["Drama", "Performance"]),
  course("linguistics", "Linguistics", "B.A", "🗣️", "arts-education", "year", [1, 2, 3, 4], 4, "Phonetics, syntax, semantics, and sociolinguistics.", ["Phonetics", "Syntax"]),
  course("education", "Education", "B.Ed", "🎓", "arts-education", "year", [1, 2, 3, 4], 4, "Curriculum, pedagogy, and educational psychology.", ["Pedagogy", "Curriculum"]),
  course("agriculture", "Agriculture", "B.Agric", "🌾", "arts-education", "year", [1, 2, 3, 4, 5], 5, "Crop science, animal science, and agricultural economics.", ["Crop science", "Animal science"]),
];

/** Legacy module type for backward compatibility */
export type ProfessionalModule = {
  id: string;
  courseId: ProfessionalCourseId;
  name: string;
  level: number;
};

export function getProfessionalCourse(courseId: string) {
  return PROFESSIONAL_COURSES.find((c) => c.id === courseId);
}

export function getSubjectsForCourse(
  courseId: ProfessionalCourseId,
  yearOrLevel: number,
  category?: string
) {
  return PROFESSIONAL_SUBJECTS.filter((s) => {
    if (s.courseId !== courseId) return false;
    const course = getProfessionalCourse(courseId);
    if (!course) return false;
    if (course.levelType === "year") {
      if (s.year !== yearOrLevel) return false;
    } else {
      if (s.level !== yearOrLevel) return false;
      if (category && s.category !== category) return false;
    }
    return true;
  });
}

export function getProfessionalSubject(subjectId: string) {
  return PROFESSIONAL_SUBJECTS.find((s) => s.id === subjectId);
}

export function subjectRequiresPremium(subject: ProfessionalSubject, isPremium: boolean) {
  return subject.access === "premium" && !isPremium;
}

export function searchCourses(query: string, category?: ProfessionalCategoryId) {
  const q = query.toLowerCase().trim();
  let results = PROFESSIONAL_COURSES;
  if (category && category !== "all" as any) {
    results = results.filter((c) => c.category === category);
  }
  if (!q) return results;
  return results.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.degree.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.highlights.some((h) => h.toLowerCase().includes(q))
  );
}

export function getCoursesByCategory(categoryId: ProfessionalCategoryId) {
  return PROFESSIONAL_COURSES.filter((c) => c.category === categoryId);
}

/** Legacy helpers */
export function getProfessionalModule(moduleId: string) {
  const subject = getProfessionalSubject(moduleId);
  if (!subject) return null;
  const course = getProfessionalCourse(subject.courseId);
  if (!course) return null;
  return {
    course,
    module: { id: subject.id, courseId: subject.courseId, name: subject.name, level: subject.level || subject.year || 0 },
  };
}

export function getModulesForCourseLevel(courseId: ProfessionalCourseId, level: number) {
  return getSubjectsForCourse(courseId, level).map((s) => ({
    id: s.id,
    courseId: s.courseId,
    name: s.name,
    level: s.level || s.year || level,
  }));
}
