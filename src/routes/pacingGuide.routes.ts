import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  calculatePacingMeta,
  deletePacingPlan,
  generatePacingPlan,
  listPacingPlans,
  PACING_BOOK_TYPES,
  PACING_STYLES,
  savePacingPlan,
} from "../services/pacingGuide.service";

const router = express.Router();

router.use(verifyFirebaseToken);

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      minWords: 20000,
      maxWords: 100000,
      defaultWords: 45000,
      bookTypes: PACING_BOOK_TYPES.map((id) => ({
        id,
        label:
          id === "self-help"
            ? "Self-help"
            : id === "memoir"
              ? "Memoir"
              : id === "business"
                ? "Business"
                : "Other Nonfiction",
      })),
      pacingStyles: PACING_STYLES.map((id) => ({
        id,
        label:
          id === "even" ? "Even" : id === "narrative" ? "Narrative arc" : "Instructional",
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/calculate", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const meta = calculatePacingMeta({
      totalWords: Number(req.body?.totalWords),
      bookType: req.body?.bookType,
      chapterCount: req.body?.chapterCount != null ? Number(req.body.chapterCount) : undefined,
    });
    return res.json({ meta });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Calculate failed." });
  }
});

router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const plan = generatePacingPlan({
      totalWords: Number(req.body?.totalWords),
      bookType: req.body?.bookType,
      chapterCount: req.body?.chapterCount != null ? Number(req.body.chapterCount) : undefined,
      pacingStyle: req.body?.pacingStyle,
      chapterTitles: Array.isArray(req.body?.chapterTitles) ? req.body.chapterTitles : undefined,
      chapterPurposes: Array.isArray(req.body?.chapterPurposes)
        ? req.body.chapterPurposes
        : undefined,
    });
    if (req.body?.bookId) plan.bookId = String(req.body.bookId);
    if (req.body?.bookTitle) plan.bookTitle = String(req.body.bookTitle);
    return res.json({ plan });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Generate failed." });
  }
});

router.get("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const plans = await listPacingPlans(req.user.uid);
    return res.json({ plans });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load plans." });
  }
});

router.post("/plans", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const incoming = req.body?.plan || req.body || {};
    const plan = generatePacingPlan({
      totalWords: Number(incoming.goalWords ?? incoming.totalWords),
      bookType: incoming.bookType,
      chapterCount: Number(incoming.chapterCount),
      pacingStyle: incoming.pacingStyle,
    });
    // Prefer client-edited chapter list if provided
    if (Array.isArray(incoming.chapters) && incoming.chapters.length) {
      plan.chapters = incoming.chapters;
      plan.chapterCount = plan.chapters.length;
      plan.totalWords = plan.chapters.reduce(
        (s: number, c: any) => s + Number(c.targetWords || 0),
        0
      );
      plan.averageWords = Math.round(plan.totalWords / Math.max(plan.chapterCount, 1));
    }
    plan.goalWords = Number(incoming.goalWords ?? incoming.totalWords ?? plan.totalWords);
    plan.bookId = incoming.bookId || null;
    plan.bookTitle = incoming.bookTitle || "";
    plan.id = incoming.id || undefined;
    const saved = await savePacingPlan(req.user.uid, plan);
    return res.json({ plan: saved });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/plans/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deletePacingPlan(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
