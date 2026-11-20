import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";

const router = express.Router();
const TOOL_CARDS_COLLECTION = "tool_card_settings";

export interface ToolCardConfig {
  id: string;
  world: "writer" | "screenwriter" | "student";
  toolId: string;
  title: string;
  desc: string;
  badge: string;
  bgImageUrl: string;
  updatedAt: string;
}

export const SEED_TOOL_CARDS: ToolCardConfig[] = [
  // WRITER WORLD
  {
    id: "writer_chapter-analyzer",
    world: "writer",
    toolId: "chapter-analyzer",
    title: "Chapter Analyzer",
    desc: "Paste your chapter, select your platform. AI evaluates it the way a real editor would.",
    badge: "FREE — 3/month",
    bgImageUrl: "/uploads/tool-cards/chapter-analyzer.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "writer_smart-edit",
    world: "writer",
    toolId: "smart-edit",
    title: "Smart Edit Suite",
    desc: "10 professional editing checks. Grammar, Passive Voice, Filler Words, and more.",
    badge: "3 checks FREE",
    bgImageUrl: "/uploads/tool-cards/smart-edit.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "writer_ghost-writer",
    world: "writer",
    toolId: "ghost-writer",
    title: "AI Ghost Writer",
    desc: "Tell us your characters, platform, and plot. AI writes a platform-ready chapter.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/ghost-writer.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "writer_writing-vault",
    world: "writer",
    toolId: "writing-vault",
    title: "Writing Vault",
    desc: "250+ writing prompts by genre and trope. Fire Starters, Scene Builders, and Character Voice.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/writing-vault.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "writer_book-cover",
    world: "writer",
    toolId: "book-cover",
    title: "Book Cover Generator",
    desc: "AI covers calibrated for your platform aesthetic — PocketFM vs Dreame and more.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/book-cover.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "writer_wealth-engine",
    world: "writer",
    toolId: "wealth-engine",
    title: "WEALTH Engine",
    desc: "Jobs board, author branding, book promotion, KDP and Draft2Digital tools.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/wealth-engine.jpg",
    updatedAt: new Date().toISOString(),
  },

  // SCREENWRITER WORLD (Ref: Image 2)
  {
    id: "screenwriter_scripts-list",
    world: "screenwriter",
    toolId: "scripts-list",
    title: "Screenwriting Toolkit",
    desc: "Write compelling scripts with professional tools & Hollywood formatting.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/screenwriting-toolkit.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_script-analyzer",
    world: "screenwriter",
    toolId: "script-analyzer",
    title: "Script Analyzer",
    desc: "Get detailed feedback on your script and improve scene pacing.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/script-analyzer.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_script-marketplace",
    world: "screenwriter",
    toolId: "script-marketplace",
    title: "Script Marketplace",
    desc: "Discover opportunities and get your scripts noticed by top producers.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/script-marketplace.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_short-film-showcase",
    world: "screenwriter",
    toolId: "short-film-showcase",
    title: "Script Moodboard",
    desc: "Visualise your story with stunning moodboards and production shorts.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/script-moodboard.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_industry-hub",
    world: "screenwriter",
    toolId: "industry-hub",
    title: "Script Formatting",
    desc: "Format your scripts to industry standards. Open calls & producer briefs.",
    badge: "FREE — 3/day",
    bgImageUrl: "/uploads/tool-cards/script-formatting.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_pitch-query-builder",
    world: "screenwriter",
    toolId: "pitch-query-builder",
    title: "Pitch Deck & Query Builder",
    desc: "Create a winning pitch deck, logline, and query letter.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/pitch-query-builder.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_ghost-writer-script",
    world: "screenwriter",
    toolId: "ghost-writer-script",
    title: "AI Script Writer",
    desc: "Generate formatted scenes for film, TV, or audio drama in seconds.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/ghost-writer-script.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_screenwriter-community",
    world: "screenwriter",
    toolId: "screenwriter-community",
    title: "Screenwriter Community",
    desc: "Writers rooms, peer review, weekly feedback, and veteran mentors.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/screenwriter-community.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "screenwriter_screenwriter-portfolio",
    world: "screenwriter",
    toolId: "screenwriter-portfolio",
    title: "Screenwriter Portfolio",
    desc: "Public profile, showcase, rates, bio, and direct hiring inquiries.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/screenwriter-portfolio.jpg",
    updatedAt: new Date().toISOString(),
  },

  // STUDENT WORLD
  {
    id: "student_jamb-practice",
    world: "student",
    toolId: "jamb-practice",
    title: "JAMB UTME Practice",
    desc: "25 years of past questions across JAMB subjects. CBT practice with timer.",
    badge: "MORE FREE THAN PAID",
    bgImageUrl: "/uploads/tool-cards/jamb-practice.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_university-past",
    world: "student",
    toolId: "university-past",
    title: "University Past Questions",
    desc: "20 universities. Navigate University → Faculty → Course → Year.",
    badge: "3 YEARS FREE",
    bgImageUrl: "/uploads/tool-cards/university-past.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_nursing-hub",
    world: "student",
    toolId: "nursing-hub",
    title: "Nursing Hub",
    desc: "Year 1 to Year 5. MedSurg, MCH, Community Health & Drug Calculations.",
    badge: "FREE + PREMIUM",
    bgImageUrl: "/uploads/tool-cards/nursing-hub.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_mbbs-hub",
    world: "student",
    toolId: "mbbs-hub",
    title: "MBBS Hub",
    desc: "6-year programme. Pre-clinical, Para-clinical & Clinical scenarios.",
    badge: "FREE + PREMIUM",
    bgImageUrl: "/uploads/tool-cards/mbbs-hub.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_professional-courses",
    world: "student",
    toolId: "professional-courses",
    title: "All Professional Courses",
    desc: "Law, Pharmacy, Med Lab, Radiography, Physiotherapy, and Dentistry.",
    badge: "FREE + PREMIUM",
    bgImageUrl: "/uploads/tool-cards/professional-courses.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_performance-analytics",
    world: "student",
    toolId: "performance-analytics",
    title: "Smart Performance Analytics",
    desc: "Score history, weak areas, and study streak — what to study today.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/performance-analytics.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_study-planner",
    world: "student",
    toolId: "study-planner",
    title: "Study Planner",
    desc: "AI day-by-day schedule generated from your subjects and exam date.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/study-planner.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_flashcards",
    world: "student",
    toolId: "flashcards",
    title: "Active Recall Flashcards",
    desc: "Transform your lecture notes or topic into interactive Q&A flashcards.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/flashcards.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_citation",
    world: "student",
    toolId: "citation",
    title: "Citation Generator",
    desc: "APA, MLA, Harvard, Chicago, Vancouver for books, journals & videos.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/citation.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_video-finder",
    world: "student",
    toolId: "video-finder",
    title: "Course Video Finder",
    desc: "Find the best high-yield video tutorials for any topic and exam.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/video-finder.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_essay-writer",
    world: "student",
    toolId: "essay-writer",
    title: "Essay & Project Writer",
    desc: "Structured essays, academic papers, and lab reports to word count.",
    badge: "PREMIUM",
    bgImageUrl: "/uploads/tool-cards/essay-writer.jpg",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "student_exam-techniques",
    world: "student",
    toolId: "exam-techniques",
    title: "Exam Techniques Hub",
    desc: "Active Recall, Spaced Repetition, Pomodoro, Mind Mapping & Feynman.",
    badge: "FREE",
    bgImageUrl: "/uploads/tool-cards/exam-techniques.jpg",
    updatedAt: new Date().toISOString(),
  },
];

