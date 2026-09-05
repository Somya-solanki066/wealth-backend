export type UniversityCourse = {
  id: string;
  code: string;
  title: string;
  level: string;
};

export type UniversityDepartment = {
  id: string;
  name: string;
  courses: UniversityCourse[];
};

export type UniversityFaculty = {
  id: string;
  name: string;
  departments: UniversityDepartment[];
};

export type University = {
  id: string;
  name: string;
  shortName: string;
  faculties: UniversityFaculty[];
};

export const UNIVERSITY_FACULTY_NAMES = [
  "Sciences",
  "Engineering",
  "Law",
  "Medicine",
  "Arts",
  "Commerce",
  "Education",
] as const;

export const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];
export const FREE_YEARS = [2024, 2023, 2022];

const UNIVERSITY_NAMES: { id: string; name: string; shortName: string }[] = [
  { id: "unilag", name: "University of Lagos", shortName: "UNILAG" },
  { id: "ui", name: "University of Ibadan", shortName: "UI" },
  { id: "abu", name: "Ahmadu Bello University", shortName: "ABU" },
  { id: "unn", name: "University of Nigeria, Nsukka", shortName: "UNN" },
  { id: "oau", name: "Obafemi Awolowo University", shortName: "OAU" },
  { id: "uniben", name: "University of Benin", shortName: "UNIBEN" },
  { id: "uniport", name: "University of Port Harcourt", shortName: "UNIPORT" },
  { id: "lasu", name: "Lagos State University", shortName: "LASU" },
  { id: "buk", name: "Bayero University Kano", shortName: "BUK" },
  { id: "futa", name: "Federal University of Technology, Akure", shortName: "FUTA" },
  { id: "unizik", name: "Nnamdi Azikiwe University", shortName: "UNIZIK" },
  { id: "unilorin", name: "University of Ilorin", shortName: "UNILORIN" },
  { id: "rsu", name: "Rivers State University", shortName: "RSU" },
  { id: "unijos", name: "University of Jos", shortName: "UNIJOS" },
  { id: "unical", name: "University of Calabar", shortName: "UNICAL" },
  { id: "delsu", name: "Delta State University", shortName: "DELSU" },
  { id: "covenant", name: "Covenant University", shortName: "CU" },
  { id: "babcock", name: "Babcock University", shortName: "BU" },
  { id: "unimaid", name: "University of Maiduguri", shortName: "UNIMAID" },
  { id: "funaab", name: "Federal University of Agriculture, Abeokuta", shortName: "FUNAAB" },
];

const DEPT_BY_FACULTY: Record<string, { id: string; name: string; prefix: string }[]> = {
  Sciences: [
    { id: "mathematics", name: "Mathematics", prefix: "MAT" },
    { id: "physics", name: "Physics", prefix: "PHY" },
    { id: "chemistry", name: "Chemistry", prefix: "CHM" },
    { id: "biology", name: "Biology", prefix: "BIO" },
  ],
  Engineering: [
    { id: "electrical-eng", name: "Electrical Engineering", prefix: "EEE" },
    { id: "mechanical-eng", name: "Mechanical Engineering", prefix: "MEE" },
    { id: "civil-eng", name: "Civil Engineering", prefix: "CVE" },
    { id: "computer-eng", name: "Computer Engineering", prefix: "CPE" },
  ],
  Law: [
    { id: "public-law", name: "Public Law", prefix: "LAW" },
    { id: "private-law", name: "Private & Commercial Law", prefix: "LAW" },
  ],
  Medicine: [
    { id: "medicine-surgery", name: "Medicine & Surgery", prefix: "MED" },
    { id: "nursing", name: "Nursing Science", prefix: "NSC" },
    { id: "pharmacy", name: "Pharmacy", prefix: "PHA" },
  ],
  Arts: [
    { id: "english", name: "English & Literary Studies", prefix: "ENG" },
    { id: "history", name: "History & International Studies", prefix: "HIS" },
    { id: "mass-comm", name: "Mass Communication", prefix: "MAC" },
  ],
  Commerce: [
    { id: "accounting", name: "Accounting", prefix: "ACC" },
    { id: "business-admin", name: "Business Administration", prefix: "BUS" },
    { id: "economics", name: "Economics", prefix: "ECO" },
  ],
  Education: [
    { id: "edu-admin", name: "Educational Administration", prefix: "EDA" },
    { id: "curriculum", name: "Curriculum Studies", prefix: "CUR" },
  ],
};

const COURSE_TITLES = [
  "Introduction I",
  "Introduction II",
  "Theory I",
  "Theory II",
  "Practical I",
  "Practical II",
];

function buildCourses(
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
      title: `${dept.name} — ${COURSE_TITLES[li % COURSE_TITLES.length]}`,
      level: `${level} Level`,
    });
    if (level === "300" || level === "400") {
      courses.push({
        id: `${uniId}-${facultyId}-${dept.id}-${level}-${num + 2}`,
        code: `${dept.prefix} ${num + 4}`,
        title:
          dept.prefix === "EEE"
            ? li === 2
              ? "Circuit Theory II"
              : "Electromagnetic Fields"
            : `${dept.name} — Advanced ${level} Level`,
        level: `${level} Level`,
      });
    }
  });
  return courses;
}

function buildUniversity(entry: { id: string; name: string; shortName: string }): University {
  const faculties: UniversityFaculty[] = UNIVERSITY_FACULTY_NAMES.map((facultyName) => {
    const facultyId = facultyName.toLowerCase().replace(/\s+/g, "-");
    const depts = DEPT_BY_FACULTY[facultyName] || [];
    return {
      id: facultyId,
      name: facultyName,
      departments: depts.map((dept) => ({
        id: dept.id,
        name: dept.name,
        courses: buildCourses(entry.id, facultyId, dept),
      })),
    };
  });
  return { ...entry, faculties };
}

export const UNIVERSITY_CATALOG: University[] = UNIVERSITY_NAMES.map(buildUniversity);

export function findUniversity(id: string) {
  return UNIVERSITY_CATALOG.find((u) => u.id === id);
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

export function isYearFree(year: number, isPremium: boolean) {
  if (isPremium) return true;
  return FREE_YEARS.includes(year);
}
