import { getFirestore } from "firebase-admin/firestore";
import { getCourseProduct } from "../data/courseProducts";

export type CourseEnrollmentRecord = {
  enrollmentId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  courseId: string;
  courseName: string;
  amountPaid: number;
  amountPaidKobo: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paymentProvider: string;
  stripeSessionId: string;
  validFrom: string;
  validUntil: string | null;
  accessType: "lifetime" | "limited";
  createdAt: string;
  confirmedAt: string | null;
  source: string;
};

export async function generateEnrollmentId(prefix: string): Promise<string> {
  const db = getFirestore();
  const counterRef = db.collection("courseEnrollmentCounters").doc(prefix);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists ? Number(snap.data()?.lastNumber || 0) : 0;
    const next = last + 1;
    tx.set(
      counterRef,
      { lastNumber: next, prefix, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return `${prefix}-${String(next).padStart(4, "0")}`;
  });
}

export async function fulfillCourseEnrollment(params: {
  userId: string;
  email: string | null;
  courseId: string;
  stripeSessionId: string;
  amountTotal: number;
  currency: string;
  source: string;
}): Promise<CourseEnrollmentRecord & { id: string }> {
  const db = getFirestore();

  const existingSnap = await db
    .collection("courseEnrollments")
    .where("stripeSessionId", "==", params.stripeSessionId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0];
    return { id: doc.id, ...(doc.data() as CourseEnrollmentRecord) };
  }

  const product = getCourseProduct(params.courseId);
  if (!product) {
    throw new Error(`Unknown course: ${params.courseId}`);
  }

  const userSnap = await db.collection("users").doc(params.userId).get();
  const userData = userSnap.data() || {};
  const userName = (userData.displayName as string) || null;

  const enrollmentId = await generateEnrollmentId(product.enrollmentPrefix);
  const now = new Date();
  const validFrom = now.toISOString();
  const validUntil = product.validityDays
    ? new Date(now.getTime() + product.validityDays * 86400000).toISOString()
    : null;

  const enrollment: CourseEnrollmentRecord = {
    enrollmentId,
    userId: params.userId,
    userEmail: params.email,
    userName,
    courseId: product.id,
    courseName: product.name,
    amountPaid: Math.round(params.amountTotal / 100),
    amountPaidKobo: params.amountTotal,
    currency: params.currency || "ngn",
    status: "paid",
    paymentProvider: "stripe",
    stripeSessionId: params.stripeSessionId,
    validFrom,
    validUntil,
    accessType: validUntil ? "limited" : "lifetime",
    createdAt: validFrom,
    confirmedAt: validFrom,
    source: params.source,
  };

  const ref = db.collection("courseEnrollments").doc();
  await ref.set(enrollment);

  const enrolledCourses: string[] = Array.isArray(userData.enrolledCourses)
    ? [...userData.enrolledCourses]
    : [];
  if (!enrolledCourses.includes(product.id)) {
    enrolledCourses.push(product.id);
  }
  if (product.id === "witweb-bundle" && !enrolledCourses.includes("witweb")) {
    enrolledCourses.push("witweb");
  }
  await db.collection("users").doc(params.userId).set({ enrolledCourses }, { merge: true });

  return { id: ref.id, ...enrollment };
}
