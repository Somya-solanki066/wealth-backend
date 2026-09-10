import OpenAI from "openai";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import { recordAiUsage } from "../utils/aiUsage";
import {
  SEED_PROMPTS,
  VAULT_CATEGORIES,
  VAULT_GENRES,
  VAULT_TONES,
  isVaultCategoryId,
  normalizeGenre,
  normalizeTone,
  type VaultCategoryId,
} from "../data/writingVaultCatalog";

const COLLECTION = "writingVault";
const SAVES = "writingVaultSaves";
const HISTORY = "writingVaultHistory";
const RECENT_EXCLUDE = 12;

export type VaultPromptResult = {
  promptId: string;
  promptText: string;
  title: string;
  category: VaultCategoryId;
  categoryLabel: string;
  genre: string;
  tone: string;
  source: "database" | "seed" | "ai";
  difficulty?: string;
};

function categoryLabel(id: VaultCategoryId) {
  return VAULT_CATEGORIES.find((c) => c.id === id)?.label || id;
}

function hashPrompt(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `seed_${Math.abs(h).toString(36)}`;
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

async function getRecentPromptIds(userId: string): Promise<Set<string>> {
  const db = getFirestore();
  const snap = await db
    .collection(HISTORY)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(RECENT_EXCLUDE)
    .get()
    .catch(async () => {
      // Fallback without composite index
      const all = await db.collection(HISTORY).where("userId", "==", userId).limit(40).get();
      return all;
    });

  const docs = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as { promptId?: string; createdAt?: unknown }) }))
    .sort((a, b) => {
      const ta = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return tb - ta;
    })
    .slice(0, RECENT_EXCLUDE);

  return new Set(docs.map((d) => String(d.promptId || "")).filter(Boolean));
}

async function recordHistory(
  userId: string,
  data: {
    promptId: string;
    promptText: string;
    category: string;
    genre: string;
    tone: string;
    source: string;
    action: "viewed" | "used" | "saved";
  }
) {
  const db = getFirestore();
  await db.collection(HISTORY).add({
    userId,
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function fetchDbCandidates(opts: {
  category: VaultCategoryId;
  genre: string;
  tone: string;
  excludeIds: Set<string>;
}) {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTION)
    .where("isActive", "==", true)
    .where("category", "==", opts.category)
    .limit(100)
    .get();
  const genre = normalizeGenre(opts.genre);
  const tone = normalizeTone(opts.tone);

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        promptId: doc.id,
        promptText: String(d.promptText || "").trim(),
        title: String(d.title || "").trim(),
        category: opts.category,
        genre: String(d.genre || "All Genres"),
        tone: String(d.tone || "Any"),
        difficulty: d.difficulty ? String(d.difficulty) : undefined,
        source: "database" as const,
      };
    })
    .filter((p) => p.promptText)
    .filter((p) => !opts.excludeIds.has(p.promptId))
    .filter((p) => genre === "All Genres" || p.genre.toLowerCase() === genre.toLowerCase())
    .filter((p) => tone === "Any" || p.tone.toLowerCase() === tone.toLowerCase());
}

function fetchSeedCandidates(opts: {
  category: VaultCategoryId;
  genre: string;
  tone: string;
  excludeIds: Set<string>;
}) {
  const genre = normalizeGenre(opts.genre);
  const tone = normalizeTone(opts.tone);

  return SEED_PROMPTS.filter((p) => p.category === opts.category)
    .map((p) => ({
      promptId: hashPrompt(`${p.category}:${p.promptText}`),
      promptText: p.promptText,
      title: p.title || "",
      category: p.category,
      genre: p.genre,
      tone: p.tone,
      difficulty: p.difficulty,
      source: "seed" as const,
    }))
    .filter((p) => !opts.excludeIds.has(p.promptId))
    .filter((p) => genre === "All Genres" || p.genre.toLowerCase() === genre.toLowerCase())
    .filter((p) => tone === "Any" || p.tone.toLowerCase() === tone.toLowerCase());
}

