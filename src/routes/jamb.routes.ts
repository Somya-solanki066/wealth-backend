import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  JAMB_SUBJECTS,
  getJambQuestions,
  getJambSubjectMeta,
  getTopicsForSubject,
  stripAnswer,
  type JambOptionKey,
  type JambSubjectId,
} from "../data/jambQuestions";
import { getPostUtmeYears, POST_UTME_UNIVERSITIES } from "../data/jambCatalog";
import {
  buildSessionConfig,
  getCatalogData,
  getJambHome,
  getJambProfile,
  questionsForClient,
  saveJambProfile,
  scoreJambSession,
  type StartSessionInput,
} from "../services/jambPractice.service";

const router = express.Router();

function isSubject(value: string): value is JambSubjectId {
  return JAMB_SUBJECTS.some((s) => s.id === value);
}

/** GET /api/student/jamb/catalog — courses, institutions, topics, years */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json(getCatalogData());
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load catalog." });
  }
});

/** GET /api/student/jamb/profile */
router.get("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getJambProfile(req.user.uid);
    return res.json({ profile, setupRequired: !profile?.setupComplete });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load profile." });
  }
});

/** POST /api/student/jamb/profile — first-time setup */
router.post("/profile", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await saveJambProfile(req.user.uid, {
      targetCourse: String(req.body?.targetCourse || ""),
      targetInstitution: String(req.body?.targetInstitution || ""),
      examDate: String(req.body?.examDate || ""),
      subjects: Array.isArray(req.body?.subjects) ? req.body.subjects : undefined,
    });
    return res.json({ success: true, profile });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "Failed to save profile." });
  }
});

/** GET /api/student/jamb/home — dashboard data */
router.get("/home", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const home = await getJambHome(req.user.uid);
    return res.json(home);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load home." });
  }
});

/** GET /api/student/jamb/subjects */
router.get("/subjects", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    const subjects = JAMB_SUBJECTS.map((s) => {
      const count = getJambQuestions(s.id).length;
      return { ...s, questionCount: count };
    });
    return res.json({ subjects });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load subjects." });
  }
});

/** GET /api/student/jamb/topics/:subject */
router.get("/topics/:subject", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subject = String(req.params.subject || "").trim();
    if (!isSubject(subject)) return res.status(400).json({ error: "Invalid subject." });
    const fromBank = getTopicsForSubject(subject);
    const fromCatalog = (await import("../data/jambCatalog")).JAMB_TOPICS[subject] || [];
    const topics = [...new Set([...fromCatalog, ...fromBank])].sort();
    return res.json({ subject, topics });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load topics." });
  }
});

/** GET /api/student/jamb/post-utme/universities */
router.get("/post-utme/universities", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getJambProfile(req.user.uid);
    const targetId = profile?.targetInstitution || "";
    const universities = POST_UTME_UNIVERSITIES.map((u) => ({
      ...u,
      years: getPostUtmeYears(u.id),
      isTarget: u.id === targetId,
    }));
    return res.json({ universities, targetInstitutionId: targetId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load universities." });
  }
});

/** POST /api/student/jamb/start — build practice session */
router.post("/start", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getJambProfile(req.user.uid);
    if (!profile?.setupComplete) {
      return res.status(400).json({ error: "Complete JAMB setup first.", setupRequired: true });
    }

    const mode = String(req.body?.mode || "subject") as StartSessionInput["mode"];
    const input: StartSessionInput = {
      mode,
      subjects: profile.subjects,
      subject: req.body?.subject ? String(req.body.subject) as JambSubjectId : undefined,
      topic: req.body?.topic ? String(req.body.topic) : undefined,
      year: req.body?.year ? Number(req.body.year) : undefined,
      questionCount: req.body?.questionCount ? Number(req.body.questionCount) : undefined,
      universityId: req.body?.universityId ? String(req.body.universityId) : undefined,
    };

    const config = buildSessionConfig(input);
    if (!config.questionIds.length) {
      return res.status(400).json({ error: "No questions available for this selection." });
    }

    const db = getFirestore();
    const pendingRef = db.collection("jambPendingSessions").doc();
    await pendingRef.set({
      userId: req.user.uid,
      config,
      createdAt: new Date().toISOString(),
    });

    const questions = questionsForClient(config.questionIds);
    return res.json({
      sessionToken: pendingRef.id,
      ...config,
      questions,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "Failed to start session." });
  }
});

/** GET /api/student/jamb/questions/:subject — legacy single-subject load */
router.get("/questions/:subject", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subject = String(req.params.subject || "").trim();
    if (!isSubject(subject)) return res.status(400).json({ error: "Invalid subject." });
    const meta = getJambSubjectMeta(subject);
    const questions = getJambQuestions(subject).map(stripAnswer);
    return res.json({
      subject,
      label: meta?.label || subject,
      durationMinutes: meta?.durationMinutes || 60,
      totalQuestions: questions.length,
      questions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load questions." });
  }
});

/** POST /api/student/jamb/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const sessionToken = String(req.body?.sessionToken || "").trim();
    const answers = (req.body?.answers || {}) as Record<string, JambOptionKey | null>;
    const markedForReview = Array.isArray(req.body?.markedForReview)
      ? (req.body.markedForReview as string[])
      : [];
    const timeUsedSeconds = Number(req.body?.timeUsedSeconds || 0);

    // New flow with session token
    if (sessionToken) {
      const db = getFirestore();
      const pendingRef = db.collection("jambPendingSessions").doc(sessionToken);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists) {
        return res.status(400).json({ error: "Session expired or invalid. Please start again." });
      }
      const pending = pendingSnap.data();
      if (pending?.userId !== req.user.uid) {
        return res.status(403).json({ error: "Unauthorized session." });
      }
      const config = pending.config;
      const result = await scoreJambSession(
        req.user.uid,
        config,
        answers,
        markedForReview,
        timeUsedSeconds
      );
      await pendingRef.delete();
      return res.json(result);
    }

    // Legacy single-subject submit
    const subject = String(req.body?.subject || "").trim();
    if (!isSubject(subject)) return res.status(400).json({ error: "Invalid subject." });

    const config = buildSessionConfig({
      mode: "subject",
      subjects: [subject],
      subject,
      questionCount: getJambQuestions(subject).length,
    });
    const result = await scoreJambSession(
      req.user.uid,
      config,
      answers,
      markedForReview,
      timeUsedSeconds
    );
    return res.json(result);
  } catch (error: any) {
    console.error("JAMB submit error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit practice." });
  }
});

/** GET /api/student/jamb/sessions */
router.get("/sessions", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db
      .collection("jambPracticeSessions")
      .where("userId", "==", req.user.uid)
      .get();
    const sessions = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 20);
    return res.json({ sessions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load sessions." });
  }
});

export default router;
