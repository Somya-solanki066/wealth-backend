import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const MICRO_GENRES = [
  "romance",
  "thriller",
  "horror",
  "scifi",
  "comedy",
  "fantasy",
  "literary",
  "other",
] as const;

export type MicroGenre = (typeof MICRO_GENRES)[number];

export const MICRO_GENRE_LABELS: Record<MicroGenre, string> = {
  romance: "Romance",
  thriller: "Thriller",
  horror: "Horror",
  scifi: "Sci-Fi",
  comedy: "Comedy",
  fantasy: "Fantasy",
  literary: "Literary",
  other: "Other",
};

export const PART_PURPOSES = [
  "Setup",
  "Conflict",
  "Twist",
  "Escalation",
  "Cliffhanger",
  "Resolution",
] as const;

export type MicroPart = {
  id: string;
  title: string;
  whatHappens: string;
  purpose: string;
  endingHook: string;
  body: string;
  status: "outline" | "draft" | "done";
};

export type MicroSerial = {
  id: string;
  userId: string;
  title: string;
  storyIdea: string;
  genre: MicroGenre;
  partCount: number;
  parts: MicroPart[];
  status: "outline" | "writing" | "complete";
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_TITLES = [
  "The setup",
  "The twist",
  "Escalation",
  "Rising stakes",
  "The turn",
  "Confrontation",
  "Resolution",
];

function col() {
  return getFirestore().collection("microSerials");
}

function normalizeGenre(raw: unknown): MicroGenre {
  const g = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (g === "sciencefiction") return "scifi";
  if ((MICRO_GENRES as readonly string[]).includes(g)) return g as MicroGenre;
  return "other";
}

function clampParts(n: number) {
  return Math.min(7, Math.max(5, Math.floor(n) || 5));
}

function emptyPart(index: number, title?: string): MicroPart {
  return {
    id: `part_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    title: title || DEFAULT_TITLES[index] || `Part ${index + 1}`,
    whatHappens: "",
    purpose: index === 0 ? "Setup" : index >= 6 ? "Resolution" : "",
    endingHook: "",
    body: "",
    status: "outline",
  };
}

function mapDoc(id: string, data: Record<string, any>): MicroSerial {
  const parts: MicroPart[] = Array.isArray(data.parts)
    ? data.parts.map((p: any, i: number) => ({
        id: String(p.id || `part_${i}`),
        title: String(p.title || `Part ${i + 1}`),
        whatHappens: String(p.whatHappens || ""),
        purpose: String(p.purpose || ""),
        endingHook: String(p.endingHook || ""),
        body: String(p.body || ""),
        status: (p.status === "done"
          ? "done"
          : p.status === "draft"
            ? "draft"
            : "outline") as MicroPart["status"],
      }))
    : [];
  return {
    id,
    userId: String(data.userId || ""),
    title: String(data.title || "Untitled serial"),
    storyIdea: String(data.storyIdea || ""),
    genre: normalizeGenre(data.genre),
    partCount: Number(data.partCount || parts.length || 5),
    parts,
    status:
      data.status === "complete" ? "complete" : data.status === "writing" ? "writing" : "outline",
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
  };
}

function parseJsonLoose(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  return JSON.parse(cleaned);
}

export async function generateMicroOutline(input: {
  userId: string;
  userEmail?: string | null;
  storyIdea: string;
  genre: string;
  partCount: number;
  title?: string;
}) {
  const idea = String(input.storyIdea || "").trim();
  if (idea.length < 20) {
    throw Object.assign(new Error("Add a clearer story idea (at least a sentence or two)."), {
      status: 400,
    });
  }
  const partCount = clampParts(input.partCount);
  const genre = normalizeGenre(input.genre);

  const system = [
    "You outline short micro-serial flash fiction (NOT full-length novels).",
    `Create exactly ${partCount} parts.`,
    "Each part must advance the same continuous story.",
    "Do not invent a different cast mid-serial.",
    "Return ONLY valid JSON with this shape:",
    '{"title":"string","parts":[{"title":"string","whatHappens":"string","purpose":"Setup|Conflict|Twist|Escalation|Cliffhanger|Resolution","endingHook":"string"}]}',
    "Keep each field concise (1–3 sentences). Ending hooks should make the reader want the next part.",
  ].join("\n");

  const user = [
    `Genre: ${MICRO_GENRE_LABELS[genre]}`,
    `Parts: ${partCount}`,
    `Working title (optional): ${input.title || "(invent a short title)"}`,
    `Story idea: ${idea}`,
  ].join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No outline returned.");

  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "micro-serial",
    wordsAnalyzed: countWords(idea),
    tokensUsed: completion.usage?.total_tokens || 0,
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    model: completion.model || model,
    inputPreview: idea.slice(0, 200),
  });

  const parsed = parseJsonLoose(content);
  const partsRaw = Array.isArray(parsed.parts) ? parsed.parts : [];
  const parts: MicroPart[] = [];
  for (let i = 0; i < partCount; i++) {
    const p = partsRaw[i] || {};
    parts.push({
      ...emptyPart(i, String(p.title || DEFAULT_TITLES[i] || `Part ${i + 1}`)),
      whatHappens: String(p.whatHappens || ""),
      purpose: String(p.purpose || ""),
      endingHook: String(p.endingHook || ""),
    });
  }

  return {
    title: String(parsed.title || input.title || "Untitled serial").trim(),
    genre,
    partCount,
    storyIdea: idea,
    parts,
  };
}

export async function assistWritePart(input: {
  userId: string;
  userEmail?: string | null;
  serial: MicroSerial;
  partIndex: number;
}) {
  const idx = input.partIndex;
  const part = input.serial.parts[idx];
  if (!part) throw Object.assign(new Error("Part not found."), { status: 404 });

  const prior = input.serial.parts.slice(0, idx).map((p, i) => ({
    part: i + 1,
    title: p.title,
    whatHappens: p.whatHappens,
    endingHook: p.endingHook,
    bodyPreview: (p.body || "").slice(0, 1200),
  }));

  const system = [
    "You help writers draft ONE part of a micro-serial flash story.",
    "Maintain continuity with prior parts: same characters, events, setting, unresolved conflicts.",
    "Do not rewrite previous parts. Do not jump to the ending unless this is the final part.",
    "Write prose for this part only (800–1400 words target is fine; shorter OK for flash).",
    "Plain text only. No markdown fences. No commentary.",
  ].join("\n");

  const user = [
    `Serial title: ${input.serial.title}`,
    `Genre: ${MICRO_GENRE_LABELS[input.serial.genre]}`,
    `Story idea: ${input.serial.storyIdea}`,
    `This is Part ${idx + 1} of ${input.serial.parts.length}`,
    `Part title: ${part.title}`,
    `Purpose: ${part.purpose || "n/a"}`,
    `What happens: ${part.whatHappens || "n/a"}`,
    `Ending hook to land on: ${part.endingHook || "n/a"}`,
    "",
    "PRIOR PARTS CONTEXT:",
    JSON.stringify(prior, null, 2),
    "",
    "Write Part " + (idx + 1) + " now.",
  ].join("\n");

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
  if (!content) throw new Error("No draft returned.");

  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "micro-serial",
    wordsAnalyzed: countWords(JSON.stringify(prior)),
    tokensUsed: completion.usage?.total_tokens || 0,
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    model: completion.model || model,
    inputPreview: `${input.serial.title} part ${idx + 1}`.slice(0, 200),
  });

  return { body: content };
}

export function defaultOutlineParts(partCount: number): MicroPart[] {
  const n = clampParts(partCount);
  return Array.from({ length: n }, (_, i) => emptyPart(i));
}

export async function listMyMicroSerials(userId: string): Promise<MicroSerial[]> {
  const snap = await col().where("userId", "==", userId).limit(60).get();
  const list = snap.docs.map((d) => mapDoc(d.id, d.data()));
  list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return list;
}

export async function getMicroSerial(userId: string, id: string): Promise<MicroSerial> {
  const snap = await col().doc(id).get();
  if (!snap.exists) throw Object.assign(new Error("Serial not found."), { status: 404 });
  const serial = mapDoc(snap.id, snap.data()!);
  if (serial.userId !== userId) throw Object.assign(new Error("Forbidden."), { status: 403 });
  return serial;
}

export async function saveMicroSerial(input: {
  userId: string;
  id?: string;
  title: string;
  storyIdea: string;
  genre: string;
  partCount?: number;
  parts: MicroPart[];
  status?: MicroSerial["status"];
}): Promise<MicroSerial> {
  const now = new Date().toISOString();
  const parts = (input.parts || []).map((p, i) => ({
    id: String(p.id || `part_${i}`),
    title: String(p.title || `Part ${i + 1}`).trim() || `Part ${i + 1}`,
    whatHappens: String(p.whatHappens || ""),
    purpose: String(p.purpose || ""),
    endingHook: String(p.endingHook || ""),
    body: String(p.body || ""),
    status: p.status === "done" ? "done" : p.body?.trim() ? "draft" : "outline",
  })) as MicroPart[];

  if (parts.length < 3) {
    throw Object.assign(new Error("Add at least 3 parts (5–7 recommended)."), { status: 400 });
  }
  if (parts.length > 7) {
    throw Object.assign(new Error("Micro-serials support a maximum of 7 parts."), { status: 400 });
  }

  const allDone = parts.every((p) => p.status === "done" || (p.body && p.body.trim().length > 40));
  const anyWriting = parts.some((p) => (p.body || "").trim().length > 0);
  const status: MicroSerial["status"] =
    input.status ||
    (allDone && parts.length >= 5 ? "complete" : anyWriting ? "writing" : "outline");

  const payload = {
    userId: input.userId,
    title: String(input.title || "Untitled serial").trim() || "Untitled serial",
    storyIdea: String(input.storyIdea || "").trim(),
    genre: normalizeGenre(input.genre),
    partCount: parts.length,
    parts,
    status,
    updatedAt: now,
  };

  if (input.id) {
    const ref = col().doc(input.id);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error("Serial not found."), { status: 404 });
    if (snap.data()?.userId !== input.userId) {
      throw Object.assign(new Error("Forbidden."), { status: 403 });
    }
    await ref.set(payload, { merge: true });
    return mapDoc(ref.id, (await ref.get()).data()!);
  }

  const ref = col().doc();
  await ref.set({ ...payload, createdAt: now });
  return mapDoc(ref.id, (await ref.get()).data()!);
}

export async function deleteMicroSerial(userId: string, id: string) {
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data()?.userId !== userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }
  await ref.delete();
  return { ok: true };
}