async function generateAiPrompt(opts: {
  userId: string;
  category: VaultCategoryId;
  genre: string;
  tone: string;
  projectContext?: {
    name?: string;
    genre?: string;
    characters?: string;
    chapterHint?: string;
  } | null;
}): Promise<VaultPromptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI generation is unavailable (missing OPENAI_API_KEY).");
  }

  const label = categoryLabel(opts.category);
  const genre = normalizeGenre(opts.genre);
  const tone = normalizeTone(opts.tone);
  const ctx = opts.projectContext;

  const system = `You are a writing coach for serialized fiction writers (PocketFM, Dreame, GoodNovel style).
Return ONLY valid JSON: {"prompt":"string","title":"string","tone":"string","genre":"string"}
Rules:
- One vivid, specific writing prompt (1–3 sentences).
- Match category: ${label}.
- Prefer genre ${genre === "All Genres" ? "popular serialized fiction tropes" : genre}.
- Prefer tone ${tone === "Any" ? "compelling" : tone}.
- No spoilers that resolve the conflict. No meta commentary. No markdown.`;

  const userParts = [
    `Category: ${label}`,
    `Genre: ${genre}`,
    `Tone: ${tone}`,
  ];
  if (ctx?.name) userParts.push(`Project: ${ctx.name}`);
  if (ctx?.genre) userParts.push(`Project genre: ${ctx.genre}`);
  if (ctx?.characters) userParts.push(`Characters: ${ctx.characters}`);
  if (ctx?.chapterHint) userParts.push(`Chapter/context: ${ctx.chapterHint}`);
  userParts.push("Generate one fresh prompt.");

  const openai = new OpenAI({ apiKey });
  const model = await getOpenAiModel();
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.95,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n") },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: { prompt?: string; title?: string; tone?: string; genre?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { prompt: raw.trim() };
  }

  const promptText = String(parsed.prompt || "").trim();
  if (!promptText) throw new Error("AI returned an empty prompt.");

  const tokensUsed =
    (completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0);

  await recordAiUsage({
    userId: opts.userId,
    field: "ghostWriterCount",
    tool: "writing-vault",
    model,
    tokensUsed,
    genre,
  }).catch(() => undefined);

  // Persist AI prompt for future free DB draws
  const db = getFirestore();
  const ref = await db.collection(COLLECTION).add({
    title: String(parsed.title || "").trim() || "AI Prompt",
    promptText,
    category: opts.category,
    genre: parsed.genre || (genre === "All Genres" ? "Romance" : genre),
    tone: parsed.tone || (tone === "Any" ? "Dramatic" : tone),
    subGenres: [],
    tropes: [],
    platforms: ["all"],
    difficulty: "intermediate",
    isActive: true,
    usageCount: 0,
    addedBy: "ai",
    source: "ai",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    promptId: ref.id,
    promptText,
    title: String(parsed.title || "").trim() || "AI Prompt",
    category: opts.category,
    categoryLabel: label,
    genre: String(parsed.genre || genre),
    tone: String(parsed.tone || tone),
    source: "ai",
  };
}

export function getVaultMeta() {
  return {
    categories: VAULT_CATEGORIES,
    genres: VAULT_GENRES,
    tones: VAULT_TONES,
  };
}

