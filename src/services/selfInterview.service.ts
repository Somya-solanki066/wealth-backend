import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { countWords, recordAiUsage } from "../utils/aiUsage";

export const CHAPTER_LENGTHS = ["short", "medium", "long"] as const;
export type ChapterLength = (typeof CHAPTER_LENGTHS)[number];

export const CHAPTER_STYLES = ["personal", "professional", "storytelling"] as const;
export type ChapterStyle = (typeof CHAPTER_STYLES)[number];

export const CHAPTER_POVS = ["first", "third"] as const;
export type ChapterPov = (typeof CHAPTER_POVS)[number];

export const CHAPTER_TONES = [
  "personal",
  "inspirational",
  "professional",
  "conversational",
] as const;
export type ChapterTone = (typeof CHAPTER_TONES)[number];

export type WritingMode = "own" | "client";

export const BOOK_TYPES = ["memoir", "self-help", "business", "other"] as const;
export type BookType = (typeof BOOK_TYPES)[number];

export type NonfictionChapter = {
  id: string;
  title: string;
  topic: string;
  purpose?: string;
  keyPoints?: string[];
  transcript: string;
  body: string;
  length: ChapterLength;
  style: ChapterStyle;
  pov?: ChapterPov;
  tone?: ChapterTone;
  wordCount: number;
  targetWords?: number;
  status: "draft" | "review" | "approved" | "planned";
  createdAt: string;
  updatedAt: string;
};

export type NonfictionBook = {
  id: string;
  userId: string;
  mode: WritingMode;
  title: string;
  clientName?: string;
  genre?: string;
  bookType?: BookType;
  mainIdea?: string;
  targetAudience?: string;
  description?: string;
  chapters: NonfictionChapter[];
  createdAt: string;
  updatedAt: string;
};

const LENGTH_GUIDE: Record<ChapterLength, string> = {
  short: "about 1,500 words",
  medium: "about 2,500 words",
  long: "about 3,500 words",
};

const STYLE_GUIDE: Record<ChapterStyle, string> = {
  personal: "intimate first-person memoir voice, reflective and human",
  professional: "clear business/nonfiction voice, credible and structured",
  storytelling: "narrative-driven scenes with momentum and emotional beats",
};

const POV_GUIDE: Record<ChapterPov, string> = {
  first: "Write in first person (I / we) — author or client voice",
  third: "Write in third person (he / she / they)",
};

const TONE_GUIDE: Record<ChapterTone, string> = {
  personal: "warm, intimate, reflective",
  inspirational: "uplifting, motivating, hopeful without inventing facts",
  professional: "clear, credible, structured nonfiction",
  conversational: "natural spoken rhythm, approachable and direct",
};

function toneToLegacyStyle(tone: ChapterTone): ChapterStyle {
  if (tone === "professional") return "professional";
  if (tone === "inspirational" || tone === "conversational") return "storytelling";
  return "personal";
}

function booksCol() {
  return getFirestore().collection("nonfictionBooks");
}

function mapChapter(raw: any, i: number): NonfictionChapter {
  const body = String(raw?.body || "");
  const statusRaw = String(raw?.status || "");
  let status: NonfictionChapter["status"] = "planned";
  if (statusRaw === "approved") status = "approved";
  else if (statusRaw === "review") status = "review";
  else if (statusRaw === "draft" || body.trim().length > 40) status = "draft";
  else if (statusRaw === "planned") status = "planned";
  else if (body.trim()) status = "draft";

  return {
    id: String(raw?.id || `ch_${i}`),
    title: String(raw?.title || `Chapter ${i + 1}`),
    topic: String(raw?.topic || ""),
    purpose: raw?.purpose != null ? String(raw.purpose) : "",
    keyPoints: Array.isArray(raw?.keyPoints)
      ? raw.keyPoints.map(String).filter(Boolean)
      : String(raw?.keyPoints || "")
          .split("\n")
          .map((s) => s.replace(/^[•\-\*]\s*/, "").trim())
          .filter(Boolean),
    transcript: String(raw?.transcript || ""),
    body,
    length: (CHAPTER_LENGTHS.includes(raw?.length) ? raw.length : "medium") as ChapterLength,
    style: (CHAPTER_STYLES.includes(raw?.style) ? raw.style : "personal") as ChapterStyle,
    pov: (CHAPTER_POVS as readonly string[]).includes(String(raw?.pov || ""))
      ? (raw.pov as ChapterPov)
      : undefined,
    tone: (CHAPTER_TONES as readonly string[]).includes(String(raw?.tone || ""))
      ? (raw.tone as ChapterTone)
      : undefined,
    wordCount: Number(raw?.wordCount || countWords(body)),
    targetWords: raw?.targetWords != null ? Number(raw.targetWords) || undefined : undefined,
    status,
    createdAt: String(raw?.createdAt || ""),
    updatedAt: String(raw?.updatedAt || ""),
  };
}

