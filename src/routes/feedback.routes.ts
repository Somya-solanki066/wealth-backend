import { Router, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();

const VALID_TOOLS = ["chapter-analyzer", "smart-edit"] as const;
const VALID_RATINGS = ["yes", "partial", "no"] as const;

router.post("/", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tool, rating, message, context } = req.body;

    if (!tool || !VALID_TOOLS.includes(tool)) {
      return res.status(400).json({ error: "Invalid tool type." });
    }

    if (!rating || !VALID_RATINGS.includes(rating)) {
      return res.status(400).json({ error: "Please select whether the AI is working correctly." });
    }

    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (trimmedMessage.length < 10) {
      return res.status(400).json({ error: "Please share at least 10 characters of feedback." });
    }

    const db = getFirestore();
    await db.collection("ai_tool_feedback").add({
      userId: req.user.uid,
      userEmail: req.user.email || null,
      tool,
      rating,
      message: trimmedMessage.slice(0, 2000),
      context: context && typeof context === "object" ? context : {},
      createdAt: new Date(),
    });

    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error("Feedback submission error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit feedback." });
  }
});

export default router;
