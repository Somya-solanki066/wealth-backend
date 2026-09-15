import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getOpenAiModel } from "../utils/catalog";
import { isUserPremium } from "../utils/plans";
import { countWords, recordAiUsage } from "../utils/aiUsage";
import {
  chargeAiCredits,
  creditErrorBody,
  finalizeAiCredits,
  refundAiCredits,
} from "../services/aiCredits.service";

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

async function requirePremiumAndCredits(
  req: AuthenticatedRequest,
  res: express.Response,
  tool: WealthTool,
  inputChars = 0
) {
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
  const charged = await chargeAiCredits({
    userId: req.user.uid,
    toolId: tool,
    inputChars,
  });
  if (!charged.ok) {
    res.status(charged.status).json(creditErrorBody(charged));
    return null;
  }
  return charged;
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

async function runWealthTool(
  req: AuthenticatedRequest,
  res: express.Response,
  tool: WealthTool,
  inputChars: number,
  system: string,
  userPrompt: string,
  preview: string,
  responseTool: string
) {
  const charged = await requirePremiumAndCredits(req, res, tool, inputChars);
  if (!charged || !req.user) return;

  try {
    const result = await callTextOpenAi(system, userPrompt);
    await logWealthUsage(req, tool, preview, result.usage, result.model);
    await finalizeAiCredits({
      requestId: charged.reservation.requestId,
      userId: req.user.uid,
      status: "success",
      provider: "openai",
      model: result.model,
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
    });
    return res.json({
      content: result.content,
      tool: responseTool,
      creditsCharged: charged.featureCreditCost,
      creditsRemaining: charged.reservation.balanceAfter,
    });
  } catch (error: any) {
    await refundAiCredits({
      requestId: charged.reservation.requestId,
      userId: req.user.uid,
      reason: error?.message || "wealth_tool_failed",
    });
    throw error;
  }
}

router.use(verifyFirebaseToken);

router.post("/tools/blurb", async (req: AuthenticatedRequest, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const genre = String(req.body?.genre || "").trim();
    const synopsis = String(req.body?.synopsis || "").trim();
    const style = String(req.body?.style || "Back cover (150 words)").trim();
    if (!title || synopsis.length < 20) {
      return res.status(400).json({ error: "Title and a short synopsis are required." });
    }
    await runWealthTool(
      req,
      res,
      "book-blurb",
      synopsis.length,
      "You are an expert book marketing copywriter for serialized fiction and indie authors. Write compelling blurbs that sell. No spoilers beyond the setup. Output plain text only.",
      `Book title: ${title}\nGenre: ${genre || "Fiction"}\nStyle/length: ${style}\nStory synopsis:\n${synopsis}\n\nWrite the blurb now.`,
      `${title} ${synopsis}`,
      "blurb"
    );
  } catch (error: any) {
    console.error("Blurb tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate blurb." });
  }
});

router.post("/tools/bio", async (req: AuthenticatedRequest, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const genres = String(req.body?.genres || "").trim();
    const achievements = String(req.body?.achievements || "").trim();
    const length = String(req.body?.length || "Medium (100 words)").trim();
    if (!name) return res.status(400).json({ error: "Name is required." });
    await runWealthTool(
      req,
      res,
      "author-bio",
      name.length + genres.length,
      "You write professional author bios for press kits, Amazon Author Central, and platform profiles. Third person. Warm, credible, no hype. Plain text only.",
      `Pen name: ${name}\nGenres: ${genres || "Fiction"}\nAchievements: ${achievements || "Emerging author"}\nLength: ${length}\n\nWrite the author bio.`,
      `${name} ${genres}`,
      "bio"
    );
  } catch (error: any) {
    console.error("Bio tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate bio." });
  }
});

router.post("/tools/press", async (req: AuthenticatedRequest, res) => {
  try {
    const announcementType = String(req.body?.announcementType || "New book launch").trim();
    const title = String(req.body?.title || "").trim();
    const details = String(req.body?.details || "").trim();
    if (!title || details.length < 15) {
      return res.status(400).json({ error: "Title and key details are required." });
    }
    await runWealthTool(
      req,
      res,
      "press-release",
      details.length,
      "You write professional press releases for authors and publishers. Use AP-style structure: headline, dateline, lead, body, boilerplate. Plain text only.",
      `Announcement type: ${announcementType}\nTitle: ${title}\nKey details:\n${details}\n\nWrite the full press release.`,
      `${title} ${details}`,
      "press"
    );
  } catch (error: any) {
    console.error("Press tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate press release." });
  }
});

