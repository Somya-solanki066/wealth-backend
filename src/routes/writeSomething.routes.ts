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

const FORMATS = ["blog", "social", "newsletter", "memo", "ugc"] as const;
type FormatId = (typeof FORMATS)[number];

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
  const snap = await getFirestore().collection("users").doc(req.user.uid).get();
  if (!isUserPremium(snap.data())) {
    res.status(403).json({
      error: "Premium required for Write Something AI.",
      premiumRequired: true,
    });
    return null;
  }
  return snap.data() || {};
}

function formatLabel(id: string) {
  const map: Record<string, string> = {
    blog: "Blog / Article",
    social: "Social Post",
    newsletter: "Newsletter / Email",
    memo: "Business Memo",
    ugc: "UGC Script",
  };
  return map[id] || id;
}

function briefBlock(body: any) {
  const lines = Object.entries(body || {})
    .filter(([k, v]) => k !== "mode" && k !== "previous" && k !== "action" && v != null && String(v).trim())
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  return lines.join("\n");
}

router.use(verifyFirebaseToken);

router.post("/structure", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const format = String(req.body?.format || "").toLowerCase() as FormatId;
    if (!FORMATS.includes(format)) {
      return res.status(400).json({ error: "Valid format is required." });
    }
    const brief = briefBlock(req.body?.brief || req.body);
    const system =
      "You create practical writing outlines for content creators and freelancers. Output plain text with a short title line, then 4–7 numbered outline beats, then a final line starting with 'Target length:' and a realistic range. No markdown fences.";
    const user = `Format: ${formatLabel(format)}\nBrief:\n${brief || "General piece"}\n\nGenerate a format-specific structure/outline the writer can follow.`;
    const result = await callTextOpenAi(system, user);
    await recordAiUsage({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      field: "wealthEngineCount",
      tool: "write-something",
      wordsAnalyzed: countWords(brief),
      tokensUsed: result.usage?.total_tokens || 0,
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      model: result.model,
      inputPreview: brief.slice(0, 200),
    });
    return res.json({ content: result.content, format });
  } catch (error: any) {
    console.error("Write-something structure error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate structure." });
  }
});

router.post("/draft", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const format = String(req.body?.format || "").toLowerCase() as FormatId;
    if (!FORMATS.includes(format)) {
      return res.status(400).json({ error: "Valid format is required." });
    }
    const brief = briefBlock(req.body?.brief || {});
    const structure = String(req.body?.structure || "").trim();
    const system =
      "You write polished first drafts for freelancers and content writers. Match the requested format exactly. Plain text only — no markdown fences unless the format needs simple headings.";
    const user = `Format: ${formatLabel(format)}\nBrief:\n${brief}\n\nApproved structure:\n${structure || "Use a strong default structure for this format."}\n\nWrite the full draft now.`;
    const result = await callTextOpenAi(system, user);
    await recordAiUsage({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      field: "wealthEngineCount",
      tool: "write-something",
      wordsAnalyzed: countWords(brief + structure),
      tokensUsed: result.usage?.total_tokens || 0,
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      model: result.model,
      inputPreview: brief.slice(0, 200),
    });
    return res.json({ content: result.content, format });
  } catch (error: any) {
    console.error("Write-something draft error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate draft." });
  }
});

router.post("/edit", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const action = String(req.body?.action || "rewrite").toLowerCase();
    const draft = String(req.body?.draft || "").trim();
    const format = String(req.body?.format || "blog");
    const tone = String(req.body?.tone || "").trim();
    if (draft.length < 20) {
      return res.status(400).json({ error: "Draft text is required." });
    }
    const actionPrompt: Record<string, string> = {
      rewrite: "Rewrite for clarity and punch while keeping meaning.",
      expand: "Expand with useful detail and smoother transitions. Keep the same format.",
      shorten: "Tighten aggressively. Cut fluff. Keep the core message.",
      tone: `Change the tone to: ${tone || "professional but warm"}. Keep facts.`,
      grammar: "Fix grammar, spelling, and punctuation. Light polish only — do not change voice much.",
      continue: "Continue writing from where this draft ends. Match style and finish the piece.",
      seo: "Improve SEO: clearer headings if useful, natural keyword use, stronger intro and close. Keep readable.",
      alternatives: "Produce 3 alternative shorter versions labeled Version A/B/C.",
    };
    const instruction = actionPrompt[action] || actionPrompt.rewrite;
    const system =
      "You are an expert editor for content writers and freelancers. Return only the edited text (or labeled alternatives). Plain text.";
    const user = `Format: ${formatLabel(format)}\nAction: ${instruction}\n\nDraft:\n${draft}`;
    const result = await callTextOpenAi(system, user);
    await recordAiUsage({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      field: "wealthEngineCount",
      tool: "write-something",
      wordsAnalyzed: countWords(draft),
      tokensUsed: result.usage?.total_tokens || 0,
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      model: result.model,
      inputPreview: draft.slice(0, 200),
    });
    return res.json({ content: result.content, action });
  } catch (error: any) {
    console.error("Write-something edit error:", error);
    return res.status(500).json({ error: error.message || "Failed to edit draft." });
  }
});

