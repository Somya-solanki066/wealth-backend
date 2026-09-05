export type CourseProductId = "witweb" | "ssg" | "witweb-bundle";

export type CourseProduct = {
  id: CourseProductId;
  name: string;
  shortName: string;
  enrollmentPrefix: string;
  priceNGN: number;
  validityDays: number | null;
  description: string;
};

export const COURSE_PRODUCTS: Record<CourseProductId, CourseProduct> = {
  witweb: {
    id: "witweb",
    name: "WIT-WEB Academy",
    shortName: "WIT-WEB",
    enrollmentPrefix: "WIT-WEB",
    priceNGN: 35000,
    validityDays: null,
    description: "Webnoveling Ink to Wealth Blueprint — 12 modules, lifetime access.",
  },
  ssg: {
    id: "ssg",
    name: "SSG Blueprint",
    shortName: "SSG Blueprint",
    enrollmentPrefix: "SSG-Blue",
    priceNGN: 30000,
    validityDays: null,
    description: "Scriptwriting and Screenwriting Guide — full programme access.",
  },
  "witweb-bundle": {
    id: "witweb-bundle",
    name: "WIT-WEB + App Bundle",
    shortName: "WIT-WEB Bundle",
    enrollmentPrefix: "WIT-BND",
    priceNGN: 55000,
    validityDays: 365,
    description:
      "WIT-WEB Academy lifetime access plus 1 year Ink2Wealth Premium app access.",
  },
};

export function getCourseProduct(courseId: string): CourseProduct | null {
  return COURSE_PRODUCTS[courseId as CourseProductId] || null;
}

export function isValidCourseProductId(id: string): id is CourseProductId {
  return id in COURSE_PRODUCTS;
}
