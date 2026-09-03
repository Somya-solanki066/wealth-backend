import { Router, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import dotenv from "dotenv";
import OpenAI from "openai";
import { isUserPremium } from "../utils/plans";
import { getAnalyzerPrompt, getOpenAiModel } from "../utils/catalog";
import { getAiUsageCount, recordAiUsage, countWords as countPlainWords } from "../utils/aiUsage";

const router = Router();

// Helper to count words (excluding HTML tags)
function countWords(html: string): number {
  if (!html) return 0;
  const cleanText = html.replace(/<[^>]*>/g, " ");
  const words = cleanText.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

// GET /api/projects - List all projects for authenticated user
router.get("/", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const db = getFirestore();
    const snapshot = await db
      .collection("projects")
      .where("userId", "==", req.user.uid)
      .get();

    const projects: any[] = [];
    snapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });

    // Sort projects in memory by updatedAt descending
    projects.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateB - dateA;
    });

    return res.status(200).json(projects);
  } catch (error: any) {
    console.error("Error listing projects:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/projects - Create a new project (Novel or Script)
router.post("/", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const { name, type } = req.body;
    if (!name || !type || !["novel", "script"].includes(type)) {
      return res.status(400).json({ error: "Invalid name or type" });
    }

    const db = getFirestore();
    const projectRef = db.collection("projects").doc();
    const projectId = projectRef.id;

    const newProject = {
      id: projectId,
      userId: req.user.uid,
      name,
      type,
      status: "Draft",
      wordCount: 0,
      chapterCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await projectRef.set(newProject);

    // Initialize the first chapter/scene
    const chapterRef = projectRef.collection("chapters").doc();
    const firstChapter = {
      id: chapterRef.id,
      title: type === "novel" ? "Chapter 1" : "Scene 1",
      content: type === "novel" ? "<p>Start writing your story here...</p>" : "<p>INT. HOUSE - DAY</p><p>Write action here...</p>",
      wordCount: type === "novel" ? 5 : 4,
      lastSavedAt: new Date().toISOString(),
    };
    await chapterRef.set(firstChapter);

    // Update project word count based on initial chapter
    await projectRef.update({
      wordCount: firstChapter.wordCount,
    });

    newProject.wordCount = firstChapter.wordCount;

    return res.status(201).json(newProject);
  } catch (error: any) {
    console.error("Error creating project:", error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id - Delete a project and all its sub-chapters
router.delete("/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const db = getFirestore();
    const projectRef = db.collection("projects").doc(req.params.id as string);
    const docSnap = await projectRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (docSnap.data()?.userId !== req.user.uid) {
      return res.status(403).json({ error: "Unauthorized access to this project" });
    }

    // Delete sub-collection chapters first
    const chaptersSnap = await projectRef.collection("chapters").get();
    const batch = db.batch();
    chaptersSnap.forEach((chapterDoc) => {
      batch.delete(chapterDoc.ref);
    });
    // Delete project doc
    batch.delete(projectRef);
    await batch.commit();

    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id/chapters - Fetch all chapters of a project
router.get("/:id/chapters", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const db = getFirestore();
    const projectRef = db.collection("projects").doc(req.params.id as string);
    const docSnap = await projectRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (docSnap.data()?.userId !== req.user.uid) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const chaptersSnap = await projectRef.collection("chapters").get();
    const chapters: any[] = [];
    chaptersSnap.forEach((cDoc) => {
      chapters.push({ id: cDoc.id, ...cDoc.data() });
    });

    // Sort chapters by ID or date or order
    chapters.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

    return res.status(200).json(chapters);
  } catch (error: any) {
    console.error("Error listing chapters:", error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/chapters - Create a new chapter under a project
router.post("/:id/chapters", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const db = getFirestore();
    const projectRef = db.collection("projects").doc(req.params.id as string);
    const docSnap = await projectRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (docSnap.data()?.userId !== req.user.uid) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const newChapterRef = projectRef.collection("chapters").doc();
    const newChapter = {
      id: newChapterRef.id,
      title,
      content: "<p>Start writing chapter text...</p>",
      wordCount: 4,
      lastSavedAt: new Date().toISOString(),
    };

    await newChapterRef.set(newChapter);

    // Increment chapterCount and total word count on project
    const currentChapterCount = docSnap.data()?.chapterCount || 1;
    const currentWordCount = docSnap.data()?.wordCount || 0;

    await projectRef.update({
      chapterCount: currentChapterCount + 1,
      wordCount: currentWordCount + newChapter.wordCount,
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json(newChapter);
  } catch (error: any) {
    console.error("Error creating chapter:", error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/projects/:id/chapters/:chapterId - Autosave chapter content & update metrics / streaks
router.put("/:id/chapters/:chapterId", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const { content, title, localDateStr } = req.body;
    if (content === undefined && !title) {
      return res.status(400).json({ error: "Content or title is required" });
    }

    const db = getFirestore();
    const projectRef = db.collection("projects").doc(req.params.id as string);
    const projSnap = await projectRef.get();

    if (!projSnap.exists || projSnap.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: "Project not found or unauthorized" });
    }

    const chapterRef = projectRef.collection("chapters").doc(req.params.chapterId as string);
    const chapSnap = await chapterRef.get();

    if (!chapSnap.exists) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Title-only rename
    if (content === undefined && title) {
      const nextTitle = String(title).trim();
      if (!nextTitle) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      await chapterRef.update({
        title: nextTitle,
        lastSavedAt: new Date().toISOString(),
      });
      await projectRef.update({ updatedAt: new Date().toISOString() });
      return res.status(200).json({
        message: "Chapter renamed successfully",
        title: nextTitle,
        chapterWordCount: chapSnap.data()?.wordCount || 0,
      });
    }

    const oldChapWords = chapSnap.data()?.wordCount || 0;
    const newChapWords = countWords(content);
    const wordDifference = Math.max(0, newChapWords - oldChapWords);

    // Update chapter
    const updateData: any = {
      content,
      wordCount: newChapWords,
      lastSavedAt: new Date().toISOString(),
    };
    if (title) updateData.title = title;

    await chapterRef.update(updateData);

    // Update project word count
    const projectWordCount = (projSnap.data()?.wordCount || 0) + wordDifference;
    await projectRef.update({
      wordCount: projectWordCount,
      updatedAt: new Date().toISOString(),
    });

    let writingStreak = 0;
    let lastWriteDate: string | null = null;
    let totalWordsWritten = 0;

    // Mark writing activity for streak when user saves with content (same as web intent)
    if (localDateStr && newChapWords > 0) {
      const userRef = db.collection("users").doc(req.user.uid);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const uData = userSnap.data() || {};
        writingStreak = uData.writingStreak || 0;
        lastWriteDate = uData.lastWriteDate || null;
        totalWordsWritten = uData.totalWordsWritten || 0;

        if (wordDifference > 0) {
        totalWordsWritten += wordDifference;
        }

        if (!lastWriteDate) {
          writingStreak = 1;
          lastWriteDate = localDateStr;
        } else {
          const lastDate = new Date(String(lastWriteDate).slice(0, 10));
          const currentDate = new Date(String(localDateStr).slice(0, 10));
          lastDate.setUTCHours(0, 0, 0, 0);
          currentDate.setUTCHours(0, 0, 0, 0);

          const diffDays = Math.round(
            (currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24)
          );

          if (diffDays === 1) {
            writingStreak += 1;
            lastWriteDate = localDateStr;
          } else if (diffDays > 1) {
            writingStreak = 1;
            lastWriteDate = localDateStr;
          } else if (diffDays === 0) {
            // Same day write — keep streak; start at 1 if it was somehow 0
            if (!writingStreak || writingStreak < 1) writingStreak = 1;
            lastWriteDate = localDateStr;
          } else {
            // clock skew / timezone — still count today
            writingStreak = Math.max(writingStreak, 1);
            lastWriteDate = localDateStr;
          }
        }

        await userRef.update({
          writingStreak,
          lastWriteDate,
          totalWordsWritten,
        });
      }
    } else {
      const userSnap = await db.collection("users").doc(req.user.uid).get();
      const uData = userSnap.data() || {};
      writingStreak = uData.writingStreak || 0;
      lastWriteDate = uData.lastWriteDate || null;
      totalWordsWritten = uData.totalWordsWritten || 0;
    }

    return res.status(200).json({
      message: "Chapter auto-saved successfully",
      chapterWordCount: newChapWords,
      projectWordCount,
      writingStreak,
      lastWriteDate,
      totalWordsWritten,
      wordsAdded: wordDifference,
      title: updateData.title || chapSnap.data()?.title || null,
    });
  } catch (error: any) {
    console.error("Error autosaving chapter:", error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id/chapters/:chapterId - Delete a single chapter/scene
router.delete("/:id/chapters/:chapterId", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }

    const db = getFirestore();
    const projectRef = db.collection("projects").doc(req.params.id as string);
    const projSnap = await projectRef.get();

    if (!projSnap.exists || projSnap.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: "Project not found or unauthorized" });
    }

    const chapterRef = projectRef.collection("chapters").doc(req.params.chapterId as string);
    const chapSnap = await chapterRef.get();
    if (!chapSnap.exists) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    const chapWords = Number(chapSnap.data()?.wordCount || 0);
    await chapterRef.delete();

    const project = projSnap.data() || {};
    await projectRef.update({
      chapterCount: Math.max(0, Number(project.chapterCount || 1) - 1),
      wordCount: Math.max(0, Number(project.wordCount || 0) - chapWords),
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      message: "Chapter deleted successfully",
      chapterId: req.params.chapterId,
    });
  } catch (error: any) {
    console.error("Error deleting chapter:", error);
    return res.status(500).json({ error: error.message });
  }
});



// POST /api/projects/:id/analyze - Run compliance analysis check using OpenAI GPT model
router.post("/:id/analyze", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const { content, platform, genre, chapterTitle, chapterId } = req.body;
    if (!content || !platform || !genre) {
      return res.status(400).json({ error: "Content, platform, and genre are required" });
    }

    const rawText = content
      .replace(/<[^>]*>/g, " ")
      .replace(/\0/g, "")
      .trim();
    const chapterName = chapterTitle || "Chapter 1";
    const wordsAnalyzed = countPlainWords(rawText);
    const db = getFirestore();
    const projectId = String(req.params.id || "");

    // Limit check logic for AI Chapter Analyzer
    const userId = req.user.uid;
    const userEmail = req.user.email || null;

    let projectName = "";
    try {
      const projectSnap = await db.collection("projects").doc(projectId).get();
      if (projectSnap.exists) {
        projectName = String(projectSnap.data()?.name || "");
      }
    } catch {
      /* ignore */
    }
    const settingsSnap = await db.collection("settings").doc("global").get();
    const settings = settingsSnap.data() || { aiAnalyzerFreeLimit: 3 };
    const freeLimit = settings.aiAnalyzerFreeLimit || 3;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const isPremium = isUserPremium(userSnap.data());

    if (!isPremium) {
      const usageCount = await getAiUsageCount(userId, "aiAnalyzerCount");
      if (usageCount >= freeLimit) {
        return res.status(403).json({ error: "Free limit exceeded", limitExceeded: true });
      }
    }

    // Fetch dynamic platform updates from Firestore if available
    let trendsPromptSection = "";
    try {
      const trendsSnap = await db.collection("editorial_trends").doc(platform as string).get();
      if (trendsSnap.exists) {
        const trends = trendsSnap.data() || {};
        trendsPromptSection = `

### CURRENT TRENDS UPDATE:
- **Hot Tropes:** ${trends.hotTropes || "N/A"}
- **Acquiring Now:** ${trends.acquiringNow || "N/A"}
- **Oversaturated / Avoid:** ${trends.avoid || "N/A"}
- **Policy Changes:** ${trends.policyChanges || "N/A"}
`;
      }
    } catch (e) {
      console.warn("Failed to load editorial trends for analyzer injection:", e);
    }

    // Force-reload dotenv to capture newly pasted key in .env file without restarting the server
    dotenv.config();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      // Mock analysis fallback matching the exact required schema
      const mockResult = {
        overall_score: Math.floor(Math.random() * 20) + 75,
        verdict: "PASS WITH REVISIONS",
        editor_note: `This is a solid chapter for ${platform} (${genre}). The pacing is steady and dialogue flows well. However, keep an eye on mobile formatting restrictions.`,
        scores: {
          hook: Math.floor(Math.random() * 3) + 7,
          pacing: Math.floor(Math.random() * 3) + 7,
          chemistry: Math.floor(Math.random() * 3) + 7,
          dialogue: Math.floor(Math.random() * 3) + 7,
          cliffhanger: Math.floor(Math.random() * 3) + 7,
          mobile_format: Math.floor(Math.random() * 3) + 7,
          emotional_depth: Math.floor(Math.random() * 3) + 7,
          platform_fit: Math.floor(Math.random() * 3) + 7
        },
        strengths: [
          `Strong opening sentence hooks the reader's attention immediately.`,
          `Great dialogue rhythm matching standard ${genre} pacing.`
        ],
        issues: [
          {
            label: "Formatting Block Density",
            detail: "Paragraphs 4 and 7 contain long, dense sentence sequences which look heavy on phone screens.",
            fix: "Split long paragraphs into 2-3 shorter sentences (max 4 lines per block)."
          },
          {
            label: "Attraction Beats",
            detail: "The romantic tension between FL and ML peaks too slowly in the middle segment.",
            fix: "Add 1-2 lines of sensory interaction to show immediate physical draw."
          }
        ],
        line_edits: [
          {
            original: "She stood near the desk waiting for him to talk to her.",
            suggestion: "She lingered by the desk, tracing the mahogany edge as she waited for his call.",
            reason: "Shows emotional nervousness instead of telling she is waiting."
          }
        ],
        trending_tropes_fit: `Matches the strong ${genre} acquisition focus currently popular on ${platform}.`,
        unlock_potential: "HIGH"
      };
      await recordAiUsage({
        userId,
        userEmail,
        field: "aiAnalyzerCount",
        tool: "chapter-analyzer",
        wordsAnalyzed,
        tokensUsed: 0,
        model: "mock",
        projectId,
        projectName,
        chapterId: chapterId || "",
        chapterTitle: chapterName,
        platform: String(platform),
        genre: String(genre),
        inputPreview: rawText,
        score: mockResult.overall_score,
      });
      return res.status(200).json(mockResult);
    }

    // Call OpenAI GPT model with platform-specific system prompts
    const basePrompt = await getAnalyzerPrompt(String(platform));
    const systemPrompt = `${basePrompt}\n${trendsPromptSection}`;

    const userContent = `
Platform: ${platform}
Genre: ${genre}
Chapter Number: ${chapterName}

CHAPTER TEXT:
${rawText}

Respond ONLY in this JSON format:
{
  "overall_score": 0-100,
  "verdict": "STRONG PASS" | "PASS WITH REVISIONS" | "REVISE AND RESUBMIT" | "REJECT",
  "editor_note": "2-3 sentence editorial voice summary",
  "scores": {
    "hook": 0-10,
    "pacing": 0-10,
    "chemistry": 0-10,
    "dialogue": 0-10,
    "cliffhanger": 0-10,
    "mobile_format": 0-10,
    "emotional_depth": 0-10,
    "platform_fit": 0-10
  },
  "strengths": ["string", "string", "string"],
  "issues": [
    {"label": "string", "detail": "string", "fix": "string"}
  ],
  "line_edits": [
    {"original": "string", "suggestion": "string", "reason": "string"}
  ],
  "trending_tropes_fit": "how well this fits current platform trends",
  "unlock_potential": "LOW" | "MEDIUM" | "HIGH"
}`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: await getOpenAiModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error("No response from OpenAI");
    }

    const parsedContent = JSON.parse(aiResponse);
    const usage = completion.usage;
    await recordAiUsage({
      userId,
      userEmail,
      field: "aiAnalyzerCount",
      tool: "chapter-analyzer",
      wordsAnalyzed,
      tokensUsed: usage?.total_tokens || 0,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      model: completion.model || "",
      projectId,
      projectName,
      chapterId: chapterId || "",
      chapterTitle: chapterName,
      platform: String(platform),
      genre: String(genre),
      inputPreview: rawText,
      score: parsedContent?.overall_score ?? null,
    });
    return res.status(200).json(parsedContent);
  } catch (error: any) {
    console.error("Error analyzing chapter:", error);
    return res.status(500).json({ error: error.message || "Failed to run AI compliance check." });
  }
});

export default router;

