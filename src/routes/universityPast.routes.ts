import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  AVAILABLE_YEARS,
  FREE_YEARS,
  UNIVERSITY_CATALOG,
  findCourse,
  isYearFree,
} from "../data/universityCatalog";
import {
  getUniversityPastQuestions,
  stripPastAnswer,
  type PastOptionKey,
} from "../data/universityQuestions";

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

/** GET /api/student/university-past/catalog */
router.get("/catalog", verifyFirebaseToken, async (_req: AuthenticatedRequest, res) => {
  try {
    return res.json({
      universities: UNIVERSITY_CATALOG,
      availableYears: AVAILABLE_YEARS,
      freeYears: FREE_YEARS,
      totalUniversities: UNIVERSITY_CATALOG.length,
    });
  } catch (error: any) {
    console.error("University catalog error:", error);
    return res.status(500).json({ error: error.message || "Failed to load catalog." });
  }
});

/** GET /api/student/university-past/years/:courseId */
router.get("/years/:courseId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const courseId = String(req.params.courseId);
    const match = findCourse(courseId);
    if (!match) return res.status(404).json({ error: "Course not found." });

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(req.user.uid).get();
    const premium = isUserPremium(userSnap.data());

    const years = AVAILABLE_YEARS.map((year) => ({
      year,
      locked: !isYearFree(year, premium),
      free: FREE_YEARS.includes(year),
    }));

    return res.json({
      course: match.course,
      university: { id: match.university.id, name: match.university.name },
      faculty: { id: match.faculty.id, name: match.faculty.name },
      department: { id: match.department.id, name: match.department.name },
      years,
    });
  } catch (error: any) {
    console.error("University years error:", error);
    return res.status(500).json({ error: error.message || "Failed to load years." });
  }
});

/** GET /api/student/university-past/questions/:courseId/:year */
router.get("/questions/:courseId/:year", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const courseId = String(req.params.courseId);
    const year = Number(req.params.year);
    if (!AVAILABLE_YEARS.includes(year)) {
      return res.status(400).json({ error: "Invalid year." });
    }

    const match = findCourse(courseId);
    if (!match) return res.status(404).json({ error: "Course not found." });

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(req.user.uid).get();
    const premium = isUserPremium(userSnap.data());
    if (!isYearFree(year, premium)) {
      return res.status(403).json({
        error: "Upgrade to access older past questions. 3 most recent years are free.",
        premiumRequired: true,
        freeYears: FREE_YEARS,
      });
    }

    const questions = getUniversityPastQuestions(courseId, year).map(stripPastAnswer);
    return res.json({
      course: match.course,
      university: match.university.name,
      faculty: match.faculty.name,
      department: match.department.name,
      year,
      totalQuestions: questions.length,
      durationMinutes: 45,
      questions,
    });
  } catch (error: any) {
    console.error("University questions error:", error);
    return res.status(500).json({ error: error.message || "Failed to load questions." });
  }
});

/** POST /api/student/university-past/submit */
router.post("/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const courseId = String(req.body?.courseId || "");
    const year = Number(req.body?.year);
    const answers = (req.body?.answers || {}) as Record<string, PastOptionKey | null>;

    const match = findCourse(courseId);
    if (!match) return res.status(404).json({ error: "Course not found." });
    if (!AVAILABLE_YEARS.includes(year)) {
      return res.status(400).json({ error: "Invalid year." });
    }

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(req.user.uid).get();
    const premium = isUserPremium(userSnap.data());
    if (!isYearFree(year, premium)) {
      return res.status(403).json({ error: "Year locked.", premiumRequired: true });
    }

    const bank = getUniversityPastQuestions(courseId, year);
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
      };
    });

    const totalQuestions = bank.length;
    const percentageScore = totalQuestions
      ? Math.round((correctCount / totalQuestions) * 100)
      : 0;

    const sessionRef = db.collection("universityPastSessions").doc();
    const session = {
      userId: req.user.uid,
      courseId,
      courseCode: match.course.code,
      courseTitle: match.course.title,
      universityId: match.university.id,
      universityName: match.university.name,
      facultyName: match.faculty.name,
      departmentName: match.department.name,
      year,
      totalQuestions,
      correctCount,
      incorrectCount,
      skippedCount,
      percentageScore,
      status: "completed",
      createdAt: nowIso(),
    };
    await sessionRef.set(session);

    return res.json({ sessionId: sessionRef.id, ...session, breakdown });
  } catch (error: any) {
    console.error("University submit error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit." });
  }
});

export default router;
