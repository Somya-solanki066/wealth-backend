import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const EXPLAINER_AUDIENCES = [
  "beginners",
  "web3-beginners",
  "intermediate",
  "developers",
  "investors",
  "general-tech",
] as const;
export type ExplainerAudience = (typeof EXPLAINER_AUDIENCES)[number];

export const EXPLAINER_GOALS = [
  "educational",
  "project-overview",
  "docs",
  "blog",
  "marketing",
] as const;
export type ExplainerGoal = (typeof EXPLAINER_GOALS)[number];

export const EXPLAINER_TONES = [
  "simple",
  "professional",
  "conversational",
  "technical",
  "persuasive",
] as const;
export type ExplainerTone = (typeof EXPLAINER_TONES)[number];

export const EXPLAINER_LENGTHS = ["short", "standard", "long"] as const;
export type ExplainerLength = (typeof EXPLAINER_LENGTHS)[number];

export type ExplainerDraft = {
  id?: string;
  userId?: string;
  topic: string;
  audience: ExplainerAudience;
  goal: ExplainerGoal;
  tone: ExplainerTone;
  length: ExplainerLength;
  references?: string;
  outline: string[];
  title: string;
  body: string;
  wordCount: number;
  createdAt?: string;
  updatedAt?: string;
};

const AUDIENCE_GUIDE: Record<ExplainerAudience, string> = {
  beginners: "total beginners — no jargon without a plain-English definition",
  "web3-beginners": "people new to Web3 who know basic internet/tech",
  intermediate: "readers who know wallets, tokens, and common protocols",
  developers: "developers — accurate technical language is OK",
  investors: "investors and founders — focus on risk, value, and how it works in practice",
  "general-tech": "general tech audience — clear, practical, lightly technical",
};

const GOAL_GUIDE: Record<ExplainerGoal, string> = {
  educational: "educational explainer that teaches the concept clearly",
  "project-overview": "project overview for a Web3 product/protocol",
  docs: "documentation-style guide for users",
  blog: "blog article suitable for a project blog or Medium",
  marketing: "marketing / landing-page friendly explainer (accurate, not hype)",
};

const TONE_GUIDE: Record<ExplainerTone, string> = {
  simple: "simple and educational",
  professional: "professional and clear",
  conversational: "conversational and approachable",
  technical: "technical and precise",
  persuasive: "persuasive but honest — no false claims",
};

const LENGTH_GUIDE: Record<ExplainerLength, string> = {
  short: "500–800 words",
  standard: "1,000–1,500 words",
  long: "2,000–3,000 words",
};

function draftsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("web3ExplainerDrafts");
}

async function callOpenAi(system: string, user: string, temperature = 0.7) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
  });
  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No content returned from OpenAI.");
  return { content, usage: completion.usage, model: completion.model || model };
}

function normalizeEnums(input: {
  audience?: string;
  goal?: string;
  tone?: string;
  length?: string;
}) {
  const audience = (EXPLAINER_AUDIENCES as readonly string[]).includes(String(input.audience || ""))
    ? (input.audience as ExplainerAudience)
    : "beginners";
  const goal = (EXPLAINER_GOALS as readonly string[]).includes(String(input.goal || ""))
    ? (input.goal as ExplainerGoal)
    : "educational";
  const tone = (EXPLAINER_TONES as readonly string[]).includes(String(input.tone || ""))
    ? (input.tone as ExplainerTone)
    : "simple";
  const length = (EXPLAINER_LENGTHS as readonly string[]).includes(String(input.length || ""))
    ? (input.length as ExplainerLength)
    : "standard";
  return { audience, goal, tone, length };
}

function parseOutline(content: string): { title: string; outline: string[] } {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let title = "Explainer Outline";
  const outline: string[] = [];
  for (const line of lines) {
    if (/^title\s*:/i.test(line)) {
      title = line.replace(/^title\s*:/i, "").trim() || title;
      continue;
    }
    const m = line.match(/^\d+[\.\)]\s*(.+)$/);
    if (m) outline.push(m[1].trim());
    else if (/^[-•]\s*/.test(line)) outline.push(line.replace(/^[-•]\s*/, "").trim());
  }
  if (!outline.length) {
    return {
      title,
      outline: lines.filter((l) => !/^title\s*:/i.test(l)).slice(0, 10),
    };
  }
  return { title, outline };
}

