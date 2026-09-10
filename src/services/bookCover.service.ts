import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";
import { getPlanById, isUserPremium } from "../utils/plans";
import { recordAiUsage } from "../utils/aiUsage";
import {
  COVER_FORMATS,
  COVER_GENRES,
  COVER_MOODS,
  COVER_PLATFORMS,
  COVER_VISUAL_STYLES,
  buildCoverImagePrompt,
  getCoverFormat,
} from "../data/bookCoverCatalog";

const COLLECTION = "bookCovers";

const VARIATION_HINTS = [
  "Shift composition — wider establishing shot with stronger atmosphere.",
  "Closer character focus, intimate framing, richer facial emotion.",
  "Change lighting — cooler moonlight and deeper shadows.",
  "New background setting while keeping the same genre mood.",
  "More dramatic pose and stronger contrast between figures and backdrop.",
];

export function getBookCoverMeta() {
  return {
    platforms: COVER_PLATFORMS.map(({ id, label }) => ({ id, label })),
    genres: COVER_GENRES,
    moods: COVER_MOODS,
    visualStyles: COVER_VISUAL_STYLES,
    formats: COVER_FORMATS.map(({ id, label }) => ({ id, label })),
  };
}

export async function assertBookCoverAccess(userId: string) {
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    return { ok: false as const, status: 404, error: "User not found." };
  }
  const userData = userSnap.data() || {};
  if (!isUserPremium(userData)) {
    return {
      ok: false as const,
      status: 403,
      error: "Book Cover Generator requires an active subscription.",
      premiumRequired: true,
    };
  }
  // Paid plans list Book Cover Generator; treat premium access as enough.
  const planId = String(userData.subscriptionPlan || "");
  const plan = planId ? await getPlanById(planId) : null;
  if (plan?.isFree) {
    return {
      ok: false as const,
      status: 403,
      error: "Book Cover Generator is available on premium plans.",
      premiumRequired: true,
    };
  }
  return { ok: true as const, userData };
}

