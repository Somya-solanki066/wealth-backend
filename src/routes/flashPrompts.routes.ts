import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  deleteFlashDraft,
  FLASH_GENRES,
  GENRE_LABELS,
  getTodayPrompt,
  listFlashDrafts,
  saveFlashDraft,
  shufflePrompt,
} from "../services/flashPrompts.service";

const router = express.Router();

router.use(verifyFirebaseToken);

router.get("/genres", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      genres: FLASH_GENRES.map((id) => ({ id, label: GENRE_LABELS[id] })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed." });
  }
});

router.get("/today", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const genre = String(req.query.genre || "romance");
    const data = await getTodayPrompt(genre);
    return res.json(data);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Failed to load prompt." });
  }
});

router.post("/shuffle", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const data = await shufflePrompt({
      genre: String(req.body?.genre || "romance"),
      currentId: req.body?.currentId ? String(req.body.currentId) : undefined,
      excludeIds: Array.isArray(req.body?.excludeIds)
        ? req.body.excludeIds.map(String)
        : undefined,
    });
    return res.json(data);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Shuffle failed." });
  }
});

router.get("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const drafts = await listFlashDrafts(req.user.uid);
    return res.json({ drafts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load drafts." });
  }
});

router.post("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const draft = await saveFlashDraft({
      userId: req.user.uid,
      id: req.body?.id ? String(req.body.id) : undefined,
      title: req.body?.title,
      genre: String(req.body?.genre || "romance"),
      promptId: String(req.body?.promptId || ""),
      promptText: String(req.body?.promptText || ""),
      body: String(req.body?.body || ""),
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/drafts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteFlashDraft(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