export async function generateExplainerOutline(input: {
  userId: string;
  userEmail?: string | null;
  topic: string;
  audience?: string;
  goal?: string;
  tone?: string;
  length?: string;
  references?: string;
}) {
  const topic = String(input.topic || "").trim();
  if (topic.length < 2) {
    throw Object.assign(new Error("Enter a technical concept to explain."), { status: 400 });
  }
  const { audience, goal, tone, length } = normalizeEnums(input);
  const references = String(input.references || "").trim();

  const system = [
    "You outline plain-English Web3 explainer articles.",
    "CRITICAL: Do NOT invent protocol facts, tokenomics, fees, roadmaps, or security claims.",
    "If reference material is provided, treat it as the source of truth for project-specific facts.",
    "If something is unknown, leave it out of the outline or mark as 'to verify' — do not fabricate.",
    "Output plain text:",
    "Title: <working title>",
    "Then 6–10 numbered outline sections.",
    "No markdown fences. No commentary.",
  ].join("\n");

  const user = [
    `Topic / concept: ${topic}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    `Content goal: ${GOAL_GUIDE[goal]}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Target length: ${LENGTH_GUIDE[length]}`,
    references
      ? `REFERENCE MATERIAL (source of truth — do not contradict):\n${references.slice(0, 8000)}`
      : "No project references provided — keep the outline conceptual and general.",
    "",
    "Create the explainer outline now.",
  ].join("\n");

  const result = await callOpenAi(system, user, 0.55);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "web3-explainer",
    wordsAnalyzed: countWords(topic + " " + references),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: topic.slice(0, 200),
  });

  const parsed = parseOutline(result.content);
  return {
    topic,
    audience,
    goal,
    tone,
    length,
    references,
    title: parsed.title,
    outline: parsed.outline,
  };
}

export async function generateExplainerArticle(input: {
  userId: string;
  userEmail?: string | null;
  topic: string;
  audience?: string;
  goal?: string;
  tone?: string;
  length?: string;
  references?: string;
  outline: string[];
  title?: string;
}) {
  const topic = String(input.topic || "").trim();
  const outline = Array.isArray(input.outline)
    ? input.outline.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  if (topic.length < 2) {
    throw Object.assign(new Error("Topic is required."), { status: 400 });
  }
  if (outline.length < 3) {
    throw Object.assign(new Error("Provide an outline with at least 3 sections."), { status: 400 });
  }
  const { audience, goal, tone, length } = normalizeEnums(input);
  const references = String(input.references || "").trim();
  const workingTitle = String(input.title || "").trim();

  const system = [
    "You write accurate, plain-English Web3 explainer articles.",
    "CRITICAL RULES:",
    "- Do NOT invent token supplies, fees, roadmaps, audits, TVL, partnerships, or security claims.",
    "- If reference material is provided, use ONLY facts present there for project-specific claims.",
    "- Prefer clear analogies for beginners when audience is beginner-level.",
    "- Follow the provided outline section order.",
    "- Output plain text: first line is the article title, blank line, then the full article with short section headings matching the outline.",
    "- No markdown fences. No preamble or closing notes.",
  ].join("\n");

  const user = [
    `Topic: ${topic}`,
    `Preferred title: ${workingTitle || "(create a clear title)"}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    `Content goal: ${GOAL_GUIDE[goal]}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Target length: ${LENGTH_GUIDE[length]}`,
    "",
    "OUTLINE:",
    ...outline.map((s, i) => `${i + 1}. ${s}`),
    "",
    references
      ? `REFERENCE MATERIAL (source of truth):\n${references.slice(0, 10000)}`
      : "No references — stay conceptual; avoid inventing project-specific metrics.",
    "",
    "Write the full article now.",
  ].join("\n");

  const result = await callOpenAi(system, user, 0.65);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "web3-explainer",
    wordsAnalyzed: countWords(topic + " " + outline.join(" ") + " " + references),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: topic.slice(0, 200),
  });

  const firstBreak = result.content.indexOf("\n");
  let title = workingTitle || topic;
  let body = result.content;
  if (firstBreak > 0) {
    title = result.content.slice(0, firstBreak).trim() || title;
    body = result.content.slice(firstBreak).replace(/^\n+/, "").trim();
  }

  return {
    topic,
    audience,
    goal,
    tone,
    length,
    references,
    outline,
    title,
    body,
    wordCount: countWords(body),
  };
}

export async function saveExplainerDraft(
  userId: string,
  draft: Omit<ExplainerDraft, "userId" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<ExplainerDraft> {
  const now = new Date().toISOString();
  const ref = draft.id ? draftsCol(userId).doc(draft.id) : draftsCol(userId).doc();
  const existing = draft.id ? (await ref.get()).data() : undefined;
  const doc = {
    userId,
    topic: String(draft.topic || ""),
    audience: draft.audience || "beginners",
    goal: draft.goal || "educational",
    tone: draft.tone || "simple",
    length: draft.length || "standard",
    references: String(draft.references || ""),
    outline: Array.isArray(draft.outline) ? draft.outline.map(String) : [],
    title: String(draft.title || "Untitled explainer"),
    body: String(draft.body || ""),
    wordCount: Number(draft.wordCount || countWords(String(draft.body || ""))),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(doc, { merge: true });
  return { ...doc, id: ref.id } as ExplainerDraft;
}

export async function listExplainerDrafts(userId: string): Promise<ExplainerDraft[]> {
  const snap = await draftsCol(userId).orderBy("updatedAt", "desc").limit(40).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId,
      topic: String(data.topic || ""),
      audience: data.audience || "beginners",
      goal: data.goal || "educational",
      tone: data.tone || "simple",
      length: data.length || "standard",
      references: String(data.references || ""),
      outline: Array.isArray(data.outline) ? data.outline.map(String) : [],
      title: String(data.title || "Untitled"),
      body: String(data.body || ""),
      wordCount: Number(data.wordCount || 0),
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    } as ExplainerDraft;
  });
}

export async function deleteExplainerDraft(userId: string, id: string) {
  await draftsCol(userId).doc(id).delete();
  return { ok: true };
}
