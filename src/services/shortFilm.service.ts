import fs from "fs";
import path from "path";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";
import { getPlanById, isUserPremium } from "../utils/plans";
import { FILM_GENRES, formatDuration } from "../data/shortFilmCatalog";

const FILMS = "shortFilms";
const LIKES = "filmLikes";
const SAVES = "savedFilms";
const REPORTS = "filmReports";

export function getShortFilmMeta() {
  return {
    genres: FILM_GENRES,
    ratings: ["General", "Mature"],
    reportReasons: [
      "Inappropriate content",
      "Copyright concern",
      "Spam",
      "Violence",
      "Other",
    ],
  };
}

export async function assertUploadAccess(userId: string) {
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
      error: "Short Film Showcase upload requires an active subscription.",
      premiumRequired: true,
    };
  }
  const planId = String(userData.subscriptionPlan || "");
  const plan = planId ? await getPlanById(planId) : null;
  if (plan?.isFree) {
    return {
      ok: false as const,
      status: 403,
      error: "Short Film upload is available on premium plans.",
      premiumRequired: true,
    };
  }
  return { ok: true as const, userData };
}

function mapFilm(id: string, data: Record<string, any>, extras?: Record<string, unknown>) {
  const durationSeconds = Number(data.durationSeconds || 0);
  return {
    id,
    creatorId: data.creatorId || "",
    creatorName: data.creatorName || "Creator",
    title: data.title || "",
    description: data.description || "",
    genre: data.genre || "",
    language: data.language || "English",
    contentRating: data.contentRating || "General",
    director: data.director || "",
    writer: data.writer || "",
    cast: data.cast || "",
    productionYear: data.productionYear || null,
    country: data.country || "",
    durationSeconds,
    durationLabel: data.durationLabel || formatDuration(durationSeconds),
    thumbnailUrl: data.thumbnailUrl || "",
    videoUrl: data.videoUrl || "",
    externalVideoUrl: data.externalVideoUrl || "",
    status: data.status || "draft",
    rejectReason: data.rejectReason || null,
    views: Number(data.views || 0),
    likes: Number(data.likes || 0),
    publishedAt: data.publishedAt || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    ...extras,
  };
}

export async function listPublishedFilms(opts: {
  genre?: string;
  search?: string;
  sort?: string;
  limit?: number;
}) {
  const db = getFirestore();
  const snap = await db.collection(FILMS).where("status", "==", "published").get();
  let films = snap.docs.map((d) => mapFilm(d.id, d.data()));

  const genre = String(opts.genre || "").trim();
  if (genre && genre.toLowerCase() !== "all") {
    films = films.filter((f) => f.genre.toLowerCase() === genre.toLowerCase());
  }

  const search = String(opts.search || "").trim().toLowerCase();
  if (search) {
    films = films.filter(
      (f) =>
        f.title.toLowerCase().includes(search) ||
        f.creatorName.toLowerCase().includes(search) ||
        f.genre.toLowerCase().includes(search) ||
        f.description.toLowerCase().includes(search)
    );
  }

  const sort = String(opts.sort || "latest");
  films.sort((a, b) => {
    if (sort === "views") return b.views - a.views;
    if (sort === "likes") return b.likes - a.likes;
    return String(b.publishedAt || b.createdAt || "").localeCompare(
      String(a.publishedAt || a.createdAt || "")
    );
  });

  const limit = Math.min(Number(opts.limit) || 40, 100);
  return films.slice(0, limit);
}

export async function listCreatorFilms(creatorId: string, includePrivate = false) {
  const db = getFirestore();
  const snap = await db.collection(FILMS).where("creatorId", "==", creatorId).get();
  let films = snap.docs.map((d) => mapFilm(d.id, d.data()));
  if (!includePrivate) {
    films = films.filter((f) => f.status === "published");
  }
  films.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return films;
}

