import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { NURSING_YEARS, getNursingTopic, getNursingYear, type NursingTopicId } from "../data/nursingCatalog";
import {
  getNursingQuestions,
  stripNursingAnswer,
  type NursingOptionKey,
} from "../data/nursingQuestions";

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/student/nursing/catalog */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json({ years: NURSING_YEARS });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load nursing catalog." });
  }
});

/** GET /api/student/nursing/questions/:topicId/:year */
router.get("/questions/:topicId/:year", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const topicId = String(req.params.topicId) as NursingTopicId;
    const year = Number(req.params.year);
    const topic = getNursingTopic(topicId);
    const yearData = getNursingYear(year);
    if (!topic || !yearData) {
      return res.status(404).json({ error: "Topic or year not found." });
    }
    const inYear = yearData.topics.some((t) => t.id === topicId);
    if (!inYear) {
      return res.status(400).json({ error: "This topic is not available for the selected year." });
    }

    const questions = getNursingQuestions(topicId, year).map(stripNursingAnswer);
    return res.json({
      topic,
      year,
      totalQuestions: questions.length,
      durationMinutes: 30,
      questions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load questions." });
  }
});

/** POST /api/student/nursing/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const topicId = String(req.body?.topicId) as NursingTopicId;
    const year = Number(req.body?.year);
    const answers = (req.body?.answers || {}) as Record<string, NursingOptionKey | null>;

    const topic = getNursingTopic(topicId);
    if (!topic) return res.status(404).json({ error: "Topic not found." });

    const bank = getNursingQuestions(topicId, year);
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
          rationale: qn.rationale,
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
        rationale: qn.rationale,
      };
    });

    const totalQuestions = bank.length;
    const percentageScore = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const db = getFirestore();
    const ref = db.collection("nursingPracticeSessions").doc();
    const session = {
      userId: req.user.uid,
      topicId,
      topicName: topic.name,
      year,
      totalQuestions,
      correctCount,
      incorrectCount,
      skippedCount,
      percentageScore,
      status: "completed",
      createdAt: nowIso(),
    };
    await ref.set(session);

    return res.json({ sessionId: ref.id, ...session, breakdown });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to submit." });
  }
});

export default router;
