import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const POST_TYPES = [
  "product-update",
  "ama-recap",
  "roadmap-milestone",
  "community-shoutout",
  "partnership",
  "feature-launch",
  "community-event",
  "giveaway",
  "maintenance",
  "security",
] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_TONES = [
  "professional",
  "friendly",
  "excited",
  "technical",
  "community",
] as const;
export type PostTone = (typeof POST_TONES)[number];

export const POST_LENGTHS = ["short", "standard", "detailed"] as const;
export type PostLength = (typeof POST_LENGTHS)[number];

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
};

export type CommunityDraft = {
  id?: string;
  userId?: string;
  kind: "draft" | "template";
  templateName?: string;
  postType: PostType;
  tone: PostTone;
  length: PostLength;
  projectName?: string;
  website?: string;
  communityName?: string;
  socialLinks?: string;
  fields: Record<string, string>;
  body: string;
  createdAt?: string;
  updatedAt?: string;
};

const CORE_TYPES: PostType[] = [
  "product-update",
  "ama-recap",
  "roadmap-milestone",
  "community-shoutout",
];

const TYPE_LABELS: Record<PostType, string> = {
  "product-update": "Product update announcement",
  "ama-recap": "AMA recap",
  "roadmap-milestone": "Roadmap milestone hit",
  "community-shoutout": "Community shoutout",
  partnership: "Partnership announcement",
  "feature-launch": "New feature launch",
  "community-event": "Community event",
  giveaway: "Giveaway announcement",
  maintenance: "Maintenance / update notice",
  security: "Security announcement",
};

const FIELD_DEFS: Record<PostType, FieldDef[]> = {
  "product-update": [
    { key: "featureName", label: "Feature / Product Name", placeholder: "Staking Dashboard", required: true },
    { key: "whatChanged", label: "What changed?", placeholder: "New UI, faster claims…", multiline: true, required: true },
    { key: "whyItMatters", label: "Why it matters", placeholder: "Easier for long-term holders…", multiline: true },
    { key: "link", label: "Link", placeholder: "https://" },
    { key: "cta", label: "CTA", placeholder: "Try it now" },
  ],
  "ama-recap": [
    { key: "amaTopic", label: "AMA Topic", placeholder: "Staking & rewards", required: true },
    { key: "date", label: "Date", placeholder: "March 10" },
    { key: "discussionPoints", label: "Key Discussion Points", placeholder: "One point per line", multiline: true, required: true },
    { key: "importantAnswers", label: "Important Answers", placeholder: "Q/A pairs, one per line", multiline: true },
    { key: "recordingLink", label: "Recording Link", placeholder: "https://" },
  ],
  "roadmap-milestone": [
    { key: "milestone", label: "Milestone", placeholder: "Mainnet staking live", required: true },
    { key: "achieved", label: "What was achieved?", multiline: true, required: true },
    { key: "whatsNext", label: "What's next?", multiline: true },
    { key: "link", label: "Link", placeholder: "https://" },
  ],
  "community-shoutout": [
    { key: "personName", label: "Person / Community Name", required: true },
    { key: "reason", label: "Reason for shoutout", multiline: true, required: true },
    { key: "achievement", label: "Achievement", multiline: true },
    { key: "profileLink", label: "Link / Profile", placeholder: "https://" },
  ],
  partnership: [
    { key: "partnerName", label: "Partner name", required: true },
    { key: "whatTogether", label: "What you're doing together", multiline: true, required: true },
    { key: "whyItMatters", label: "Why it matters", multiline: true },
    { key: "link", label: "Link", placeholder: "https://" },
  ],
  "feature-launch": [
    { key: "featureName", label: "Feature name", required: true },
    { key: "whatItDoes", label: "What it does", multiline: true, required: true },
    { key: "howToStart", label: "How to get started", multiline: true },
    { key: "link", label: "Link", placeholder: "https://" },
  ],
  "community-event": [
    { key: "eventName", label: "Event name", required: true },
    { key: "whenWhere", label: "When / where", required: true },
    { key: "details", label: "Details", multiline: true },
    { key: "link", label: "RSVP / Link", placeholder: "https://" },
  ],
  giveaway: [
    { key: "prize", label: "Prize", required: true },
    { key: "howToEnter", label: "How to enter", multiline: true, required: true },
    { key: "deadline", label: "Deadline" },
    { key: "link", label: "Link", placeholder: "https://" },
  ],
  maintenance: [
    { key: "whatAffected", label: "What is affected?", required: true },
    { key: "when", label: "When", required: true },
    { key: "impact", label: "Expected impact", multiline: true },
    { key: "statusLink", label: "Status link", placeholder: "https://" },
  ],
  security: [
    { key: "summary", label: "Summary (facts only)", multiline: true, required: true },
    { key: "actionRequired", label: "Action required from users", multiline: true },
    { key: "officialLink", label: "Official link", placeholder: "https://", required: true },
  ],
};

function draftsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("web3CommunityDrafts");
}

function templatesCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("web3CommunityTemplates");
}

function normalizeType(t?: string): PostType {
  return (POST_TYPES as readonly string[]).includes(String(t || ""))
    ? (t as PostType)
    : "product-update";
}

function normalizeTone(t?: string): PostTone {
  return (POST_TONES as readonly string[]).includes(String(t || ""))
    ? (t as PostTone)
    : "friendly";
}

function normalizeLength(l?: string): PostLength {
  return (POST_LENGTHS as readonly string[]).includes(String(l || ""))
    ? (l as PostLength)
    : "standard";
}

function lines(text?: string): string[] {
  return String(text || "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function projectFooter(input: {
  projectName?: string;
  communityName?: string;
  website?: string;
}) {
  const bits = [
    input.communityName || input.projectName,
    input.website,
  ].filter(Boolean);
  return bits.length ? `\n\n— ${bits.join(" · ")}` : "";
}

export function getCommunityMeta(includeFuture = true) {
  const types = (includeFuture ? [...POST_TYPES] : CORE_TYPES).map((id) => ({
    id,
    label: TYPE_LABELS[id],
    core: CORE_TYPES.includes(id),
    fields: FIELD_DEFS[id],
  }));
  return {
    postTypes: types,
    tones: POST_TONES.map((id) => ({
      id,
      label:
        id === "professional"
          ? "Professional"
          : id === "friendly"
            ? "Friendly"
            : id === "excited"
              ? "Excited"
              : id === "technical"
                ? "Technical"
                : "Community-focused",
    })),
    lengths: POST_LENGTHS.map((id) => ({
      id,
      label: id === "short" ? "Short" : id === "detailed" ? "Detailed" : "Standard",
    })),
  };
}

