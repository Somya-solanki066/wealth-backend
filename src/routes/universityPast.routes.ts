import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import { AVAILABLE_YEARS, FREE_YEARS } from "../data/universityCatalog";
import {
  buildSession,
  checkAnswer,
  getCourses,
  getFaculties,
  getSessionHistory,
  getUniversitiesList,
  getYearsForCourse,
  questionsForClient,
  scoreSession,
  type PracticeMode,
} from "../services/universityPast.service";
import type { PastOptionKey } from "../data/universityQuestions";

const router = express.Router();

async function getPremium(userId: string): Promise<boolean> {
  const db = getFirestore();
  const snap = await db.collection("users").doc(userId).get();
  return isUserPremium(snap.data());
}

/** GET /api/student/university-past/universities?search= */
router.get("/universities", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const search = String(req.query.search || "");
    return res.json(getUniversitiesList(search));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load universities." });
  }
});

/** GET /api/student/university-past/universities/:uniId/faculties */
router.get("/universities/:uniId/faculties", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const data = getFaculties(String(req.params.uniId));
    if (!data) return res.status(404).json({ error: "University not found." });
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load faculties." });
  }
});

/** GET /api/student/university-past/universities/:uniId/faculties/:facultyId/courses */
router.get(
  "/universities/:uniId/faculties/:facultyId/courses",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const search = String(req.query.search || "");
      const level = String(req.query.level || "");
      const data = getCourses(String(req.params.uniId), String(req.params.facultyId), search, level);
      if (!data) return res.status(404).json({ error: "Faculty not found." });
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load courses." });
    }
  }
);

/** GET /api/student/university-past/courses/:courseId/years */
router.get("/courses/:courseId/years", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const premium = await getPremium(req.user.uid);
    const data = getYearsForCourse(String(req.params.courseId), premium);
    if (!data) return res.status(404).json({ error: "Course not found." });
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load years." });
  }
});

/** Legacy catalog endpoint */
router.get("/catalog", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const data = getUniversitiesList();
    return res.json({
      regions: data.regions,
      availableYears: AVAILABLE_YEARS,
      freeYears: FREE_YEARS,
      totalUniversities: data.total,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** Legacy years endpoint */
router.get("/years/:courseId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const premium = await getPremium(req.user.uid);
    const data = getYearsForCourse(String(req.params.courseId), premium);
    if (!data) return res.status(404).json({ error: "Course not found." });
    return res.json({
      course: data.course,
      university: data.university,
      faculty: data.faculty,
      department: data.department,
      years: data.years,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/university-past/start */
router.post("/start", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const courseId = String(req.body?.courseId || "");
    const year = Number(req.body?.year);
    const mode = String(req.body?.mode || "exam") as PracticeMode;

    if (!courseId || !year) {
      return res.status(400).json({ error: "Course and year are required." });
    }

    const premium = await getPremium(req.user.uid);
    let config;
    try {
      config = buildSession(courseId, year, mode, premium);
    } catch (err: any) {
      if (err.premiumRequired) {
        return res.status(403).json({
          error: err.message,
          premiumRequired: true,
          coursePremium: err.coursePremium || false,
          yearPremium: err.yearPremium || false,
        });
      }
      throw err;
    }

    const db = getFirestore();
    const pendingRef = db.collection("universityPendingSessions").doc();
    await pendingRef.set({
      userId: req.user.uid,
      config,
      createdAt: new Date().toISOString(),
    });

    const questions = questionsForClient(config.questionIds, courseId, year);
    return res.json({
      sessionToken: pendingRef.id,
      ...config,
      totalQuestions: questions.length,
      questions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to start session." });
  }
});

/** POST /api/student/university-past/check-answer — Study mode instant feedback */
router.post("/check-answer", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessionToken = String(req.body?.sessionToken || "");
    const questionId = String(req.body?.questionId || "");
    const chosen = String(req.body?.chosen || "") as PastOptionKey;

    const db = getFirestore();
    const pendingSnap = await db.collection("universityPendingSessions").doc(sessionToken).get();
    if (!pendingSnap.exists || pendingSnap.data()?.userId !== req.user.uid) {
      return res.status(400).json({ error: "Invalid session." });
    }
    const config = pendingSnap.data()?.config;
    if (config?.mode !== "study") {
      return res.status(400).json({ error: "Check-answer is only available in study mode." });
    }

    const result = checkAnswer(questionId, chosen, config.courseId, config.year);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to check answer." });
  }
});

/** Legacy questions endpoint */
router.get("/questions/:courseId/:year", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const courseId = String(req.params.courseId);
    const year = Number(req.params.year);
    const premium = await getPremium(req.user.uid);
    const config = buildSession(courseId, year, "exam", premium);
    const questions = questionsForClient(config.questionIds, courseId, year);
    return res.json({
      courseId,
      year,
      totalQuestions: questions.length,
      durationMinutes: 60,
      questions,
    });
  } catch (error: any) {
    if (error.premiumRequired) {
      return res.status(403).json({ error: error.message, premiumRequired: true });
    }
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/university-past/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessionToken = String(req.body?.sessionToken || "");
    const answers = (req.body?.answers || {}) as Record<string, PastOptionKey | null>;
    const markedForReview = Array.isArray(req.body?.markedForReview) ? req.body.markedForReview : [];
    const timeUsedSeconds = Number(req.body?.timeUsedSeconds || 0);

    if (sessionToken) {
      const db = getFirestore();
      const pendingRef = db.collection("universityPendingSessions").doc(sessionToken);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists || pendingSnap.data()?.userId !== req.user.uid) {
        return res.status(400).json({ error: "Session expired. Please start again." });
      }
      const config = pendingSnap.data()?.config;
      const result = await scoreSession(
        req.user.uid,
        config,
        answers,
        markedForReview,
        timeUsedSeconds
      );
      await pendingRef.delete();
      return res.json(result);
    }

    // Legacy submit without session token
    const courseId = String(req.body?.courseId || "");
    const year = Number(req.body?.year);
    const premium = await getPremium(req.user.uid);
    const config = buildSession(courseId, year, "exam", premium);
    const result = await scoreSession(req.user.uid, config, answers, markedForReview, timeUsedSeconds);
    return res.json(result);
  } catch (error: any) {
    if (error.premiumRequired) {
      return res.status(403).json({ error: error.message, premiumRequired: true });
    }
    return res.status(500).json({ error: error.message || "Failed to submit." });
  }
});

/** GET /api/student/university-past/sessions */
router.get("/sessions", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessions = await getSessionHistory(req.user.uid);
    return res.json({ sessions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load history." });
  }
});

export default router;
