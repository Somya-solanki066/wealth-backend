import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

const SETTINGS_DOC = "pitchTemplates";

export type PitchFieldDef = {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
  multiline?: boolean;
};

export type PitchTemplate = {
  id: string;
  name: string;
  description: string;
  structure: string;
  fields: PitchFieldDef[];
  generateLabel: string;
  active: boolean;
  sortOrder: number;
};

export type PitchTemplatesSettings = {
  templates: PitchTemplate[];
  updatedAt?: string;
};

export const DEFAULT_PITCH_TEMPLATES: PitchTemplate[] = [
  {
    id: "cold-email",
    name: "Cold email to a content agency",
    description: "Outreach to agencies looking for freelance writers.",
    structure: `Hi [Agency Name] —

I'm [Your Name]. I write serialized fiction and freelance content, and I noticed [Agency Name] works with clients in [Agency/Niche].

I specialize in [Your Service]. [Your Experience]

I'd love to send a few quick samples if you're open to it.
Portfolio: [Portfolio Link]

Would you be open to a short intro call?`,
    fields: [
      { key: "yourName", label: "Your Name", required: true, placeholder: "Alex Rivera" },
      { key: "agencyName", label: "Agency Name", required: true, placeholder: "Northline Content" },
      { key: "niche", label: "Agency / Niche", required: true, placeholder: "SaaS / wellness" },
      { key: "service", label: "Your Service", required: true, placeholder: "SEO blog & newsletter copy" },
      { key: "experience", label: "Your Experience", required: true, multiline: true, placeholder: "5 years writing for DTC brands…" },
      { key: "portfolioLink", label: "Portfolio Link", required: false, placeholder: "https://…" },
    ],
    generateLabel: "Generate Pitch",
    active: true,
    sortOrder: 1,
  },
  {
    id: "gig-application",
    name: "Gig application (Upwork/Fiverr style)",
    description: "Apply to a specific job listing with relevant proof.",
    structure: `Hi [Client Name],

I saw your listing for [Job Title] and would love to help.

Job context: [Job Description]

Relevant experience: [Your Relevant Experience]

Portfolio: [Portfolio Link]
Availability: [Your Availability]

Happy to start with a paid trial piece if helpful.`,
    fields: [
      { key: "clientName", label: "Client Name", required: true, placeholder: "Sarah" },
      { key: "jobTitle", label: "Job Title", required: true, placeholder: "10 skincare blogs / month" },
      { key: "jobDescription", label: "Job Description", required: true, multiline: true, placeholder: "What the listing asks for…" },
      { key: "experience", label: "Your Relevant Experience", required: true, multiline: true, placeholder: "3 years content writing…" },
      { key: "portfolioLink", label: "Portfolio Link", required: false, placeholder: "https://…" },
      { key: "availability", label: "Your Availability", required: true, placeholder: "Can start this week" },
    ],
    generateLabel: "Generate Application",
    active: true,
    sortOrder: 2,
  },
  {
    id: "referral-followup",
    name: "Referral follow-up",
    description: "Thank a referral intro and propose next steps.",
    structure: `Hey [Client Name],

Thanks again for the intro from [Referrer's Name]. I'm [Your Name].

I help with [Service]. [Previous Conversation]

Sharing my rate card and recent samples in case there's a fit:
[Portfolio Link]

Happy to jump on a quick call whenever works.`,
    fields: [
      { key: "yourName", label: "Your Name", required: true, placeholder: "Alex Rivera" },
      { key: "referrerName", label: "Referrer's Name", required: true, placeholder: "Jordan" },
      { key: "clientName", label: "Client Name", required: true, placeholder: "Sam" },
      { key: "service", label: "Service", required: true, placeholder: "Newsletter + blog retainers" },
      { key: "previousConversation", label: "Previous Conversation", required: false, multiline: true, placeholder: "We briefly discussed…" },
      { key: "portfolioLink", label: "Portfolio Link", required: false, placeholder: "https://…" },
    ],
    generateLabel: "Generate Follow-up",
    active: true,
    sortOrder: 3,
  },
  {
    id: "ghostwriting-inquiry",
    name: "Ghostwriting inquiry",
    description: "Pitch ghostwriting for memoirs, business books, and more.",
    structure: `Hi [Client Name] —

I'm [Your Name]. I ghostwrite [Book/Project Type] and specialize in [Genre / Niche].

[Your Experience]

Would love 15 minutes to see if I can help with [Book/Project Type].
Portfolio: [Portfolio Link]`,
    fields: [
      { key: "yourName", label: "Your Name", required: true, placeholder: "Alex Rivera" },
      { key: "clientName", label: "Client Name", required: true, placeholder: "Morgan" },
      { key: "projectType", label: "Book / Project Type", required: true, placeholder: "memoirs / business books" },
      { key: "genre", label: "Genre / Niche", required: true, placeholder: "founder stories" },
      { key: "experience", label: "Your Experience", required: true, multiline: true, placeholder: "Turning interviews into finished manuscripts…" },
      { key: "portfolioLink", label: "Portfolio Link", required: false, placeholder: "https://…" },
    ],
    generateLabel: "Generate Inquiry",
    active: true,
    sortOrder: 4,
  },
];

