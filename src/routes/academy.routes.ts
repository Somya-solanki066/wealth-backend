import express, { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  ACADEMY_COURSES,
  courseIdsForEnrollment,
  getAcademyCourse,
  type AcademyCourseId,
} from "../data/academyCatalog";

const router = express.Router();

type CourseProgress = {
  completedLessons: number[];
  examPassed?: boolean;
  examScore?: number;
  examSubmittedAt?: string;
};

type AcademyProgressDoc = {
  userId: string;
  enteredWith: string | null;
  lastEnteredAt: string | null;
  courses: Partial<Record<AcademyCourseId, CourseProgress>>;
  certificates: {
    courseId: AcademyCourseId;
    certId: string;
    courseTitle: string;
    issuedAt: string;
    studentName: string;
  }[];
  updatedAt: string;
};

async function getAccessibleCourseIds(userId: string): Promise<AcademyCourseId[]> {
  const db = getFirestore();
  const snap = await db.collection("courseEnrollments").where("userId", "==", userId).get();
  const ids = new Set<AcademyCourseId>();

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status !== "paid") continue;
    if (d.validUntil) {
      const expiry = new Date(d.validUntil);
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) continue;
    }
    for (const cid of courseIdsForEnrollment(String(d.courseId || ""))) {
      ids.add(cid);
    }
  }

  return [...ids];
}

async function getProgressDoc(userId: string): Promise<AcademyProgressDoc> {
  const db = getFirestore();
  const ref = db.collection("academyProgress").doc(userId);
  const snap = await ref.get();
  if (snap.exists) {
    return { userId, enteredWith: null, lastEnteredAt: null, courses: {}, certificates: [], updatedAt: new Date().toISOString(), ...snap.data() } as AcademyProgressDoc;
  }
  return {
    userId,
    enteredWith: null,
    lastEnteredAt: null,
    courses: {},
    certificates: [],
    updatedAt: new Date().toISOString(),
  };
}

async function saveProgressDoc(userId: string, data: Partial<AcademyProgressDoc>) {
  const db = getFirestore();
  const ref = db.collection("academyProgress").doc(userId);
  await ref.set({ userId, updatedAt: new Date().toISOString(), ...data }, { merge: true });
}

async function isEnrollmentActive(data: Record<string, unknown>): Promise<boolean> {
  if (String(data.status || "") !== "paid") return false;
  if (data.validUntil) {
    const expiry = new Date(String(data.validUntil));
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) return false;
  }
  return true;
}

/** Enrollment must belong to this exact logged-in user. */
async function findOwnedEnrollment(userId: string, enrollmentId: string) {
  const db = getFirestore();
  const owned = await db
    .collection("courseEnrollments")
    .where("userId", "==", userId)
    .where("enrollmentId", "==", enrollmentId)
    .limit(1)
    .get();

  if (!owned.empty) {
    const doc = owned.docs[0];
    const data = doc.data();
    if (await isEnrollmentActive(data)) {
      return { found: true as const, owned: true, doc, data };
    }
    return { found: true as const, owned: true, inactive: true as const, doc, data };
  }

  const foreign = await db
    .collection("courseEnrollments")
    .where("enrollmentId", "==", enrollmentId)
    .limit(1)
    .get();

  if (!foreign.empty) {
    return { found: true as const, owned: false, doc: foreign.docs[0], data: foreign.docs[0].data() };
  }

  return { found: false as const, owned: false };
}

async function getPortalAccess(userId: string) {
  const progress = await getProgressDoc(userId);
  if (!progress.enteredWith) {
    return { portalAccess: false, enteredWith: null as string | null };
  }

  const check = await findOwnedEnrollment(userId, progress.enteredWith);
  if (!check.found || !check.owned || ("inactive" in check && check.inactive)) {
    await saveProgressDoc(userId, { enteredWith: null, lastEnteredAt: null });
    return { portalAccess: false, enteredWith: null as string | null };
  }

  return { portalAccess: true, enteredWith: progress.enteredWith };
}