export async function getNextPrompt(opts: {
  userId: string;
  category: string;
  genre?: string;
  tone?: string;
  preferAi?: boolean;
  projectContext?: {
    name?: string;
    genre?: string;
    characters?: string;
    chapterHint?: string;
  } | null;
}): Promise<VaultPromptResult> {
  if (!isVaultCategoryId(opts.category)) {
    throw Object.assign(new Error("Invalid category."), { status: 400 });
  }

  const category = opts.category;
  const genre = normalizeGenre(opts.genre);
  const tone = normalizeTone(opts.tone);
  const excludeIds = await getRecentPromptIds(opts.userId);

  // Project-aware or explicit AI request → AI first
  if (opts.preferAi || opts.projectContext?.name || opts.projectContext?.characters) {
    try {
      const ai = await generateAiPrompt({
        userId: opts.userId,
        category,
        genre,
        tone,
        projectContext: opts.projectContext,
      });
      await recordHistory(opts.userId, {
        promptId: ai.promptId,
        promptText: ai.promptText,
        category,
        genre: ai.genre,
        tone: ai.tone,
        source: "ai",
        action: "viewed",
      });
      return ai;
    } catch (err) {
      // fall through to library
      console.warn("Writing Vault AI fallback:", err);
    }
  }

  const dbHits = await fetchDbCandidates({ category, genre, tone, excludeIds });
  type Candidate = {
    promptId: string;
    promptText: string;
    title: string;
    category: VaultCategoryId;
    genre: string;
    tone: string;
    difficulty?: string;
    source: "database" | "seed";
  };
  let picked: Candidate | null = pickRandom(dbHits);

  if (!picked) {
    // Relax filters gradually
    const relaxed = await fetchDbCandidates({
      category,
      genre: "All Genres",
      tone: "Any",
      excludeIds,
    });
    picked = pickRandom(relaxed);
  }

  if (!picked) {
    const seeds = fetchSeedCandidates({ category, genre, tone, excludeIds });
    const fallbackSeeds = seeds.length
      ? seeds
      : fetchSeedCandidates({ category, genre: "All Genres", tone: "Any", excludeIds });
    picked = pickRandom(fallbackSeeds);
  }

  if (!picked) {
    // Last resort: AI
    const ai = await generateAiPrompt({
      userId: opts.userId,
      category,
      genre,
      tone,
      projectContext: opts.projectContext,
    });
    await recordHistory(opts.userId, {
      promptId: ai.promptId,
      promptText: ai.promptText,
      category,
      genre: ai.genre,
      tone: ai.tone,
      source: "ai",
      action: "viewed",
    });
    return ai;
  }

  if (picked.source === "database") {
    await getFirestore()
      .collection(COLLECTION)
      .doc(picked.promptId)
      .update({ usageCount: FieldValue.increment(1) })
      .catch(() => undefined);
  }

  const result: VaultPromptResult = {
    promptId: picked.promptId,
    promptText: picked.promptText,
    title: picked.title || categoryLabel(category),
    category,
    categoryLabel: categoryLabel(category),
    genre: picked.genre,
    tone: picked.tone,
    source: picked.source,
    difficulty: picked.difficulty,
  };

  await recordHistory(opts.userId, {
    promptId: result.promptId,
    promptText: result.promptText,
    category,
    genre: result.genre,
    tone: result.tone,
    source: result.source,
    action: "viewed",
  });

  return result;
}

export async function savePrompt(
  userId: string,
  body: {
    promptId: string;
    promptText: string;
    category: string;
    genre?: string;
    tone?: string;
    title?: string;
    source?: string;
  }
) {
  const db = getFirestore();
  const promptId = String(body.promptId || "").trim();
  const promptText = String(body.promptText || "").trim();
  if (!promptId || !promptText) {
    throw Object.assign(new Error("promptId and promptText are required."), { status: 400 });
  }

  const existing = await db
    .collection(SAVES)
    .where("userId", "==", userId)
    .where("promptId", "==", promptId)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { id: existing.docs[0].id, alreadySaved: true };
  }

  const ref = await db.collection(SAVES).add({
    userId,
    promptId,
    promptText,
    title: String(body.title || "").trim(),
    category: String(body.category || ""),
    genre: normalizeGenre(body.genre),
    tone: normalizeTone(body.tone),
    source: String(body.source || "database"),
    createdAt: FieldValue.serverTimestamp(),
  });

  await recordHistory(userId, {
    promptId,
    promptText,
    category: String(body.category || ""),
    genre: normalizeGenre(body.genre),
    tone: normalizeTone(body.tone),
    source: String(body.source || "database"),
    action: "saved",
  });

  if (!promptId.startsWith("seed_")) {
    await db
      .collection(COLLECTION)
      .doc(promptId)
      .update({ usageCount: FieldValue.increment(1) })
      .catch(() => undefined);
  }

  return { id: ref.id, alreadySaved: false };
}

