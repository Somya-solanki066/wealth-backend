import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import { MBBS_PHASES, CURATED_TOPIC_VIDEOS } from "../data/mbbsCatalog";
import type { MbbsPhaseId, MbbsSubjectId } from "../data/mbbsCatalog";
import type { MbbsOptionKey } from "../data/mbbsQuestions";
import { getMbbsScenarios, stripMbbsAnswer } from "../data/mbbsQuestions";
import { getMbbsPhase, getMbbsSubject } from "../data/mbbsCatalog";
import {
  calculateScoringTool,
  checkAnswer,
  getLabValues,
  getMbbsHome,
  getMbbsProfile,
  getMdcnAccess,
  getScoringTools,
  getTopicDetail,
  saveMbbsProfile,
  scoreMbbsSession,
  searchDrugReference,
  searchTopics,
  startPracticeSession,
} from "../services/mbbsPractice.service";

const router = express.Router();

async function getPremium(userId: string) {
  const snap = await getFirestore().collection("users").doc(userId).get();
  return isUserPremium(snap.data());
}

/** GET /api/student/mbbs/home */
router.get("/home", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const viewPhase = req.query.phase ? String(req.query.phase) as MbbsPhaseId : undefined;
    const home = await getMbbsHome(req.user.uid, viewPhase);
    return res.json(home);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/mbbs/profile */
router.get("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getMbbsProfile(req.user.uid);
    return res.json({ profile, setupRequired: !profile?.setupComplete });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/mbbs/profile */
router.post("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await saveMbbsProfile(req.user.uid, {
      university: String(req.body?.university || ""),
      college: String(req.body?.college || ""),
      year: Number(req.body?.year || 2),
      phase: String(req.body?.phase || "pre-clinical") as MbbsPhaseId,
      customUniversityLabel: req.body?.customUniversityLabel
        ? String(req.body.customUniversityLabel)
        : undefined,
    });
    return res.json({ success: true, profile });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** GET /api/student/mbbs/topics/search?q= */
router.get("/topics/search", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const q = String(req.query.q || "");
    return res.json({ results: searchTopics(q) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/mbbs/topics/:topicId */
router.get("/topics/:topicId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const detail = getTopicDetail(String(req.params.topicId));
    if (!detail) return res.status(404).json({ error: "Topic not found." });
    return res.json(detail);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/mbbs/topics/:topicId/videos */
router.get("/topics/:topicId/videos", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const topicId = String(req.params.topicId);
    const detail = getTopicDetail(topicId);
    if (!detail) return res.status(404).json({ error: "Topic not found." });
    const curated = CURATED_TOPIC_VIDEOS[topicId] || [];
    return res.json({
      topicId,
      topicName: detail.topic.name,
      videos: curated,
      source: curated.length ? "curated" : "search-fallback",
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(detail.topic.name + " MBBS anatomy tutorial")}`,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/mbbs/start */
router.post("/start", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const phaseId = String(req.body?.phaseId || "pre-clinical") as MbbsPhaseId;
    const subjectId = req.body?.subjectId ? String(req.body.subjectId) as MbbsSubjectId : undefined;
    const topicId = req.body?.topicId ? String(req.body.topicId) : undefined;
    const questionType = String(req.body?.questionType || "mcq");
    const clinicalTopic = String(req.body?.clinicalTopic || "");
    const limit = Number(req.body?.limit || 20);
    const mdcnExamId = String(req.body?.mdcnExamId || "");

    if (mdcnExamId) {
      const premium = await getPremium(req.user.uid);
      const access = getMdcnAccess(mdcnExamId, premium);
      if (!access) return res.status(404).json({ error: "Exam not found." });
      if (access.locked) {
        return res.status(403).json({ error: "Premium subscription required.", premiumRequired: true });
      }
    }

    const session = startPracticeSession({
      phaseId,
      subjectId,
      topicId,
      questionType,
      clinicalTopic: clinicalTopic || undefined,
      limit,
      mdcnExamId: mdcnExamId || undefined,
    });

    const db = getFirestore();
    const pendingRef = db.collection("mbbsPendingSessions").doc();
    await pendingRef.set({
      userId: req.user.uid,
      phaseId,
      subjectId: subjectId || null,
      topicId: topicId || null,
      type: questionType === "clinical" ? "clinical" : mdcnExamId ? "mdcn" : topicId ? "topic" : "subject",
      mdcnExamId: mdcnExamId || null,
      questionIds: session.questionIds,
      createdAt: new Date().toISOString(),
    });

    return res.json({ sessionToken: pendingRef.id, ...session });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/student/mbbs/check-answer */
router.post("/check-answer", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const questionId = String(req.body?.questionId || "");
    const chosen = String(req.body?.chosen || "") as MbbsOptionKey;
    const result = checkAnswer(questionId, chosen);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** POST /api/student/mbbs/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessionToken = String(req.body?.sessionToken || "");
    const answers = (req.body?.answers || {}) as Record<string, MbbsOptionKey | null>;

    if (sessionToken) {
      const db = getFirestore();
      const pendingRef = db.collection("mbbsPendingSessions").doc(sessionToken);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists || pendingSnap.data()?.userId !== req.user.uid) {
        return res.status(400).json({ error: "Session expired." });
      }
      const pending = pendingSnap.data()!;
      const result = await scoreMbbsSession(req.user.uid, {
        phaseId: pending.phaseId as MbbsPhaseId,
        subjectId: pending.subjectId || undefined,
        topicId: pending.topicId || undefined,
        type: pending.type || "topic",
        mdcnExamId: pending.mdcnExamId || undefined,
        answers,
        questionIds: pending.questionIds || [],
      });
      await pendingRef.delete();
      return res.json(result);
    }

    const phaseId = String(req.body?.phaseId) as MbbsPhaseId;
    const subjectId = String(req.body?.subjectId || "");
    const result = await scoreMbbsSession(req.user.uid, {
      phaseId,
      subjectId: subjectId || undefined,
      type: "subject",
      answers,
      questionIds: Object.keys(answers),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/** GET /api/student/mbbs/reference/lab-values */
router.get("/reference/lab-values", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  return res.json({ categories: getLabValues() });
});

/** GET /api/student/mbbs/reference/scoring-tools */
router.get("/reference/scoring-tools", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  return res.json({ tools: getScoringTools() });
});

/** POST /api/student/mbbs/reference/scoring-tools/calculate */
router.post("/reference/scoring-tools/calculate", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const toolId = String(req.body?.toolId || "");
    const params = req.body?.params || {};
    const result = calculateScoringTool(toolId, params);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/** GET /api/student/mbbs/reference/drugs?q= */
router.get("/reference/drugs", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  const q = String(req.query.q || "");
  return res.json({ drugs: searchDrugReference(q) });
});

/** Legacy catalog */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  return res.json({ programmeYears: 6, phases: MBBS_PHASES });
});

/** Legacy scenarios */
router.get("/scenarios/:phaseId/:subjectId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const phaseId = String(req.params.phaseId) as MbbsPhaseId;
    const subjectId = String(req.params.subjectId) as MbbsSubjectId;
    const phase = getMbbsPhase(phaseId);
    const subject = getMbbsSubject(subjectId);
    if (!phase || !subject) return res.status(404).json({ error: "Phase or subject not found." });
    const scenarios = getMbbsScenarios(phaseId, subjectId).map(stripMbbsAnswer);
    return res.json({
      phase: { id: phase.id, label: phase.label },
      subject,
      totalQuestions: scenarios.length,
      durationMinutes: 45,
      scenarios,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