/** Brief Builder — structure a client ask without inventing missing facts */
router.post("/brief", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const clientAsk = String(req.body?.clientAsk || "").trim();
    const budget = String(req.body?.budget || "").trim();
    if (clientAsk.length < 10) {
      return res.status(400).json({ error: "Paste what the client asked for (at least a short sentence)." });
    }

    const system = `You convert messy client requests into a WORKING BRIEF for freelance writers.
CRITICAL RULES:
- Never invent facts that were not stated or clearly implied.
- If something is unknown, use exactly "Not specified" or list it under missingInformation.
- You MAY lightly infer content type (e.g. blog) when the ask clearly says "blog posts".
- Do NOT invent audience, word count, deadline, CTA, platform, or keywords unless stated.
- status must be "Ready" only if deliverables + topic + tone are clear; otherwise "Needs clarification".
Return ONLY valid JSON with this shape:
{
  "project": string,
  "deliverables": string,
  "contentType": string,
  "topic": string,
  "tone": string,
  "seo": string,
  "quantity": string,
  "budget": string,
  "budgetMonthly": string,
  "targetAudience": string,
  "wordCount": string,
  "deadline": string,
  "cta": string,
  "platform": string,
  "keywords": string,
  "keyPoints": string[],
  "missingInformation": string[],
  "status": "Ready" | "Needs clarification",
  "plainText": string
}
plainText should be a clean WORKING BRIEF the writer can copy.`;

    const user = `Client ask:\n${clientAsk}\n\nBudget/rate mentioned:\n${budget || "Not provided"}\n\nProduce the JSON brief now.`;
    const result = await callTextOpenAi(system, user);

    let parsed: any = null;
    try {
      const cleaned = result.content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed !== "object") {
      // Fallback structured brief without inventing
      parsed = {
        project: "Client content request",
        deliverables: "Not specified",
        contentType: "Not specified",
        topic: "Not specified",
        tone: "Not specified",
        seo: "Not specified",
        quantity: "Not specified",
        budget: budget || "Not specified",
        budgetMonthly: "Not specified",
        targetAudience: "Not specified",
        wordCount: "Not specified",
        deadline: "Not specified",
        cta: "Not specified",
        platform: "Not specified",
        keywords: "Not specified",
        keyPoints: [],
        missingInformation: [
          "Could not parse AI response — review client ask manually",
          "Required word count?",
          "Target audience?",
          "Primary keywords?",
          "Publishing platform?",
          "Individual deadlines?",
        ],
        status: "Needs clarification",
        plainText: result.content,
      };
    }

    if (budget && (!parsed.budget || parsed.budget === "Not specified")) {
      parsed.budget = budget;
    }

    await recordAiUsage({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      field: "wealthEngineCount",
      tool: "write-something",
      wordsAnalyzed: countWords(clientAsk),
      tokensUsed: result.usage?.total_tokens || 0,
      promptTokens: result.usage?.prompt_tokens || 0,
      completionTokens: result.usage?.completion_tokens || 0,
      model: result.model,
      inputPreview: clientAsk.slice(0, 200),
    });

    return res.json({ brief: parsed, raw: result.content });
  } catch (error: any) {
    console.error("Brief builder error:", error);
    return res.status(500).json({ error: error.message || "Failed to build brief." });
  }
});

export default router;