export async function getFilm(filmId: string, viewerId?: string) {
  const db = getFirestore();
  const snap = await db.collection(FILMS).doc(filmId).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }
  const data = snap.data()!;
  const isOwner = viewerId && data.creatorId === viewerId;
  if (data.status !== "published" && !isOwner) {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }

  let liked = false;
  let saved = false;
  if (viewerId) {
    const likeId = `${viewerId}_${filmId}`;
    const saveId = `${viewerId}_${filmId}`;
    const [likeSnap, saveSnap] = await Promise.all([
      db.collection(LIKES).doc(likeId).get(),
      db.collection(SAVES).doc(saveId).get(),
    ]);
    liked = likeSnap.exists;
    saved = saveSnap.exists;
  }

  return mapFilm(snap.id, data, { liked, saved, isOwner: Boolean(isOwner) });
}

export async function upsertFilmDraft(
  userId: string,
  userName: string,
  body: Record<string, any>,
  filmId?: string
) {
  const title = String(body.title || "").trim();
  if (!title) throw Object.assign(new Error("Title is required."), { status: 400 });

  const db = getFirestore();
  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    title,
    description: String(body.description || "").trim(),
    genre: String(body.genre || "Drama").trim(),
    language: String(body.language || "English").trim(),
    contentRating: String(body.contentRating || "General").trim(),
    director: String(body.director || "").trim(),
    writer: String(body.writer || "").trim(),
    cast: String(body.cast || "").trim(),
    productionYear: body.productionYear ? Number(body.productionYear) : null,
    country: String(body.country || "").trim(),
    durationSeconds: Number(body.durationSeconds || 0),
    durationLabel: formatDuration(Number(body.durationSeconds || 0)),
    externalVideoUrl: String(body.externalVideoUrl || "").trim(),
    updatedAt: now,
  };

  if (body.thumbnailUrl) payload.thumbnailUrl = String(body.thumbnailUrl);
  if (body.videoUrl) payload.videoUrl = String(body.videoUrl);

  if (filmId) {
    const ref = db.collection(FILMS).doc(filmId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.creatorId !== userId) {
      throw Object.assign(new Error("Film not found."), { status: 404 });
    }
    const status = snap.data()?.status;
    if (status === "published") {
      // edits after publish go back to pending if resubmitting later; for draft save keep published unless submit
    }
    await ref.set(payload, { merge: true });
    const next = await ref.get();
    return mapFilm(next.id, next.data()!);
  }

  const ref = db.collection(FILMS).doc();
  await ref.set({
    creatorId: userId,
    creatorName: userName,
    ...payload,
    thumbnailUrl: payload.thumbnailUrl || "",
    videoUrl: payload.videoUrl || "",
    status: "draft",
    rejectReason: null,
    views: 0,
    likes: 0,
    publishedAt: null,
    createdAt: now,
  });
  const next = await ref.get();
  return mapFilm(next.id, next.data()!);
}

export async function submitFilmForReview(userId: string, filmId: string) {
  const db = getFirestore();
  const ref = db.collection(FILMS).doc(filmId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.creatorId !== userId) {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }
  const data = snap.data()!;
  if (!data.videoUrl && !data.externalVideoUrl) {
    throw Object.assign(new Error("Upload a video or add an external video URL first."), {
      status: 400,
    });
  }
  if (!String(data.title || "").trim()) {
    throw Object.assign(new Error("Title is required."), { status: 400 });
  }
  const now = new Date().toISOString();
  await ref.update({
    status: "pending_review",
    rejectReason: null,
    updatedAt: now,
  });
  const next = await ref.get();
  return mapFilm(next.id, next.data()!);
}

export async function saveUploadedAsset(
  kind: "video" | "thumbnail",
  filmId: string,
  filename: string
) {
  const rel = `/uploads/films/${filmId}/${filename}`;
  const db = getFirestore();
  const ref = db.collection(FILMS).doc(filmId);
  const update: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (kind === "video") update.videoUrl = rel;
  else update.thumbnailUrl = rel;
  await ref.update(update);
  return rel;
}

