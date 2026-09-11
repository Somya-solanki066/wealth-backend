import express from "express";
import multer from "multer";
import path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { getUploadsDir } from "../utils/paths";
import { buildUploadUrl } from "../utils/publicUrl";
import {
  COACH_PAGE_COLLECTION,
  COACH_PAGE_DOC_ID,
  mergeCoachPage,
  type CoachPageContent,
} from "../utils/coachPageDefaults";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `coach-page-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, JPG, PNG and WEBP image files are allowed."));
    }
  },
});

function docRef() {
  return getFirestore().collection(COACH_PAGE_COLLECTION).doc(COACH_PAGE_DOC_ID);
}

router.get("/", async (_req, res) => {
  try {
    const snap = await docRef().get();
    const data = mergeCoachPage(
      snap.exists ? (snap.data() as Partial<CoachPageContent>) : undefined
    );
    res.json({ data });
  } catch (error) {
    console.error("Error fetching coach page:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/", verifyAdmin, async (req, res) => {
  try {
    const payload = req.body?.page ?? req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid coach page payload." });
    }

    const merged = mergeCoachPage(payload as Partial<CoachPageContent>);
    await docRef().set(
      {
        ...merged,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const saved = await docRef().get();
    res.json({
      message: "Coach page updated successfully.",
      data: mergeCoachPage(saved.data() as Partial<CoachPageContent>),
    });
  } catch (error) {
    console.error("Error updating coach page:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post(
  "/photo",
  verifyAdmin,
  (req, res, next) => {
    upload.single("photo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo image file uploaded." });
      }

      const fileUrl = buildUploadUrl(req, req.file.filename);
      await docRef().set(
        {
          photoUrl: fileUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      res.json({
        message: "Coach profile photo uploaded successfully.",
        photoUrl: fileUrl,
        photoURL: fileUrl,
      });
    } catch (error) {
      console.error("Error uploading coach page photo:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

export default router;
