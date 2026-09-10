import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const THREAD_AUDIENCES = [
  "web3-beginners",
  "crypto-users",
  "developers",
  "investors",
  "project-community",
  "general",
] as const;
export type ThreadAudience = (typeof THREAD_AUDIENCES)[number];

export const THREAD_GOALS = [
  "educate",
  "explain-product",
  "announce-update",
  "build-awareness",
  "community-engagement",
  "promote-project",
] as const;
export type ThreadGoal = (typeof THREAD_GOALS)[number];

export const THREAD_TONES = [
  "educational",
  "professional",
  "conversational",
  "bold",
  "technical",
  "community",
] as const;
export type ThreadTone = (typeof THREAD_TONES)[number];

export const THREAD_LENGTHS = ["short", "standard", "long"] as const;
export type ThreadLength = (typeof THREAD_LENGTHS)[number];

export const THREAD_CTAS = [
  "follow",
  "join-community",
  "visit-website",
  "read-docs",
  "try-product",
  "none",
] as const;
export type ThreadCta = (typeof THREAD_CTAS)[number];

export const POST_ACTIONS = ["rewrite", "shorten", "expand"] as const;
export type PostAction = (typeof POST_ACTIONS)[number];

export type ThreadDraft = {
  id?: string;
  userId?: string;
  idea: string;
  audience: ThreadAudience;
  goal: ThreadGoal;
  tone: ThreadTone;
  length: ThreadLength;
  cta: ThreadCta;
  projectName?: string;
  website?: string;
  keyInfo?: string;
  references?: string;
  posts: string[];
  createdAt?: string;
  updatedAt?: string;
};

const AUDIENCE_GUIDE: Record<ThreadAudience, string> = {
  "web3-beginners": "Web3 beginners — define jargon briefly",
  "crypto-users": "crypto-native users — can use common Web3 terms",
  developers: "developers — precise, technical",
  investors: "investors — value, risk, why it matters",
  "project-community": "existing project community — insider-friendly",
  general: "general audience — accessible, minimal jargon",
};

const GOAL_GUIDE: Record<ThreadGoal, string> = {
  educate: "educate — teach a concept clearly (what → why → how → example → takeaway)",
  "explain-product": "explain a product/feature clearly",
  "announce-update": "announce an update — what changed and why it matters",
  "build-awareness": "build awareness — memorable framing, shareable",
  "community-engagement": "community engagement — invite discussion",
  "promote-project": "promote a project honestly — no fake claims or hype numbers",
};

const TONE_GUIDE: Record<ThreadTone, string> = {
  educational: "educational and clear",
  professional: "professional",
  conversational: "conversational, like talking to a friend",
  bold: "bold and punchy — still honest",
  technical: "technical and precise",
  community: "community-focused and welcoming",
};

const LENGTH_TARGET: Record<ThreadLength, { min: number; max: number; label: string }> = {
  short: { min: 5, max: 5, label: "exactly 5 posts" },
  standard: { min: 8, max: 8, label: "exactly 8 posts" },
  long: { min: 10, max: 12, label: "10 to 12 posts" },
};

const CTA_GUIDE: Record<ThreadCta, string> = {
  follow: "soft CTA: follow for more Web3 insights",
  "join-community": "CTA: join the community / Discord / Telegram",
  "visit-website": "CTA: visit the project website",
  "read-docs": "CTA: read the documentation",
  "try-product": "CTA: try the product",
  none: "no CTA — end with a strong takeaway only",
};

function draftsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("web3ThreadDrafts");
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

function normalize(input: {
  audience?: string;
  goal?: string;
  tone?: string;
  length?: string;
  cta?: string;
}) {
  const audience = (THREAD_AUDIENCES as readonly string[]).includes(String(input.audience || ""))
    ? (input.audience as ThreadAudience)
    : "web3-beginners";
  const goal = (THREAD_GOALS as readonly string[]).includes(String(input.goal || ""))
    ? (input.goal as ThreadGoal)
    : "educate";
  const tone = (THREAD_TONES as readonly string[]).includes(String(input.tone || ""))
    ? (input.tone as ThreadTone)
    : "conversational";
  const length = (THREAD_LENGTHS as readonly string[]).includes(String(input.length || ""))
    ? (input.length as ThreadLength)
    : "standard";
  const cta = (THREAD_CTAS as readonly string[]).includes(String(input.cta || ""))
    ? (input.cta as ThreadCta)
    : "follow";
  return { audience, goal, tone, length, cta };
}