async function requirePortalAccess(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Login required to access the academy portal." });
    return null;
  }
  const access = await getPortalAccess(req.user.uid);
  if (!access.portalAccess) {
    res.status(403).json({
      error: "Academy access not verified. Enter your own enrollment ID to continue.",
      code: "ACADEMY_GATE_REQUIRED",
    });
    return null;
  }
  return access;
}

/** GET /api/academy/portal */
router.get("/portal", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const userId = req.user.uid;
    const db = getFirestore();
    const [accessibleCourseIds, progress, enrollSnap, userSnap] = await Promise.all([
      getAccessibleCourseIds(userId),
      getProgressDoc(userId),
      db.collection("courseEnrollments").where("userId", "==", userId).where("status", "==", "paid").get(),
      db.collection("users").doc(userId).get(),
    ]);

    const enrollmentIds = enrollSnap.docs
      .map((d) => d.data().enrollmentId)
      .filter(Boolean) as string[];

    const userData = userSnap.data() || {};
    const studentName =
      (userData.displayName as string) ||
      req.user.name ||
      req.user.email?.split("@")[0] ||
      "Student";

    const access = await getPortalAccess(userId);
    const hasEnrollment = enrollmentIds.length > 0;

    if (!access.portalAccess) {
      return res.json({
        portalAccess: false,
        hasEnrollment,
        enrollmentIds,
        studentName,
        userEmail: req.user.email || null,
        entered: false,
        enteredWith: null,
        accessibleCourseIds: [],
        progress: {},
        certificates: [],
        courses: [],
      });
    }

    return res.json({
      portalAccess: true,
      hasEnrollment,
      accessibleCourseIds,
      enrollmentIds,
      studentName,
      userEmail: req.user.email || null,
      entered: true,
      enteredWith: access.enteredWith,
      progress: progress.courses || {},
      certificates: progress.certificates || [],
      courses: accessibleCourseIds.map((id) => {
        const course = ACADEMY_COURSES[id];
        const cp = progress.courses?.[id];
        const completed = cp?.completedLessons?.length || 0;
        const total = course.lessons.length;
        return {
          id,
          title: course.title,
          lede: course.lede,
          icon: course.icon,
          totalLessons: total,
          completedLessons: completed,
          percent: total ? Math.round((completed / total) * 100) : 0,
          examPassed: Boolean(cp?.examPassed),
        };
      }),
    });
  } catch (error: any) {
    console.error("Academy portal error:", error);
    return res.status(500).json({ error: error.message || "Failed to load academy portal." });
  }
});

/** POST /api/academy/enter */
router.post("/enter", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const enrollmentId = String(req.body?.enrollmentId || "").trim();
    if (!enrollmentId) return res.status(400).json({ error: "Enrollment ID is required." });

    const check = await findOwnedEnrollment(req.user.uid, enrollmentId);

    if (!check.found) {
      return res.status(403).json({
        error: "Invalid enrollment ID. Use the ID shown in your Courses tab after payment.",
        code: "ENROLLMENT_NOT_FOUND",
      });
    }

    if (!check.owned) {
      return res.status(403).json({
        error:
          "This enrollment ID belongs to another account. Log in with the account that purchased this course and use that account's ID.",
        code: "ENROLLMENT_OWNERSHIP_MISMATCH",
      });
    }

    if ("inactive" in check && check.inactive) {
      return res.status(403).json({
        error: "This enrollment is not active. Please contact support if you believe this is an error.",
        code: "ENROLLMENT_INACTIVE",
      });
    }

    await saveProgressDoc(req.user.uid, {
      enteredWith: enrollmentId,
      lastEnteredAt: new Date().toISOString(),
    });

    return res.json({ success: true, enrollmentId, portalAccess: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to enter portal." });
  }
});