router.post("/tools/pitch-deck", async (req: AuthenticatedRequest, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const pitchingTo = String(req.body?.pitchingTo || "Book publisher").trim();
    const logline = String(req.body?.logline || "").trim();
    if (!title || logline.length < 10) {
      return res.status(400).json({ error: "Title and logline are required." });
    }
    await runWealthTool(
      req,
      res,
      "pitch-deck",
      logline.length,
      "You build text-based pitch decks for novels and screenplays. Structure as labeled slides: Title, Logline, Synopsis, Comparable Titles, Audience, Why Now, Ask. Concise and professional. Plain text only.",
      `Project: ${title}\nPitching to: ${pitchingTo}\nLogline: ${logline}\n\nBuild the pitch deck outline with slide content.`,
      `${title} ${logline}`,
      "pitch-deck"
    );
  } catch (error: any) {
    console.error("Pitch deck tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to build pitch deck." });
  }
});

router.post("/tools/booktok", async (req: AuthenticatedRequest, res) => {
  try {
    const hook = String(req.body?.hook || "").trim();
    const title = String(req.body?.title || "").trim();
    if (hook.length < 10) {
      return res.status(400).json({ error: "Paste a dramatic line or scene (min 10 chars)." });
    }
    await runWealthTool(
      req,
      res,
      "booktok-hook",
      hook.length,
      "You write TikTok #BookTok hook scripts for authors. Include: on-screen text cues, spoken lines, timing beats (~15-30s), CTA, and hashtag set. Plain text only.",
      `Book title: ${title || "Untitled"}\nDramatic line/scene:\n${hook}\n\nGenerate a BookTok hook script.`,
      hook,
      "booktok"
    );
  } catch (error: any) {
    console.error("BookTok tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate BookTok script." });
  }
});

router.post("/tools/medium", async (req: AuthenticatedRequest, res) => {
  try {
    const topic = String(req.body?.topic || "").trim();
    if (topic.length < 8) {
      return res.status(400).json({ error: "Article topic is required." });
    }
    await runWealthTool(
      req,
      res,
      "medium-outline",
      topic.length,
      "You outline Medium articles that funnel readers to an author's fiction. Include title options, outline with H2s, CTA ending linking to Chapter 1. Plain text only.",
      `Topic: ${topic}\n\nGenerate a Medium article outline with a traffic-to-fiction CTA.`,
      topic,
      "medium"
    );
  } catch (error: any) {
    console.error("Medium tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate outline." });
  }
});

router.post("/tools/query", async (req: AuthenticatedRequest, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const genre = String(req.body?.genre || "").trim();
    const wordCount = String(req.body?.wordCount || "").trim();
    const synopsis = String(req.body?.synopsis || "").trim();
    const comps = String(req.body?.comps || "").trim();
    const bio = String(req.body?.bio || "").trim();
    if (!title || synopsis.length < 40) {
      return res.status(400).json({ error: "Title and synopsis (40+ chars) are required." });
    }
    await runWealthTool(
      req,
      res,
      "query-letter",
      synopsis.length,
      "You write literary agent query packages: personalized query letter, 1-page synopsis, and short bio. Professional US market standards. Plain text with clear section headers.",
      `Title: ${title}\nGenre: ${genre || "Fiction"}\nWord count: ${wordCount || "N/A"}\nComparable titles: ${comps || "N/A"}\nAuthor bio notes: ${bio || "N/A"}\nSynopsis:\n${synopsis}\n\nProduce the full submission package.`,
      `${title} ${synopsis}`,
      "query"
    );
  } catch (error: any) {
    console.error("Query tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to build query letter." });
  }
});

router.post("/tools/social", async (req: AuthenticatedRequest, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const genre = String(req.body?.genre || "").trim();
    const hook = String(req.body?.hook || "").trim();
    const platforms = String(req.body?.platforms || "TikTok, Instagram, Twitter/X, Facebook").trim();
    if (!title || hook.length < 10) {
      return res.status(400).json({ error: "Title and a short hook are required." });
    }
    await runWealthTool(
      req,
      res,
      "social-kit",
      hook.length,
      "You create ready-to-post social media kits for book launches. For each platform: caption, hashtags, and posting tip. Plain text with clear sections.",
      `Book: ${title}\nGenre: ${genre || "Fiction"}\nHook: ${hook}\nPlatforms: ${platforms}\n\nGenerate the social media kit.`,
      `${title} ${hook}`,
      "social"
    );
  } catch (error: any) {
    console.error("Social kit tool error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate social kit." });
  }
});

export default router;