function contextBlock(input: {
  projectName?: string;
  website?: string;
  keyInfo?: string;
  references?: string;
}) {
  return [
    input.projectName ? `Project name: ${input.projectName}` : "",
    input.website ? `Website: ${input.website}` : "",
    input.keyInfo ? `Key information:\n${input.keyInfo}` : "",
    input.references
      ? `REFERENCE MATERIAL (source of truth):\n${String(input.references).slice(0, 8000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parsePosts(content: string, expectedMin: number, expectedMax: number): string[] {
  const lines = content.split("\n");
  const posts: string[] = [];
  let current = "";

  const flush = () => {
    const t = current.trim();
    if (t) posts.push(t);
    current = "";
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.match(/^(?:POST\s*)?(\d+)\s*[\/:.\)]\s*(.*)$/i);
    if (m) {
      flush();
      current = (m[2] || "").trim();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      continue;
    }
    if (current || line.trim()) {
      current = current ? `${current}\n${line}` : line;
    }
  }
  flush();

  if (posts.length < expectedMin) {
    const chunks = content
      .split(/\n\s*\n/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (chunks.length >= expectedMin) return chunks.slice(0, expectedMax);
  }

  return posts.slice(0, expectedMax);
}

async function logUsage(
  input: { userId: string; userEmail?: string | null },
  preview: string,
  result: { usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }; model: string },
  words: number
) {
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "web3-thread",
    wordsAnalyzed: words,
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: preview.slice(0, 200),
  });
}

export async function generateThread(input: {
  userId: string;
  userEmail?: string | null;
  idea: string;
  audience?: string;
  goal?: string;
  tone?: string;
  length?: string;
  cta?: string;
  projectName?: string;
  website?: string;
  keyInfo?: string;
  references?: string;
}) {
  const idea = String(input.idea || "").trim();
  if (idea.length < 3) {
    throw Object.assign(new Error("Enter a core idea for the thread."), { status: 400 });
  }
  const { audience, goal, tone, length, cta } = normalize(input);
  const target = LENGTH_TARGET[length];
  const ctx = contextBlock(input);

  const system = [
    "You write Twitter/X threads for Web3 projects and education.",
    "CRITICAL: Do NOT invent tokenomics, supply, APR, fees, roadmaps, partnerships, or audit claims.",
    "If project context is provided, use ONLY those facts for project-specific claims.",
    "If a fact is unknown, stay conceptual or say users should check official docs.",
    "Each post must be concise and under 280 characters when possible (hard max 400).",
    "Post 1 is the hook — scroll-stopping, clear.",
    "Last post includes the requested CTA (or a takeaway if no CTA).",
    "Output format ONLY:",
    "1/N",
    "post text",
    "",
    "2/N",
    "post text",
    "...",
    `Generate ${target.label}.`,
  ].join("\n");

  const user = [
    `Core idea: ${idea}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    `Goal: ${GOAL_GUIDE[goal]}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Length: ${target.label}`,
    `Final CTA: ${CTA_GUIDE[cta]}`,
    ctx || "No project references — keep general; do not invent project-specific facts.",
    "",
    "Write the full thread now.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callOpenAi(system, user, 0.75);
  await logUsage(input, idea, result, countWords(idea + " " + ctx));

  const posts = parsePosts(result.content, target.min, target.max);
  if (posts.length < 3) {
    throw Object.assign(new Error("Thread generation returned too few posts. Try again."), {
      status: 500,
    });
  }

  return {
    idea,
    audience,
    goal,
    tone,
    length,
    cta,
    projectName: input.projectName || "",
    website: input.website || "",
    keyInfo: input.keyInfo || "",
    references: input.references || "",
    posts,
  };
}

export async function refineThreadPost(input: {
  userId: string;
  userEmail?: string | null;
  action: string;
  post: string;
  idea: string;
  audience?: string;
  tone?: string;
  index: number;
  total: number;
}) {
  const post = String(input.post || "").trim();
  if (!post) throw Object.assign(new Error("Post text is required."), { status: 400 });
  const action = (POST_ACTIONS as readonly string[]).includes(String(input.action || ""))
    ? (input.action as PostAction)
    : "rewrite";
  const { audience, tone } = normalize({
    audience: input.audience,
    tone: input.tone,
  });

  const actionGuide =
    action === "shorten"
      ? "Shorten this post while keeping the same point. Prefer under 220 characters."
      : action === "expand"
        ? "Expand slightly with one clearer detail or example. Stay under 280 characters if possible (max 400)."
        : "Rewrite this post for stronger clarity and scroll-stopping punch. Same idea, better wording. Stay under 280 characters if possible (max 400).";

  const system = [
    "You refine a single Twitter/X thread post.",
    "Return ONLY the new post text. No numbering, no quotes, no preamble.",
    "Do not invent protocol facts.",
    actionGuide,
  ].join("\n");

  const user = [
    `Thread idea: ${input.idea}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `This is post ${input.index + 1} of ${input.total}.`,
    "",
    "Current post:",
    post,
  ].join("\n");

  const result = await callOpenAi(system, user, 0.7);
  await logUsage(input, post, result, countWords(post));
  return { post: result.content.replace(/^["']|["']$/g, "").trim() };
}

export async function improveThreadHook(input: {
  userId: string;
  userEmail?: string | null;
  idea: string;
  currentHook: string;
  audience?: string;
  tone?: string;
  goal?: string;
}) {
  const currentHook = String(input.currentHook || "").trim();
  if (!currentHook) throw Object.assign(new Error("Current hook is required."), { status: 400 });
  const { audience, tone, goal } = normalize({
    audience: input.audience,
    tone: input.tone,
    goal: input.goal,
  });

  const system = [
    "You write Twitter/X thread hooks for Web3 content.",
    "Return exactly 3 alternative hooks as:",
    "A. ...",
    "B. ...",
    "C. ...",
    "Each under 280 characters. No inventing protocol facts. No preamble.",
  ].join("\n");

  const user = [
    `Thread idea: ${input.idea}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Goal: ${GOAL_GUIDE[goal]}`,
    "",
    "Current hook:",
    currentHook,
    "",
    "Give 3 stronger alternatives.",
  ].join("\n");

  const result = await callOpenAi(system, user, 0.8);
  await logUsage(input, currentHook, result, countWords(currentHook));

  const alternatives: string[] = [];
  for (const line of result.content.split("\n")) {
    const m = line.trim().match(/^[ABC][\.\):]\s*(.+)$/i);
    if (m) alternatives.push(m[1].trim());
  }
  if (alternatives.length < 3) {
    const extras = result.content
      .split("\n")
      .map((l) => l.replace(/^[ABC\-\d]+[\.\):]\s*/i, "").trim())
      .filter(Boolean);
    for (const e of extras) {
      if (alternatives.length >= 3) break;
      if (!alternatives.includes(e)) alternatives.push(e);
    }
  }

  return { alternatives: alternatives.slice(0, 3) };
}

export async function applyThreadCta(input: {
  userId: string;
  userEmail?: string | null;
  idea: string;
  lastPost: string;
  cta?: string;
  projectName?: string;
  website?: string;
  tone?: string;
}) {
  const lastPost = String(input.lastPost || "").trim();
  if (!lastPost) throw Object.assign(new Error("Last post is required."), { status: 400 });
  const { cta, tone } = normalize({ cta: input.cta, tone: input.tone });

  const system = [
    "You rewrite the FINAL post of a Twitter/X thread to include the requested CTA.",
    "Keep the core takeaway. Stay under 280 characters when possible (max 400).",
    "Return ONLY the new post text. No numbering.",
    "Do not invent URLs or claims; use provided project website only if relevant.",
  ].join("\n");

  const user = [
    `Thread idea: ${input.idea}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Requested CTA: ${CTA_GUIDE[cta]}`,
    input.projectName ? `Project: ${input.projectName}` : "",
    input.website ? `Website: ${input.website}` : "",
    "",
    "Current last post:",
    lastPost,
    "",
    "Rewrite the last post now.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callOpenAi(system, user, 0.65);
  await logUsage(input, lastPost, result, countWords(lastPost));
  return { post: result.content.replace(/^["']|["']$/g, "").trim(), cta };
}

export async function saveThreadDraft(
  userId: string,
  draft: Omit<ThreadDraft, "userId" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<ThreadDraft> {
  const now = new Date().toISOString();
  const ref = draft.id ? draftsCol(userId).doc(draft.id) : draftsCol(userId).doc();
  const existing = draft.id ? (await ref.get()).data() : undefined;
  const doc = {
    userId,
    idea: String(draft.idea || ""),
    audience: draft.audience || "web3-beginners",
    goal: draft.goal || "educate",
    tone: draft.tone || "conversational",
    length: draft.length || "standard",
    cta: draft.cta || "follow",
    projectName: String(draft.projectName || ""),
    website: String(draft.website || ""),
    keyInfo: String(draft.keyInfo || ""),
    references: String(draft.references || ""),
    posts: Array.isArray(draft.posts) ? draft.posts.map(String) : [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(doc, { merge: true });
  return { ...doc, id: ref.id } as ThreadDraft;
}

export async function listThreadDrafts(userId: string): Promise<ThreadDraft[]> {
  const snap = await draftsCol(userId).orderBy("updatedAt", "desc").limit(40).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId,
      idea: String(data.idea || ""),
      audience: data.audience || "web3-beginners",
      goal: data.goal || "educate",
      tone: data.tone || "conversational",
      length: data.length || "standard",
      cta: data.cta || "follow",
      projectName: String(data.projectName || ""),
      website: String(data.website || ""),
      keyInfo: String(data.keyInfo || ""),
      references: String(data.references || ""),
      posts: Array.isArray(data.posts) ? data.posts.map(String) : [],
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    } as ThreadDraft;
  });
}

export async function deleteThreadDraft(userId: string, id: string) {
  await draftsCol(userId).doc(id).delete();
  return { ok: true };
}