/** PATCH /api/academy/progress/:courseId */
router.patch("/progress/:courseId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const portalAccess = await requirePortalAccess(req, res);
    if (!portalAccess) return;

    const courseId = String(req.params.courseId || "") as AcademyCourseId;
    if (!getAcademyCourse(courseId)) return res.status(400).json({ error: "Invalid course." });

    const accessible = await getAccessibleCourseIds(req.user.uid);
    if (!accessible.includes(courseId)) {
      return res.status(403).json({ error: "You do not have access to this course." });
    }

    const lessonIndex = Number(req.body?.lessonIndex);
    const completed = req.body?.completed !== false;
    if (!Number.isInteger(lessonIndex) || lessonIndex < 0) {
      return res.status(400).json({ error: "Invalid lesson index." });
    }

    const course = getAcademyCourse(courseId)!;
    if (lessonIndex >= course.lessons.length) {
      return res.status(400).json({ error: "Lesson not found." });
    }

    const progress = await getProgressDoc(req.user.uid);
    const courseProgress: CourseProgress = progress.courses[courseId] || { completedLessons: [] };
    const set = new Set(courseProgress.completedLessons || []);

    if (completed) set.add(lessonIndex);
    else set.delete(lessonIndex);

    const updatedCourses = {
      ...progress.courses,
      [courseId]: {
        ...courseProgress,
        completedLessons: [...set].sort((a, b) => a - b),
      },
    };

    await saveProgressDoc(req.user.uid, { courses: updatedCourses });

    return res.json({
      success: true,
      completedLessons: updatedCourses[courseId]!.completedLessons,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to save progress." });
  }
});

/** POST /api/academy/exam/:courseId/submit */
router.post("/exam/:courseId/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const portalAccess = await requirePortalAccess(req, res);
    if (!portalAccess) return;

    const courseId = String(req.params.courseId || "") as AcademyCourseId;
    const course = getAcademyCourse(courseId);
    if (!course) return res.status(400).json({ error: "Invalid course." });

    const accessible = await getAccessibleCourseIds(req.user.uid);
    if (!accessible.includes(courseId)) {
      return res.status(403).json({ error: "You do not have access to this course." });
    }

    const answers: number[] = Array.isArray(req.body?.answers) ? req.body.answers.map(Number) : [];
    if (answers.length !== course.exam.length) {
      return res.status(400).json({ error: "Please answer all questions." });
    }

    const progress = await getProgressDoc(req.user.uid);
    const courseProgress = progress.courses[courseId] || { completedLessons: [] };
    const allLessonsDone = course.lessons.every((_, i) => courseProgress.completedLessons?.includes(i));
    if (!allLessonsDone) {
      return res.status(400).json({ error: "Complete all lessons before taking the exam." });
    }

    let correct = 0;
    course.exam.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct += 1;
    });
    const score = Math.round((correct / course.exam.length) * 100);
    const passed = score >= course.passScore;

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(req.user.uid).get();
    const studentName =
      (userSnap.data()?.displayName as string) ||
      req.user.name ||
      req.user.email?.split("@")[0] ||
      "Student";

    let certificate = progress.certificates.find((c) => c.courseId === courseId) || null;

    if (passed && !certificate) {
      const counterRef = db.collection("academyCertCounters").doc(course.certPrefix);
      const certNum = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const last = snap.exists ? Number(snap.data()?.lastNumber || 0) : 0;
        const next = last + 1;
        tx.set(counterRef, { lastNumber: next, updatedAt: new Date().toISOString() }, { merge: true });
        return next;
      });
      certificate = {
        courseId,
        certId: `${course.certPrefix}-${String(certNum).padStart(5, "0")}`,
        courseTitle: `${course.title} — ${course.lede}`,
        issuedAt: new Date().toISOString(),
        studentName,
      };
    }

    const certificates = certificate
      ? [...progress.certificates.filter((c) => c.courseId !== courseId), certificate]
      : progress.certificates;

    const updatedCourses = {
      ...progress.courses,
      [courseId]: {
        ...courseProgress,
        examPassed: passed,
        examScore: score,
        examSubmittedAt: new Date().toISOString(),
      },
    };

    await saveProgressDoc(req.user.uid, { courses: updatedCourses, certificates });

    return res.json({
      success: true,
      passed,
      score,
      passScore: course.passScore,
      certificate,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to submit exam." });
  }
});

export default router;