function mapBook(id: string, data: Record<string, any>): NonfictionBook {
  const chapters = Array.isArray(data.chapters)
    ? data.chapters.map((c: any, i: number) => mapChapter(c, i))
    : [];
  const bookType = (BOOK_TYPES as readonly string[]).includes(String(data.bookType || ""))
    ? (data.bookType as BookType)
    : undefined;
  return {
    id,
    userId: String(data.userId || ""),
    mode: data.mode === "client" ? "client" : "own",
    title: String(data.title || "Untitled book"),
    clientName: data.clientName ? String(data.clientName) : undefined,
    genre: data.genre ? String(data.genre) : undefined,
    bookType,
    mainIdea: data.mainIdea ? String(data.mainIdea) : undefined,
    targetAudience: data.targetAudience ? String(data.targetAudience) : undefined,
    description: data.description ? String(data.description) : undefined,
    chapters,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
  };
}

async function callOpenAi(system: string, user: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.65,
  });
  const content = completion.choices[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("No content returned from OpenAI.");
  return { content, usage: completion.usage, model: completion.model || model };
}

export async function draftChapterFromInterview(input: {
  userId: string;
  userEmail?: string | null;
  transcript: string;
  topic?: string;
  chapterTitle?: string;
  length?: string;
  style?: string;
  pov?: string;
  tone?: string;
  targetWords?: number;
  mode?: WritingMode;
  clientName?: string;
  priorChaptersSummary?: string;
}) {
  const transcript = String(input.transcript || "").trim();
  if (transcript.length < 40) {
    throw Object.assign(new Error("Paste a longer interview transcript excerpt."), { status: 400 });
  }

  const length = (CHAPTER_LENGTHS.includes(input.length as ChapterLength)
    ? input.length
    : "medium") as ChapterLength;
  const tone = (CHAPTER_TONES.includes(input.tone as ChapterTone)
    ? input.tone
    : input.style === "professional"
      ? "professional"
      : "personal") as ChapterTone;
  const style = (CHAPTER_STYLES.includes(input.style as ChapterStyle)
    ? input.style
    : toneToLegacyStyle(tone)) as ChapterStyle;
  const pov = (CHAPTER_POVS.includes(input.pov as ChapterPov)
    ? input.pov
    : "first") as ChapterPov;
  const topic = String(input.topic || "").trim();
  const chapterTitle = String(input.chapterTitle || "").trim();
  const mode = input.mode === "client" ? "client" : "own";
  const targetWords = input.targetWords
    ? Math.round(Number(input.targetWords))
    : length === "short"
      ? 1500
      : length === "long"
        ? 3500
        : 2500;

  const system = [
    "You turn interview transcripts into polished nonfiction book chapters.",
    "CRITICAL RULES:",
    "- Use ONLY facts, people, events, and details present in the transcript (and optional prior-chapter context).",
    "- Do NOT invent new events, people, companies, quotes, or outcomes.",
    "- You may arrange chronology, tighten prose, and add light narrative connective tissue without inventing facts.",
    "- Extract key events, people, experiences, lessons, quotes, and timeline cues from the material.",
    "- Output plain text: first line is the chapter title (no 'Chapter X —' prefix unless the user provided one), then a blank line, then the chapter body.",
    "- No markdown fences. No commentary before or after.",
  ].join("\n");

  const user = [
    `Mode: ${mode === "client" ? "Ghostwriting for a client" : "Author writing their own book"}`,
    input.clientName ? `Client name: ${input.clientName}` : "",
    `Chapter topic: ${topic || "(infer from transcript)"}`,
    `Preferred title: ${chapterTitle || "(create a short evocative title from the material)"}`,
    `Target length: about ${targetWords.toLocaleString()} words (${LENGTH_GUIDE[length]})`,
    `Point of view: ${POV_GUIDE[pov]}`,
    `Tone: ${TONE_GUIDE[tone]}`,
    `Voice notes: ${STYLE_GUIDE[style]}`,
    input.priorChaptersSummary
      ? `Prior book context (continuity — do not contradict):\n${input.priorChaptersSummary}`
      : "",
    "",
    "INTERVIEW TRANSCRIPT:",
    transcript,
    "",
    "Draft the chapter now.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callOpenAi(system, user);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "self-interview-builder",
    wordsAnalyzed: countWords(transcript),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: transcript.slice(0, 200),
  });

  const firstBreak = result.content.indexOf("\n");
  let title = chapterTitle || "Untitled chapter";
  let body = result.content;
  if (firstBreak > 0) {
    title = result.content.slice(0, firstBreak).trim() || title;
    body = result.content.slice(firstBreak).replace(/^\n+/, "").trim();
  }

  return {
    title,
    topic,
    transcript,
    body,
    length,
    style,
    pov,
    tone,
    targetWords,
    wordCount: countWords(body),
  };
}

