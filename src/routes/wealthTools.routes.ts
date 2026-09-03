import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getOpenAiModel } from "../utils/catalog";
import { isUserPremium } from "../utils/plans";
import { countWords, recordAiUsage } from "../utils/aiUsage";

dotenv.config();

const router = express.Router();

type WealthTool =
  | "book-blurb"
  | "author-bio"
  | "press-release"
  | "pitch-deck"
  | "booktok-hook"
  | "medium-outline"
  | "query-letter"
  | "social-kit";

async function callTextOpenAi(system: string, user: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.75,
  });
  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No content returned from OpenAI.");
  return {
    content,
    usage: completion.usage,
    model: completion.model || model,
  };
}

async function requirePremium(req: AuthenticatedRequest, res: express.Response) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(req.user.uid).get();
  if (!isUserPremium(userSnap.data())) {
    res.status(403).json({
      error: "Premium required for WEALTH AI tools.",
      premiumRequired: true,
    });
    return null;
  }
  return userSnap.data() || {};
}

async function logWealthUsage(
  req: AuthenticatedRequest,
  tool: WealthTool,
  preview: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  model?: string
) {
  if (!req.user) return;
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(req.user.uid).get();
  await recordAiUsage({
    userId: req.user.uid,
    userEmail: userSnap.data()?.email || req.user.email || null,
    field: "wealthEngineCount",
    tool,
    wordsAnalyzed: countWords(preview),
    tokensUsed: usage?.total_tokens || 0,
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
    model: model || "",
    inputPreview: preview.slice(0, 400),
  });
}

router.use(verifyFirebaseToken);

/** POST /api/wealth/tools/blurb */
router.post("/tools/blurb", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const title = String(req.body?.title || "").trim();
    const genre = String(req.body?.genre || "").trim();
    const synopsis = String(req.body?.synopsis || "").trim();
    const style = String(req.body?.style || "Back cover (150 words)").trim();
    if (!title || synopsis.length < 20) {
      return res.status(400).json({ error: "Title and a short synopsis are required." });
    }
    const system =
      "You are an expert book marketing copywriter for serialized fiction and indie authors. Write compelling blurbs that sell. No spoilers beyond the setup. Output plain text only.";
    const user = `Book title: ${title}\nGenre: ${genre || "Fiction"}\nStyle/length: ${style}\nStory synopsis:\n${synopsis}\n\nWrite the blurb now.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "book-blurb", `${title} ${synopsis}`, result.usage, result.model);
    return res.json({ content: result.content, tool: "blurb" });
  } catch (error: any) {
    console.error("Blurb tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate blurb." });
  }
});

/** POST /api/wealth/tools/bio */
router.post("/tools/bio", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const name = String(req.body?.name || "").trim();
    const genres = String(req.body?.genres || "").trim();
    const achievements = String(req.body?.achievements || "").trim();
    const length = String(req.body?.length || "Medium (100 words)").trim();
    if (!name) return res.status(400).json({ error: "Name is required." });
    const system =
      "You write professional author bios for press kits, Amazon Author Central, and platform profiles. Third person. Warm, credible, no hype. Plain text only.";
    const user = `Pen name: ${name}\nGenres: ${genres || "Fiction"}\nAchievements: ${achievements || "Emerging author"}\nLength: ${length}\n\nWrite the author bio.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "author-bio", `${name} ${genres}`, result.usage, result.model);
    return res.json({ content: result.content, tool: "bio" });
  } catch (error: any) {
    console.error("Bio tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate bio." });
  }
});

/** POST /api/wealth/tools/press */
router.post("/tools/press", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const announcementType = String(req.body?.announcementType || "New book launch").trim();
    const title = String(req.body?.title || "").trim();
    const details = String(req.body?.details || "").trim();
    if (!title || details.length < 15) {
      return res.status(400).json({ error: "Title and key details are required." });
    }
    const system =
      "You write professional press releases for authors and publishers. Use AP-style structure: headline, dateline, lead, body, boilerplate. Plain text only.";
    const user = `Announcement type: ${announcementType}\nTitle: ${title}\nKey details:\n${details}\n\nWrite the full press release.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "press-release", `${title} ${details}`, result.usage, result.model);
    return res.json({ content: result.content, tool: "press" });
  } catch (error: any) {
    console.error("Press tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate press release." });
  }
});

/** POST /api/wealth/tools/pitch-deck */
router.post("/tools/pitch-deck", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const title = String(req.body?.title || "").trim();
    const pitchingTo = String(req.body?.pitchingTo || "Book publisher").trim();
    const logline = String(req.body?.logline || "").trim();
    if (!title || logline.length < 10) {
      return res.status(400).json({ error: "Title and logline are required." });
    }
    const system =
      "You build text-based pitch decks for novels and screenplays. Structure as labeled slides: Title, Logline, Synopsis, Comparable Titles, Audience, Why Now, Ask. Concise and professional. Plain text only.";
    const user = `Project: ${title}\nPitching to: ${pitchingTo}\nLogline: ${logline}\n\nBuild the pitch deck outline with slide content.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "pitch-deck", `${title} ${logline}`, result.usage, result.model);
    return res.json({ content: result.content, tool: "pitch-deck" });
  } catch (error: any) {
    console.error("Pitch deck tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to build pitch deck." });
  }
});