function normalizeTemplate(raw: any, index: number): PitchTemplate {
  const fallback = DEFAULT_PITCH_TEMPLATES[index] || DEFAULT_PITCH_TEMPLATES[0];
  const fields = Array.isArray(raw?.fields)
    ? raw.fields.map((f: any) => ({
        key: String(f.key || "").trim(),
        label: String(f.label || f.key || "Field"),
        required: f.required !== false,
        placeholder: f.placeholder ? String(f.placeholder) : undefined,
        multiline: Boolean(f.multiline),
      })).filter((f: PitchFieldDef) => f.key)
    : fallback.fields;

  return {
    id: String(raw?.id || fallback.id || `tpl_${index}`),
    name: String(raw?.name || fallback.name || "Template"),
    description: String(raw?.description || fallback.description || ""),
    structure: String(raw?.structure || fallback.structure || ""),
    fields,
    generateLabel: String(raw?.generateLabel || fallback.generateLabel || "Generate Pitch"),
    active: raw?.active !== false,
    sortOrder: Number(raw?.sortOrder ?? index + 1),
  };
}

export async function getPitchTemplatesSettings(): Promise<PitchTemplatesSettings> {
  const snap = await getFirestore().collection("settings").doc(SETTINGS_DOC).get();
  if (!snap.exists) {
    return { templates: DEFAULT_PITCH_TEMPLATES.map((t) => ({ ...t, fields: [...t.fields] })) };
  }
  const data = snap.data() || {};
  const templates =
    Array.isArray(data.templates) && data.templates.length
      ? data.templates.map((t: any, i: number) => normalizeTemplate(t, i))
      : DEFAULT_PITCH_TEMPLATES.map((t) => ({ ...t, fields: [...t.fields] }));
  templates.sort((a: PitchTemplate, b: PitchTemplate) => a.sortOrder - b.sortOrder);
  return { templates, updatedAt: data.updatedAt };
}

export async function savePitchTemplatesSettings(
  patch: Partial<PitchTemplatesSettings>
): Promise<PitchTemplatesSettings> {
  const current = await getPitchTemplatesSettings();
  const templates = Array.isArray(patch.templates)
    ? patch.templates.map((t, i) => normalizeTemplate(t, i))
    : current.templates;

  if (!templates.length) {
    throw Object.assign(new Error("At least one template is required."), { status: 400 });
  }

  const next: PitchTemplatesSettings = {
    templates,
    updatedAt: new Date().toISOString(),
  };
  await getFirestore().collection("settings").doc(SETTINGS_DOC).set(next, { merge: true });
  return next;
}

/** Active templates for the user calculator (no inactive). */
export async function listActivePitchTemplates() {
  const { templates } = await getPitchTemplatesSettings();
  return templates
    .filter((t) => t.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      structure: t.structure,
      fields: t.fields,
      generateLabel: t.generateLabel,
    }));
}

function fillStructurePreview(structure: string, details: Record<string, string>) {
  let out = structure;
  for (const [key, value] of Object.entries(details)) {
    if (!value?.trim()) continue;
    // Replace common bracket labels loosely by matching field values into structure via AI;
    // for static preview we leave brackets — AI does personalization.
    out = out.replace(new RegExp(`\\[${key}\\]`, "gi"), value.trim());
  }
  return out;
}