export async function refineChapter(input: {
  userId: string;
  userEmail?: string | null;
  action:
    | "regenerate"
    | "expand"
    | "shorten"
    | "more-personal"
    | "improve-flow"
    | "rewrite";
  title: string;
  body: string;
  transcript: string;
  topic?: string;
  length?: string;
  style?: string;
  pov?: string;
  tone?: string;
}) {
  const body = String(input.body || "").trim();
  const transcript = String(input.transcript || "").trim();
  if (body.length < 40) {
    throw Object.assign(new Error("Chapter body is too short to refine."), { status: 400 });
  }

  const actionGuide: Record<string, string> = {
    regenerate:
      "Rewrite the chapter freshly from the transcript and current draft intent. Keep facts identical.",
    expand: "Expand with more scene detail and reflection using ONLY transcript facts. Do not invent.",
    shorten: "Tighten and shorten while preserving meaning and all key facts.",
    "more-personal": "Make the voice more personal and reflective without inventing new life events.",
    "improve-flow":
      "Improve pacing, transitions, and readability while keeping all facts and voice intent.",
    rewrite: "Rewrite for clarity and polish without inventing new facts.",
  };

  const system = [
    "You refine nonfiction chapters drafted from interview transcripts.",
    "Do NOT invent facts, people, or events not present in the transcript/draft.",
    "Output plain text: title on line 1, blank line, then body. No commentary.",
    actionGuide[input.action] || actionGuide.regenerate,
  ].join("\n");

  const user = [
    `Action: ${input.action}`,
    `Topic: ${input.topic || ""}`,
    `Current title: ${input.title}`,
    "",
    "CURRENT DRAFT:",
    body,
    "",
    "SOURCE TRANSCRIPT:",
    transcript || "(not provided)",
  ].join("\n");

  const result = await callOpenAi(system, user);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "self-interview-builder",
    wordsAnalyzed: countWords(body),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: `${input.action}: ${input.title}`.slice(0, 200),
  });

  const firstBreak = result.content.indexOf("\n");
  let title = input.title;
  let nextBody = result.content;
  if (firstBreak > 0) {
    title = result.content.slice(0, firstBreak).trim() || title;
    nextBody = result.content.slice(firstBreak).replace(/^\n+/, "").trim();
  }

  return { title, body: nextBody, wordCount: countWords(nextBody) };
}

