import type { CourseProductId } from "./courseProducts";

export type CourseFeature = { name: string; included: boolean };

const COURSE_FEATURES: Record<CourseProductId, CourseFeature[]> = {
  witweb: [
    { name: "All 12 modules — 48 lessons", included: true },
    { name: "Lifetime access — watch anytime", included: true },
    { name: "Downloadable resources and templates", included: true },
    { name: "Community access — WIT-WEB writers group", included: true },
    { name: "Certificate of completion", included: true },
    { name: "Platform submission guides (9 platforms)", included: true },
    { name: "Contract negotiation strategies", included: true },
  ],
  ssg: [
    { name: "All 10 modules — 40+ lessons", included: true },
    { name: "Feature film, TV, and audio drama formats", included: true },
    { name: "Industry-standard screenplay formatting", included: true },
    { name: "Lifetime access — watch anytime", included: true },
    { name: "Query letter and pitch deck templates", included: true },
    { name: "Certificate of completion", included: true },
    { name: "Nollywood and African film market insights", included: true },
  ],
  "witweb-bundle": [
    { name: "Everything in WIT-WEB Academy (lifetime)", included: true },
    { name: "1 year Ink2Wealth Premium app access", included: true },
    { name: "Unlimited chapter analysis — all 9 platforms", included: true },
    { name: "AI Ghost Writer — unlimited", included: true },
    { name: "All 10 Smart Edit checks", included: true },
    { name: "Book Cover Generator — unlimited", included: true },
    { name: "Full WEALTH Engine", included: true },
    { name: "Priority support from Coach Victor", included: true },
    { name: "One private 30-min strategy session", included: true },
    { name: "Early access to newly released modules", included: true },
  ],
};

export function getCourseFeatures(courseId: string): CourseFeature[] {
  return COURSE_FEATURES[courseId as CourseProductId] || [];
}
