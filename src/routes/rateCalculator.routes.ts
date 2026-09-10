import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  calculateRateEstimate,
  getPublicRateMeta,
} from "../services/rateCalculator.service";

const router = express.Router();

router.use(verifyFirebaseToken);

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const meta = await getPublicRateMeta();
    return res.json({ meta });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load pricing." });
  }
});

router.post("/calculate", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const model = String(req.body?.model || "");
    if (!["perWord", "perProject", "retainer"].includes(model)) {
      return res.status(400).json({ error: "model must be perWord, perProject, or retainer." });
    }
    const estimate = await calculateRateEstimate({
      model: model as "perWord" | "perProject" | "retainer",
      wordCount: req.body?.wordCount != null ? Number(req.body.wordCount) : undefined,
      projectTypeId: req.body?.projectTypeId ? String(req.body.projectTypeId) : undefined,
      retainerId: req.body?.retainerId ? String(req.body.retainerId) : undefined,
    });
    return res.json({ estimate });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Calculation failed." });
  }
});

export default router;
