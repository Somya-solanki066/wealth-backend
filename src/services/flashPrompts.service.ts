import { createHash } from "crypto";
import { getFirestore } from "firebase-admin/firestore";

const SETTINGS_DOC = "flashPrompts";

export const FLASH_GENRES = ["romance", "horror", "scifi", "comedy"] as const;
export type FlashGenre = (typeof FLASH_GENRES)[number];

export type FlashPrompt = {
  id: string;
  text: string;
  genre: FlashGenre;
  active: boolean;
  featured: boolean;
  createdAt?: string;
};

export type FlashPromptsSettings = {
  prompts: FlashPrompt[];
  updatedAt?: string;
};

export const GENRE_LABELS: Record<FlashGenre, string> = {
  romance: "Romance",
  horror: "Horror",
  scifi: "Sci-Fi",
  comedy: "Comedy",
};

export const DEFAULT_FLASH_PROMPTS: FlashPrompt[] = [
  {
    id: "rom_1",
    genre: "romance",
    text: "A wedding planner falls for the groom's best man three days before the ceremony.",
    active: true,
    featured: true,
  },
  {
    id: "rom_2",
    genre: "romance",
    text: "Two rival bakers are forced to share one kitchen for a city-wide dessert contest.",
    active: true,
    featured: false,
  },
  {
    id: "rom_3",
    genre: "romance",
    text: "A bookstore owner keeps finding love notes in returned novels — signed with their own handwriting.",
    active: true,
    featured: false,
  },
  {
    id: "rom_4",
    genre: "romance",
    text: "After a flight delay, strangers invent a fake relationship to claim the last hotel room.",
    active: true,
    featured: false,
  },
  {
    id: "hor_1",
    genre: "horror",
    text: "Every night at 3:11 a.m., your smart fridge unlocks and whispers a name you haven't heard since childhood.",
    active: true,
    featured: true,
  },
  {
    id: "hor_2",
    genre: "horror",
    text: "The babysitter realizes the children are counting something she cannot see in the corners.",
    active: true,
    featured: false,
  },
  {
    id: "hor_3",
    genre: "horror",
    text: "A hiking app reroutes you to a trail that doesn't exist on any map — and your phone battery won't drop below 1%.",
    active: true,
    featured: false,
  },
  {
    id: "sci_1",
    genre: "scifi",
    text: "Earth gets a delivery: a sealed crate addressed to you, timestamped 40 years in the future.",
    active: true,
    featured: true,
  },
  {
    id: "sci_2",
    genre: "scifi",
    text: "Your clone returns from a mission you don't remember authorizing — and they are terrified of you.",
    active: true,
    featured: false,
  },
  {
    id: "sci_3",
    genre: "scifi",
    text: "City lights blink in Morse. Tonight they spell your name, then: RUN.",
    active: true,
    featured: false,
  },
  {
    id: "com_1",
    genre: "comedy",
    text: "You accidentally become the city's most beloved influencer after a typo goes viral for the wrong reasons.",
    active: true,
    featured: true,
  },
  {
    id: "com_2",
    genre: "comedy",
    text: "Your therapist's emotional support parrot starts giving better advice than the therapist.",
    active: true,
    featured: false,
  },
  {
    id: "com_3",
    genre: "comedy",
    text: "A family reunion requires every guest to wear a costume based on their biggest regret.",
    active: true,
    featured: false,
  },
];

function normalizeGenre(raw: unknown): FlashGenre {
  const g = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (g === "scifi" || g === "sciencefiction") return "scifi";
  if ((FLASH_GENRES as readonly string[]).includes(g)) return g as FlashGenre;
  return "romance";
}

function normalizePrompt(raw: any, index: number): FlashPrompt {
  const genre = normalizeGenre(raw?.genre);
  return {
    id: String(raw?.id || `fp_${genre}_${index}_${Date.now()}`),
    text: String(raw?.text || "").trim(),
    genre,
    active: raw?.active !== false,
    featured: Boolean(raw?.featured),
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
  };
}

export async function getFlashPromptsSettings(): Promise<FlashPromptsSettings> {
  const snap = await getFirestore().collection("settings").doc(SETTINGS_DOC).get();
  if (!snap.exists) {
    return { prompts: DEFAULT_FLASH_PROMPTS.map((p) => ({ ...p })) };
  }
  const data = snap.data() || {};
  const prompts =
    Array.isArray(data.prompts) && data.prompts.length
      ? data.prompts
          .map((p: any, i: number) => normalizePrompt(p, i))
          .filter((p: FlashPrompt) => p.text.length > 0)
      : DEFAULT_FLASH_PROMPTS.map((p) => ({ ...p }));
  return { prompts, updatedAt: data.updatedAt };
}

