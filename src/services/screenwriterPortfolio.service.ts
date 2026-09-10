import { getFirestore } from "firebase-admin/firestore";

export type PricingModel = "per-page" | "per-script" | "per-project";
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type PortfolioPublishStatus = "draft" | "published" | "private";
export type WorkType = "feature" | "short" | "tv" | "series" | "theatre";
export type WorkStatus = "available" | "sold" | "optioned" | "produced";

export type SocialLinks = {
  youtube?: string;
  tiktok?: string;
  instagram?: string;
  portfolioSite?: string;
  imdb?: string;
  linkedin?: string;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  year?: string;
  proofUrl?: string;
};

export type PortfolioWork = {
  id: string;
  title: string;
  workType: WorkType;
  genre: string;
  status: WorkStatus;
  logline: string;
  pagesOrEpisodes?: string;
  role: string;
  year?: string;
  externalLink?: string;
  sampleText?: string;
  sampleLabel?: string;
};

export type ScreenwriterPortfolio = {
  id?: string;
  userId: string;
  displayName: string;
  professionalTitle: string;
  genres: string[];
  about: string;
  yearsExperience?: number;
  location?: string;
  languages?: string;
  availableForWork: boolean;
  pricingModel: PricingModel;
  rateAmount: number;
  rateCurrency: string;
  rateNegotiable: boolean;
  social: SocialLinks;
  achievements: Achievement[];
  works: PortfolioWork[];
  photoUrl?: string;
  slug: string;
  publishStatus: PortfolioPublishStatus;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};

export type HireInquiry = {
  id?: string;
  portfolioId: string;
  writerUserId: string;
  fromUserId?: string;
  fromName: string;
  fromEmail: string;
  projectTitle: string;
  lookingFor: string;
  budget?: string;
  deadline?: string;
  message: string;
  status: "new" | "read" | "replied";
  createdAt: string;
};

const COL = "screenwriterPortfolios";
const INQUIRIES = "screenwriterInquiries";

const GENRES = [
  "Thriller",
  "Drama",
  "Comedy",
  "Romance",
  "Action",
  "Horror",
  "Sci-Fi",
  "Crime",
  "Fantasy",
  "Documentary",
];

function col() {
  return getFirestore().collection(COL);
}

function inquiriesCol() {
  return getFirestore().collection(INQUIRIES);
}

function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "writer";
}

async function ensureUniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base);
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const snap = await col().where("slug", "==", candidate).limit(1).get();
    if (snap.empty || (excludeId && snap.docs[0].id === excludeId)) return candidate;
    n += 1;
    if (n > 50) return `${slug}-${Date.now().toString(36)}`;
  }
}

function cleanSocial(raw: any): SocialLinks {
  const pick = (k: string) => {
    const v = String(raw?.[k] || "").trim();
    return v || undefined;
  };
  return {
    youtube: pick("youtube"),
    tiktok: pick("tiktok"),
    instagram: pick("instagram"),
    portfolioSite: pick("portfolioSite"),
    imdb: pick("imdb"),
    linkedin: pick("linkedin"),
  };
}

function mapAchievement(raw: any, i: number): Achievement {
  return {
    id: String(raw?.id || `ach_${i}`),
    title: String(raw?.title || "").trim(),
    description: String(raw?.description || "").trim(),
    year: String(raw?.year || "").trim() || undefined,
    proofUrl: String(raw?.proofUrl || "").trim() || undefined,
  };
}

function mapWork(raw: any, i: number): PortfolioWork {
  const workType = (["feature", "short", "tv", "series", "theatre"] as WorkType[]).includes(raw?.workType)
    ? raw.workType
    : "feature";
  const status = (["available", "sold", "optioned", "produced"] as WorkStatus[]).includes(raw?.status)
    ? raw.status
    : "available";
  return {
    id: String(raw?.id || `work_${i}`),
    title: String(raw?.title || "Untitled").trim(),
    workType,
    genre: String(raw?.genre || "").trim(),
    status,
    logline: String(raw?.logline || "").trim(),
    pagesOrEpisodes: String(raw?.pagesOrEpisodes || "").trim() || undefined,
    role: String(raw?.role || "Screenwriter").trim(),
    year: String(raw?.year || "").trim() || undefined,
    externalLink: String(raw?.externalLink || "").trim() || undefined,
    sampleText: String(raw?.sampleText || "").trim() || undefined,
    sampleLabel: String(raw?.sampleLabel || "First 10 pages").trim() || undefined,
  };
}