// In-memory cache
const memoryToolCards = new Map<string, ToolCardConfig>();
for (const seed of SEED_TOOL_CARDS) {
  memoryToolCards.set(seed.id, seed);
}

function toolCardsRef() {
  return getFirestore().collection(TOOL_CARDS_COLLECTION);
}

/**
 * Public GET: Fetch all tool card settings grouped by world
 */
router.get("/", async (req, res) => {
  try {
    let list: ToolCardConfig[] = [];
    try {
      const snap = await toolCardsRef().get();
      if (!snap.empty) {
        list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ToolCardConfig));
      }
    } catch (e) {
      // Firebase fallback to memory
    }

    if (list.length === 0) {
      list = Array.from(memoryToolCards.values());
    } else {
      // Merge with memory defaults so new tools are never missing
      const existingIds = new Set(list.map((item) => item.id));
      for (const seed of SEED_TOOL_CARDS) {
        if (!existingIds.has(seed.id)) {
          list.push(seed);
        }
      }
    }

    // Group by world
    const grouped = {
      writer: list.filter((i) => i.world === "writer"),
      screenwriter: list.filter((i) => i.world === "screenwriter"),
      student: list.filter((i) => i.world === "student"),
    };

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error("Error fetching tool cards:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tool cards." });
  }
});

