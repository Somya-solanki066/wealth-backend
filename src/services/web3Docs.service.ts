import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const DOC_TYPES = ["whitepaper", "user-guide", "faq"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_AUDIENCES = [
  "general",
  "web3-beginners",
  "crypto-users",
  "developers",
  "technical",
] as const;
export type DocAudience = (typeof DOC_AUDIENCES)[number];

export const USER_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type UserLevel = (typeof USER_LEVELS)[number];

export const FAQ_COUNTS = [10, 15, 20] as const;

export type DocsDraft = {
  id?: string;
  userId?: string;
  docType: DocType;
  topic: string;
  projectName?: string;
  projectDescription?: string;
  technicalNotes?: string;
  docsUrl?: string;
  references?: string;
  audience: DocAudience;
  userLevel?: UserLevel;
  faqCount?: number;
  structure: string[];
  title: string;
  body: string;
  wordCount: number;
  createdAt?: string;
  updatedAt?: string;
};

const AUDIENCE_GUIDE: Record<DocAudience, string> = {
  general: "general users — keep language accessible",
  "web3-beginners": "Web3 beginners — define jargon",
  "crypto-users": "crypto-native users — can use common Web3 terms",
  developers: "developers — precise technical language OK",
  technical: "technical users — accurate protocol-level detail",
};

const LEVEL_GUIDE: Record<UserLevel, string> = {
  beginner: "step-by-step for first-time users",
  intermediate: "users who already have a wallet and basic familiarity",
  advanced: "power users — concise, fewer hand-holding steps",
};

function draftsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("web3DocsDrafts");
}

async function callOpenAi(system: string, user: string, temperature = 0.6) {
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
  docType?: string;
  audience?: string;
  userLevel?: string;
  faqCount?: number;
}) {
  const docType = (DOC_TYPES as readonly string[]).includes(String(input.docType || ""))
    ? (input.docType as DocType)
    : "whitepaper";
  const audience = (DOC_AUDIENCES as readonly string[]).includes(String(input.audience || ""))
    ? (input.audience as DocAudience)
    : "web3-beginners";
  const userLevel = (USER_LEVELS as readonly string[]).includes(String(input.userLevel || ""))
    ? (input.userLevel as UserLevel)
    : "beginner";
  const faqCount = FAQ_COUNTS.includes(Number(input.faqCount) as any)
    ? Number(input.faqCount)
    : 10;
  return { docType, audience, userLevel, faqCount };
}

function contextBlock(input: {
  projectName?: string;
  projectDescription?: string;
  technicalNotes?: string;
  docsUrl?: string;
  references?: string;
}) {
  return [
    input.projectName ? `Project/protocol: ${input.projectName}` : "",
    input.projectDescription ? `Project description: ${input.projectDescription}` : "",
    input.docsUrl ? `Official docs URL: ${input.docsUrl}` : "",
    input.technicalNotes ? `Technical notes:\n${input.technicalNotes}` : "",
    input.references
      ? `REFERENCE MATERIAL (source of truth):\n${String(input.references).slice(0, 10000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseStructure(content: string): { title: string; structure: string[] } {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let title = "Document Structure";
  const structure: string[] = [];
  for (const line of lines) {
    if (/^title\s*:/i.test(line)) {
      title = line.replace(/^title\s*:/i, "").trim() || title;
      continue;
    }
    const m = line.match(/^\d+[\.\)]\s*(.+)$/);
    if (m) structure.push(m[1].trim());
    else if (/^[-•Q]\s*/i.test(line) || /^Q\d*[:.\)]/i.test(line)) {
      structure.push(line.replace(/^[-•]\s*/, "").trim());
    }
  }
  if (!structure.length) {
    return { title, structure: lines.filter((l) => !/^title\s*:/i.test(l)).slice(0, 20) };
  }
  return { title, structure };
}

export async function generateDocStructure(input: {
  userId: string;
  userEmail?: string | null;
  docType?: string;
  topic: string;
  projectName?: string;
  projectDescription?: string;
  technicalNotes?: string;
  docsUrl?: string;
  references?: string;
  audience?: string;
  userLevel?: string;
  faqCount?: number;
}) {
  const topic = String(input.topic || "").trim();
  if (topic.length < 2) {
    throw Object.assign(new Error("Enter a feature or topic."), { status: 400 });
  }
  const { docType, audience, userLevel, faqCount } = normalize(input);
  const ctx = contextBlock(input);

  const typeInstructions =
    docType === "faq"
      ? `Create an FAQ structure: Title line, then ${faqCount} numbered question prompts only (not answers). Questions should cover the topic thoroughly for the audience.`
      : docType === "user-guide"
        ? `Create a step-by-step user guide structure: Title line, then 6–10 numbered steps (action-oriented). Level: ${LEVEL_GUIDE[userLevel]}.`
        : `Create a whitepaper section structure: Title line, then 6–10 numbered section headings (Overview, mechanics, eligibility, calculation, risks, examples as relevant).`;

  const system = [
    "You structure Web3 whitepaper sections, user guides, and FAQs.",
    "CRITICAL: Do NOT invent tokenomics, fees, APR, roadmaps, audits, or protocol rules.",
    "If project context/references are provided, treat them as source of truth.",
    "If a fact is unknown, omit it or mark 'to verify' — never fabricate.",
    "Output plain text only: Title: ... then numbered list. No markdown fences.",
    typeInstructions,
  ].join("\n");

  const user = [
    `Document type: ${docType}`,
    `Feature / topic: ${topic}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    docType === "user-guide" ? `User level: ${LEVEL_GUIDE[userLevel]}` : "",
    docType === "faq" ? `Question count: ${faqCount}` : "",
    ctx || "No project references — keep structure general; avoid inventing project-specific rules.",
    "",
    "Generate the structure now.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callOpenAi(system, user, 0.5);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "web3-docs",
    wordsAnalyzed: countWords(topic + " " + ctx),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: topic.slice(0, 200),
  });

  const parsed = parseStructure(result.content);
  return {
    docType,
    topic,
    audience,
    userLevel,
    faqCount,
    projectName: input.projectName || "",
    projectDescription: input.projectDescription || "",
    technicalNotes: input.technicalNotes || "",
    docsUrl: input.docsUrl || "",
    references: input.references || "",
    title: parsed.title,
    structure: parsed.structure,
  };
}

