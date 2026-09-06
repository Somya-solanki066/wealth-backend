export type UniversityCourse = {
  id: string;
  code: string;
  title: string;
  level: string;
  departmentId?: string;
  departmentName?: string;
  premiumCourse?: boolean;
  availableYears?: number[];
};

export type UniversityDepartment = {
  id: string;
  name: string;
  courses: UniversityCourse[];
};

export type UniversityFaculty = {
  id: string;
  name: string;
  icon?: string;
  departments: UniversityDepartment[];
};

export type University = {
  id: string;
  name: string;
  shortName: string;
  region: string;
  location?: string;
  faculties: UniversityFaculty[];
};

export const UNIVERSITY_REGIONS = ["South East", "South West", "North Central", "North West", "South South"] as const;

export const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];
export const FREE_YEARS = [2024, 2023, 2022];

const UNIVERSITY_FACULTY_NAMES = [
  "College of Medicine",
  "Faculty of Law",
  "Faculty of Sciences",
  "Faculty of Engineering",
  "Faculty of Business Admin",
  "Faculty of Arts",
] as const;

const UNIVERSITY_NAMES: {
  id: string;
  name: string;
  shortName: string;
  region: string;
  location: string;
}[] = [
  { id: "unn", name: "University of Nigeria, Enugu", shortName: "UNEC", region: "South East", location: "Enugu" },
  { id: "esut", name: "Enugu State University", shortName: "ESUT", region: "South East", location: "Enugu" },
  { id: "unizik", name: "Nnamdi Azikiwe University", shortName: "NAU", region: "South East", location: "Anambra" },
  { id: "futo", name: "Federal University of Technology, Owerri", shortName: "FUTO", region: "South East", location: "Imo" },
  { id: "unilag", name: "University of Lagos", shortName: "UNILAG", region: "South West", location: "Lagos" },
  { id: "ui", name: "University of Ibadan", shortName: "UI", region: "South West", location: "Oyo" },
  { id: "oau", name: "Obafemi Awolowo University", shortName: "OAU", region: "South West", location: "Osun" },
  { id: "abu", name: "Ahmadu Bello University", shortName: "ABU", region: "North West", location: "Kaduna" },
  { id: "uniben", name: "University of Benin", shortName: "UNIBEN", region: "South South", location: "Edo" },
  { id: "uniport", name: "University of Port Harcourt", shortName: "UNIPORT", region: "South South", location: "Rivers" },
  { id: "lasu", name: "Lagos State University", shortName: "LASU", region: "South West", location: "Lagos" },
  { id: "unilorin", name: "University of Ilorin", shortName: "UNILORIN", region: "North Central", location: "Kwara" },
  { id: "futa", name: "Federal University of Technology, Akure", shortName: "FUTA", region: "South West", location: "Ondo" },
  { id: "covenant", name: "Covenant University", shortName: "CU", region: "South West", location: "Ogun" },
  { id: "babcock", name: "Babcock University", shortName: "BU", region: "South West", location: "Ogun" },
];

const DEPT_BY_FACULTY: Record<string, { id: string; name: string; prefix: string }[]> = {
  "College of Medicine": [
    { id: "physiology", name: "Physiology", prefix: "PHY" },
    { id: "anatomy", name: "Anatomy", prefix: "ANA" },
    { id: "medicine-surgery", name: "Medicine & Surgery", prefix: "MED" },
    { id: "nursing", name: "Nursing Science", prefix: "NSC" },
  ],
  "Faculty of Law": [
    { id: "public-law", name: "Public Law", prefix: "LAW" },
    { id: "private-law", name: "Private & Commercial Law", prefix: "LAW" },
  ],
  "Faculty of Sciences": [
    { id: "mathematics", name: "Mathematics", prefix: "MAT" },
    { id: "physics", name: "Physics", prefix: "PHY" },
    { id: "chemistry", name: "Chemistry", prefix: "CHM" },
    { id: "biology", name: "Biology", prefix: "BIO" },
  ],
  "Faculty of Engineering": [
    { id: "electrical-eng", name: "Electrical Engineering", prefix: "EEE" },
    { id: "mechanical-eng", name: "Mechanical Engineering", prefix: "MEE" },
    { id: "civil-eng", name: "Civil Engineering", prefix: "CVE" },
    { id: "computer-eng", name: "Computer Engineering", prefix: "CPE" },
  ],
  "Faculty of Business Admin": [
    { id: "accounting", name: "Accounting", prefix: "ACC" },
    { id: "business-admin", name: "Business Administration", prefix: "BUS" },
    { id: "economics", name: "Economics", prefix: "ECO" },
  ],
  "Faculty of Arts": [
    { id: "english", name: "English & Literary Studies", prefix: "ENG" },
    { id: "history", name: "History & International Studies", prefix: "HIS" },
    { id: "mass-comm", name: "Mass Communication", prefix: "MAC" },
  ],
};

