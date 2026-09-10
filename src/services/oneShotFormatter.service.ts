import OpenAI from "openai";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const ONE_SHOT_GENRES = [
  "romance",
  "horror",
  "scifi",
  "comedy",
  "literary",
  "thriller",
  "fantasy",
  "other",
] as const;

export type OneShotGenre = (typeof ONE_SHOT_GENRES)[number];

export const ONE_SHOT_GENRE_LABELS: Record<OneShotGenre, string> = {
  romance: "Romance",
  horror: "Horror",
  scifi: "Sci-Fi",
  comedy: "Comedy",
  literary: "Literary",
  thriller: "Thriller",
  fantasy: "Fantasy",
  other: "Other",
};

export type OneShotStatus = "draft" | "published";
export type OneShotVisibility = "public" | "private";

export type OneShotStory = {
  id: string;
  userId: string;
  authorName: string;
  authorEmail?: string;
  title: string;
  originalText: string;
  formattedText: string;
  genre: OneShotGenre;
  description: string;
  visibility: OneShotVisibility;
  status: OneShotStatus;
  wordCount: number;
  readingMinutes: number;
  views: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};

function normalizeGenre(raw: unknown): OneShotGenre {
  const g = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (g === "sciencefiction") return "scifi";
  if ((ONE_SHOT_GENRES as readonly string[]).includes(g)) return g as OneShotGenre;
  return "other";
}

function readingMinutes(words: number) {
  return Math.max(1, Math.ceil(words / 225));
}

function storiesCol() {
  return getFirestore().collection("oneShotStories");
}

function mapDoc(id: string, data: Record<string, any>): OneShotStory {
  return {
    id,
    userId: String(data.userId || ""),
    authorName: String(data.authorName || "Writer"),
    authorEmail: data.authorEmail ? String(data.authorEmail) : undefined,
    title: String(data.title || "Untitled"),
    originalText: String(data.originalText || ""),
    formattedText: String(data.formattedText || ""),
    genre: normalizeGenre(data.genre),
    description: String(data.description || ""),
    visibility: data.visibility === "private" ? "private" : "public",
    status: data.status === "published" ? "published" : "draft",
    wordCount: Number(data.wordCount || 0),
    readingMinutes: Number(data.readingMinutes || readingMinutes(Number(data.wordCount || 0))),
    views: Number(data.views || 0),
    likes: Number(data.likes || 0),
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
    publishedAt: data.publishedAt ? String(data.publishedAt) : null,
  };
}

/** Deterministic readability pass used as fallback / light pre-clean */
export function localFormatOneShot(title: string, body: string) {
  let text = String(body || "").replace(/\r\n/g, "\n").trim();
  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Ensure dialogue lines that start mid-paragraph with quotes get breathing room when jammed
  text = text.replace(/([.!?])\s*(")/g, "$1\n\n$2");
  // Split dense single newlines that look like paragraph breaks after sentences
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  const cleanTitle = String(title || "").trim() || "Untitled";
  // Drop a leading title line if it duplicates the entered title
  const lines = text.split("\n");
  if (lines[0] && lines[0].trim().toLowerCase() === cleanTitle.toLowerCase()) {
    text = lines.slice(1).join("\n").replace(/^\n+/, "");
  }

  const wordCount = countWords(text);
  return {
    title: cleanTitle,
    formattedText: text.trim(),
    wordCount,
    readingMinutes: readingMinutes(wordCount),
  };
}

export async function formatOneShotWithAi(input: {
  userId: string;
  userEmail?: string | null;
  title: string;
  story: string;
}) {
  const title = String(input.title || "").trim();
  const story = String(input.story || "").trim();
  if (story.length < 40) {
    throw Object.assign(new Error("Paste a fuller one-shot story (at least a few paragraphs)."), {
      status: 400,
    });
  }

  const system = [
    "You are a fiction formatting engine for one-shot short stories.",
    "Format the submitted story for readability.",
    "Do not change the plot, characters, meaning, events, or author's voice.",
    "Do not add new content.",
    "Do not summarize, rewrite, or improve prose.",
    "Only adjust: paragraph spacing, dialogue line breaks, title/heading presentation, and obvious whitespace.",
    "Preserve every sentence the author wrote.",
    "Output plain text only:",
    "Line 1: the story title (Title Case if it was ALL CAPS, otherwise keep natural casing).",
    "Then a blank line.",
    "Then the formatted story body with readable paragraph breaks.",
    "No markdown fences. No commentary before or after.",
  ].join("\n");

  const user = [
    `Title (user entered): ${title || "(derive from first line if present)"}`,
    "",
    "STORY:",
    story,
  ].join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("Formatter returned empty output.");

  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "one-shot-formatter",
    wordsAnalyzed: countWords(story),
    tokensUsed: completion.usage?.total_tokens || 0,
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    model: completion.model || model,
    inputPreview: story.slice(0, 200),
  });

  const firstBreak = content.indexOf("\n");
  let outTitle = title || "Untitled";
  let body = content;
  if (firstBreak > 0) {
    outTitle = content.slice(0, firstBreak).trim() || outTitle;
    body = content.slice(firstBreak).replace(/^\n+/, "").trim();
  }

  const wordCount = countWords(body);
  return {
    title: outTitle,
    originalText: story,
    formattedText: body,
    wordCount,
    readingMinutes: readingMinutes(wordCount),
  };
}