export function assembleCommunityPost(input: {
  postType?: string;
  tone?: string;
  length?: string;
  projectName?: string;
  website?: string;
  communityName?: string;
  fields?: Record<string, string>;
}): { postType: PostType; tone: PostTone; length: PostLength; body: string } {
  const postType = normalizeType(input.postType);
  const tone = normalizeTone(input.tone);
  const length = normalizeLength(input.length);
  const f = input.fields || {};
  const footer = projectFooter(input);

  let body = "";

  if (postType === "product-update") {
    const name = f.featureName || "our latest update";
    const changed = f.whatChanged || "several improvements";
    const why = f.whyItMatters || "";
    const link = f.link || "";
    const cta = f.cta || "";
    if (length === "short") {
      body = `🚀 Update: ${name} just shipped.\n\n${changed}${link ? `\n\n${link}` : ""}`;
    } else if (length === "detailed") {
      body = [
        `🚀 Update: ${name} just shipped.`,
        "",
        "Here's what changed:",
        changed,
        why ? `\nWhy it matters:\n${why}` : "",
        cta ? `\n${cta}` : "",
        link ? `\n${link}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      body = [
        `🚀 Update: ${name} just shipped.`,
        "",
        `Here's what changed and why it matters for you:`,
        changed,
        why ? `\n${why}` : "",
        cta ? `\n${cta}` : "",
        link ? `\n${link}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  } else if (postType === "ama-recap") {
    const topic = f.amaTopic || "today's AMA";
    const date = f.date ? ` (${f.date})` : "";
    const points = lines(f.discussionPoints);
    const answers = lines(f.importantAnswers);
    const bullets = [...points, ...answers].slice(0, length === "short" ? 3 : length === "detailed" ? 8 : 5);
    body = [
      `🎙️ AMA Recap${date}`,
      "",
      `Here's what we covered on ${topic}:`,
      "",
      ...bullets.map((b) => `• ${b}`),
      f.recordingLink ? `\nWatch the full AMA:\n${f.recordingLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "roadmap-milestone") {
    const milestone = f.milestone || "a major milestone";
    body = [
      `🎯 Roadmap milestone reached!`,
      "",
      `We've completed ${milestone}.`,
      f.achieved ? `\nHere's what this means for the community:\n${f.achieved}` : "",
      f.whatsNext ? `\nNext:\n${f.whatsNext}` : "",
      f.link ? `\n${f.link}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "community-shoutout") {
    const name = f.personName || "a community member";
    body = [
      `💙 Community shoutout!`,
      "",
      `Big thanks to ${name}${f.reason ? ` for ${f.reason}` : "."}`,
      f.achievement ? `\n${f.achievement}` : "",
      "",
      "Your contributions are helping the community grow.",
      f.profileLink ? `\n${f.profileLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "partnership") {
    body = [
      `🤝 Partnership announcement`,
      "",
      `We're teaming up with ${f.partnerName || "a new partner"}.`,
      f.whatTogether ? `\n${f.whatTogether}` : "",
      f.whyItMatters ? `\nWhy it matters:\n${f.whyItMatters}` : "",
      f.link ? `\n${f.link}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "feature-launch") {
    body = [
      `✨ New feature: ${f.featureName || "just launched"}`,
      "",
      f.whatItDoes || "",
      f.howToStart ? `\nGet started:\n${f.howToStart}` : "",
      f.link ? `\n${f.link}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "community-event") {
    body = [
      `📅 Community event: ${f.eventName || "Join us"}`,
      f.whenWhere ? `\n${f.whenWhere}` : "",
      f.details ? `\n${f.details}` : "",
      f.link ? `\nRSVP: ${f.link}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "giveaway") {
    body = [
      `🎁 Giveaway: ${f.prize || "a special prize"}`,
      "",
      "How to enter:",
      f.howToEnter || "",
      f.deadline ? `\nDeadline: ${f.deadline}` : "",
      f.link ? `\n${f.link}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else if (postType === "maintenance") {
    body = [
      `🛠️ Maintenance notice`,
      "",
      `Affected: ${f.whatAffected || "services"}`,
      f.when ? `When: ${f.when}` : "",
      f.impact ? `\n${f.impact}` : "",
      f.statusLink ? `\nStatus: ${f.statusLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    body = [
      `🔐 Security notice`,
      "",
      f.summary || "",
      f.actionRequired ? `\nWhat you should do:\n${f.actionRequired}` : "",
      f.officialLink ? `\nOfficial info only:\n${f.officialLink}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Light tone flavor without AI
  if (tone === "excited" && !body.startsWith("🚀") && !body.includes("!")) {
    body = body.replace(/\n\n/, "!\n\n");
  } else if (tone === "professional") {
    body = body.replace(/🚀 |🎙️ |🎯 |💙 |🤝 |✨ |📅 |🎁 |🛠️ |🔐 /g, "");
  }

  body = (body.trim() + footer).trim();
  return { postType, tone, length, body };
}

export async function polishCommunityPost(input: {
  userId: string;
  userEmail?: string | null;
  postType?: string;
  tone?: string;
  length?: string;
  projectName?: string;
  website?: string;
  communityName?: string;
  socialLinks?: string;
  fields?: Record<string, string>;
  draftBody?: string;
}) {
  const assembled = assembleCommunityPost(input);
  const fieldsText = Object.entries(input.fields || {})
    .filter(([, v]) => String(v || "").trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const system = [
    "You write short community posts for Web3 Discord/Telegram/Twitter communities.",
    "CRITICAL: Do NOT invent tokenomics, roadmaps, partnerships, audits, or dates.",
    "Use ONLY the provided fields/project info. Keep placeholders out — omit missing links.",
    "Return ONLY the final post text. No markdown fences. No preamble.",
    `Tone: ${assembled.tone}. Length: ${assembled.length} (short≈2-4 lines, standard≈5-8, detailed≈8-12).`,
  ].join("\n");

  const user = [
    `Post type: ${TYPE_LABELS[assembled.postType]}`,
    input.projectName ? `Project: ${input.projectName}` : "",
    input.communityName ? `Community: ${input.communityName}` : "",
    input.website ? `Website: ${input.website}` : "",
    input.socialLinks ? `Social: ${input.socialLinks}` : "",
    "",
    "Fields:",
    fieldsText || "(none)",
    "",
    "Draft to polish:",
    input.draftBody || assembled.body,
  ]
    .filter(Boolean)
    .join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.6,
  });
  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No content returned from OpenAI.");

  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "web3-community",
    wordsAnalyzed: countWords(fieldsText + " " + (input.draftBody || assembled.body)),
    tokensUsed: completion.usage?.total_tokens || 0,
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    model: completion.model || model,
    inputPreview: (fieldsText || assembled.body).slice(0, 200),
  });

  return {
    ...assembled,
    body: content,
    polished: true,
  };
}

async function saveDoc(
  col: ReturnType<typeof draftsCol>,
  userId: string,
  draft: Partial<CommunityDraft> & { kind: "draft" | "template" }
): Promise<CommunityDraft> {
  const now = new Date().toISOString();
  const ref = draft.id ? col.doc(draft.id) : col.doc();
  const existing = draft.id ? (await ref.get()).data() : undefined;
  const doc = {
    userId,
    kind: draft.kind,
    templateName: String(draft.templateName || ""),
    postType: normalizeType(draft.postType),
    tone: normalizeTone(draft.tone),
    length: normalizeLength(draft.length),
    projectName: String(draft.projectName || ""),
    website: String(draft.website || ""),
    communityName: String(draft.communityName || ""),
    socialLinks: String(draft.socialLinks || ""),
    fields: (draft.fields && typeof draft.fields === "object" ? draft.fields : {}) as Record<
      string,
      string
    >,
    body: String(draft.body || ""),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await ref.set(doc, { merge: true });
  return { ...doc, id: ref.id } as CommunityDraft;
}

export async function saveCommunityDraft(
  userId: string,
  draft: Omit<CommunityDraft, "userId" | "createdAt" | "updatedAt" | "kind"> & {
    id?: string;
  }
) {
  return saveDoc(draftsCol(userId), userId, { ...draft, kind: "draft" });
}

export async function saveCommunityTemplate(
  userId: string,
  draft: Omit<CommunityDraft, "userId" | "createdAt" | "updatedAt" | "kind"> & {
    id?: string;
    templateName: string;
  }
) {
  const name = String(draft.templateName || "").trim();
  if (name.length < 2) {
    throw Object.assign(new Error("Enter a name for your saved template."), { status: 400 });
  }
  return saveDoc(templatesCol(userId), userId, { ...draft, kind: "template", templateName: name });
}

function mapDoc(id: string, data: Record<string, any>, userId: string): CommunityDraft {
  return {
    id,
    userId,
    kind: data.kind === "template" ? "template" : "draft",
    templateName: String(data.templateName || ""),
    postType: normalizeType(data.postType),
    tone: normalizeTone(data.tone),
    length: normalizeLength(data.length),
    projectName: String(data.projectName || ""),
    website: String(data.website || ""),
    communityName: String(data.communityName || ""),
    socialLinks: String(data.socialLinks || ""),
    fields: (data.fields && typeof data.fields === "object" ? data.fields : {}) as Record<
      string,
      string
    >,
    body: String(data.body || ""),
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
  };
}

export async function listCommunityDrafts(userId: string) {
  const snap = await draftsCol(userId).orderBy("updatedAt", "desc").limit(40).get();
  return snap.docs.map((d) => mapDoc(d.id, d.data(), userId));
}

export async function listCommunityTemplates(userId: string) {
  const snap = await templatesCol(userId).orderBy("updatedAt", "desc").limit(40).get();
  return snap.docs.map((d) => mapDoc(d.id, d.data(), userId));
}

export async function deleteCommunityDraft(userId: string, id: string) {
  await draftsCol(userId).doc(id).delete();
  return { ok: true };
}

export async function deleteCommunityTemplate(userId: string, id: string) {
  await templatesCol(userId).doc(id).delete();
  return { ok: true };
}
