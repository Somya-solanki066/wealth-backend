import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  MBBS_PHASES,
  getMbbsPhase,
  getMbbsSubject,
  type MbbsPhaseId,
  type MbbsSubjectId,
} from "../data/mbbsCatalog";
import {
  getMbbsScenarios,
  stripMbbsAnswer,
  type MbbsOptionKey,
} from "../data/mbbsQuestions";

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/student/mbbs/catalog */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json({
      programmeYears: 6,
      phases: MBBS_PHASES,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load MBBS catalog." });
  }
});

/** GET /api/student/mbbs/scenarios/:phaseId/:subjectId */
router.get("/scenarios/:phaseId/:subjectId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const phaseId = String(req.params.phaseId) as MbbsPhaseId;
    const subjectId = String(req.params.subjectId) as MbbsSubjectId;
    const phase = getMbbsPhase(phaseId);
    const subject = getMbbsSubject(subjectId);
    if (!phase || !subject) {
      return res.status(404).json({ error: "Phase or subject not found." });
    }
    const inPhase = phase.subjects.some((s) => s.id === subjectId);
    if (!inPhase) {
      return res.status(400).json({ error: "This subject is not available for the selected phase." });
    }

    const scenarios = getMbbsScenarios(phaseId, subjectId).map(stripMbbsAnswer);
    return res.json({
      phase: { id: phase.id, label: phase.label },
      subject,
      totalQuestions: scenarios.length,
      durationMinutes: 45,
      scenarios,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load scenarios." });
  }
});

/** POST /api/student/mbbs/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const phaseId = String(req.body?.phaseId) as MbbsPhaseId;
    const subjectId = String(req.body?.subjectId) as MbbsSubjectId;
    const answers = (req.body?.answers || {}) as Record<string, MbbsOptionKey | null>;

    const phase = getMbbsPhase(phaseId);
    const subject = getMbbsSubject(subjectId);
    if (!phase || !subject) return res.status(404).json({ error: "Phase or subject not found." });

    const bank = getMbbsScenarios(phaseId, subjectId);
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
    const ref = db.collection("mbbsPracticeSessions").doc();
    const session = {
      userId: req.user.uid,
      phaseId,
      phaseLabel: phase.label,
      subjectId,
      subjectName: subject.name,
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