export async function generateDocBody(input: {
  userId: string;
  userEmail?: string | null;
  docType?: string;
  topic: string;
  projectName?: string;
  projectDescription?: string;
  technicalNotes?: string;
  docsUrl?: string;
  references?: string;
  audience?: string;
  userLevel?: string;
  faqCount?: number;
  structure: string[];
  title?: string;
}) {
  const topic = String(input.topic || "").trim();
  const structure = Array.isArray(input.structure)
    ? input.structure.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  if (topic.length < 2) {
    throw Object.assign(new Error("Topic is required."), { status: 400 });
  }
  if (structure.length < 3) {
    throw Object.assign(new Error("Provide a structure with at least 3 items."), { status: 400 });
  }
  const { docType, audience, userLevel, faqCount } = normalize(input);
  const ctx = contextBlock(input);
  const workingTitle = String(input.title || "").trim();

  const formatHint =
    docType === "faq"
      ? "Write Q&A pairs. Each question from the structure should have a clear answer. Use 'Q:' and 'A:' labels."
      : docType === "user-guide"
        ? "Write a numbered step-by-step guide. Each step: short heading, then clear instructions. Level: " +
          LEVEL_GUIDE[userLevel]
        : "Write a whitepaper-style section with short headings matching the structure. Clear, precise, non-hype.";

  const system = [
    "You write accurate Web3 documentation (whitepaper sections, user guides, FAQs).",
    "CRITICAL: Do NOT invent APR, token supply, fees, lockups, audits, or roadmap dates.",
    "Use ONLY facts from provided project context/references for protocol-specific claims.",
    "If unknown, say users should check official docs — do not guess.",
    "Output plain text: first line is the document title, blank line, then body.",
    "No markdown fences. No preamble.",
    formatHint,
  ].join("\n");

  const user = [
    `Document type: ${docType}`,
    `Topic: ${topic}`,
    `Preferred title: ${workingTitle || "(create a clear title)"}`,
    `Audience: ${AUDIENCE_GUIDE[audience]}`,
    docType === "user-guide" ? `User level: ${LEVEL_GUIDE[userLevel]}` : "",
    docType === "faq" ? `Target ~${faqCount} Q&As based on structure` : "",
    "",
    "STRUCTURE:",
    ...structure.map((s, i) => `${i + 1}. ${s}`),
    "",
    ctx || "No references — stay conceptual; avoid inventing project-specific numbers/rules.",
    "",
    "Write the full document now.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callOpenAi(system, user, 0.65);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "web3-docs",
    wordsAnalyzed: countWords(topic + " " + structure.join(" ") + " " + ctx),
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
    docType,
    topic,
    audience,
    userLevel,
    faqCount,
    projectName: input.projectName || "",
    projectDescription: input.projectDescription || "",
    technicalNotes: input.technicalNotes || "",
    docsUrl: input.docsUrl || "",
    references: input.references || "",
    structure,
    title,
    body,
    wordCount: countWords(body),
  };
}

export async function saveDocsDraft(
  userId: string,
  draft: Omit<DocsDraft, "userId" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<DocsDraft> {
  const now = new Date().toISOString();
  const ref = draft.id ? draftsCol(userId).doc(draft.id) : draftsCol(userId).doc();
  const existing = draft.id ? (await ref.get()).data() : undefined;
  const doc = {
    userId,
    docType: draft.docType || "whitepaper",
    topic: String(draft.topic || ""),
    projectName: String(draft.projectName || ""),
    projectDescription: String(draft.projectDescription || ""),
    technicalNotes: String(draft.technicalNotes || ""),
    docsUrl: String(draft.docsUrl || ""),
    references: String(draft.references || ""),
    audience: draft.audience || "web3-beginners",
    userLevel: draft.userLevel || "beginner",
    faqCount: Number(draft.faqCount || 10),
    structure: Array.isArray(draft.structure) ? draft.structure.map(String) : [],
    title: String(draft.title || "Untitled doc"),
    body: String(draft.body || ""),
    wordCount: Number(draft.wordCount || countWords(String(draft.body || ""))),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(doc, { merge: true });
  return { ...doc, id: ref.id } as DocsDraft;
}

export async function listDocsDrafts(userId: string): Promise<DocsDraft[]> {
  const snap = await draftsCol(userId).orderBy("updatedAt", "desc").limit(40).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId,
      docType: data.docType || "whitepaper",
      topic: String(data.topic || ""),
      projectName: String(data.projectName || ""),
      projectDescription: String(data.projectDescription || ""),
      technicalNotes: String(data.technicalNotes || ""),
      docsUrl: String(data.docsUrl || ""),
      references: String(data.references || ""),
      audience: data.audience || "web3-beginners",
      userLevel: data.userLevel || "beginner",
      faqCount: Number(data.faqCount || 10),
      structure: Array.isArray(data.structure) ? data.structure.map(String) : [],
      title: String(data.title || "Untitled"),
      body: String(data.body || ""),
      wordCount: Number(data.wordCount || 0),
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    } as DocsDraft;
  });
}

export async function deleteDocsDraft(userId: string, id: string) {
  await draftsCol(userId).doc(id).delete();
  return { ok: true };
}