export async function listSaved(userId: string, limit = 50) {
  const db = getFirestore();
  const snap = await db.collection(SAVES).where("userId", "==", userId).limit(limit).get();
  const items = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      promptId: String(d.promptId || ""),
      promptText: String(d.promptText || ""),
      title: String(d.title || ""),
      category: String(d.category || ""),
      categoryLabel: isVaultCategoryId(String(d.category || ""))
        ? categoryLabel(String(d.category) as VaultCategoryId)
        : String(d.category || ""),
      genre: String(d.genre || ""),
      tone: String(d.tone || ""),
      source: String(d.source || ""),
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
    };
  });
  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return items;
}

export async function deleteSaved(userId: string, saveId: string) {
  const db = getFirestore();
  const ref = db.collection(SAVES).doc(saveId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== userId) {
    throw Object.assign(new Error("Saved prompt not found."), { status: 404 });
  }
  await ref.delete();
  return { ok: true };
}

export async function listRecent(userId: string, limit = 30) {
  const db = getFirestore();
  const snap = await db.collection(HISTORY).where("userId", "==", userId).limit(80).get();
  const items = snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        promptId: String(d.promptId || ""),
        promptText: String(d.promptText || ""),
        category: String(d.category || ""),
        categoryLabel: isVaultCategoryId(String(d.category || ""))
          ? categoryLabel(String(d.category) as VaultCategoryId)
          : String(d.category || ""),
        genre: String(d.genre || ""),
        tone: String(d.tone || ""),
        source: String(d.source || ""),
        action: String(d.action || "viewed"),
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    })
    .filter((x) => x.action === "viewed" || x.action === "used")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  // Dedupe by promptId keeping most recent
  const seen = new Set<string>();
  const deduped = [];
  for (const item of items) {
    if (seen.has(item.promptId)) continue;
    seen.add(item.promptId);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export async function markUsed(
  userId: string,
  body: {
    promptId: string;
    promptText: string;
    category?: string;
    genre?: string;
    tone?: string;
    source?: string;
  }
) {
  await recordHistory(userId, {
    promptId: String(body.promptId || ""),
    promptText: String(body.promptText || ""),
    category: String(body.category || ""),
    genre: normalizeGenre(body.genre),
    tone: normalizeTone(body.tone),
    source: String(body.source || "database"),
    action: "used",
  });
  return { ok: true };
}

function toHtmlPromptBlock(promptText: string) {
  const escaped = promptText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p><strong>WRITING PROMPT</strong></p><p><em>"${escaped}"</em></p><p><br/></p><p></p>`;
}

export async function applyPromptToProject(
  userId: string,
  opts: {
    projectId: string;
    chapterId?: string;
    promptId: string;
    promptText: string;
    category?: string;
    genre?: string;
    tone?: string;
    source?: string;
    prepend?: boolean;
  }
) {
  const db = getFirestore();
  const projectRef = db.collection("projects").doc(String(opts.projectId));
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists || projectSnap.data()?.userId !== userId) {
    throw Object.assign(new Error("Project not found or unauthorized."), { status: 404 });
  }

  const project = projectSnap.data() || {};
  if (project.type && project.type !== "novel") {
    throw Object.assign(new Error("Writing Vault currently inserts into novel projects only."), {
      status: 400,
    });
  }

  const promptHtml = toHtmlPromptBlock(opts.promptText);
  let chapterRef;
  let chapterId = opts.chapterId ? String(opts.chapterId) : "";

  if (chapterId) {
    chapterRef = projectRef.collection("chapters").doc(chapterId);
    const chapSnap = await chapterRef.get();
    if (!chapSnap.exists) {
      throw Object.assign(new Error("Chapter not found."), { status: 404 });
    }
    const existing = String(chapSnap.data()?.content || "");
    const nextContent =
      opts.prepend === false ? `${existing}${promptHtml}` : `${promptHtml}${existing}`;
    await chapterRef.update({
      content: nextContent,
      lastSavedAt: new Date().toISOString(),
    });
  } else {
    // Prefer first chapter by order/createdAt
    const chaptersSnap = await projectRef.collection("chapters").get();
    const chapters = chaptersSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as { order?: number; createdAt?: string; content?: string }) }))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    if (chapters[0]) {
      chapterId = chapters[0].id;
      chapterRef = projectRef.collection("chapters").doc(chapterId);
      const existing = String(chapters[0].content || "");
      const nextContent =
        opts.prepend === false ? `${existing}${promptHtml}` : `${promptHtml}${existing}`;
      await chapterRef.update({
        content: nextContent,
        lastSavedAt: new Date().toISOString(),
      });
    } else {
      chapterRef = projectRef.collection("chapters").doc();
      chapterId = chapterRef.id;
      await chapterRef.set({
        title: "Chapter 1",
        content: promptHtml,
        order: 1,
        wordCount: 0,
        createdAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
      });
    }
  }

  await projectRef.update({ updatedAt: new Date().toISOString() });
  await markUsed(userId, opts);

  return {
    projectId: opts.projectId,
    chapterId,
    project: { id: opts.projectId, name: project.name, type: project.type || "novel" },
  };
}

// ——— Admin helpers ———

export async function adminListPrompts(filters?: {
  category?: string;
  genre?: string;
  status?: string;
}) {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).limit(500).get();
  let items = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: String(d.title || ""),
      promptText: String(d.promptText || ""),
      category: String(d.category || ""),
      genre: String(d.genre || ""),
      tone: String(d.tone || ""),
      difficulty: String(d.difficulty || "intermediate"),
      isActive: d.isActive !== false,
      usageCount: Number(d.usageCount || 0),
      source: String(d.source || "admin"),
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
      updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || null,
    };
  });

  if (filters?.category) items = items.filter((i) => i.category === filters.category);
  if (filters?.genre && filters.genre !== "All Genres") {
    items = items.filter((i) => i.genre.toLowerCase() === filters.genre!.toLowerCase());
  }
  if (filters?.status === "active") items = items.filter((i) => i.isActive);
  if (filters?.status === "inactive") items = items.filter((i) => !i.isActive);

  items.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return items;
}

export async function adminUpsertPrompt(
  data: {
    title?: string;
    promptText: string;
    category: string;
    genre?: string;
    tone?: string;
    difficulty?: string;
    isActive?: boolean;
  },
  id?: string,
  adminId?: string
) {
  if (!isVaultCategoryId(data.category)) {
    throw Object.assign(new Error("Invalid category."), { status: 400 });
  }
  const promptText = String(data.promptText || "").trim();
  if (!promptText) {
    throw Object.assign(new Error("promptText is required."), { status: 400 });
  }

  const db = getFirestore();
  const payload = {
    title: String(data.title || "").trim() || categoryLabel(data.category),
    promptText,
    category: data.category,
    genre: normalizeGenre(data.genre) === "All Genres" ? "Romance" : normalizeGenre(data.genre),
    tone: normalizeTone(data.tone) === "Any" ? "Dramatic" : normalizeTone(data.tone),
    difficulty: String(data.difficulty || "intermediate"),
    isActive: data.isActive !== false,
    subGenres: [],
    tropes: [],
    platforms: ["all"],
    addedBy: adminId || "admin",
    source: "admin",
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (id) {
    await db.collection(COLLECTION).doc(id).set(payload, { merge: true });
    return { id };
  }

  const ref = await db.collection(COLLECTION).add({
    ...payload,
    usageCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function adminDeletePrompt(id: string) {
  await getFirestore().collection(COLLECTION).doc(id).delete();
  return { ok: true };
}

export async function adminSeedDefaults(adminId?: string) {
  const db = getFirestore();
  const existing = await db.collection(COLLECTION).limit(1).get();
  if (!existing.empty) {
    return { seeded: 0, message: "Library already has prompts." };
  }

  const batch = db.batch();
  let count = 0;
  for (const p of SEED_PROMPTS) {
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, {
      title: p.title || categoryLabel(p.category),
      promptText: p.promptText,
      category: p.category,
      genre: p.genre,
      tone: p.tone,
      difficulty: p.difficulty || "intermediate",
      isActive: true,
      usageCount: 0,
      subGenres: [],
      tropes: [],
      platforms: ["all"],
      addedBy: adminId || "seed",
      source: "seed",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    count += 1;
  }
  await batch.commit();
  return { seeded: count, message: `Seeded ${count} prompts.` };
}
