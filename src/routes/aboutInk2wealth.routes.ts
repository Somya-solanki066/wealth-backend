import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";
import {
  ABOUT_COLLECTION,
  ABOUT_DOC_ID,
  DEFAULT_ABOUT_CONTENT,
  mergeAboutContent,
  type AboutInk2WealthContent,
} from "../utils/aboutDefaults";

const router = express.Router();
const upload = memoryImageUpload;

function docRef() {
  return getFirestore().collection(ABOUT_COLLECTION).doc(ABOUT_DOC_ID);
}

// GET /api/about-ink2wealth (Public)
router.get("/", async (_req, res) => {
  try {
    const snap = await docRef().get();
    const data = mergeAboutContent(
      snap.exists ? (snap.data() as Partial<AboutInk2WealthContent>) : undefined
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching About Ink2Wealth:", error);
    res.json({ success: true, data: DEFAULT_ABOUT_CONTENT });
  }
});

// PUT /api/about-ink2wealth (Admin only)
router.put("/", verifyAdmin, async (req, res) => {
  try {
    const payload = req.body?.data ?? req.body?.content ?? req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid About Ink2Wealth payload." });
    }

    const merged = mergeAboutContent(payload as Partial<AboutInk2WealthContent>);
    const toSave = {
      ...merged,
      updatedAt: new Date().toISOString(),
    };

    await docRef().set(toSave, { merge: true });

    res.json({
      success: true,
      message: "About Ink2Wealth updated successfully.",
      data: toSave,
    });
  } catch (error) {
    console.error("Error updating About Ink2Wealth:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/about-ink2wealth/upload (Admin only)
router.post(
  "/upload",
  verifyAdmin,
  (req, res, next) => {
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "file", maxCount: 1 },
      { name: "photo", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file =
        files?.image?.[0] || files?.file?.[0] || files?.photo?.[0] || (req.file as Express.Multer.File | undefined);

      if (!file) {
        return res.status(400).json({ error: "No image file uploaded." });
      }

      const filename = makeUploadFilename("about-ink2wealth", file.originalname);
      const fileUrl = await persistPublicUpload(req, file, filename);

      res.json({
        success: true,
        message: "Image uploaded successfully.",
        url: fileUrl,
        fileUrl,
      });
    } catch (error: any) {
      console.error("Error uploading about image:", error);
      res.status(500).json({ error: error?.message || "Internal server error." });
    }
  }
);

export default router;
