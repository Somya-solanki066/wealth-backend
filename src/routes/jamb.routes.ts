import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  JAMB_SUBJECTS,
  getJambQuestions,
  getJambSubjectMeta,
  stripAnswer,
  type JambOptionKey,
  type JambSubjectId,
} from "../data/jambQuestions";

const router = express.Router();

function isSubject(value: string): value is JambSubjectId {
  return JAMB_SUBJECTS.some((s) => s.id === value);
}

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/student/jamb/subjects */
router.get("/subjects", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    const subjects = JAMB_SUBJECTS.map((s) => {
      const count = getJambQuestions(s.id).length;
      return { ...s, questionCount: count };
    });
    return res.json({ subjects });
  } catch (error: any) {
    console.error("JAMB subjects error:", error);
    return res.status(500).json({ error: error.message || "Failed to load subjects." });
  }
});

/** GET /api/student/jamb/questions/:subject */
router.get("/questions/:subject", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const subject = String(req.params.subject || "").trim();
    if (!isSubject(subject)) {
      return res.status(400).json({ error: "Invalid subject." });
    }
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
    console.error("JAMB questions error:", error);
    return res.status(500).json({ error: error.message || "Failed to load questions." });
  }
});

/** POST /api/student/jamb/submit — score answers */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const subject = String(req.body?.subject || "").trim();
    if (!isSubject(subject)) {
      return res.status(400).json({ error: "Invalid subject." });
    }

    const answers = (req.body?.answers || {}) as Record<string, JambOptionKey | null>;
    const markedForReview = Array.isArray(req.body?.markedForReview)
      ? (req.body.markedForReview as string[])
      : [];
    const timeUsedSeconds = Number(req.body?.timeUsedSeconds || 0);

    const bank = getJambQuestions(subject);
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const breakdown = bank.map((qn) => {
      const chosen = answers[qn.id] ?? null;
      if (!chosen) {
        skippedCount += 1;
        return {
          questionId: qn.id,
          questionNumber: qn.questionNumber,
          chosen: null,
          correctAnswer: qn.correctAnswer,
          isCorrect: false,
          topic: qn.topic,
        };
      }
      const isCorrect = chosen === qn.correctAnswer;
      if (isCorrect) correctCount += 1;
      else incorrectCount += 1;
      return {
        questionId: qn.id,
        questionNumber: qn.questionNumber,
        chosen,
        correctAnswer: qn.correctAnswer,
        isCorrect,
        topic: qn.topic,
      };
    });

    const totalQuestions = bank.length;
    const percentageScore = totalQuestions
      ? Math.round((correctCount / totalQuestions) * 100)
      : 0;

    const db = getFirestore();
    const sessionRef = db.collection("jambPracticeSessions").doc();
    const session = {
      userId: req.user.uid,
      subject,
      subjectLabel: getJambSubjectMeta(subject)?.label || subject,
      totalQuestions,
      correctCount,
      incorrectCount,
      skippedCount,
      percentageScore,
      timeUsedSeconds,
      markedForReview,
      status: "completed",
      createdAt: nowIso(),
    };
    await sessionRef.set(session);

    return res.json({
      sessionId: sessionRef.id,
      ...session,
      breakdown,
    });
  } catch (error: any) {
    console.error("JAMB submit error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit practice." });
  }
});

/** GET /api/student/jamb/sessions — recent attempts */
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
    console.error("JAMB sessions error:", error);
    return res.status(500).json({ error: error.message || "Failed to load sessions." });
  }
});

export default router;