const PHYSIOLOGY_COURSES = (uniId: string, facultyId: string, deptId: string) => [
  {
    id: `${uniId}-${facultyId}-${deptId}-200-201`,
    code: "PHY 201",
    title: "General Physiology",
    level: "200 Level",
    departmentId: deptId,
    departmentName: "Physiology",
    availableYears: [2019, 2020, 2021, 2022, 2023],
  },
  {
    id: `${uniId}-${facultyId}-${deptId}-200-202`,
    code: "PHY 202",
    title: "Blood & Cardiovascular Physiology",
    level: "200 Level",
    departmentId: deptId,
    departmentName: "Physiology",
    availableYears: [2019, 2020, 2021, 2022, 2023],
  },
  {
    id: `${uniId}-${facultyId}-${deptId}-300-301`,
    code: "PHY 301",
    title: "Systemic Physiology",
    level: "300 Level",
    departmentId: deptId,
    departmentName: "Physiology",
    availableYears: [2018, 2019, 2020, 2021, 2022, 2023],
  },
  {
    id: `${uniId}-${facultyId}-${deptId}-300-302`,
    code: "PHY 302",
    title: "Neurophysiology",
    level: "300 Level",
    departmentId: deptId,
    departmentName: "Physiology",
    premiumCourse: true,
    availableYears: [2018, 2019, 2020, 2021, 2022, 2023],
  },
  {
    id: `${uniId}-${facultyId}-${deptId}-300-303`,
    code: "PHY 303",
    title: "Endocrine Physiology",
    level: "300 Level",
    departmentId: deptId,
    departmentName: "Physiology",
    premiumCourse: true,
    availableYears: [2018, 2019, 2020, 2021, 2022, 2023],
  },
];

function buildGenericCourses(
  uniId: string,
  facultyId: string,
  dept: { id: string; name: string; prefix: string }
): UniversityCourse[] {
  const levels = ["100", "200", "300", "400"];
  const courses: UniversityCourse[] = [];
  levels.forEach((level, li) => {
    const num = 101 + li * 4;
    courses.push({
      id: `${uniId}-${facultyId}-${dept.id}-${level}-${num}`,
      code: `${dept.prefix} ${num}`,
      title: `${dept.name} — Level ${level}`,
      level: `${level} Level`,
      departmentId: dept.id,
      departmentName: dept.name,
      availableYears: AVAILABLE_YEARS,
    });
  });
  return courses;
}

function buildUniversity(entry: {
  id: string;
  name: string;
  shortName: string;
  region: string;
  location: string;
}): University {
  const faculties: UniversityFaculty[] = UNIVERSITY_FACULTY_NAMES.map((facultyName) => {
    const facultyId = facultyName.toLowerCase().replace(/\s+/g, "-");
    const depts = DEPT_BY_FACULTY[facultyName] || [];
    return {
      id: facultyId,
      name: facultyName,
      departments: depts.map((dept) => {
        let courses: UniversityCourse[];
        if (dept.id === "physiology" && entry.id === "unn") {
          courses = PHYSIOLOGY_COURSES(entry.id, facultyId, dept.id);
        } else {
          courses = buildGenericCourses(entry.id, facultyId, dept);
        }
        return { id: dept.id, name: dept.name, courses };
      }),
    };
  });
  return { ...entry, faculties };
}

export const UNIVERSITY_CATALOG: University[] = UNIVERSITY_NAMES.map(buildUniversity);

export function findUniversity(id: string) {
  return UNIVERSITY_CATALOG.find((u) => u.id === id);
}

export function findFaculty(universityId: string, facultyId: string) {
  const uni = findUniversity(universityId);
  return uni?.faculties.find((f) => f.id === facultyId);
}

export function findCourse(courseId: string) {
  for (const uni of UNIVERSITY_CATALOG) {
    for (const faculty of uni.faculties) {
      for (const dept of faculty.departments) {
        const course = dept.courses.find((c) => c.id === courseId);
        if (course) {
          return { university: uni, faculty, department: dept, course };
        }
      }
    }
  }
  return null;
}

export function flattenFacultyCourses(faculty: UniversityFaculty): UniversityCourse[] {
  return faculty.departments.flatMap((d) =>
    d.courses.map((c) => ({
      ...c,
      departmentId: c.departmentId || d.id,
      departmentName: c.departmentName || d.name,
    }))
  );
}

export function listUniversities(search = "") {
  const q = search.trim().toLowerCase();
  let list = UNIVERSITY_CATALOG;
  if (q) {
    list = list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.shortName.toLowerCase().includes(q) ||
        u.location?.toLowerCase().includes(q)
    );
  }
  const grouped: Record<string, University[]> = {};
  for (const u of list) {
    if (!grouped[u.region]) grouped[u.region] = [];
    grouped[u.region].push(u);
  }
  return { universities: list, grouped };
}

export function listFacultyCourses(
  universityId: string,
  facultyId: string,
  search = "",
  level = ""
) {
  const faculty = findFaculty(universityId, facultyId);
  if (!faculty) return null;
  let courses = flattenFacultyCourses(faculty);
  const q = search.trim().toLowerCase();
  if (q) {
    courses = courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
    );
  }
  if (level) {
    courses = courses.filter((c) => c.level.toLowerCase().includes(level.toLowerCase()));
  }
  const byLevel: Record<string, UniversityCourse[]> = {};
  for (const c of courses) {
    if (!byLevel[c.level]) byLevel[c.level] = [];
    byLevel[c.level].push(c);
  }
  return { faculty, courses, byLevel };
}

export function getCourseYears(courseId: string, isPremium: boolean) {
  const match = findCourse(courseId);
  if (!match) return null;
  const years = match.course.availableYears || AVAILABLE_YEARS;
  return years.map((year) => ({
    year,
    locked: !isYearFree(year, isPremium),
    free: FREE_YEARS.includes(year),
    premium: !FREE_YEARS.includes(year),
  }));
}

export function isYearFree(year: number, isPremium: boolean) {
  if (isPremium) return true;
  return FREE_YEARS.includes(year);
}

export function isCoursePremiumLocked(courseId: string, isPremium: boolean) {
  if (isPremium) return false;
  const match = findCourse(courseId);
  return Boolean(match?.course.premiumCourse);
}
