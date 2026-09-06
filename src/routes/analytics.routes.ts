import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getAnalyticsOverview, logAnalyticsEvent } from "../services/analyticsEngine.service";

const router = express.Router();

/** GET /api/student/analytics/overview */
router.get("/overview", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    let userName = "Student";
    try {
      const userSnap = await getFirestore().collection("users").doc(req.user.uid).get();
      const data = userSnap.data();
      userName = String(data?.displayName || data?.name || req.user.email?.split("@")[0] || "Student");
    } catch {
      userName = req.user.email?.split("@")[0] || "Student";
    }

    const overview = await getAnalyticsOverview(req.user.uid, userName);
    return res.json(overview);
  } catch (error: any) {
    console.error("Analytics overview error:", error);
    return res.status(500).json({ error: error.message || "Failed to load analytics." });
  }
});

/** POST /api/student/analytics/events */
router.post("/events", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await logAnalyticsEvent(req.user.uid, {
      tool: String(req.body?.tool || ""),
      eventType: String(req.body?.eventType || ""),
      subject: req.body?.subject ? String(req.body.subject) : undefined,
      topic: req.body?.topic ? String(req.body.topic) : undefined,
      score: req.body?.score !== undefined ? Number(req.body.score) : undefined,
      correct: req.body?.correct !== undefined ? Number(req.body.correct) : undefined,
      total: req.body?.total !== undefined ? Number(req.body.total) : undefined,
      duration: req.body?.duration !== undefined ? Number(req.body.duration) : undefined,
      metadata: req.body?.metadata || undefined,
    });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to log event." });
  }
});

export default router;
