import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getOpenAiModel } from "../utils/catalog";
import { getPlanById, isUserPremium } from "../utils/plans";
import { countWords, recordAiUsage } from "../utils/aiUsage";

dotenv.config();

const router = express.Router();

const NOVEL_TONES = [
  "Emotional",
  "Dark",
  "Slow burn",
  "Fast-paced",
  "Humorous",
  "Gritty",
] as const;

const LENGTH_PRESETS: Record<string, { label: string; min: number; max: number; target: number }> = {
  short: { label: "Short", min: 800, max: 1000, target: 900 },
  standard: { label: "Standard", min: 1200, max: 1500, target: 1350 },
  long: { label: "Long", min: 1800, max: 2000, target: 1900 },
};

const SCRIPT_LENGTH_PRESETS: Record<
  string,
  { label: string; min: number; max: number; target: number }
> = {
  short: { label: "Short", min: 500, max: 750, target: 650 },
  standard: { label: "Standard", min: 1000, max: 1250, target: 1100 },
  long: { label: "Long", min: 1800, max: 2500, target: 2100 },
};

function normalizeCharacters(input: unknown): string {
  if (Array.isArray(input)) {
    return input.map((c) => String(c || "").trim()).filter(Boolean).join(", ");
  }
  return String(input || "").trim();
}

function resolveLength(
  lengthKey: unknown,
  targetWordCount: unknown,
  presets: typeof LENGTH_PRESETS
) {
  const key = String(lengthKey || "standard").toLowerCase();
  if (presets[key]) return presets[key];
  const n = Number(targetWordCount);
  if (Number.isFinite(n) && n >= 400 && n <= 3000) {
    return { label: "Custom", min: Math.max(400, n - 100), max: n + 100, target: Math.round(n) };
  }
  return presets.standard;
}

async function assertGhostWriterAccess(userId: string) {
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    return { ok: false as const, status: 404, error: "User not found." };
  }
  const userData = userSnap.data() || {};
  if (!isUserPremium(userData)) {
    return {
      ok: false as const,
      status: 403,
      error: "AI Ghost Writer requires an active subscription.",
      premiumRequired: true,
    };
  }
  const planId = String(userData.subscriptionPlan || "");
  const plan = planId ? await getPlanById(planId) : null;
  const allowedByPlan = plan ? plan.ghostWriter === true : Boolean(userData.isPremium);
  if (!allowedByPlan) {
    return {
      ok: false as const,
      status: 403,
      error: "Your plan does not include AI Ghost Writer.",
      premiumRequired: true,
    };
  }
  return { ok: true as const, userData };
}

async function buildProjectContext(userId: string, projectId?: string | null): Promise<string> {
  if (!projectId) return "";
  const db = getFirestore();
  const projectRef = db.collection("projects").doc(projectId);
  const snap = await projectRef.get();
  if (!snap.exists || snap.data()?.userId !== userId) return "";

  const chaptersSnap = await projectRef.collection("chapters").get();
  const chapters = chaptersSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), undefined, { numeric: true })
    );

  if (!chapters.length) return "";

  const recent = chapters.slice(-5);
  const parts = recent.map((ch, i) => {
    const plain = String(ch.content || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
    return `${i + 1}. ${ch.title || "Untitled"}: ${plain || "(empty)"}`;
  });

  return `Story so far (recent chapters/scenes for continuity):\n${parts.join("\n")}`;
}

async function callOpenAi(system: string, user: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.85,
  });
  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No content returned from OpenAI.");
  return {
    content,
    usage: completion.usage,
    model: completion.model || model,
  };
}

