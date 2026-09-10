import express from "express";
import multer from "multer";
import path from "path";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getFirestore } from "firebase-admin/firestore";
import {
  adminListFilms,
  adminListReports,
  adminModerateFilm,
  assertUploadAccess,
  ensureFilmUploadDir,
  getFilm,
  getShortFilmMeta,
  listCreatorFilms,
  listPublishedFilms,
  listSavedFilms,
  recordView,
  reportFilm,
  saveUploadedAsset,
  seedDemoFilms,
  submitFilmForReview,
  toggleLike,
  toggleSave,
  upsertFilmDraft,
} from "../services/shortFilm.service";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const filmId = String(req.params.id || "temp");
    try {
      const dir = ensureFilmUploadDir(filmId);
      cb(null, dir);
    } catch (err: any) {
      cb(err, "");
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 400 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "");
    const ok =
      mime.startsWith("video/") ||
      mime.startsWith("image/") ||
      [".mp4", ".webm", ".mov", ".m4v", ".jpg", ".jpeg", ".png", ".webp"].includes(
        path.extname(file.originalname || "").toLowerCase()
      );
    if (!ok) return cb(new Error("Only video or image files are allowed."));
    cb(null, true);
  },
});

async function creatorName(uid: string) {
  const snap = await getFirestore().collection("users").doc(uid).get();
  const d = snap.data() || {};
  return d.displayName || d.name || d.email || "Creator";
}

router.get("/meta", (_req, res) => res.json(getShortFilmMeta()));

router.get("/films", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    let films = await listPublishedFilms({
      genre: req.query.genre ? String(req.query.genre) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      sort: req.query.sort ? String(req.query.sort) : "latest",
      limit: req.query.limit ? Number(req.query.limit) : 40,
    });
    if (!films.length && !req.query.genre && !req.query.search) {
      const seeded = await seedDemoFilms();
      films = seeded.films;
    }
    return res.json({ films });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load films." });
  }
});

router.post("/seed-demo", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await seedDemoFilms();
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Seed failed." });
  }
});

router.get("/mine", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const films = await listCreatorFilms(req.user.uid, true);
    return res.json({ films });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load your films." });
  }
});

router.get("/saved", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const films = await listSavedFilms(req.user.uid);
    return res.json({ films });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load saved films." });
  }
});

router.get("/creator/:creatorId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const films = await listCreatorFilms(String(req.params.creatorId), false);
    const name = films[0]?.creatorName || "Creator";
    const totalViews = films.reduce((sum, f) => sum + f.views, 0);
    return res.json({
      profile: { id: req.params.creatorId, name, filmsCount: films.length, totalViews },
      films,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load creator." });
  }
});

router.post("/films", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const access = await assertUploadAccess(req.user.uid);
    if (!access.ok) {
      return res.status(access.status).json({
        error: access.error,
        premiumRequired: access.premiumRequired,
      });
    }
    const name = await creatorName(req.user.uid);
    const film = await upsertFilmDraft(req.user.uid, name, req.body || {});
    return res.status(201).json({ film });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to create film." });
  }
});

router.put("/films/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const film = await upsertFilmDraft(req.user.uid, "", req.body || {}, String(req.params.id));
    return res.json({ film });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to update film." });
  }
});

router.post(
  "/films/:id/upload",
  verifyFirebaseToken,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const access = await assertUploadAccess(req.user.uid);
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          premiumRequired: access.premiumRequired,
        });
      }
      const filmId = String(req.params.id);
      const snap = await getFirestore().collection("shortFilms").doc(filmId).get();
      if (!snap.exists || snap.data()?.creatorId !== req.user.uid) {
        return res.status(404).json({ error: "Film not found." });
      }
      if (!req.file) return res.status(400).json({ error: "File is required." });

      const kind = String(req.body?.kind || "").toLowerCase() === "thumbnail" ? "thumbnail" : "video";
      const mime = String(req.file.mimetype || "");
      if (kind === "thumbnail" && !mime.startsWith("image/")) {
        return res.status(400).json({ error: "Thumbnail must be an image." });
      }
      if (kind === "video" && !mime.startsWith("video/") && !mime.startsWith("image/")) {
        // allow only video for video kind
        if (!mime.startsWith("video/")) {
          return res.status(400).json({ error: "Video file required." });
        }
      }

      const url = await saveUploadedAsset(kind, filmId, req.file.filename);
      const film = await getFilm(filmId, req.user.uid);
      return res.json({ url, film });
    } catch (error: any) {
      const status = error?.status || 500;
      return res.status(status).json({ error: error.message || "Upload failed." });
    }
  }
);

router.post("/films/:id/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const film = await submitFilmForReview(req.user.uid, String(req.params.id));
    return res.json({ film, message: "Submitted for admin review." });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Submit failed." });
  }
});

router.get("/films/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const film = await getFilm(String(req.params.id), req.user.uid);
    return res.json({ film });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to load film." });
  }
});

router.post("/films/:id/view", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await recordView(req.user.uid, String(req.params.id));
    return res.json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to record view." });
  }
});

router.post("/films/:id/like", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await toggleLike(req.user.uid, String(req.params.id));
    return res.json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to like." });
  }
});

router.post("/films/:id/save", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await toggleSave(req.user.uid, String(req.params.id));
    return res.json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to save." });
  }
});

router.post("/films/:id/report", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await reportFilm(
      req.user.uid,
      String(req.params.id),
      String(req.body?.reason || "Other"),
      req.body?.details
    );
    return res.json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to report." });
  }
});

export default router;
