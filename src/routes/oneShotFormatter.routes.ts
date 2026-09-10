import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  deleteOneShot,
  formatOneShotWithAi,
  getOneShot,
  incrementOneShotViews,
  listMyOneShots,
  listPublicOneShots,
  localFormatOneShot,
  ONE_SHOT_GENRE_LABELS,
  ONE_SHOT_GENRES,
  publishOneShot,
  saveOneShot,
} from "../services/oneShotFormatter.service";

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
      error: "Premium required for One-Shot Formatter AI.",
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
      genres: ONE_SHOT_GENRES.map((id) => ({ id, label: ONE_SHOT_GENRE_LABELS[id] })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/format", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const title = String(req.body?.title || "").trim();
    const story = String(req.body?.story || "").trim();
    try {
      const result = await formatOneShotWithAi({
        userId: req.user!.uid,
        userEmail: profile.email || req.user!.email,
        title,
        story,
      });
      return res.json({ ...result, engine: "ai" });
    } catch (aiErr: any) {
      // Fallback to local formatting if AI fails (still useful)
      console.error("One-shot AI format failed, using local:", aiErr?.message);
      const local = localFormatOneShot(title, story);
      if (local.formattedText.length < 20) throw aiErr;
      return res.json({
        title: local.title,
        originalText: story,
        formattedText: local.formattedText,
        wordCount: local.wordCount,
        readingMinutes: local.readingMinutes,
        engine: "local",
        warning: "AI unavailable — applied local readability formatting.",
      });
    }
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Format failed." });
  }
});

router.get("/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const stories = await listMyOneShots(req.user.uid);
    return res.json({ stories });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load stories." });
  }
});

router.get("/public", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const stories = await listPublicOneShots(40);
    return res.json({ stories });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load feed." });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const story = await getOneShot(String(req.params.id), req.user.uid);
    if (story.userId !== req.user.uid && story.status === "published" && story.visibility === "public") {
      void incrementOneShotViews(story.id).catch(() => undefined);
    }
    return res.json({ story });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.post("/save", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profileSnap = await getFirestore().collection("users").doc(req.user.uid).get();
    const profile = profileSnap.data() || {};
    const story = await saveOneShot({
      userId: req.user.uid,
      authorName: profile.displayName || profile.name || req.user.email || "Writer",
      authorEmail: profile.email || req.user.email,
      id: req.body?.id ? String(req.body.id) : undefined,
      title: String(req.body?.title || ""),
      originalText: String(req.body?.originalText || ""),
      formattedText: String(req.body?.formattedText || req.body?.story || ""),
      genre: req.body?.genre,
      description: req.body?.description,
      visibility: req.body?.visibility === "private" ? "private" : "public",
      status: "draft",
    });
    return res.json({ story });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.post("/publish", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profileSnap = await getFirestore().collection("users").doc(req.user.uid).get();
    const profile = profileSnap.data() || {};
    const genre = String(req.body?.genre || "").trim();
    const description = String(req.body?.description || "").trim();
    if (!genre) return res.status(400).json({ error: "Choose a genre." });
    if (description.length < 10) {
      return res.status(400).json({ error: "Add a short description (at least 10 characters)." });
    }
    const story = await publishOneShot({
      userId: req.user.uid,
      authorName: profile.displayName || profile.name || req.user.email || "Writer",
      authorEmail: profile.email || req.user.email,
      id: req.body?.id ? String(req.body.id) : undefined,
      title: String(req.body?.title || ""),
      originalText: String(req.body?.originalText || ""),
      formattedText: String(req.body?.formattedText || ""),
      genre,
      description,
      visibility: req.body?.visibility === "private" ? "private" : "public",
    });
    return res.json({ story });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Publish failed." });
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteOneShot(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