router.post(
  "/generateChapter",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const userId = req.user.uid;

      const access = await assertGhostWriterAccess(userId);
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          premiumRequired: access.premiumRequired === true,
        });
      }

      const {
        platform,
        genre,
        storyTitle,
        characters,
        chapterNumber,
        plotSummary,
        tone,
        length,
        targetWordCount,
        projectId,
        contextSummary,
        previousContent,
      } = req.body || {};

      const platformName = String(platform || "").trim();
      const genreName = String(genre || "").trim();
      const title = String(storyTitle || "").trim();
      const characterNames = normalizeCharacters(characters);
      const plot = String(plotSummary || "").trim();
      const toneName = String(tone || "Emotional").trim();
      const chapterNum = Math.max(1, Number(chapterNumber) || 1);
      const lengthPreset = resolveLength(length, targetWordCount, LENGTH_PRESETS);

      if (!platformName || !genreName || !title || !plot) {
        return res.status(400).json({
          error: "platform, genre, storyTitle, and plotSummary are required.",
        });
      }

      const autoContext = await buildProjectContext(userId, projectId || null);
      const continuity = [String(contextSummary || "").trim(), autoContext]
        .filter(Boolean)
        .join("\n\n");

      const systemPrompt = `You are an expert serialized fiction ghost writer for platforms like PocketFM, Dreame, GoodNovel, WebNovel, MegaNovel, AlphaNovel, Letterlux, Stary, and NovelSnack.
Write a complete, publishable chapter with platform-specific pacing, hooks, emotion, and a cliffhanger ending when appropriate.
Output ONLY the chapter prose (no markdown headings about word counts, no meta commentary).
Target length: ${lengthPreset.min}-${lengthPreset.max} words (aim ~${lengthPreset.target}).
Match the selected platform's house style and reader expectations.`;

      const userPrompt = [
        `Platform: ${platformName}`,
        `Genre: ${genreName}`,
        `Story title: ${title}`,
        `Chapter number: ${chapterNum}`,
        `Main characters: ${characterNames || "As needed for the plot"}`,
        `Tone: ${NOVEL_TONES.includes(toneName as (typeof NOVEL_TONES)[number]) ? toneName : toneName}`,
        `What should happen in this chapter:\n${plot}`,
        continuity ? `\nContinuity context:\n${continuity}` : "",
        previousContent
          ? `\nRewrite/regenerate. Improve this previous draft while keeping the same plot intent:\n${String(previousContent).slice(0, 6000)}`
          : "",
        `\nWrite Chapter ${chapterNum} now.`,
      ]
        .filter(Boolean)
        .join("\n");

      const result = await callOpenAi(systemPrompt, userPrompt);
      const wordCount = countWords(result.content);
      const tokensUsed = result.usage?.total_tokens || 0;

      const db = getFirestore();
      const sessionRef = db.collection("ghostWriterSessions").doc();
      const session = {
        id: sessionRef.id,
        userId,
        mode: "novel" as const,
        platform: platformName,
        genre: genreName,
        storyTitle: title,
        characters: characterNames,
        chapterNumber: chapterNum,
        plotSummary: plot,
        tone: toneName,
        targetWordCount: lengthPreset.target,
        lengthKey: String(length || "standard").toLowerCase(),
        projectId: projectId || null,
        generatedContent: result.content,
        wordCount,
        tokensUsed,
        accepted: false,
        savedToChapterId: null as string | null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await sessionRef.set(session);

      await recordAiUsage({
        userId,
        userEmail: access.userData.email || req.user.email || null,
        field: "ghostWriterCount",
        tool: "ghost-writer",
        wordsAnalyzed: wordCount,
        tokensUsed,
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        model: result.model,
        projectId: projectId || "",
        platform: platformName,
        genre: genreName,
        inputPreview: plot,
      });

      return res.json({
        sessionId: session.id,
        generatedContent: result.content,
        wordCount,
        tokensUsed,
      });
    } catch (error: any) {
      console.error("Ghost Writer generateChapter error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate chapter." });
    }
  }
);

