import express from "express";
import multer from "multer";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  applyCoverToProject,
  assertBookCoverAccess,
  deleteBookCover,
  generateBookCover,
  getBookCover,
  getBookCoverMeta,
  listBookCovers,
  saveFinalCoverImage,
} from "../services/bookCover.service";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.get("/book-cover/meta", (_req, res) => {
  return res.json(getBookCoverMeta());
});

router.get("/book-cover/library", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const covers = await listBookCovers(req.user.uid);
    return res.json({ covers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load covers." });
  }
});

router.post("/book-cover/generate", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const access = await assertBookCoverAccess(req.user.uid);
    if (!access.ok) {
      return res.status(access.status).json({
        error: access.error,
        premiumRequired: access.premiumRequired,
      });
    }

      const cover = await generateBookCover({
      userId: req.user.uid,
      title: req.body?.title,
      authorName: req.body?.authorName,
      showAuthor: req.body?.showAuthor !== false,
      platform: String(req.body?.platform || ""),
      genre: String(req.body?.genre || ""),
      mood: String(req.body?.mood || ""),
      visualStyle: String(req.body?.visualStyle || ""),
      sceneDescription: req.body?.sceneDescription,
      coverFormat: req.body?.coverFormat,
      projectId: req.body?.projectId || null,
      parentCoverId: req.body?.parentCoverId || null,
    });

    return res.json({ cover });
  } catch (error: any) {
    const status = error?.status || 500;
    console.error("Book cover generate error:", error);
    return res.status(status).json({ error: error.message || "Failed to generate cover." });
  }
});

router.get("/book-cover/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const cover = await getBookCover(req.user.uid, String(req.params.id));
    return res.json({ cover });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to load cover." });
  }
});

router.post(
  "/book-cover/:id/final",
  verifyFirebaseToken,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "PNG file is required." });
      }
      const result = await saveFinalCoverImage({
        userId: req.user.uid,
        coverId: String(req.params.id),
        buffer: req.file.buffer,
      });
      return res.json(result);
    } catch (error: any) {
      const status = error?.status || 500;
      return res.status(status).json({ error: error.message || "Failed to save final cover." });
    }
  }
);

router.post(
  "/book-cover/:id/apply-to-project",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const projectId = String(req.body?.projectId || "").trim();
      if (!projectId) return res.status(400).json({ error: "projectId is required." });
      const result = await applyCoverToProject({
        userId: req.user.uid,
        coverId: String(req.params.id),
        projectId,
      });
      return res.json(result);
    } catch (error: any) {
      const status = error?.status || 500;
      return res.status(status).json({ error: error.message || "Failed to apply cover." });
    }
  }
);

router.delete("/book-cover/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteBookCover(req.user.uid, String(req.params.id));
    return res.json({ ok: true });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to delete cover." });
  }
});

export default router;
