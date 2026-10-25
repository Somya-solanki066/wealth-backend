import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";

const router = express.Router();

export type MemberStoryWorld = "writer" | "screenwriter" | "student";

export interface MemberStory {
  id: string;
  title: string;
  role: string;
  by: string;
  initials: string;
  time: string;
  quote: string;
  rating: number;
  youtubeId: string;
  videoUrl: string;
  imageUrl: string;
  img: string;
  world: MemberStoryWorld;
  order: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeStoryWorld(value: unknown): MemberStoryWorld {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "screenwriter" || raw === "script" || raw === "screen") return "screenwriter";
  if (raw === "student") return "student";
  return "writer";
}

export const SEED_MEMBER_STORIES: Omit<MemberStory, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "This app changed my life!",
    role: "Writer and student",
    by: "Writer and student",
    initials: "WA",
    time: "0:45",
    quote: "This app changed my life!",
    rating: 5,
    youtubeId: "dQw4w9WgXcQ",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/uploads/stories/testi0.webp",
    img: "testi0",
    world: "writer",
    order: 0,
    featured: true,
  },
  {
    title: "I finally finished my first serial!",
    role: "Serial fiction writer",
    by: "Serial fiction writer",
    initials: "SW",
    time: "0:41",
    quote: "I finally finished my first serial!",
    rating: 5,
    youtubeId: "dQw4w9WgXcQ",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/uploads/stories/testi1.webp",
    img: "testi1",
    world: "writer",
    order: 1,
    featured: true,
  },
  {
    title: "My short film found a producer!",
    role: "Screenwriter",
    by: "Screenwriter",
    initials: "SC",
    time: "0:52",
    quote: "My short film found a producer!",
    rating: 5,
    youtubeId: "dQw4w9WgXcQ",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/uploads/stories/testi2.webp",
    img: "testi2",
    world: "screenwriter",
    order: 2,
    featured: true,
  },
  {
    title: "The script editor feels professional!",
    role: "Script writer",
    by: "Script writer",
    initials: "SR",
    time: "0:38",
    quote: "The script editor feels professional!",
    rating: 5,
    youtubeId: "dQw4w9WgXcQ",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/uploads/stories/testi3.webp",
    img: "testi3",
    world: "screenwriter",
    order: 3,
    featured: true,
  },
  {
    title: "I finally passed my nursing exams!",
    role: "Nursing student",
    by: "Nursing student",
    initials: "NS",
    time: "0:36",
    quote: "I finally passed my nursing exams!",
    rating: 5,
    youtubeId: "dQw4w9WgXcQ",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/uploads/stories/testi4.webp",
    img: "testi4",
    world: "student",
    order: 4,
    featured: true,
  },
  {
    title: "This is every student's best friend!",
    role: "Final year student",
    by: "Final year student",
    initials: "FS",
    time: "0:48",
    quote: "This is every student's best friend!",
    rating: 5,
    youtubeId: "dQw4w9WgXcQ",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    imageUrl: "/uploads/stories/testi5.webp",
    img: "testi5",
    world: "student",
    order: 5,
    featured: true,
  },
];

export async function ensureSeedMemberStories() {
  try {
    const db = getFirestore();
    const snap = await db.collection("member_stories").get();
    if (!snap.empty) {
      return;
    }
    const batch = db.batch();
    const now = new Date().toISOString();
    for (let i = 0; i < SEED_MEMBER_STORIES.length; i++) {
      const data = SEED_MEMBER_STORIES[i];
      const docRef = db.collection("member_stories").doc(`story-${i + 1}`);
      batch.set(docRef, {
        id: `story-${i + 1}`,
        ...data,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
    console.log("Seeded member_stories collection with 6 prototype testimonials.");
  } catch (err) {
    console.error("ensureSeedMemberStories error:", err);
  }
}

// GET all stories
router.get("/", async (_req, res) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("member_stories").orderBy("order", "asc").get();
    if (snap.empty) {
      // Auto seed if empty
      await ensureSeedMemberStories();
      const freshSnap = await db.collection("member_stories").orderBy("order", "asc").get();
      const list = freshSnap.docs.map((doc) => doc.data() as MemberStory);
      return res.json({ success: true, data: list });
    }
    const list = snap.docs.map((doc) => doc.data() as MemberStory);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error("Error fetching member stories:", error);
    // Return seed fallback if firestore fails
    res.json({
      success: true,
      data: SEED_MEMBER_STORIES.map((s, idx) => ({
        id: `story-${idx + 1}`,
        ...s,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    });
  }
});

// GET single story
router.get("/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const doc = await db.collection("member_stories").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Story not found." });
    }
    res.json({ success: true, data: doc.data() });
  } catch (error) {
    console.error("Error getting story:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// POST create story (Admin)
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const body = req.body || {};
    const id = body.id || `story-${Date.now()}`;
    const now = new Date().toISOString();

    const role = body.role || body.by || "Writer and student";
    const title = body.title || "This app changed my life!";
    const world = normalizeStoryWorld(body.world);
    const initials =
      body.initials ||
      role
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase() ||
      "WA";

    const story: MemberStory = {
      id,
      title,
      role,
      by: role,
      initials,
      time: body.time || "0:45",
      quote: body.quote || title,
      rating: Number(body.rating) || 5,
      youtubeId: body.youtubeId || "",
      videoUrl: body.videoUrl || "",
      imageUrl: body.imageUrl || "",
      img: body.img || "",
      world,
      order: typeof body.order === "number" ? body.order : Date.now(),
      featured: body.featured !== false,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("member_stories").doc(id).set(story);
    res.status(201).json({ success: true, message: "Story created successfully.", data: story });
  } catch (error) {
    console.error("Error creating member story:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// PUT update story (Admin)
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const id = String(req.params.id);
    const docRef = db.collection("member_stories").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: "Story not found." });
    }

    const prev = doc.data() as MemberStory;
    const body = req.body || {};
    const role = body.role ?? body.by ?? prev.role;
    const title = body.title ?? prev.title;
    const world = normalizeStoryWorld(body.world ?? prev.world);
    const initials =
      body.initials ??
      prev.initials ??
      role
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase();

    const updated: MemberStory = {
      ...prev,
      ...body,
      id,
      title,
      role,
      by: role,
      initials,
      world,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(updated, { merge: true });
    res.json({ success: true, message: "Story updated successfully.", data: updated });
  } catch (error) {
    console.error("Error updating member story:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// DELETE story (Admin)
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const id = String(req.params.id);
    await db.collection("member_stories").doc(id).delete();
    res.json({ success: true, message: "Story deleted successfully." });
  } catch (error) {
    console.error("Error deleting member story:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// POST upload cover image for story (Admin)
router.post("/upload-image", verifyAdmin, memoryImageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file provided." });
    }
    const filename = makeUploadFilename("story-cover", req.file.originalname);
    const publicUrl = await persistPublicUpload(req, req.file, filename);
    res.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error("Error uploading story image:", error);
    res.status(500).json({ success: false, error: "Failed to upload image." });
  }
});

export default router;