router.post(
  "/generateScript",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const userId = req.user.uid;

      const access = await assertGhostWriterAccess(userId);
      if (!access.ok) {
        return res.status(access.status).json({
          error: access.error,
          premiumRequired: access.premiumRequired === true,
        });
      }

      const {
        format,
        genre,
        title,
        characters,
        sceneNumber,
        whatHappens,
        tone,
        length,
        targetWordCount,
        projectId,
        contextSummary,
        previousContent,
      } = req.body || {};

      const formatName = String(format || "Film").trim();
      const genreName = String(genre || "").trim();
      const scriptTitle = String(title || "").trim();
      const characterNames = normalizeCharacters(characters);
      const plot = String(whatHappens || "").trim();
      const toneName = String(tone || "Dramatic").trim();
      const sceneNum = Math.max(1, Number(sceneNumber) || 1);
      const lengthPreset = resolveLength(length, targetWordCount, SCRIPT_LENGTH_PRESETS);

      if (!genreName || !scriptTitle || !plot) {
        return res.status(400).json({
          error: "genre, title, and whatHappens are required.",
        });
      }

      const autoContext = await buildProjectContext(userId, projectId || null);
      const continuity = [String(contextSummary || "").trim(), autoContext]
        .filter(Boolean)
        .join("\n\n");

      const systemPrompt = `You are an expert professional screenwriter for Film, TV, and Audio drama (including Nollywood and serialized audio formats).
Write a complete, usable screenplay scene/block in proper format:
- Scene headings (INT./EXT.)
- Action lines
- Character cues
- Dialogue
- Parentheticals when needed
Output ONLY the screenplay text (no markdown fences, no commentary).
Target length: roughly ${lengthPreset.min}-${lengthPreset.max} words (aim ~${lengthPreset.target}).`;

      const userPrompt = [
        `Format: ${formatName}`,
        `Genre: ${genreName}`,
        `Title: ${scriptTitle}`,
        `Scene number: ${sceneNum}`,
        `Characters: ${characterNames || "As needed for the scene"}`,
        `Tone: ${toneName}`,
        `What should happen in this scene:\n${plot}`,
        continuity ? `\nContinuity context:\n${continuity}` : "",
        previousContent
          ? `\nRewrite/regenerate. Improve this previous draft while keeping the same intent:\n${String(previousContent).slice(0, 6000)}`
          : "",
        `\nWrite Scene ${sceneNum} now.`,
      ]
        .filter(Boolean)
        .join("\n");

      const result = await callOpenAi(systemPrompt, userPrompt);
      const wordCount = countWords(result.content);
      const tokensUsed = result.usage?.total_tokens || 0;

      const db = getFirestore();
      const sessionRef = db.collection("ghostWriterSessions").doc();
      const session = {
        id: sessionRef.id,
        userId,
        mode: "script" as const,
        format: formatName,
        genre: genreName,
        storyTitle: scriptTitle,
        characters: characterNames,
        chapterNumber: sceneNum,
        plotSummary: plot,
        tone: toneName,
        targetWordCount: lengthPreset.target,
        lengthKey: String(length || "standard").toLowerCase(),
        projectId: projectId || null,
        generatedContent: result.content,
        wordCount,
        tokensUsed,
        accepted: false,
        savedToChapterId: null as string | null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await sessionRef.set(session);

      await recordAiUsage({
        userId,
        userEmail: access.userData.email || req.user.email || null,
        field: "ghostWriterCount",
        tool: "ghost-writer",
        wordsAnalyzed: wordCount,
        tokensUsed,
        promptTokens: result.usage?.prompt_tokens || 0,
        completionTokens: result.usage?.completion_tokens || 0,
        model: result.model,
        projectId: projectId || "",
        platform: formatName,
        genre: genreName,
        inputPreview: plot,
      });

      return res.json({
        sessionId: session.id,
        generatedContent: result.content,
        wordCount,
        tokensUsed,
      });
    } catch (error: any) {
      console.error("Ghost Writer generateScript error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate script." });
    }
  }
);

