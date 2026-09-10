import { getFirestore } from "firebase-admin/firestore";

export const PACING_BOOK_TYPES = ["memoir", "self-help", "business", "other"] as const;
export type PacingBookType = (typeof PACING_BOOK_TYPES)[number];

export const PACING_STYLES = ["even", "narrative", "instructional"] as const;
export type PacingStyle = (typeof PACING_STYLES)[number];

export type PacingChapter = {
  index: number;
  title: string;
  purpose: string;
  targetWords: number;
};

export type PacingPlan = {
  id?: string;
  userId?: string;
  bookId?: string | null;
  bookTitle?: string;
  /** Original slider goal — may differ from sum of edited chapter targets */
  goalWords?: number;
  totalWords: number;
  chapterCount: number;
  averageWords: number;
  bookType: PacingBookType;
  pacingStyle: PacingStyle;
  chapters: PacingChapter[];
  createdAt?: string;
  updatedAt?: string;
};

const PURPOSE_SETS: Record<PacingBookType, string[]> = {
  memoir: [
    "Introduction — Why this story matters",
    "Background — Where it began",
    "Turning point — The first crack",
    "Core conflict — What went wrong",
    "Struggle — Living with the problem",
    "Discovery — A new understanding",
    "Action — Taking the leap",
    "Setback — The cost of change",
    "Support — People who shaped the journey",
    "Breakthrough — What finally shifted",
    "Integration — Living the lesson",
    "Reflection — Meaning of the path",
    "Legacy — What you carry forward",
    "Conclusion — What comes next",
  ],
  "self-help": [
    "Introduction — The promise",
    "The problem — Why readers feel stuck",
    "Mindset shift — Reframe the challenge",
    "Framework — The method overview",
    "Step 1 — Foundation habits",
    "Step 2 — Daily practice",
    "Step 3 — Overcoming resistance",
    "Case study — Seeing it work",
    "Advanced tactics — Leveling up",
    "Common mistakes — What to avoid",
    "Tools & systems — Keep the gains",
    "Conclusion — Your 30-day plan",
  ],
  business: [
    "Introduction — Why I started",
    "The idea — Spotting the opportunity",
    "First step — Getting started",
    "Early mistakes — Lessons paid for",
    "Finding customers — First traction",
    "Offer & pricing — What sells",
    "Operations — Making it repeatable",
    "Team — People and hiring",
    "Cash & risk — Staying alive",
    "Growth — Scaling what works",
    "Managing failure — Recovery",
    "Lessons learned — Principles",
    "Conclusion — What comes next",
  ],
  other: [
    "Introduction",
    "Background",
    "Core problem",
    "Exploration",
    "Evidence",
    "Framework",
    "Application",
    "Objections",
    "Advanced ideas",
    "Synthesis",
    "Conclusion",
  ],
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Suggest chapter count from total words + book type */
export function suggestChapterCount(totalWords: number, bookType: PacingBookType) {
  const avgTarget =
    bookType === "memoir" ? 2600 : bookType === "self-help" ? 2400 : bookType === "business" ? 2800 : 2700;
  return clamp(Math.round(totalWords / avgTarget), 8, 24);
}

function weightsForStyle(count: number, style: PacingStyle): number[] {
  const weights = Array.from({ length: count }, () => 1);
  if (style === "even" || count < 3) return weights;

  if (style === "narrative") {
    // shorter open/close, heavier middle
    weights[0] = 0.75;
    weights[count - 1] = 0.85;
    const midStart = Math.floor(count * 0.35);
    const midEnd = Math.floor(count * 0.75);
    for (let i = midStart; i < midEnd; i++) weights[i] = 1.15;
  } else if (style === "instructional") {
    weights[0] = 0.7;
    weights[1] = 0.85;
    for (let i = 2; i < count - 1; i++) weights[i] = 1.1;
    weights[count - 1] = 0.9;
  }
  return weights;
}

function allocateWords(totalWords: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (totalWords * w) / sum);
  const floors = raw.map((n) => Math.floor(n));
  let rem = totalWords - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < rem; k++) out[order[k % order.length].i] += 1;
  return out;
}

