import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  deleteSprintSession,
  getSprintAnalytics,
  listSprintSessions,
  saveSprintSession,
} from "../services/sprintTimer.service";

const router = express.Router();

router.use(verifyFirebaseToken);

router.get("/history", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessions = await listSprintSessions(req.user.uid);
    return res.json({ sessions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load history." });
  }
});

router.get("/analytics", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const analytics = await getSprintAnalytics(req.user.uid);
    return res.json({ analytics });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load analytics." });
  }
});

router.post("/complete", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const session = await saveSprintSession({
      userId: req.user.uid,
      wordGoal: Number(req.body?.wordGoal),
      timeGoalSeconds: Number(req.body?.timeGoalSeconds),
      wordsWritten: Number(req.body?.wordsWritten),
      durationSeconds: Number(req.body?.durationSeconds),
      body: req.body?.body,
      startedAt: String(req.body?.startedAt || new Date().toISOString()),
      completedAt: String(req.body?.completedAt || new Date().toISOString()),
    });
    return res.json({ session });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/history/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteSprintSession(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
