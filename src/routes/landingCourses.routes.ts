import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";
import {
  COURSE_IDS,
  getDefaultLandingCourse,
  isValidCourseId,
  type LandingCourseId,
} from "../utils/landingCoursesDefaults";

const router = express.Router();

const upload = memoryImageUpload;

function mergeCourse(courseId: LandingCourseId, stored: Record<string, unknown> | undefined) {
  const defaults = getDefaultLandingCourse(courseId);
  return { ...defaults, ...(stored || {}), id: courseId };
}

router.get("/", async (_req, res) => {
  try {
    const db = getFirestore();
    const result: Record<string, unknown> = {};

    await Promise.all(
      COURSE_IDS.map(async (courseId) => {
        const doc = await db.collection("landing_courses").doc(courseId).get();
        result[courseId] = mergeCourse(courseId, doc.exists ? (doc.data() as Record<string, unknown>) : undefined);
      })
    );

    res.json({ data: result });
  } catch (error) {
    console.error("Error fetching landing courses:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/:courseId", async (req, res) => {
  try {
    const courseId = String(req.params.courseId);
    if (!isValidCourseId(courseId)) {
      return res.status(400).json({ error: "Invalid course id. Use witweb or ssg." });
    }

    const db = getFirestore();
    const doc = await db.collection("landing_courses").doc(courseId).get();
    const data = mergeCourse(courseId, doc.exists ? (doc.data() as Record<string, unknown>) : undefined);
    res.json({ data });
  } catch (error) {
    console.error("Error fetching landing course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/:courseId", verifyAdmin, async (req, res) => {
  try {
    const courseId = String(req.params.courseId);
    if (!isValidCourseId(courseId)) {
      return res.status(400).json({ error: "Invalid course id. Use witweb or ssg." });
    }

    const payload = req.body?.course ?? req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid course payload." });
    }

    const { id: _id, ...rest } = payload as Record<string, unknown>;
    const db = getFirestore();
    const docRef = db.collection("landing_courses").doc(courseId);
    await docRef.set(
      {
        ...rest,
        id: courseId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const saved = await docRef.get();
    res.json({
      message: "Landing course updated successfully.",
      data: mergeCourse(courseId, saved.data() as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Error updating landing course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post(
  "/:courseId/photo",
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
      const courseId = String(req.params.courseId);
      if (!isValidCourseId(courseId)) {
        return res.status(400).json({ error: "Invalid course id. Use witweb or ssg." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No photo image file uploaded." });
      }

      const filename = makeUploadFilename("coach", req.file.originalname);
      const fileUrl = await persistPublicUpload(req, req.file, filename);
      const db = getFirestore();
      const docRef = db.collection("landing_courses").doc(courseId);
      await docRef.set(
        {
          coachPhotoUrl: fileUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      res.json({
        message: "Coach photo uploaded successfully.",
        photoURL: fileUrl,
        coachPhotoUrl: fileUrl,
      });
    } catch (error: any) {
      console.error("Error uploading coach photo:", error);
      res.status(500).json({ error: error?.message || "Internal server error." });
    }
  }
);

router.post(
  "/:courseId/thumbnail",
  verifyAdmin,
  (req, res, next) => {
    upload.single("thumbnail")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const courseId = String(req.params.courseId);
      if (!isValidCourseId(courseId)) {
        return res.status(400).json({ error: "Invalid course id. Use witweb or ssg." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No thumbnail image file uploaded." });
      }

      const filename = makeUploadFilename("course-banner", req.file.originalname);
      const fileUrl = await persistPublicUpload(req, req.file, filename);
      const db = getFirestore();
      const docRef = db.collection("landing_courses").doc(courseId);
      await docRef.set(
        {
          bannerImageUrl: fileUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      res.json({
        message: "Course thumbnail uploaded successfully.",
        bannerImageUrl: fileUrl,
        thumbnailUrl: fileUrl,
      });
    } catch (error: any) {
      console.error("Error uploading course thumbnail:", error);
      res.status(500).json({ error: error?.message || "Internal server error." });
    }
  }
);

router.post(
  "/:courseId/my-student-banner",
  verifyAdmin,
  (req, res, next) => {
    upload.single("banner")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const courseId = String(req.params.courseId);
      if (!isValidCourseId(courseId)) {
        return res.status(400).json({ error: "Invalid course id. Use witweb or ssg." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No My Student banner image uploaded." });
      }

      const filename = makeUploadFilename("course-banner", req.file.originalname);
      const fileUrl = await persistPublicUpload(req, req.file, filename);
      const db = getFirestore();
      const docRef = db.collection("landing_courses").doc(courseId);
      await docRef.set(
        {
          myStudentBannerImageUrl: fileUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      res.json({
        message: "My Student banner uploaded successfully.",
        myStudentBannerImageUrl: fileUrl,
      });
    } catch (error: any) {
      console.error("Error uploading My Student banner:", error);
      res.status(500).json({ error: error?.message || "Internal server error." });
    }
  }
);

export default router;