export async function saveOneShot(input: {
  userId: string;
  authorName?: string;
  authorEmail?: string | null;
  id?: string;
  title: string;
  originalText: string;
  formattedText: string;
  genre?: string;
  description?: string;
  visibility?: OneShotVisibility;
  status?: OneShotStatus;
}): Promise<OneShotStory> {
  const now = new Date().toISOString();
  const formattedText = String(input.formattedText || "").trim();
  const title = String(input.title || "").trim() || "Untitled";
  if (formattedText.length < 20) {
    throw Object.assign(new Error("Story is too short to save."), { status: 400 });
  }

  const wordCount = countWords(formattedText);
  const base = {
    userId: input.userId,
    authorName: String(input.authorName || "Writer"),
    authorEmail: input.authorEmail || null,
    title,
    originalText: String(input.originalText || ""),
    formattedText,
    genre: normalizeGenre(input.genre),
    description: String(input.description || "").trim(),
    visibility: input.visibility === "private" ? "private" : "public",
    status: (input.status === "published" ? "published" : "draft") as OneShotStatus,
    wordCount,
    readingMinutes: readingMinutes(wordCount),
    updatedAt: now,
  };

  if (input.id) {
    const ref = storiesCol().doc(input.id);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error("Story not found."), { status: 404 });
    if (snap.data()?.userId !== input.userId) {
      throw Object.assign(new Error("Forbidden."), { status: 403 });
    }
    const patch: Record<string, unknown> = { ...base };
    if (base.status === "published" && !snap.data()?.publishedAt) {
      patch.publishedAt = now;
    }
    if (base.status === "draft") {
      // keep publishedAt if was published before? User saving as draft after publish — leave as draft
      if (snap.data()?.status === "published" && base.status === "draft") {
        patch.publishedAt = snap.data()?.publishedAt || null;
      }
    }
    await ref.set(patch, { merge: true });
    return mapDoc(ref.id, (await ref.get()).data()!);
  }

  const ref = storiesCol().doc();
  await ref.set({
    ...base,
    views: 0,
    likes: 0,
    createdAt: now,
    publishedAt: base.status === "published" ? now : null,
  });
  return mapDoc(ref.id, (await ref.get()).data()!);
}

export async function publishOneShot(input: {
  userId: string;
  authorName?: string;
  authorEmail?: string | null;
  id?: string;
  title: string;
  originalText: string;
  formattedText: string;
  genre: string;
  description: string;
  visibility: OneShotVisibility;
}) {
  return saveOneShot({
    ...input,
    status: "published",
    visibility: input.visibility || "public",
  });
}

export async function listMyOneShots(userId: string): Promise<OneShotStory[]> {
  const snap = await storiesCol().where("userId", "==", userId).limit(80).get();
  const list = snap.docs.map((d) => mapDoc(d.id, d.data()));
  list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return list;
}

export async function listPublicOneShots(limit = 40): Promise<OneShotStory[]> {
  const snap = await storiesCol()
    .where("status", "==", "published")
    .where("visibility", "==", "public")
    .limit(limit)
    .get();
  const list = snap.docs.map((d) => mapDoc(d.id, d.data()));
  list.sort((a, b) => (b.publishedAt || b.updatedAt || "").localeCompare(a.publishedAt || a.updatedAt || ""));
  return list;
}

export async function getOneShot(id: string, viewerId?: string) {
  const snap = await storiesCol().doc(id).get();
  if (!snap.exists) throw Object.assign(new Error("Story not found."), { status: 404 });
  const story = mapDoc(snap.id, snap.data()!);
  const isOwner = viewerId && story.userId === viewerId;
  if (story.status !== "published" || story.visibility === "private") {
    if (!isOwner) throw Object.assign(new Error("Story not available."), { status: 403 });
  }
  return story;
}

export async function deleteOneShot(userId: string, id: string) {
  const ref = storiesCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data()?.userId !== userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }
  await ref.delete();
  return { ok: true };
}

export async function incrementOneShotViews(id: string) {
  const ref = storiesCol().doc(id);
  await ref.update({ views: FieldValue.increment(1) });
}
