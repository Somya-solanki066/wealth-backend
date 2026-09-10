import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import { NURSING_YEARS } from "../data/nursingCatalog";
import type { NursingTopicId } from "../data/nursingCatalog";
import type { NursingOptionKey } from "../data/nursingQuestions";
import {
  calculateDrugDose,
  checkAnswer,
  getExamAccess,
  getNursingHome,
  getNursingProfile,
  saveNursingProfile,
  scoreNursingSession,
  startPracticeSession,
} from "../services/nursingPractice.service";

const router = express.Router();

async function getPremium(userId: string) {
  const snap = await getFirestore().collection("users").doc(userId).get();
  return isUserPremium(snap.data());
}

/** GET /api/student/nursing/home */
router.get("/home", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const viewYear = req.query.year ? Number(req.query.year) : undefined;
    const home = await getNursingHome(req.user.uid, viewYear);
    return res.json(home);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/nursing/profile */
router.get("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getNursingProfile(req.user.uid);
    return res.json({ profile, setupRequired: !profile?.setupComplete });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/nursing/profile */
router.post("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await saveNursingProfile(req.user.uid, {
      university: String(req.body?.university || ""),
      school: String(req.body?.school || ""),
      year: Number(req.body?.year || 3),
      customUniversityLabel: req.body?.customUniversityLabel
        ? String(req.body.customUniversityLabel)
        : undefined,
    });
    return res.json({ success: true, profile });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** Legacy catalog */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  return res.json({ years: NURSING_YEARS });
});

/** POST /api/student/nursing/start */
router.post("/start", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const topicId = String(req.body?.topicId || "") as NursingTopicId;
    const year = Number(req.body?.year || 3);
    const courseId = String(req.body?.courseId || "");
    const clinicalTopic = String(req.body?.clinicalTopic || "");
    const questionType = String(req.body?.questionType || "");
    const limit = Number(req.body?.limit || 20);
    const examId = String(req.body?.examId || "");

    if (examId) {
      const premium = await getPremium(req.user.uid);
      const access = getExamAccess(examId, premium);
      if (!access) return res.status(404).json({ error: "Exam not found." });
      if (access.locked) {
        return res.status(403).json({ error: "Premium subscription required.", premiumRequired: true });
      }
    }

    const session = startPracticeSession({
      topicId,
      year,
      courseId: courseId || undefined,
      clinicalTopic: clinicalTopic || undefined,
      questionType: questionType || undefined,
      limit,
      examId: examId || undefined,
    });

    const db = getFirestore();
    const pendingRef = db.collection("nursingPendingSessions").doc();
    await pendingRef.set({
      userId: req.user.uid,
      topicId,
      year,
      courseId: courseId || null,
      examId: examId || null,
      type: questionType === "clinical" ? "clinical" : examId ? "exam" : "course",
      questionIds: session.questionIds,
      createdAt: new Date().toISOString(),
    });

    return res.json({ sessionToken: pendingRef.id, ...session });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** Legacy questions route */
router.get("/questions/:topicId/:year", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const topicId = String(req.params.topicId) as NursingTopicId;
    const year = Number(req.params.year);
    const session = startPracticeSession({ topicId, year });
    return res.json({ topicId, year, ...session, durationMinutes: 30 });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/nursing/check-answer */
router.post("/check-answer", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const questionId = String(req.body?.questionId || "");
    const chosen = String(req.body?.chosen || "") as NursingOptionKey;
    const result = checkAnswer(questionId, chosen);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** POST /api/student/nursing/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessionToken = String(req.body?.sessionToken || "");
    const answers = (req.body?.answers || {}) as Record<string, NursingOptionKey | null>;

    if (sessionToken) {
      const db = getFirestore();
      const pendingRef = db.collection("nursingPendingSessions").doc(sessionToken);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists || pendingSnap.data()?.userId !== req.user.uid) {
        return res.status(400).json({ error: "Session expired." });
      }
      const pending = pendingSnap.data()!;
      const result = await scoreNursingSession(req.user.uid, {
        topicId: pending.topicId as NursingTopicId,
        year: pending.year,
        courseId: pending.courseId || undefined,
        type: pending.type || "course",
        examId: pending.examId || undefined,
        answers,
        questionIds: pending.questionIds || [],
      });
      await pendingRef.delete();
      return res.json(result);
    }

    const topicId = String(req.body?.topicId || "") as NursingTopicId;
    const year = Number(req.body?.year);
    const result = await scoreNursingSession(req.user.uid, {
      topicId,
      year,
      courseId: req.body?.courseId,
      type: "course",
      answers,
      questionIds: Object.keys(answers),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/nursing/drug-calc */
router.post("/drug-calc", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const type = String(req.body?.type || "iv-rate");
    const params = req.body?.params || {};
    const result = calculateDrugDose(type, params);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