export async function listMyBooks(userId: string): Promise<NonfictionBook[]> {
  const snap = await booksCol().where("userId", "==", userId).limit(50).get();
  const list = snap.docs.map((d) => mapBook(d.id, d.data()));
  list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return list;
}

export async function getBook(userId: string, id: string): Promise<NonfictionBook> {
  const snap = await booksCol().doc(id).get();
  if (!snap.exists) throw Object.assign(new Error("Book not found."), { status: 404 });
  const book = mapBook(snap.id, snap.data()!);
  if (book.userId !== userId) throw Object.assign(new Error("Forbidden."), { status: 403 });
  return book;
}

export async function saveBook(input: {
  userId: string;
  id?: string;
  mode: WritingMode;
  title: string;
  clientName?: string;
  genre?: string;
  bookType?: string;
  mainIdea?: string;
  targetAudience?: string;
  description?: string;
  chapters?: NonfictionChapter[];
}): Promise<NonfictionBook> {
  const now = new Date().toISOString();
  const title = String(input.title || "").trim() || "Untitled book";
  const bookType = (BOOK_TYPES as readonly string[]).includes(String(input.bookType || ""))
    ? input.bookType
    : "other";

  const payload: Record<string, unknown> = {
    mode: input.mode === "client" ? "client" : "own",
    title,
    clientName: input.clientName || null,
    genre: input.genre || bookType || null,
    bookType,
    mainIdea: input.mainIdea != null ? String(input.mainIdea) : null,
    targetAudience: input.targetAudience != null ? String(input.targetAudience) : null,
    description: input.description || null,
    updatedAt: now,
  };

  if (Array.isArray(input.chapters)) {
    payload.chapters = input.chapters.map((c, i) => mapChapter(c, i));
  }

  if (input.id) {
    const ref = booksCol().doc(input.id);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error("Book not found."), { status: 404 });
    if (snap.data()?.userId !== input.userId) {
      throw Object.assign(new Error("Forbidden."), { status: 403 });
    }
    await ref.set(payload, { merge: true });
    return mapBook(ref.id, (await ref.get()).data()!);
  }

  const ref = booksCol().doc();
  await ref.set({
    userId: input.userId,
    ...payload,
    chapters: Array.isArray(input.chapters) ? input.chapters.map((c, i) => mapChapter(c, i)) : [],
    createdAt: now,
  });
  return mapBook(ref.id, (await ref.get()).data()!);
}