function workForStore(w: PortfolioWork) {
  return {
    id: w.id,
    title: w.title,
    workType: w.workType,
    genre: w.genre || "",
    status: w.status,
    logline: w.logline || "",
    pagesOrEpisodes: w.pagesOrEpisodes || "",
    role: w.role || "Screenwriter",
    year: w.year || "",
    externalLink: w.externalLink || "",
    sampleText: w.sampleText || "",
    sampleLabel: w.sampleLabel || "First 10 pages",
  };
}

function achievementForStore(a: Achievement) {
  return {
    id: a.id,
    title: a.title,
    description: a.description || "",
    year: a.year || "",
    proofUrl: a.proofUrl || "",
  };
}

function mapPortfolio(id: string, data: Record<string, any>): ScreenwriterPortfolio {
  return {
    id,
    userId: String(data.userId || ""),
    displayName: String(data.displayName || ""),
    professionalTitle: String(data.professionalTitle || "Screenwriter"),
    genres: Array.isArray(data.genres) ? data.genres.map(String) : [],
    about: String(data.about || ""),
    yearsExperience: data.yearsExperience != null ? Number(data.yearsExperience) : undefined,
    location: String(data.location || "") || undefined,
    languages: String(data.languages || "") || undefined,
    availableForWork: data.availableForWork !== false,
    pricingModel: (["per-page", "per-script", "per-project"] as PricingModel[]).includes(data.pricingModel)
      ? data.pricingModel
      : "per-page",
    rateAmount: Number(data.rateAmount || 0),
    rateCurrency: String(data.rateCurrency || "NGN"),
    rateNegotiable: data.rateNegotiable !== false,
    social: cleanSocial(data.social || {}),
    achievements: Array.isArray(data.achievements)
      ? data.achievements.map(mapAchievement).filter((a: Achievement) => a.title)
      : [],
    works: Array.isArray(data.works) ? data.works.map(mapWork) : [],
    photoUrl: String(data.photoUrl || "") || undefined,
    slug: String(data.slug || id),
    publishStatus:
      data.publishStatus === "published"
        ? "published"
        : data.publishStatus === "private"
          ? "private"
          : "draft",
    verificationStatus:
      data.verificationStatus === "pending" ||
      data.verificationStatus === "approved" ||
      data.verificationStatus === "rejected"
        ? data.verificationStatus
        : "unverified",
    verificationNote: data.verificationNote ? String(data.verificationNote) : undefined,
    verifiedAt: data.verifiedAt || null,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
    publishedAt: data.publishedAt || null,
  };
}

export function getScreenwriterPortfolioMeta() {
  return {
    genres: GENRES,
    pricingModels: [
      { id: "per-page", label: "Per page" },
      { id: "per-script", label: "Per script" },
      { id: "per-project", label: "Per project" },
    ],
    workTypes: [
      { id: "feature", label: "Feature" },
      { id: "short", label: "Short Film" },
      { id: "tv", label: "TV" },
      { id: "series", label: "Series" },
      { id: "theatre", label: "Theatre" },
    ],
    workStatuses: [
      { id: "available", label: "Available" },
      { id: "sold", label: "Sold" },
      { id: "optioned", label: "Optioned" },
      { id: "produced", label: "Produced" },
    ],
  };
}

async function computeLiveStats(userId: string) {
  const db = getFirestore();
  let scriptsSold = 0;
  try {
    const purchases = await db.collection("marketplacePurchases").where("writerId", "==", userId).get();
    if (!purchases.empty) {
      scriptsSold = purchases.size;
    } else {
      const listings = await db.collection("marketplaceListings").where("writerId", "==", userId).get();
      scriptsSold = listings.docs.filter((d) => {
        const s = d.data()?.status;
        return s === "sold" || s === "optioned";
      }).length;
    }
  } catch {
    scriptsSold = 0;
  }

  let rating: number | null = null;
  try {
    const reviews = await db.collection("marketplaceReviews").where("writerId", "==", userId).get();
    const scores = reviews.docs
      .map((d) => Number(d.data()?.rating))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (scores.length) {
      rating = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    }
  } catch {
    rating = null;
  }

  let responseTimeLabel: string | null = null;
  try {
    const inquiries = await db.collection(INQUIRIES).where("writerUserId", "==", userId).get();
    const deltas: number[] = [];
    for (const doc of inquiries.docs) {
      const d = doc.data();
      if (d?.status !== "replied" || !d.createdAt || !d.repliedAt) continue;
      const start = Date.parse(String(d.createdAt));
      const end = Date.parse(String(d.repliedAt));
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        deltas.push(end - start);
      }
    }
    if (deltas.length) {
      const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const hours = avgMs / (1000 * 60 * 60);
      responseTimeLabel = hours < 2 ? "<2h" : hours < 24 ? `<${Math.ceil(hours)}h` : `<${Math.ceil(hours / 24)}d`;
    }
  } catch {
    responseTimeLabel = null;
  }

  // Rating / response / sold are platform-derived — never user-editable
  return {
    scriptsSold,
    rating,
    responseTimeLabel,
  };
}

