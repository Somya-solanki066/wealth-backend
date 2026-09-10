import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  deleteExplainerDraft,
  EXPLAINER_AUDIENCES,
  EXPLAINER_GOALS,
  EXPLAINER_LENGTHS,
  EXPLAINER_TONES,
  generateExplainerArticle,
  generateExplainerOutline,
  listExplainerDrafts,
  saveExplainerDraft,
} from "../services/web3Explainer.service";

const router = express.Router();
router.use(verifyFirebaseToken);

async function requirePremium(req: AuthenticatedRequest, res: express.Response) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  const snap = await getFirestore().collection("users").doc(req.user.uid).get();
  if (!isUserPremium(snap.data())) {
    res.status(403).json({
      error: "Premium required for Explainer Article Builder AI.",
      premiumRequired: true,
    });
    return null;
  }
  return snap.data() || {};
}

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      audiences: EXPLAINER_AUDIENCES.map((id) => ({
        id,
        label:
          id === "beginners"
            ? "Total Beginners"
            : id === "web3-beginners"
              ? "Web3 Beginners"
              : id === "intermediate"
                ? "Intermediate"
                : id === "developers"
                  ? "Developers"
                  : id === "investors"
                    ? "Investors / Founders"
                    : "General Tech Audience",
      })),
      goals: EXPLAINER_GOALS.map((id) => ({
        id,
        label:
          id === "educational"
            ? "Educational Explainer"
            : id === "project-overview"
              ? "Project Overview"
              : id === "docs"
                ? "Product Documentation"
                : id === "blog"
                  ? "Blog Article"
                  : "Marketing / Landing Page",
      })),
      tones: EXPLAINER_TONES.map((id) => ({
        id,
        label:
          id === "simple"
            ? "Simple & Educational"
            : id === "professional"
              ? "Professional"
              : id === "conversational"
                ? "Conversational"
                : id === "technical"
                  ? "Technical"
                  : "Persuasive",
      })),
      lengths: EXPLAINER_LENGTHS.map((id) => ({
        id,
        label:
          id === "short"
            ? "Short — 500–800 words"
            : id === "long"
              ? "Long — 2,000–3,000 words"
              : "Standard — 1,000–1,500 words",
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/outline", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const outline = await generateExplainerOutline({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      topic: String(req.body?.topic || ""),
      audience: req.body?.audience,
      goal: req.body?.goal,
      tone: req.body?.tone,
      length: req.body?.length,
      references: req.body?.references,
    });
    return res.json({ outline });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Outline failed." });
  }
});

router.post("/article", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const article = await generateExplainerArticle({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      topic: String(req.body?.topic || ""),
      audience: req.body?.audience,
      goal: req.body?.goal,
      tone: req.body?.tone,
      length: req.body?.length,
      references: req.body?.references,
      outline: Array.isArray(req.body?.outline) ? req.body.outline : [],
      title: req.body?.title,
    });
    return res.json({ article });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Article failed." });
  }
});

router.get("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const drafts = await listExplainerDrafts(req.user.uid);
    return res.json({ drafts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load drafts." });
  }
});

router.post("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const draft = await saveExplainerDraft(req.user.uid, {
      id: req.body?.id,
      topic: String(req.body?.topic || ""),
      audience: req.body?.audience || "beginners",
      goal: req.body?.goal || "educational",
      tone: req.body?.tone || "simple",
      length: req.body?.length || "standard",
      references: req.body?.references,
      outline: Array.isArray(req.body?.outline) ? req.body.outline : [],
      title: String(req.body?.title || "Untitled explainer"),
      body: String(req.body?.body || ""),
      wordCount: Number(req.body?.wordCount || 0),
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/drafts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteExplainerDraft(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