function titlesFor(count: number, bookType: PacingBookType): { title: string; purpose: string }[] {
  const pool = PURPOSE_SETS[bookType] || PURPOSE_SETS.other;
  const result: { title: string; purpose: string }[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      const p = pool[0] || "Introduction";
      result.push({ title: p.split("—")[0].trim() || "Introduction", purpose: p });
      continue;
    }
    if (i === count - 1) {
      const p = pool[pool.length - 1] || "Conclusion";
      result.push({ title: p.split("—")[0].trim() || "Conclusion", purpose: p });
      continue;
    }
    const p = pool[Math.min(i, pool.length - 2)] || `Chapter ${i}`;
    const label = p.includes("—") ? p : `Chapter ${i} — ${p}`;
    result.push({
      title: label.split("—")[0].trim().startsWith("Chapter")
        ? label.split("—")[0].trim() + (label.includes("—") ? ` — ${label.split("—").slice(1).join("—").trim()}` : "")
        : `Chapter ${i} — ${p.split("—")[0].trim()}`,
      purpose: p,
    });
  }
  // Clean titles
  return result.map((r, i) => {
    if (i === 0) return { title: r.title.includes("Introduction") ? r.title : "Introduction", purpose: r.purpose };
    if (i === count - 1)
      return { title: r.title.includes("Conclusion") ? r.title : "Conclusion", purpose: r.purpose };
    const purposePart = r.purpose.includes("—") ? r.purpose.split("—").slice(1).join("—").trim() : r.purpose;
    return {
      title: `Chapter ${i} — ${purposePart || r.title}`,
      purpose: r.purpose,
    };
  });
}

export function calculatePacingMeta(input: {
  totalWords: number;
  bookType?: string;
  chapterCount?: number;
}) {
  const totalWords = clamp(Math.round(Number(input.totalWords) || 45000), 20000, 100000);
  const bookType = (PACING_BOOK_TYPES as readonly string[]).includes(String(input.bookType || ""))
    ? (input.bookType as PacingBookType)
    : "other";
  const suggested = suggestChapterCount(totalWords, bookType);
  const chapterCount = input.chapterCount
    ? clamp(Math.round(Number(input.chapterCount)), 5, 30)
    : suggested;
  const averageWords = Math.round(totalWords / chapterCount);
  return { totalWords, bookType, suggestedChapters: suggested, chapterCount, averageWords };
}

export function generatePacingPlan(input: {
  totalWords: number;
  bookType?: string;
  chapterCount?: number;
  pacingStyle?: string;
  chapterTitles?: string[];
  chapterPurposes?: string[];
}): PacingPlan {
  const meta = calculatePacingMeta(input);
  const style = (PACING_STYLES as readonly string[]).includes(String(input.pacingStyle || ""))
    ? (input.pacingStyle as PacingStyle)
    : "narrative";
  const weights = weightsForStyle(meta.chapterCount, style);
  const targets = allocateWords(meta.totalWords, weights);
  const labels = titlesFor(meta.chapterCount, meta.bookType);
  const titles = Array.isArray(input.chapterTitles) ? input.chapterTitles : [];
  const purposes = Array.isArray(input.chapterPurposes) ? input.chapterPurposes : [];

  const chapters: PacingChapter[] = targets.map((targetWords, index) => ({
    index: index + 1,
    title: String(titles[index] || labels[index]?.title || `Chapter ${index + 1}`),
    purpose: String(purposes[index] || labels[index]?.purpose || ""),
    targetWords,
  }));

  return {
    goalWords: meta.totalWords,
    totalWords: meta.totalWords,
    chapterCount: meta.chapterCount,
    averageWords: meta.averageWords,
    bookType: meta.bookType,
    pacingStyle: style,
    chapters,
  };
}

function plansCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("pacingPlans");
}

export async function savePacingPlan(userId: string, plan: PacingPlan): Promise<PacingPlan> {
  const now = new Date().toISOString();
  const ref = plan.id ? plansCol(userId).doc(plan.id) : plansCol(userId).doc();
  const existing = plan.id ? (await ref.get()).data() : undefined;
  const doc = {
    ...plan,
    userId,
    bookId: plan.bookId ?? existing?.bookId ?? null,
    bookTitle: plan.bookTitle ?? existing?.bookTitle ?? "",
    goalWords: plan.goalWords ?? plan.totalWords,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  delete (doc as any).id;
  await ref.set(doc, { merge: true });
  return { ...doc, id: ref.id };
}

export async function listPacingPlans(userId: string): Promise<PacingPlan[]> {
  const snap = await plansCol(userId).orderBy("createdAt", "desc").limit(20).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId,
      bookId: data.bookId || null,
      bookTitle: String(data.bookTitle || ""),
      goalWords: Number(data.goalWords || data.totalWords || 0),
      totalWords: Number(data.totalWords || 0),
      chapterCount: Number(data.chapterCount || 0),
      averageWords: Number(data.averageWords || 0),
      bookType: data.bookType || "other",
      pacingStyle: data.pacingStyle || "narrative",
      chapters: Array.isArray(data.chapters) ? data.chapters : [],
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    } as PacingPlan;
  });
}

export async function deletePacingPlan(userId: string, id: string) {
  await plansCol(userId).doc(id).delete();
  return { ok: true };
}