/**
 * Admin PUT/POST: Update card background image & details
 */
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const { world, toolId, bgImageUrl, title, desc, badge } = req.body;
    if (!world || !toolId) {
      return res.status(400).json({ error: "world and toolId are required." });
    }

    const id = `${world}_${toolId}`;
    const now = new Date().toISOString();

    const existing = memoryToolCards.get(id) || SEED_TOOL_CARDS.find((s) => s.id === id);

    const updated: ToolCardConfig = {
      id,
      world: world as "writer" | "screenwriter" | "student",
      toolId,
      title: title ?? existing?.title ?? "",
      desc: desc ?? existing?.desc ?? "",
      badge: badge ?? existing?.badge ?? "FREE",
      bgImageUrl: bgImageUrl !== undefined ? String(bgImageUrl).trim() : existing?.bgImageUrl ?? "",
      updatedAt: now,
    };

    memoryToolCards.set(id, updated);

    try {
      await toolCardsRef().doc(id).set(updated, { merge: true });
    } catch (err) {
      console.warn("Firestore save failed, saved in memory:", err);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error saving tool card:", error);
    res.status(500).json({ success: false, error: "Failed to save tool card." });
  }
});

/**
 * Admin POST /upload: Upload an image for a tool card
 */
router.post(
  "/upload",
  verifyAdmin,
  (req, res, next) => {
    memoryImageUpload.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided." });
      }
      const filename = makeUploadFilename("tool-card", req.file.originalname);
      const url = await persistPublicUpload(req, req.file, filename);
      res.json({ success: true, url });
    } catch (error) {
      console.error("Error uploading tool card image:", error);
      res.status(500).json({ error: "Failed to upload image." });
    }
  }
);

/**
 * Admin POST /reset: Reset all tool cards in a world or single card to default
 */
router.post("/reset", verifyAdmin, async (req, res) => {
  try {
    const { world, toolId } = req.body;
    const now = new Date().toISOString();

    if (world && toolId) {
      const id = `${world}_${toolId}`;
      const seed = SEED_TOOL_CARDS.find((s) => s.id === id);
      if (seed) {
        const resetItem = { ...seed, updatedAt: now };
        memoryToolCards.set(id, resetItem);
        try {
          await toolCardsRef().doc(id).set(resetItem);
        } catch (_) {}
      }
    } else {
      for (const seed of SEED_TOOL_CARDS) {
        if (!world || seed.world === world) {
          memoryToolCards.set(seed.id, { ...seed, updatedAt: now });
          try {
            await toolCardsRef().doc(seed.id).set({ ...seed, updatedAt: now });
          } catch (_) {}
        }
      }
    }

    res.json({ success: true, message: "Reset to default seeds successfully." });
  } catch (error) {
    console.error("Error resetting tool cards:", error);
    res.status(500).json({ success: false, error: "Failed to reset tool cards." });
  }
});

export default router;
