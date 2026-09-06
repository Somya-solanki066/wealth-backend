import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import { PROFESSIONAL_COURSES } from "../data/professionalCatalog";
import type { ProfessionalCourseId } from "../data/professionalCatalog";
import type { ProfessionalOptionKey } from "../data/professionalQuestions";
import { getProfessionalQuestions, stripProfessionalAnswer } from "../data/professionalQuestions";
import { getProfessionalModule, getModulesForCourseLevel, getProfessionalCourse } from "../data/professionalCatalog";
import {
  checkAnswer,
  getCourseHub,
  getLicensingPrepAccess,
  getProHubHome,
  getProfessionalProfile,
  getSubjectAccess,
  saveProfessionalProfile,
  scoreProfessionalSession,
  searchCatalog,
  startPracticeSession,
} from "../services/professionalPractice.service";

const router = express.Router();

async function getPremium(userId: string) {
  const snap = await getFirestore().collection("users").doc(userId).get();
  return isUserPremium(snap.data());
}

/** GET /api/student/professional/home */
router.get("/home", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const home = await getProHubHome(req.user.uid);
    return res.json(home);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/professional/catalog */
router.get("/catalog", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q || "");
    const category = String(req.query.category || "all");
    const courses = searchCatalog(q, category);
    return res.json({ courses, total: courses.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/professional/courses/:courseId/hub */
router.get("/courses/:courseId/hub", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const courseId = String(req.params.courseId) as ProfessionalCourseId;
    const yearOrLevel = Number(req.query.yearOrLevel || req.query.level || 4);
    const category = req.query.category ? String(req.query.category) : undefined;
    const hub = await getCourseHub(req.user.uid, courseId, yearOrLevel, category);
    return res.json(hub);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** GET /api/student/professional/profile */
router.get("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getProfessionalProfile(req.user.uid);
    return res.json({ profile, setupRequired: !profile?.setupComplete });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/professional/profile */
router.post("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await saveProfessionalProfile(req.user.uid, {
      courseId: String(req.body?.courseId || "") as ProfessionalCourseId,
      institution: String(req.body?.institution || ""),
      currentYear: Number(req.body?.currentYear || 1),
      currentLevel: Number(req.body?.currentLevel || 100),
    });
    return res.json({ success: true, profile });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** POST /api/student/professional/start */
router.post("/start", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const subjectId = String(req.body?.subjectId || "");
    const licensingPrepId = String(req.body?.licensingPrepId || "");
    const courseId = String(req.body?.courseId || "") as ProfessionalCourseId;
    const limit = Number(req.body?.limit || 20);

    const premium = await getPremium(req.user.uid);

    if (subjectId) {
      const access = getSubjectAccess(subjectId, premium);
      if (!access) return res.status(404).json({ error: "Subject not found." });
      if (access.locked) {
        return res.status(403).json({ error: "Premium subscription required.", premiumRequired: true, subjectName: access.subject.name });
      }
    }

    if (licensingPrepId && courseId) {
      const access = getLicensingPrepAccess(courseId, premium);
      if (!access) return res.status(404).json({ error: "Licensing prep not found." });
      if (access.locked) {
        return res.status(403).json({ error: "Premium subscription required.", premiumRequired: true });
      }
    }

    const session = startPracticeSession({ subjectId, licensingPrepId, limit });

    const db = getFirestore();
    const pendingRef = db.collection("professionalPendingSessions").doc();
    await pendingRef.set({
      userId: req.user.uid,
      subjectId: subjectId || null,
      courseId: courseId || null,
      licensingPrepId: licensingPrepId || null,
      type: licensingPrepId ? "licensing" : "subject",
      questionIds: session.questionIds,
      createdAt: new Date().toISOString(),
    });

    return res.json({ sessionToken: pendingRef.id, ...session });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/professional/check-answer */
router.post("/check-answer", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const questionId = String(req.body?.questionId || "");
    const chosen = String(req.body?.chosen || "") as ProfessionalOptionKey;
    const result = checkAnswer(questionId, chosen);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** POST /api/student/professional/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessionToken = String(req.body?.sessionToken || "");
    const answers = (req.body?.answers || {}) as Record<string, ProfessionalOptionKey | null>;

    if (sessionToken) {
      const db = getFirestore();
      const pendingRef = db.collection("professionalPendingSessions").doc(sessionToken);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists || pendingSnap.data()?.userId !== req.user.uid) {
        return res.status(400).json({ error: "Session expired." });
      }
      const pending = pendingSnap.data()!;
      const result = await scoreProfessionalSession(req.user.uid, {
        subjectId: pending.subjectId || "",
        courseId: (pending.courseId || "pharmacy") as ProfessionalCourseId,
        type: pending.type || "subject",
        licensingPrepId: pending.licensingPrepId || undefined,
        answers,
        questionIds: pending.questionIds || [],
      });
      await pendingRef.delete();
      return res.json(result);
    }

    const moduleId = String(req.body?.moduleId || "");
    const data = getProfessionalModule(moduleId);
    if (!data) return res.status(404).json({ error: "Module not found." });

    const result = await scoreProfessionalSession(req.user.uid, {
      subjectId: moduleId,
      courseId: data.course.id,
      type: "subject",
      answers,
      questionIds: Object.keys(answers),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** Legacy modules */
router.get("/modules/:courseId/:level", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const courseId = String(req.params.courseId) as ProfessionalCourseId;
    const level = Number(req.params.level);
    const course = getProfessionalCourse(courseId);
    if (!course) return res.status(404).json({ error: "Course not found." });
    const modules = getModulesForCourseLevel(courseId, level);
    return res.json({ course: { id: course.id, name: course.name }, level, modules });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** Legacy questions */
router.get("/questions/:moduleId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const moduleId = String(req.params.moduleId);
    const data = getProfessionalModule(moduleId);
    if (!data) return res.status(404).json({ error: "Module not found." });
    const questions = getProfessionalQuestions(data.module.id, data.course.id, data.module.name).map(stripProfessionalAnswer);
    return res.json({
      course: { id: data.course.id, name: data.course.name },
      module: data.module,
      totalQuestions: questions.length,
      durationMinutes: 30,
      questions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** Legacy full catalog */
router.get("/catalog/all", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  return res.json({ courses: PROFESSIONAL_COURSES });
});

export default router;