function downloadToUploads(imageUrl: string, filename: string) {
  return (async () => {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("Failed to download generated artwork.");
    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.join(getUploadsDir(), "covers");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/covers/${filename}`;
  })();
}

export async function generateBookCover(opts: {
  userId: string;
  title: string;
  authorName?: string;
  showAuthor?: boolean;
  platform: string;
  genre: string;
  mood: string;
  visualStyle: string;
  sceneDescription?: string;
  coverFormat?: string;
  projectId?: string | null;
  parentCoverId?: string | null;
}) {
  const title = String(opts.title || "").trim();
  if (!title) {
    throw Object.assign(new Error("Book title is required."), { status: 400 });
  }
  if (!opts.platform || !opts.genre || !opts.mood || !opts.visualStyle) {
    throw Object.assign(new Error("Platform, genre, mood, and visual style are required."), {
      status: 400,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not configured."), { status: 500 });
  }

  const format = getCoverFormat(opts.coverFormat || "serialized");
  const variationHint = opts.parentCoverId
    ? VARIATION_HINTS[Math.floor(Math.random() * VARIATION_HINTS.length)]
    : undefined;

  const prompt = buildCoverImagePrompt({
    title,
    platform: opts.platform,
    genre: opts.genre,
    mood: opts.mood,
    visualStyle: opts.visualStyle,
    sceneDescription: opts.sceneDescription,
    variationHint,
  });

  const openai = new OpenAI({ apiKey });
  const result = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    size: format.size,
    quality: "standard",
    n: 1,
    response_format: "url",
  });

  const remoteUrl = result.data?.[0]?.url;
  if (!remoteUrl) throw new Error("No image returned from OpenAI.");

  const coverRef = getFirestore().collection(COLLECTION).doc();
  const filename = `${coverRef.id}-art.png`;
  const artworkPath = await downloadToUploads(remoteUrl, filename);
  // Relative path so Next.js /uploads rewrite stays same-origin for canvas compositing
  const artworkUrl = artworkPath;

  const showAuthor = opts.showAuthor !== false;
  const authorName = showAuthor ? String(opts.authorName || "").trim() : "";

  const version = opts.parentCoverId
    ? await nextVersion(opts.userId, title, opts.parentCoverId)
    : 1;

  const doc = {
    id: coverRef.id,
    userId: opts.userId,
    projectId: opts.projectId || null,
    parentCoverId: opts.parentCoverId || null,
    title,
    authorName,
    showAuthor,
    platform: opts.platform,
    genre: opts.genre,
    mood: opts.mood,
    visualStyle: opts.visualStyle,
    sceneDescription: String(opts.sceneDescription || "").trim(),
    coverFormat: format.id,
    artworkUrl,
    artworkPath,
    finalImageUrl: null as string | null,
    finalImagePath: null as string | null,
    thumbnailUrl: artworkUrl,
    status: "generated",
    version,
    promptPreview: prompt.slice(0, 500),
    model: "dall-e-3",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await coverRef.set(doc);

  await recordAiUsage({
    userId: opts.userId,
    field: "ghostWriterCount",
    tool: "book-cover",
    model: "dall-e-3",
    tokensUsed: 0,
    genre: opts.genre,
    projectId: opts.projectId || undefined,
    projectName: title,
    inputPreview: title,
  }).catch(() => undefined);

  return {
    ...doc,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function nextVersion(userId: string, title: string, parentCoverId: string) {
  const db = getFirestore();
  const parent = await db.collection(COLLECTION).doc(parentCoverId).get();
  const baseTitle = parent.exists ? String(parent.data()?.title || title) : title;
  const snap = await db.collection(COLLECTION).where("userId", "==", userId).limit(100).get();
  let max = 1;
  snap.docs.forEach((d) => {
    const data = d.data();
    if (String(data.title || "") === baseTitle) {
      max = Math.max(max, Number(data.version || 1));
    }
  });
  return max + 1;
}

export async function listBookCovers(userId: string) {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).where("userId", "==", userId).limit(100).get();
  const items = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: String(d.title || ""),
      authorName: String(d.authorName || ""),
      showAuthor: d.showAuthor !== false,
      platform: String(d.platform || ""),
      genre: String(d.genre || ""),
      mood: String(d.mood || ""),
      visualStyle: String(d.visualStyle || ""),
      sceneDescription: String(d.sceneDescription || ""),
      coverFormat: String(d.coverFormat || "serialized"),
      artworkUrl: String(d.artworkUrl || ""),
      finalImageUrl: d.finalImageUrl ? String(d.finalImageUrl) : null,
      thumbnailUrl: String(d.thumbnailUrl || d.finalImageUrl || d.artworkUrl || ""),
      projectId: d.projectId || null,
      parentCoverId: d.parentCoverId || null,
      status: String(d.status || "generated"),
      version: Number(d.version || 1),
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
    };
  });
  items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return items;
}

export async function getBookCover(userId: string, coverId: string) {
  const snap = await getFirestore().collection(COLLECTION).doc(coverId).get();
  if (!snap.exists || snap.data()?.userId !== userId) {
    throw Object.assign(new Error("Cover not found."), { status: 404 });
  }
  const d = snap.data()!;
  return {
    id: snap.id,
    ...d,
    createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || null,
  };
}

export async function saveFinalCoverImage(opts: {
  userId: string;
  coverId: string;
  buffer: Buffer;
}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(opts.coverId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== opts.userId) {
    throw Object.assign(new Error("Cover not found."), { status: 404 });
  }

  const dir = path.join(getUploadsDir(), "covers");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${opts.coverId}-final.png`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, opts.buffer);
  const rel = `/uploads/covers/${filename}`;
  const finalImageUrl = rel;

  await ref.update({
    finalImageUrl,
    finalImagePath: rel,
    thumbnailUrl: finalImageUrl,
    status: "saved",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { finalImageUrl, coverId: opts.coverId };
}

export async function applyCoverToProject(opts: {
  userId: string;
  coverId: string;
  projectId: string;
}) {
  const db = getFirestore();
  const coverRef = db.collection(COLLECTION).doc(opts.coverId);
  const coverSnap = await coverRef.get();
  if (!coverSnap.exists || coverSnap.data()?.userId !== opts.userId) {
    throw Object.assign(new Error("Cover not found."), { status: 404 });
  }

  const projectRef = db.collection("projects").doc(opts.projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists || projectSnap.data()?.userId !== opts.userId) {
    throw Object.assign(new Error("Project not found or unauthorized."), { status: 404 });
  }

  const cover = coverSnap.data()!;
  const imageUrl = String(cover.finalImageUrl || cover.artworkUrl || "");
  if (!imageUrl) {
    throw Object.assign(new Error("Cover image missing."), { status: 400 });
  }

  await projectRef.update({
    coverImageUrl: imageUrl,
    coverId: opts.coverId,
    updatedAt: new Date().toISOString(),
  });

  await coverRef.update({
    projectId: opts.projectId,
    status: "applied",
    updatedAt: FieldValue.serverTimestamp(),
  });

  const project = projectSnap.data() || {};
  return {
    projectId: opts.projectId,
    coverImageUrl: imageUrl,
    project: {
      id: opts.projectId,
      name: project.name,
      type: project.type || "novel",
      coverImageUrl: imageUrl,
    },
  };
}

export async function deleteBookCover(userId: string, coverId: string) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(coverId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== userId) {
    throw Object.assign(new Error("Cover not found."), { status: 404 });
  }
  const data = snap.data() || {};
  for (const key of ["artworkPath", "finalImagePath"] as const) {
    const rel = data[key];
    if (typeof rel === "string" && rel.startsWith("/uploads/")) {
      const abs = path.join(getUploadsDir(), "..", rel.replace(/^\//, "").replace(/^uploads[\\/]/, ""));
      // Prefer joining from uploads root
      const filePath = path.join(getUploadsDir(), rel.replace(/^\/uploads\//, ""));
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
      void abs;
    }
  }
  await ref.delete();
  return { ok: true };
}