export async function getMyScreenwriterPortfolio(userId: string) {
  const snap = await col().where("userId", "==", userId).limit(1).get();
  if (snap.empty) return null;
  const p = mapPortfolio(snap.docs[0].id, snap.docs[0].data());
  const stats = await computeLiveStats(userId);
  return { portfolio: p, stats };
}

export async function saveScreenwriterPortfolio(
  userId: string,
  input: Partial<ScreenwriterPortfolio> & { publish?: boolean }
) {
  const existingSnap = await col().where("userId", "==", userId).limit(1).get();
  const existing = existingSnap.empty
    ? null
    : mapPortfolio(existingSnap.docs[0].id, existingSnap.docs[0].data());

  const now = new Date().toISOString();
  const displayName = String(input.displayName || existing?.displayName || "").trim() || "Screenwriter";
  const slug = await ensureUniqueSlug(input.slug || existing?.slug || displayName, existing?.id);

  let publishStatus: PortfolioPublishStatus = input.publishStatus || existing?.publishStatus || "draft";
  let publishedAt = existing?.publishedAt || null;
  if (input.publish) {
    publishStatus = "published";
    publishedAt = now;
  }

  // verificationStatus is NEVER taken from client write for privilege escalation
  const verificationStatus = existing?.verificationStatus || "unverified";

  const payload = {
    userId,
    displayName,
    professionalTitle: String(input.professionalTitle || existing?.professionalTitle || "Screenwriter").trim(),
    genres: Array.isArray(input.genres) ? input.genres.map(String) : existing?.genres || [],
    about: String(input.about ?? existing?.about ?? "").trim(),
    yearsExperience:
      input.yearsExperience != null
        ? Number(input.yearsExperience)
        : existing?.yearsExperience ?? null,
    location: String(input.location ?? existing?.location ?? "").trim(),
    languages: String(input.languages ?? existing?.languages ?? "").trim(),
    availableForWork:
      input.availableForWork != null ? Boolean(input.availableForWork) : existing?.availableForWork !== false,
    pricingModel: input.pricingModel || existing?.pricingModel || "per-page",
    rateAmount: Number(input.rateAmount ?? existing?.rateAmount ?? 0),
    rateCurrency: String(input.rateCurrency || existing?.rateCurrency || "NGN"),
    rateNegotiable:
      input.rateNegotiable != null ? Boolean(input.rateNegotiable) : existing?.rateNegotiable !== false,
    social: cleanSocial(input.social || existing?.social || {}),
    achievements: (Array.isArray(input.achievements) ? input.achievements : existing?.achievements || [])
      .map(mapAchievement)
      .filter((a) => a.title)
      .map(achievementForStore),
    works: (Array.isArray(input.works) ? input.works : existing?.works || [])
      .map(mapWork)
      .map(workForStore),
    photoUrl: String(input.photoUrl ?? existing?.photoUrl ?? "").trim(),
    slug,
    publishStatus,
    verificationStatus,
    verificationNote: existing?.verificationNote || "",
    verifiedAt: existing?.verifiedAt || null,
    updatedAt: now,
    publishedAt,
    createdAt: existing?.createdAt || now,
  };

  if (existing?.id) {
    await col().doc(existing.id).set(payload, { merge: true });
    const stats = await computeLiveStats(userId);
    return { portfolio: mapPortfolio(existing.id, (await col().doc(existing.id).get()).data()!), stats };
  }

  const ref = col().doc();
  await ref.set(payload);
  const stats = await computeLiveStats(userId);
  return { portfolio: mapPortfolio(ref.id, (await ref.get()).data()!), stats };
}

