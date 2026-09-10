import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  applyPromptToProject,
  deleteSaved,
  getNextPrompt,
  getVaultMeta,
  listRecent,
  listSaved,
  markUsed,
  savePrompt,
} from "../services/writingVault.service";

const router = express.Router();

router.get("/writing-vault/meta", (_req, res) => {
  return res.json(getVaultMeta());
});

router.post("/writing-vault/prompt", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const { category, genre, tone, preferAi, projectContext } = req.body || {};
    if (!category) return res.status(400).json({ error: "category is required." });

    const prompt = await getNextPrompt({
      userId: req.user.uid,
      category: String(category),
      genre: genre ? String(genre) : undefined,
      tone: tone ? String(tone) : undefined,
      preferAi: Boolean(preferAi),
      projectContext: projectContext || null,
    });
    return res.json({ prompt });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to get prompt." });
  }
});

router.get("/writing-vault/saved", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const items = await listSaved(req.user.uid);
    return res.json({ prompts: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load saved prompts." });
  }
});

router.post("/writing-vault/save", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await savePrompt(req.user.uid, req.body || {});
    return res.json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to save prompt." });
  }
});

router.delete(
  "/writing-vault/saved/:id",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      await deleteSaved(req.user.uid, String(req.params.id));
      return res.json({ ok: true });
    } catch (error: any) {
      const status = error?.status || 500;
      return res.status(status).json({ error: error.message || "Failed to delete saved prompt." });
    }
  }
);

router.get("/writing-vault/recent", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const items = await listRecent(req.user.uid);
    return res.json({ prompts: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load recent prompts." });
  }
});

router.post("/writing-vault/use", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await markUsed(req.user.uid, req.body || {});
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to mark prompt used." });
  }
});

router.post(
  "/writing-vault/apply-to-project",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const result = await applyPromptToProject(req.user.uid, req.body || {});
      return res.json(result);
    } catch (error: any) {
      const status = error?.status || 500;
      return res.status(status).json({ error: error.message || "Failed to apply prompt." });
    }
  }
);

export default router;