router.post(
  "/sessions/:sessionId/save",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      const userId = req.user.uid;
      const sessionId = String(req.params.sessionId || "");
      const { projectId, chapterId, title, content } = req.body || {};

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required." });
      }

      const db = getFirestore();
      const sessionRef = db.collection("ghostWriterSessions").doc(sessionId);
      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) {
        return res.status(404).json({ error: "Session not found." });
      }
      const session = sessionSnap.data() || {};
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized access to session." });
      }

      const projectRef = db.collection("projects").doc(String(projectId));
      const projectSnap = await projectRef.get();
      if (!projectSnap.exists || projectSnap.data()?.userId !== userId) {
        return res.status(404).json({ error: "Project not found or unauthorized." });
      }

      const project = projectSnap.data() || {};
      const mode = session.mode === "script" ? "script" : "novel";
      if (project.type && project.type !== mode) {
        return res.status(400).json({
          error: `This session is for a ${mode} project. Selected project is type "${project.type}".`,
        });
      }

      const finalContent = String(
        content !== undefined && content !== null ? content : session.generatedContent || ""
      ).trim();
      if (!finalContent) {
        return res.status(400).json({ error: "No content to save." });
      }

      const wordCount = countWords(finalContent);
      const defaultTitle =
        mode === "script"
          ? `Scene ${session.chapterNumber || 1}`
          : `Chapter ${session.chapterNumber || 1}`;
      const chapterTitle = String(title || defaultTitle).trim() || defaultTitle;

      const normalizeTitle = (value: string) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/^(chapter|scene)\s*0*(\d+)\b/i, (_, kind, num) => `${kind} ${Number(num)}`);

      // Store as HTML paragraphs for the editors
      const htmlContent = finalContent.includes("<")
        ? finalContent
        : finalContent
            .split(/\n{2,}/)
            .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
            .join("");

      let savedChapterId = chapterId ? String(chapterId) : "";
      let savedChapter: Record<string, unknown>;

      // If no explicit chapterId, reuse existing Chapter/Scene with the same title
      if (!savedChapterId) {
        const chaptersSnap = await projectRef.collection("chapters").get();
        const targetNorm = normalizeTitle(chapterTitle);
        const matches = chaptersSnap.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
          .filter((ch) => normalizeTitle(String(ch.title || "")) === targetNorm)
          .sort((a, b) => Number(b.wordCount || 0) - Number(a.wordCount || 0));
        if (matches[0]) {
          savedChapterId = matches[0].id;
        }
      }

      if (savedChapterId) {
        const chapterRef = projectRef.collection("chapters").doc(savedChapterId);
        const chapSnap = await chapterRef.get();
        if (!chapSnap.exists) {
          return res.status(404).json({ error: "Chapter not found." });
        }
        const oldWords = Number(chapSnap.data()?.wordCount || 0);
        savedChapter = {
          title: chapterTitle,
          content: htmlContent,
          wordCount,
          lastSavedAt: new Date().toISOString(),
        };
        await chapterRef.update(savedChapter);
        const delta = wordCount - oldWords;
        await projectRef.update({
          wordCount: Math.max(0, Number(project.wordCount || 0) + delta),
          updatedAt: new Date().toISOString(),
        });
        savedChapter = { id: savedChapterId, ...savedChapter };
      } else {
        const newChapterRef = projectRef.collection("chapters").doc();
        savedChapterId = newChapterRef.id;
        savedChapter = {
          id: savedChapterId,
          title: chapterTitle,
          content: htmlContent,
          wordCount,
          lastSavedAt: new Date().toISOString(),
        };
        await newChapterRef.set(savedChapter);
        await projectRef.update({
          chapterCount: Number(project.chapterCount || 0) + 1,
          wordCount: Number(project.wordCount || 0) + wordCount,
          updatedAt: new Date().toISOString(),
        });
      }

      await sessionRef.update({
        accepted: true,
        savedToChapterId: savedChapterId,
        projectId: String(projectId),
        generatedContent: finalContent,
        wordCount,
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        message: "Saved to project successfully.",
        projectId: String(projectId),
        chapterId: savedChapterId,
        chapter: savedChapter,
        mode,
      });
    } catch (error: any) {
      console.error("Ghost Writer save error:", error);
      return res.status(500).json({ error: error.message || "Failed to save session." });
    }
  }
);

export default router;