export async function submitVerification(userId: string, note?: string) {
  const mine = await getMyScreenwriterPortfolio(userId);
  if (!mine?.portfolio?.id) {
    throw Object.assign(new Error("Save your profile before requesting verification."), { status: 400 });
  }
  if (mine.portfolio.verificationStatus === "approved") {
    throw Object.assign(new Error("Already verified."), { status: 400 });
  }
  await col().doc(mine.portfolio.id).set(
    {
      verificationStatus: "pending",
      verificationNote: String(note || "").trim(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return getMyScreenwriterPortfolio(userId);
}

export async function getPublicScreenwriterPortfolio(slug: string) {
  const snap = await col().where("slug", "==", String(slug || "")).limit(1).get();
  if (snap.empty) throw Object.assign(new Error("Portfolio not found."), { status: 404 });
  const p = mapPortfolio(snap.docs[0].id, snap.docs[0].data());
  if (p.publishStatus !== "published") {
    throw Object.assign(new Error("Portfolio is not public."), { status: 403 });
  }
  const stats = await computeLiveStats(p.userId);

  // Public: trim sample to preview only (first ~1500 chars)
  const works = p.works.map((w) => ({
    ...w,
    sampleText: w.sampleText ? w.sampleText.slice(0, 1500) : undefined,
    sampleIsPreview: Boolean(w.sampleText),
  }));

  return {
    portfolio: {
      ...p,
      works,
      userId: undefined,
      verificationNote: undefined,
    },
    stats: {
      scriptsSold: stats.scriptsSold,
      rating: stats.rating,
      responseTimeLabel: stats.responseTimeLabel,
      verified: p.verificationStatus === "approved",
    },
  };
}

export async function createHireInquiry(input: {
  slug: string;
  fromUserId?: string;
  fromName: string;
  fromEmail: string;
  projectTitle: string;
  lookingFor: string;
  budget?: string;
  deadline?: string;
  message: string;
}) {
  const publicData = await getPublicScreenwriterPortfolio(input.slug);
  const portfolioId = (await col().where("slug", "==", input.slug).limit(1).get()).docs[0].id;
  const writerUserId = (await col().doc(portfolioId).get()).data()!.userId;

  const name = String(input.fromName || "").trim();
  const email = String(input.fromEmail || "").trim();
  const projectTitle = String(input.projectTitle || "").trim();
  const lookingFor = String(input.lookingFor || "").trim();
  const message = String(input.message || "").trim();
  if (!name || !email || !projectTitle || !lookingFor || !message) {
    throw Object.assign(new Error("Fill required inquiry fields."), { status: 400 });
  }

  const now = new Date().toISOString();
  const ref = inquiriesCol().doc();
  const doc: HireInquiry = {
    portfolioId,
    writerUserId,
    fromUserId: input.fromUserId || undefined,
    fromName: name,
    fromEmail: email,
    projectTitle,
    lookingFor,
    budget: String(input.budget || "").trim() || undefined,
    deadline: String(input.deadline || "").trim() || undefined,
    message,
    status: "new",
    createdAt: now,
  };
  await ref.set({
    ...doc,
    fromUserId: doc.fromUserId || "",
    budget: doc.budget || "",
    deadline: doc.deadline || "",
  });
  return { inquiry: { ...doc, id: ref.id }, writerName: publicData.portfolio.displayName };
}

export async function listMyInquiries(userId: string) {
  const snap = await inquiriesCol().where("writerUserId", "==", userId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HireInquiry));
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return list;
}

export async function adminListScreenwriterPortfolios() {
  const snap = await col().limit(200).get();
  return snap.docs.map((d) => mapPortfolio(d.id, d.data()));
}

export async function adminSetVerification(
  id: string,
  status: "approved" | "rejected" | "unverified" | "pending",
  note?: string
) {
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Portfolio not found."), { status: 404 });
  const now = new Date().toISOString();
  await ref.set(
    {
      verificationStatus: status,
      verificationNote: String(note || "").trim(),
      verifiedAt: status === "approved" ? now : null,
      updatedAt: now,
    },
    { merge: true }
  );
  return mapPortfolio(id, (await ref.get()).data()!);
}

function formatRate(p: ScreenwriterPortfolio) {
  const amount = p.rateAmount || 0;
  const formatted =
    p.rateCurrency === "NGN"
      ? `₦${amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}`
      : `${p.rateCurrency} ${amount}`;
  const suffix =
    p.pricingModel === "per-page"
      ? "Per page"
      : p.pricingModel === "per-script"
        ? "Per script"
        : "Per project";
  return { formatted, suffix, negotiable: p.rateNegotiable };
}

export { formatRate };
