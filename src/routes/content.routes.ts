import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";

const router = express.Router();

const DEFAULT_CONTENT_PAGES: Record<string, { title: string; body: string }> = {
  "community-guidelines": {
    title: "Community Guidelines",
    body: "Effective Date: January 1, 2026\n\nWelcome to Ink2Wealth. Our community guidelines are designed to ensure a supportive, safe, and productive space for all authors, screenwriters, and students.\n\n1. Respectful Communication\nBe courteous and respectful. Any harassment, hate speech, defamation, or derogatory comments will result in account suspension.\n\n2. Originality and Plagiarism\nAll writers are expected to produce authentic work. Plagiarizing others' scripts, novels, or answers is strictly forbidden.\n\n3. Constructive Feedback\nOur peer reviews, comments, and community discussions thrive on constructive, encouraging critiques.\n\n4. Reporting Issues\nIf you encounter content or conduct violating our policies, please report it to victor@ink2wealth.co.",
  },
  "about-ink2wealth": {
    title: "About Ink2Wealth",
    body: "Ink2Wealth Media Limited is the premier platform empowering storytellers, screenwriters, and ambitious students across Africa and globally.\n\nOur Mission\nTo unlock creative potential and build sustainable wealth through masterclasses, AI-assisted writing tools, and global publishing opportunities.\n\nThree Worlds, One Membership\n- Writer World: Craft serial fiction, analyze chapters with AI tailored for 9 web novel platforms, and build an audience.\n- Screenwriter World: Professional screenplay formatting, scene breakdowns, and pitch-ready scripts.\n- Student World: Study planners, smart flashcards, automated citations (APA, MLA, Harvard), and academic excellence tools.\n\nContact Us\nEmail: victor@ink2wealth.co\nWebsite: ink2wealth.co\nAddress: Enugu, Enugu State, Nigeria",
  },
};

router.get("/:pageId", async (req, res) => {
  try {
    const db = getFirestore();
    const pageId = String(req.params.pageId);
    const docRef = db.collection("page_content").doc(pageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      if (DEFAULT_CONTENT_PAGES[pageId]) {
        await docRef.set(DEFAULT_CONTENT_PAGES[pageId], { merge: true });
        return res.json({ data: DEFAULT_CONTENT_PAGES[pageId] });
      }
      // Return empty object if it doesn't exist yet so frontend doesn't crash
      return res.json({ data: {} });
    }

    res.json({ data: doc.data() });
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/:pageId", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const pageId = String(req.params.pageId);
    const { content } = req.body;

    if (!content || typeof content !== "object") {
      return res.status(400).json({ error: "Invalid content payload." });
    }

    const docRef = db.collection("page_content").doc(pageId);
    await docRef.set(content, { merge: true });

    res.json({ message: "Content updated successfully." });
  } catch (error) {
    console.error("Error updating content:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