export async function saveFlashPromptsSettings(
  patch: Partial<FlashPromptsSettings>
): Promise<FlashPromptsSettings> {
  const current = await getFlashPromptsSettings();
  const prompts = Array.isArray(patch.prompts)
    ? patch.prompts.map((p, i) => normalizePrompt(p, i)).filter((p) => p.text.length > 0)
    : current.prompts;

  if (!prompts.length) {
    throw Object.assign(new Error("At least one prompt is required."), { status: 400 });
  }

  const next: FlashPromptsSettings = {
    prompts,
    updatedAt: new Date().toISOString(),
  };
  await getFirestore().collection("settings").doc(SETTINGS_DOC).set(next, { merge: true });
  return next;
}

function activeForGenre(prompts: FlashPrompt[], genre: FlashGenre) {
  return prompts.filter((p) => p.active && p.genre === genre);
}

/** Stable daily pick from date + genre (UTC calendar day). */
export function pickDailyPrompt(prompts: FlashPrompt[], genre: FlashGenre, dateKey: string): FlashPrompt | null {
  const pool = activeForGenre(prompts, genre);
  if (!pool.length) return null;

  const featured = pool.filter((p) => p.featured);
  const usePool = featured.length ? featured : pool;

  const hash = createHash("sha256").update(`${dateKey}:${genre}`).digest();
  const idx = hash.readUInt32BE(0) % usePool.length;
  return usePool[idx];
}

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function getTodayPrompt(genreInput: string, dateKey?: string) {
  const genre = normalizeGenre(genreInput);
  const day = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : utcDateKey();
  const { prompts } = await getFlashPromptsSettings();
  const prompt = pickDailyPrompt(prompts, genre, day);
  if (!prompt) {
    throw Object.assign(new Error(`No active prompts for ${GENRE_LABELS[genre]}.`), { status: 404 });
  }
  return {
    date: day,
    genre,
    genreLabel: GENRE_LABELS[genre],
    prompt: { id: prompt.id, text: prompt.text, genre: prompt.genre, featured: prompt.featured },
  };
}

export async function shufflePrompt(input: {
  genre: string;
  excludeIds?: string[];
  currentId?: string;
}) {
  const genre = normalizeGenre(input.genre);
  const { prompts } = await getFlashPromptsSettings();
  const pool = activeForGenre(prompts, genre);
  if (!pool.length) {
    throw Object.assign(new Error(`No active prompts for ${GENRE_LABELS[genre]}.`), { status: 404 });
  }

  const exclude = new Set<string>([
    ...(input.excludeIds || []).map(String),
    ...(input.currentId ? [String(input.currentId)] : []),
  ]);

  let candidates = pool.filter((p) => !exclude.has(p.id));
  // If user exhausted the list, reset but still avoid immediate repeat of current
  if (!candidates.length) {
    candidates = pool.filter((p) => p.id !== input.currentId);
  }
  if (!candidates.length) {
    candidates = pool;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    genre,
    genreLabel: GENRE_LABELS[genre],
    prompt: { id: pick.id, text: pick.text, genre: pick.genre, featured: pick.featured },
    remaining: Math.max(0, pool.length - exclude.size - 1),
  };
}

export type FlashDraft = {
  id: string;
  title: string;
  genre: FlashGenre;
  promptId: string;
  promptText: string;
  body: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

function draftsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("flashDrafts");
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export async function listFlashDrafts(userId: string): Promise<FlashDraft[]> {
  const snap = await draftsCol(userId).orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title || "Untitled draft"),
      genre: normalizeGenre(data.genre),
      promptId: String(data.promptId || ""),
      promptText: String(data.promptText || ""),
      body: String(data.body || ""),
      wordCount: Number(data.wordCount || 0),
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    };
  });
}

export async function saveFlashDraft(input: {
  userId: string;
  id?: string;
  title?: string;
  genre: string;
  promptId: string;
  promptText: string;
  body: string;
}): Promise<FlashDraft> {
  const genre = normalizeGenre(input.genre);
  const body = String(input.body || "");
  const now = new Date().toISOString();
  const title =
    String(input.title || "").trim() ||
    `${GENRE_LABELS[genre]} flash — ${now.slice(0, 10)}`;

  const payload = {
    title,
    genre,
    promptId: String(input.promptId || ""),
    promptText: String(input.promptText || ""),
    body,
    wordCount: countWords(body),
    updatedAt: now,
  };

  if (input.id) {
    const ref = draftsCol(input.userId).doc(input.id);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error("Draft not found."), { status: 404 });
    await ref.set(payload, { merge: true });
    const data = (await ref.get()).data()!;
    return {
      id: ref.id,
      title: String(data.title),
      genre: normalizeGenre(data.genre),
      promptId: String(data.promptId || ""),
      promptText: String(data.promptText || ""),
      body: String(data.body || ""),
      wordCount: Number(data.wordCount || 0),
      createdAt: String(data.createdAt || now),
      updatedAt: String(data.updatedAt || now),
    };
  }

  const ref = draftsCol(input.userId).doc();
  await ref.set({ ...payload, createdAt: now });
  return { id: ref.id, createdAt: now, ...payload };
}

export async function deleteFlashDraft(userId: string, draftId: string) {
  await draftsCol(userId).doc(draftId).delete();
  return { ok: true };
}
