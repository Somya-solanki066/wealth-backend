import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  buildWeekStreak,
  computeStudyStreak,
  getFocusTopics,
  normalizeSession,
  type NormalizedAttempt,
} from "../data/analyticsHelpers";

const router = express.Router();

const SESSION_COLLECTIONS: { source: string; name: string }[] = [
  { source: "jamb", name: "jambPracticeSessions" },
  { source: "university", name: "universityPastSessions" },
  { source: "nursing", name: "nursingPracticeSessions" },
  { source: "mbbs", name: "mbbsPracticeSessions" },
  { source: "professional", name: "professionalPracticeSessions" },
];

async function fetchAllAttempts(userId: string): Promise<NormalizedAttempt[]> {
  const db = getFirestore();
  const batches = await Promise.all(
    SESSION_COLLECTIONS.map(async ({ source, name }) => {
      const snap = await db.collection(name).where("userId", "==", userId).get();
      return snap.docs
        .map((d) => normalizeSession(d.id, source, d.data() as Record<string, unknown>))
        .filter((a): a is NormalizedAttempt => Boolean(a));
    })
  );
  return batches
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** GET /api/student/analytics/overview */
router.get("/overview", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const attempts = await fetchAllAttempts(req.user.uid);
    const dates = attempts.map((a) => a.createdAt).filter(Boolean);

    const scoreHistory = attempts.slice(0, 6).reverse().map((a) => ({
      id: a.id,
      label: a.subjectLabel,
      source: a.source,
      percentageScore: a.percentageScore,
      createdAt: a.createdAt,
    }));

    const subjectMap = new Map<string, { total: number; count: number; incorrect: number; source: string }>();
    for (const a of attempts) {
      const cur = subjectMap.get(a.subjectLabel) || { total: 0, count: 0, incorrect: 0, source: a.source };
      cur.total += a.percentageScore;
      cur.count += 1;
      cur.incorrect += a.incorrectCount;
      subjectMap.set(a.subjectLabel, cur);
    }

    const subjectBreakdown = [...subjectMap.entries()]
      .map(([subject, stats]) => ({
        subject,
        source: stats.source,
        averageScore: Math.round(stats.total / stats.count),
        attempts: stats.count,
        totalIncorrect: stats.incorrect,
      }))
      .sort((a, b) => a.averageScore - b.averageScore);

    const weakest = subjectBreakdown[0] || null;
    const focusTopics = weakest ? getFocusTopics(weakest.subject) : [];
    const questionsQueued = weakest
      ? Math.max(10, Math.min(30, weakest.totalIncorrect || 18))
      : 0;

    const toolHintMap: Record<string, string> = {
      jamb: "jamb-practice",
      university: "university-past",
      nursing: "nursing-hub",
      mbbs: "mbbs-hub",
      professional: "professional-courses",
    };

    const studyStreak = computeStudyStreak(dates);
    const weekActivity = buildWeekStreak(dates);

    const overallAverage = attempts.length
      ? Math.round(attempts.reduce((s, a) => s + a.percentageScore, 0) / attempts.length)
      : 0;

    return res.json({
      totalAttempts: attempts.length,
      overallAverage,
      scoreHistory,
      subjectBreakdown,
      weakArea: weakest
        ? {
            subject: weakest.subject,
            averageScore: weakest.averageScore,
            focusToday: focusTopics.slice(0, 2).join(", "),
            focusTopics,
            questionsQueued,
            recommendation: `Focus today: ${focusTopics.slice(0, 2).join(", ")}.`,
          }
        : null,
      studyStreak,
      weekActivity,
      studyToday: weakest
        ? {
            headline: `Study ${weakest.subject} today`,
            detail: `You are weakest in ${weakest.subject} (${weakest.averageScore}%). ${focusTopics.slice(0, 2).join(", ")} need attention.`,
            toolHint: toolHintMap[weakest.source] || "jamb-practice",
          }
        : {
            headline: "Start your first practice session",
            detail: "Complete a JAMB or university practice exam to unlock personalised analytics.",
            toolHint: "jamb-practice",
          },
    });
  } catch (error: any) {
    console.error("Analytics overview error:", error);
    return res.status(500).json({ error: error.message || "Failed to load analytics." });
  }
});

export default router;