/** POST /api/wealth/tools/booktok */
router.post("/tools/booktok", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const hook = String(req.body?.hook || "").trim();
    const title = String(req.body?.title || "").trim();
    if (hook.length < 10) {
      return res.status(400).json({ error: "Paste a dramatic line or scene (min 10 chars)." });
    }
    const system =
      "You write TikTok #BookTok hook scripts for authors. Include: on-screen text cues, spoken lines, timing beats (~15-30s), CTA, and hashtag set. Plain text only.";
    const user = `Book title: ${title || "Untitled"}\nDramatic line/scene:\n${hook}\n\nGenerate a BookTok hook script.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "booktok-hook", hook, result.usage, result.model);
    return res.json({ content: result.content, tool: "booktok" });
  } catch (error: any) {
    console.error("BookTok tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate BookTok script." });
  }
});

/** POST /api/wealth/tools/medium */
router.post("/tools/medium", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const topic = String(req.body?.topic || "").trim();
    if (topic.length < 8) {
      return res.status(400).json({ error: "Article topic is required." });
    }
    const system =
      "You outline Medium articles that funnel readers to an author's fiction. Include title options, outline with H2s, CTA ending linking to Chapter 1. Plain text only.";
    const user = `Topic: ${topic}\n\nGenerate a Medium article outline with a traffic-to-fiction CTA.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "medium-outline", topic, result.usage, result.model);
    return res.json({ content: result.content, tool: "medium" });
  } catch (error: any) {
    console.error("Medium tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate outline." });
  }
});

/** POST /api/wealth/tools/query */
router.post("/tools/query", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const title = String(req.body?.title || "").trim();
    const genre = String(req.body?.genre || "").trim();
    const wordCount = String(req.body?.wordCount || "").trim();
    const synopsis = String(req.body?.synopsis || "").trim();
    const comps = String(req.body?.comps || "").trim();
    const bio = String(req.body?.bio || "").trim();
    if (!title || synopsis.length < 40) {
      return res.status(400).json({ error: "Title and synopsis (40+ chars) are required." });
    }
    const system =
      "You write literary agent query packages: personalized query letter, 1-page synopsis, and short bio. Professional US market standards. Plain text with clear section headers.";
    const user = `Title: ${title}\nGenre: ${genre || "Fiction"}\nWord count: ${wordCount || "N/A"}\nComparable titles: ${comps || "N/A"}\nAuthor bio notes: ${bio || "N/A"}\nSynopsis:\n${synopsis}\n\nProduce the full submission package.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "query-letter", `${title} ${synopsis}`, result.usage, result.model);
    return res.json({ content: result.content, tool: "query" });
  } catch (error: any) {
    console.error("Query tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to build query letter." });
  }
});

/** POST /api/wealth/tools/social */
router.post("/tools/social", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const title = String(req.body?.title || "").trim();
    const genre = String(req.body?.genre || "").trim();
    const hook = String(req.body?.hook || "").trim();
    const platforms = String(req.body?.platforms || "TikTok, Instagram, Twitter/X, Facebook").trim();
    if (!title || hook.length < 10) {
      return res.status(400).json({ error: "Title and a short hook are required." });
    }
    const system =
      "You create ready-to-post social media kits for book launches. For each platform: caption, hashtags, and posting tip. Plain text with clear sections.";
    const user = `Book: ${title}\nGenre: ${genre || "Fiction"}\nHook: ${hook}\nPlatforms: ${platforms}\n\nGenerate the social media kit.`;
    const result = await callTextOpenAi(system, user);
    await logWealthUsage(req, "social-kit", `${title} ${hook}`, result.usage, result.model);
    return res.json({ content: result.content, tool: "social" });
  } catch (error: any) {
    console.error("Social kit tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate social kit." });
  }
});

export default router;
