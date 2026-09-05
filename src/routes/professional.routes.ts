import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  PROFESSIONAL_COURSES,
  getProfessionalCourse,
  getProfessionalModule,
  getModulesForCourseLevel,
  type ProfessionalCourseId,
} from "../data/professionalCatalog";
import {
  getProfessionalQuestions,
  stripProfessionalAnswer,
  type ProfessionalOptionKey,
} from "../data/professionalQuestions";

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/student/professional/catalog */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json({ courses: PROFESSIONAL_COURSES });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load catalog." });
  }
});

/** GET /api/student/professional/modules/:courseId/:level */
router.get("/modules/:courseId/:level", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const courseId = String(req.params.courseId) as ProfessionalCourseId;
    const level = Number(req.params.level);
    const course = getProfessionalCourse(courseId);
    if (!course) return res.status(404).json({ error: "Course not found." });
    if (!course.levels.includes(level)) {
      return res.status(400).json({ error: "Level not available for this course." });
    }
    const modules = getModulesForCourseLevel(courseId, level);
    return res.json({ course: { id: course.id, name: course.name }, level, modules });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load modules." });
  }
});

/** GET /api/student/professional/questions/:moduleId */
router.get("/questions/:moduleId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const moduleId = String(req.params.moduleId);
    const data = getProfessionalModule(moduleId);
    if (!data) return res.status(404).json({ error: "Module not found." });

    const questions = getProfessionalQuestions(
      data.module.id,
      data.course.id,
      data.module.name
    ).map(stripProfessionalAnswer);

    return res.json({
      course: { id: data.course.id, name: data.course.name },
      module: data.module,
      totalQuestions: questions.length,
      durationMinutes: 30,
      questions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load questions." });
  }
});

/** POST /api/student/professional/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const moduleId = String(req.body?.moduleId);
    const answers = (req.body?.answers || {}) as Record<string, ProfessionalOptionKey | null>;

    const data = getProfessionalModule(moduleId);
    if (!data) return res.status(404).json({ error: "Module not found." });

    const bank = getProfessionalQuestions(data.module.id, data.course.id, data.module.name);
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
    const ref = db.collection("professionalPracticeSessions").doc();
    const session = {
      userId: req.user.uid,
      courseId: data.course.id,
      courseName: data.course.name,
      moduleId: data.module.id,
      moduleName: data.module.name,
      level: data.module.level,
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
