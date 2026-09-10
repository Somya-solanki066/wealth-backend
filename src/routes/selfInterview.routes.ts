import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  BOOK_TYPES,
  CHAPTER_LENGTHS,
  CHAPTER_POVS,
  CHAPTER_STYLES,
  CHAPTER_TONES,
  deleteBook,
  draftChapterFromInterview,
  generateBookOutline,
  getBook,
  listMyBooks,
  priorChaptersSummary,
  refineChapter,
  saveBook,
  saveChapterToBook,
} from "../services/selfInterview.service";

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
      error: "Premium required for Self-Interview Builder AI.",
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
      lengths: CHAPTER_LENGTHS.map((id) => ({
        id,
        label:
          id === "short"
            ? "1,500 words"
            : id === "long"
              ? "3,500 words"
              : "2,500 words",
      })),
      styles: CHAPTER_STYLES.map((id) => ({
        id,
        label:
          id === "personal" ? "Personal" : id === "professional" ? "Professional" : "Storytelling",
      })),
      povs: CHAPTER_POVS.map((id) => ({
        id,
        label: id === "first" ? "First Person" : "Third Person",
      })),
      tones: CHAPTER_TONES.map((id) => ({
        id,
        label:
          id === "personal"
            ? "Personal"
            : id === "inspirational"
              ? "Inspirational"
              : id === "professional"
                ? "Professional"
                : "Conversational",
      })),
      bookTypes: BOOK_TYPES.map((id) => ({
        id,
        label:
          id === "self-help"
            ? "Self-help"
            : id === "memoir"
              ? "Memoir"
              : id === "business"
                ? "Business"
                : "Other Nonfiction",
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/books", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const mode = req.query.mode ? String(req.query.mode) : undefined;
    let books = await listMyBooks(req.user.uid);
    if (mode === "own" || mode === "client") {
      books = books.filter((b) => b.mode === mode);
    }
    return res.json({ books });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load books." });
  }
});

router.post("/books", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const book = await saveBook({
      userId: req.user.uid,
      id: req.body?.id ? String(req.body.id) : undefined,
      mode: req.body?.mode === "client" ? "client" : "own",
      title: String(req.body?.title || ""),
      clientName: req.body?.clientName,
      genre: req.body?.genre,
      bookType: req.body?.bookType,
      mainIdea: req.body?.mainIdea,
      targetAudience: req.body?.targetAudience,
      description: req.body?.description,
      chapters: Array.isArray(req.body?.chapters) ? req.body.chapters : undefined,
    });
    return res.json({ book });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.post("/generate-outline", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const outline = await generateBookOutline({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      title: String(req.body?.title || ""),
      bookType: String(req.body?.bookType || "other"),
      mainIdea: String(req.body?.mainIdea || ""),
      targetAudience: String(req.body?.targetAudience || ""),
      chapterCount: req.body?.chapterCount != null ? Number(req.body.chapterCount) : 10,
      mode: req.body?.mode === "client" ? "client" : "own",
      clientName: req.body?.clientName,
    });
    return res.json({ outline });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Outline failed." });
  }
});

router.get("/books/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const book = await getBook(req.user.uid, String(req.params.id));
    return res.json({ book });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.delete("/books/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteBook(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Delete failed." });
  }
});

router.post("/draft", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;

    let prior = "";
    if (req.body?.bookId) {
      try {
        const book = await getBook(req.user!.uid, String(req.body.bookId));
        prior = priorChaptersSummary(book, req.body?.chapterId ? String(req.body.chapterId) : undefined);
      } catch {
        /* optional */
      }
    }

    const draft = await draftChapterFromInterview({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      transcript: String(req.body?.transcript || ""),
      topic: req.body?.topic,
      chapterTitle: req.body?.chapterTitle,
      length: req.body?.length,
      style: req.body?.style,
      pov: req.body?.pov,
      tone: req.body?.tone,
      targetWords: req.body?.targetWords != null ? Number(req.body.targetWords) : undefined,
      mode: req.body?.mode === "client" ? "client" : "own",
      clientName: req.body?.clientName,
      priorChaptersSummary: prior,
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Draft failed." });
  }
});

router.post("/refine", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const action = String(req.body?.action || "regenerate");
    if (
      !["regenerate", "expand", "shorten", "more-personal", "improve-flow", "rewrite"].includes(
        action
      )
    ) {
      return res.status(400).json({ error: "Invalid refine action." });
    }
    const draft = await refineChapter({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      action: action as any,
      title: String(req.body?.title || ""),
      body: String(req.body?.body || ""),
      transcript: String(req.body?.transcript || ""),
      topic: req.body?.topic,
      length: req.body?.length,
      style: req.body?.style,
      pov: req.body?.pov,
      tone: req.body?.tone,
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Refine failed." });
  }
});

router.post("/books/:id/chapters", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const book = await saveChapterToBook({
      userId: req.user.uid,
      bookId: String(req.params.id),
      chapterId: req.body?.chapterId ? String(req.body.chapterId) : undefined,
      title: String(req.body?.title || ""),
      topic: String(req.body?.topic || ""),
      purpose: req.body?.purpose,
      keyPoints: Array.isArray(req.body?.keyPoints) ? req.body.keyPoints : undefined,
      transcript: String(req.body?.transcript || ""),
      body: String(req.body?.body || ""),
      length: (req.body?.length || "medium") as any,
      style: (req.body?.style || "personal") as any,
      pov: req.body?.pov,
      tone: req.body?.tone,
      targetWords: req.body?.targetWords != null ? Number(req.body.targetWords) : undefined,
      status: req.body?.status,
      allowShort: Boolean(req.body?.allowShort) || req.body?.status === "planned",
    });
    return res.json({ book });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save chapter failed." });
  }
});

export default router;
