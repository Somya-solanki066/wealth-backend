import express from "express";
import multer from "multer";
import path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { getUploadsDir } from "../utils/paths";
import {
  WORLD_COURSE_IDS,
  createEmptyWorldCourse,
  getDefaultWorldCourses,
  isValidWorldCourseId,
  mergeWorldCoursesPage,
  type WorldCourseId,
  type WorldFlagshipCourse,
} from "../utils/worldCoursesDefaults";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `world-coach-${uniqueSuffix}${path.extname(file.originalname)}`);
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

router.get("/", async (_req, res) => {
  try {
    const db = getFirestore();
    const result: Record<string, unknown> = {};

    await Promise.all(
      WORLD_COURSE_IDS.map(async (worldId) => {
        const doc = await db.collection("world_courses").doc(worldId).get();
        result[worldId] = mergeWorldCoursesPage(
          worldId,
          doc.exists ? (doc.data() as Record<string, unknown>) : undefined
        );
      })
    );

    res.json({ data: result });
  } catch (error) {
    console.error("Error fetching world courses:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/:worldId", async (req, res) => {
  try {
    const worldId = String(req.params.worldId);
    if (!isValidWorldCourseId(worldId)) {
      return res.status(400).json({ error: "Invalid world id. Use writer, screenwriter, or student." });
    }

    const db = getFirestore();
    const doc = await db.collection("world_courses").doc(worldId).get();
    res.json({
      data: mergeWorldCoursesPage(
        worldId,
        doc.exists ? (doc.data() as Record<string, unknown>) : undefined
      ),
    });
  } catch (error) {
    console.error("Error fetching world courses page:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/:worldId", verifyAdmin, async (req, res) => {
  try {
    const worldId = String(req.params.worldId);
    if (!isValidWorldCourseId(worldId)) {
      return res.status(400).json({ error: "Invalid world id. Use writer, screenwriter, or student." });
    }

    const payload = req.body?.page ?? req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid world courses payload." });
    }

    const courses = Array.isArray(payload.courses) ? payload.courses : [];
    const normalized: WorldFlagshipCourse[] = courses.map(
      (c: WorldFlagshipCourse, i: number) => ({
        ...createEmptyWorldCourse(c?.id || `course-${Date.now()}-${i}`),
        ...c,
        id: String(c?.id || `course-${Date.now()}-${i}`),
      })
    );

    const db = getFirestore();
    const docRef = db.collection("world_courses").doc(worldId);
    await docRef.set(
      {
        id: worldId,
        courses: normalized,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const saved = await docRef.get();
    res.json({
      message: "World courses updated successfully.",
      data: mergeWorldCoursesPage(worldId, saved.data() as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Error updating world courses:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post(
  "/:worldId/courses/:courseId/photo",
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
      const worldId = String(req.params.worldId);
      const courseId = String(req.params.courseId);
      if (!isValidWorldCourseId(worldId)) {
        return res.status(400).json({ error: "Invalid world id." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No photo image file uploaded." });
      }

      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
      const db = getFirestore();
      const docRef = db.collection("world_courses").doc(worldId);
      const doc = await docRef.get();
      const page = mergeWorldCoursesPage(
        worldId,
        doc.exists ? (doc.data() as Record<string, unknown>) : undefined
      );

      const courses = page.courses.map((c) =>
        c.id === courseId ? { ...c, coachPhotoUrl: fileUrl } : c
      );

      // If course not found yet (unsaved new course), still return URL for client to apply locally
      const found = courses.some((c) => c.id === courseId);
      if (found) {
        await docRef.set(
          {
            id: worldId,
            courses,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      res.json({
        message: "Coach photo uploaded successfully.",
        photoURL: fileUrl,
        coachPhotoUrl: fileUrl,
      });
    } catch (error) {
      console.error("Error uploading world course coach photo:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
);

export default router;