export function ensureFilmUploadDir(filmId: string) {
  const dir = path.join(getUploadsDir(), "films", filmId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function recordView(userId: string, filmId: string) {
  const db = getFirestore();
  const filmRef = db.collection(FILMS).doc(filmId);
  const snap = await filmRef.get();
  if (!snap.exists || snap.data()?.status !== "published") {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }
  // Simple dedupe: one counted view per user per film per day
  const day = new Date().toISOString().slice(0, 10);
  const viewId = `${userId}_${filmId}_${day}`;
  const viewRef = db.collection("filmViews").doc(viewId);
  const viewSnap = await viewRef.get();
  if (viewSnap.exists) {
    return { views: Number(snap.data()?.views || 0), counted: false };
  }
  await viewRef.set({ userId, filmId, day, createdAt: new Date().toISOString() });
  await filmRef.update({ views: FieldValue.increment(1) });
  const next = await filmRef.get();
  return { views: Number(next.data()?.views || 0), counted: true };
}

export async function toggleLike(userId: string, filmId: string) {
  const db = getFirestore();
  const filmRef = db.collection(FILMS).doc(filmId);
  const filmSnap = await filmRef.get();
  if (!filmSnap.exists || filmSnap.data()?.status !== "published") {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }
  const likeRef = db.collection(LIKES).doc(`${userId}_${filmId}`);
  const likeSnap = await likeRef.get();
  if (likeSnap.exists) {
    await likeRef.delete();
    await filmRef.update({ likes: FieldValue.increment(-1) });
    const next = await filmRef.get();
    return { liked: false, likes: Math.max(0, Number(next.data()?.likes || 0)) };
  }
  await likeRef.set({
    userId,
    filmId,
    createdAt: new Date().toISOString(),
  });
  await filmRef.update({ likes: FieldValue.increment(1) });
  const next = await filmRef.get();
  return { liked: true, likes: Number(next.data()?.likes || 0) };
}

export async function toggleSave(userId: string, filmId: string) {
  const db = getFirestore();
  const filmRef = db.collection(FILMS).doc(filmId);
  const filmSnap = await filmRef.get();
  if (!filmSnap.exists || filmSnap.data()?.status !== "published") {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }
  const saveRef = db.collection(SAVES).doc(`${userId}_${filmId}`);
  const saveSnap = await saveRef.get();
  if (saveSnap.exists) {
    await saveRef.delete();
    return { saved: false };
  }
  await saveRef.set({
    userId,
    filmId,
    createdAt: new Date().toISOString(),
  });
  return { saved: true };
}

export async function listSavedFilms(userId: string) {
  const db = getFirestore();
  const snap = await db.collection(SAVES).where("userId", "==", userId).get();
  const ids = snap.docs.map((d) => String(d.data().filmId || "")).filter(Boolean);
  if (!ids.length) return [];
  const films = [];
  for (const id of ids.slice(0, 50)) {
    const f = await db.collection(FILMS).doc(id).get();
    if (f.exists && f.data()?.status === "published") {
      films.push(mapFilm(f.id, f.data()!));
    }
  }
  return films;
}

export async function reportFilm(
  userId: string,
  filmId: string,
  reason: string,
  details?: string
) {
  const db = getFirestore();
  const filmSnap = await db.collection(FILMS).doc(filmId).get();
  if (!filmSnap.exists) {
    throw Object.assign(new Error("Film not found."), { status: 404 });
  }
  const ref = db.collection(REPORTS).doc();
  await ref.set({
    filmId,
    userId,
    reason: String(reason || "Other").trim(),
    details: String(details || "").trim(),
    status: "open",
    createdAt: new Date().toISOString(),
  });
  return { ok: true, id: ref.id };
}

export async function adminListFilms(status?: string) {
  const db = getFirestore();
  const snap = await db.collection(FILMS).limit(300).get();
  let films = snap.docs.map((d) => mapFilm(d.id, d.data()));
  if (status) films = films.filter((f) => f.status === status);
  films.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return films;
}

export async function adminModerateFilm(
  filmId: string,
  action: "approve" | "reject" | "remove",
  rejectReason?: string
) {
  const db = getFirestore();
  const ref = db.collection(FILMS).doc(filmId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Film not found."), { status: 404 });
  const now = new Date().toISOString();
  if (action === "approve") {
    await ref.update({
      status: "published",
      rejectReason: null,
      publishedAt: snap.data()?.publishedAt || now,
      updatedAt: now,
    });
  } else if (action === "reject") {
    await ref.update({
      status: "rejected",
      rejectReason: String(rejectReason || "Needs changes").trim(),
      updatedAt: now,
    });
  } else {
    await ref.update({ status: "removed", updatedAt: now });
  }
  const next = await ref.get();
  return mapFilm(next.id, next.data()!);
}

export async function adminListReports() {
  const db = getFirestore();
  const snap = await db.collection(REPORTS).limit(200).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function seedDemoFilms() {
  const db = getFirestore();
  const existing = await db.collection(FILMS).where("status", "==", "published").limit(1).get();
  if (!existing.empty) {
    const all = await listPublishedFilms({ limit: 20 });
    return { seeded: 0, films: all, message: "Showcase already has films." };
  }

  const now = new Date().toISOString();
  const samples = [
    {
      title: "Ashes of Enugu",
      genre: "Drama",
      durationSeconds: 14 * 60,
      description:
        "A short drama about family, memory, and the roads that lead us home through Enugu's red earth.",
      director: "Ada Okonkwo",
      writer: "John Writer",
      cast: "Chioma Eze, Tunde Bakare",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80",
      externalVideoUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ",
      creatorName: "John Writer",
    },
    {
      title: "Last Bus Home",
      genre: "Thriller",
      durationSeconds: 9 * 60,
      description: "A late-night bus ride turns into a race against a secret already on board.",
      director: "Kemi Ade",
      writer: "Kemi Ade",
      cast: "Ibrahim Yusuf, Ngozi Ume",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=800&q=80",
      externalVideoUrl: "https://www.youtube.com/embed/LXb3EKWsInQ",
      creatorName: "Kemi Ade",
    },
    {
      title: "Salt & Palm Oil",
      genre: "Comedy",
      durationSeconds: 11 * 60,
      description: "Two cousins, one kitchen, and a wedding feast that refuses to go as planned.",
      director: "Bola Mensah",
      writer: "Bola Mensah",
      cast: "Funke Akin, Dayo Ojo",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80",
      externalVideoUrl: "https://www.youtube.com/embed/ScMzIvxBSi4",
      creatorName: "Bola Mensah",
    },
    {
      title: "Quiet Water",
      genre: "Drama",
      durationSeconds: 16 * 60,
      description: "A riverside town holds its breath as a missing boat returns without its captain.",
      director: "Amara Cole",
      writer: "Amara Cole",
      cast: "Sade Lawal, Emeka Obi",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80",
      externalVideoUrl: "https://www.youtube.com/embed/tgbNymZ7vqY",
      creatorName: "Amara Cole",
    },
  ];

  const batch = db.batch();
  const created = [];
  for (const s of samples) {
    const ref = db.collection(FILMS).doc();
    const doc = {
      creatorId: "system-demo",
      creatorName: s.creatorName,
      title: s.title,
      description: s.description,
      genre: s.genre,
      language: "English",
      contentRating: "General",
      director: s.director,
      writer: s.writer,
      cast: s.cast,
      productionYear: 2026,
      country: "Nigeria",
      durationSeconds: s.durationSeconds,
      durationLabel: formatDuration(s.durationSeconds),
      thumbnailUrl: s.thumbnailUrl,
      videoUrl: "",
      externalVideoUrl: s.externalVideoUrl,
      status: "published",
      rejectReason: null,
      views: Math.floor(Math.random() * 900) + 100,
      likes: Math.floor(Math.random() * 80) + 10,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(ref, doc);
    created.push(mapFilm(ref.id, doc));
  }
  await batch.commit();
  return { seeded: created.length, films: created, message: `Seeded ${created.length} demo films.` };
}