export async function generateBookOutline(input: {
  userId: string;
  userEmail?: string | null;
  title: string;
  bookType: string;
  mainIdea: string;
  targetAudience: string;
  chapterCount?: number;
  mode?: WritingMode;
  clientName?: string;
}) {
  const title = String(input.title || "").trim();
  const mainIdea = String(input.mainIdea || "").trim();
  if (title.length < 2) {
    throw Object.assign(new Error("Enter a book title."), { status: 400 });
  }
  if (mainIdea.length < 10) {
    throw Object.assign(new Error("Add a clearer main idea / book goal."), { status: 400 });
  }

  const count = Math.min(16, Math.max(5, Math.floor(Number(input.chapterCount) || 10)));
  const bookType = String(input.bookType || "other");

  const system = [
    "You outline full-length nonfiction books (memoir, self-help, business, etc.).",
    `Create about ${count} chapters including an Introduction and a Conclusion when appropriate.`,
    "Return ONLY valid JSON:",
    '{"chapters":[{"title":"string","purpose":"string","keyPoints":["string","string"]}]}',
    "Titles should be concise. Purpose = 1–2 sentences. Key points = 3–5 bullets.",
    "Do not invent the author's private life facts beyond what the main idea implies as structure.",
  ].join("\n");

  const user = [
    `Mode: ${input.mode === "client" ? "Ghostwriting for client" : "Author's own book"}`,
    input.clientName ? `Client: ${input.clientName}` : "",
    `Title: ${title}`,
    `Book type: ${bookType}`,
    `Main idea / goal: ${mainIdea}`,
    `Target audience: ${input.targetAudience || "general readers"}`,
    `Target chapter count: ~${count}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callOpenAi(system, user);
  await recordAiUsage({
    userId: input.userId,
    userEmail: input.userEmail,
    field: "wealthEngineCount",
    tool: "outline-builder",
    wordsAnalyzed: countWords(mainIdea),
    tokensUsed: result.usage?.total_tokens || 0,
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    model: result.model,
    inputPreview: `${title}: ${mainIdea}`.slice(0, 200),
  });

  const cleaned = result.content.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const parsed = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
  const now = new Date().toISOString();
  const chapters: NonfictionChapter[] = (Array.isArray(parsed.chapters) ? parsed.chapters : []).map(
    (c: any, i: number) => ({
      id: `ch_${Date.now()}_${i}`,
      title: String(c.title || `Chapter ${i + 1}`),
      topic: String(c.title || ""),
      purpose: String(c.purpose || ""),
      keyPoints: Array.isArray(c.keyPoints) ? c.keyPoints.map(String) : [],
      transcript: "",
      body: "",
      length: "medium" as ChapterLength,
      style: "personal" as ChapterStyle,
      wordCount: 0,
      status: "planned" as const,
      createdAt: now,
      updatedAt: now,
    })
  );

  if (!chapters.length) throw new Error("Outline generation returned no chapters.");
  return { title, bookType, mainIdea, targetAudience: input.targetAudience, chapters };
}

export async function saveChapterToBook(input: {
  userId: string;
  bookId: string;
  chapterId?: string;
  title: string;
  topic: string;
  purpose?: string;
  keyPoints?: string[];
  transcript: string;
  body: string;
  length: ChapterLength;
  style: ChapterStyle;
  pov?: ChapterPov;
  tone?: ChapterTone;
  targetWords?: number;
  status?: NonfictionChapter["status"];
  allowShort?: boolean;
}): Promise<NonfictionBook> {
  const book = await getBook(input.userId, input.bookId);
  const now = new Date().toISOString();
  const body = String(input.body || "").trim();
  if (!input.allowShort && body.length < 40 && input.status !== "planned") {
    throw Object.assign(new Error("Chapter is too short to save."), { status: 400 });
  }

  const existing = input.chapterId
    ? book.chapters.find((c) => c.id === input.chapterId)
    : undefined;

  const chapter: NonfictionChapter = {
    id: input.chapterId || `ch_${Date.now()}`,
    title: String(input.title || "Untitled chapter").trim(),
    topic: String(input.topic || ""),
    purpose: input.purpose != null ? String(input.purpose) : existing?.purpose || "",
    keyPoints:
      input.keyPoints != null
        ? input.keyPoints
        : existing?.keyPoints || [],
    transcript: String(input.transcript || ""),
    body,
    length: input.length,
    style: input.style,
    pov: input.pov || existing?.pov,
    tone: input.tone || existing?.tone,
    targetWords: input.targetWords ?? existing?.targetWords,
    wordCount: countWords(body),
    status:
      input.status ||
      (body.length > 40 ? "draft" : "planned"),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const chapters = [...book.chapters];
  const idx = chapters.findIndex((c) => c.id === chapter.id);
  if (idx >= 0) chapters[idx] = { ...chapters[idx], ...chapter };
  else chapters.push(chapter);

  await booksCol().doc(book.id).set({ chapters, updatedAt: now }, { merge: true });
  return mapBook(book.id, (await booksCol().doc(book.id).get()).data()!);
}

export async function deleteBook(userId: string, id: string) {
  const ref = booksCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  if (snap.data()?.userId !== userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }
  await ref.delete();
  return { ok: true };
}

export function priorChaptersSummary(book: NonfictionBook, excludeChapterId?: string) {
  return book.chapters
    .filter((c) => c.id !== excludeChapterId && c.body.trim())
    .map(
      (c, i) =>
        `Chapter ${i + 1}: ${c.title}\nTopic: ${c.topic}\nExcerpt: ${c.body.slice(0, 500)}`
    )
    .join("\n\n")
    .slice(0, 6000);
}