export async function generatePersonalizedPitch(input: {
  userId: string;
  userEmail?: string | null;
  templateId: string;
  details: Record<string, string>;
}) {
  const { templates } = await getPitchTemplatesSettings();
  const template = templates.find((t) => t.id === input.templateId && t.active);
  if (!template) {
    throw Object.assign(new Error("Template not found or inactive."), { status: 404 });
  }

  const details: Record<string, string> = {};
  for (const field of template.fields) {
    const val = String(input.details?.[field.key] ?? "").trim();
    if (field.required && !val) {
      throw Object.assign(new Error(`${field.label} is required.`), { status: 400 });
    }
    if (val) details[field.key] = val;
  }

  const detailLines = template.fields
    .map((f) => (details[f.key] ? `${f.label}: ${details[f.key]}` : null))
    .filter(Boolean)
    .join("\n");

  const system = [
    "You personalize freelance outreach pitches for writers.",
    "CRITICAL RULES:",
    "- Do NOT invent a random new pitch from scratch.",
    "- Base the output on the provided TEMPLATE STRUCTURE.",
    "- Replace placeholders with the user's details naturally.",
    "- Keep the same intent, length, and tone as the template.",
    "- Use only facts the user provided — do not fabricate clients, metrics, or awards.",
    "- Plain text only. No markdown fences. Keep paragraph breaks.",
    "- If a detail is missing, omit that clause gracefully instead of inventing it.",
  ].join("\n");

  const user = [
    `Template name: ${template.name}`,
    "",
    "TEMPLATE STRUCTURE:",
    template.structure,
    "",
    "USER DETAILS:",
    detailLines || "(none)",
    "",
    "Write the final personalized pitch now.",
  ].join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.55,
  });

  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No pitch returned from OpenAI.");

  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "pitch-templates",
    wordsAnalyzed: countWords(detailLines),
    tokensUsed: completion.usage?.total_tokens || 0,
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    model: completion.model || model,
    inputPreview: `${template.id}: ${detailLines}`.slice(0, 200),
  });

  return {
    templateId: template.id,
    templateName: template.name,
    pitch: content,
    structurePreview: fillStructurePreview(template.structure, details),
  };
}

export type SavedPitch = {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  pitch: string;
  details: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

function savedCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("savedPitches");
}

export async function listSavedPitches(userId: string): Promise<SavedPitch[]> {
  const snap = await savedCol(userId).orderBy("createdAt", "desc").limit(50).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title || "Untitled pitch"),
      templateId: String(data.templateId || ""),
      templateName: String(data.templateName || ""),
      pitch: String(data.pitch || ""),
      details: (data.details || {}) as Record<string, string>,
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    };
  });
}

export async function saveUserPitch(input: {
  userId: string;
  title?: string;
  templateId: string;
  templateName: string;
  pitch: string;
  details?: Record<string, string>;
}): Promise<SavedPitch> {
  const pitch = String(input.pitch || "").trim();
  if (pitch.length < 20) {
    throw Object.assign(new Error("Pitch is too short to save."), { status: 400 });
  }
  const now = new Date().toISOString();
  const title =
    String(input.title || "").trim() ||
    `${input.templateName || "Pitch"} — ${new Date().toLocaleDateString()}`;

  const ref = savedCol(input.userId).doc();
  const doc: Omit<SavedPitch, "id"> = {
    title,
    templateId: input.templateId,
    templateName: input.templateName,
    pitch,
    details: input.details || {},
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function deleteSavedPitch(userId: string, pitchId: string) {
  await savedCol(userId).doc(pitchId).delete();
  return { ok: true };
}

export async function updateSavedPitch(
  userId: string,
  pitchId: string,
  patch: { title?: string; pitch?: string }
) {
  const ref = savedCol(userId).doc(pitchId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Saved pitch not found."), { status: 404 });
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.title != null) updates.title = String(patch.title).trim();
  if (patch.pitch != null) updates.pitch = String(patch.pitch).trim();
  await ref.update(updates);
  const next = await ref.get();
  const data = next.data()!;
  return {
    id: next.id,
    title: String(data.title || ""),
    templateId: String(data.templateId || ""),
    templateName: String(data.templateName || ""),
    pitch: String(data.pitch || ""),
    details: (data.details || {}) as Record<string, string>,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
  } as SavedPitch;
}
