import { getFirestore } from "firebase-admin/firestore";

export type PortfolioVisibility = "public" | "private" | "unlisted";
export type PortfolioStatus = "draft" | "published" | "disabled";
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type PricingModel = "per-word" | "per-project" | "retainer" | "per-article";

export type SocialLinks = {
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  portfolioSite?: string;
  medium?: string;
  behance?: string;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  year?: string;
  proofUrl?: string;
};

export type PortfolioWorkItem = {
  id: string;
  title: string;
  projectType: string;
  description: string;
  role: string;
  skills: string[];
  clientCompany?: string;
  projectLink?: string;
  sampleText?: string;
  sampleLabel?: string;
  year?: string;
  status?: string;
  sourceType:
    | "project"
    | "one-shot"
    | "flash-draft"
    | "nonfiction"
    | "web3-explainer"
    | "web3-docs"
    | "web3-thread"
    | "web3-community"
    | "external";
  sourceId?: string;
  visibility: PortfolioVisibility;
  sortOrder: number;
};

export type WriterPortfolio = {
  id: string;
  userId: string;
  portfolioName: string;
  displayName: string;
  professionalTitle: string;
  bio: string;
  coverImageUrl?: string;
  photoUrl?: string;
  specialties: string[];
  yearsExperience?: number | null;
  location?: string;
  languages?: string;
  availableForWork: boolean;
  pricingModel: PricingModel;
  rateAmount: number;
  rateCurrency: string;
  rateNegotiable: boolean;
  social: SocialLinks;
  achievements: Achievement[];
  slug: string;
  layout: "classic" | "grid" | "list";
  status: PortfolioStatus;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  verifiedAt?: string | null;
  works: PortfolioWorkItem[];
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
  repliedAt?: string;
};

export type WorkSource = {
  id: string;
  sourceType: PortfolioWorkItem["sourceType"];
  title: string;
  projectType: string;
  excerpt: string;
  updatedAt?: string;
};

const COL = "writerPortfolios";
const INQUIRIES = "writerPortfolioInquiries";
const SETTINGS_DOC = "portfolioBuilder";

const SPECIALTIES = [
  "Copywriting",
  "Content Writing",
  "Blog / SEO",
  "Technical Writing",
  "Ghostwriting",
  "Email Marketing",
  "Social Media",
  "Grant Writing",
  "UX Writing",
  "Journalism",
  "Nonfiction",
  "Web3 / Crypto",
];

export function getPortfolioBuilderMeta() {
  return {
    specialties: SPECIALTIES,
    pricingModels: [
      { id: "per-word", label: "Per word" },
      { id: "per-article", label: "Per article" },
      { id: "per-project", label: "Per project" },
      { id: "retainer", label: "Retainer" },
    ],
    workStatuses: [
      { id: "available", label: "Available" },
      { id: "published", label: "Published" },
      { id: "commissioned", label: "Commissioned" },
      { id: "featured", label: "Featured" },
    ],
  };
}

function col() {
  return getFirestore().collection(COL);
}

function inquiriesCol() {
  return getFirestore().collection(INQUIRIES);
}

function slugify(input: string) {
  return String(input || "writer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "writer";
}

async function ensureUniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base);
  let attempt = 0;
  while (attempt < 20) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const snap = await col().where("slug", "==", candidate).limit(1).get();
    if (snap.empty || (excludeId && snap.docs[0].id === excludeId)) return candidate;
    attempt += 1;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

function cleanSocial(raw: any): SocialLinks {
  const keys: (keyof SocialLinks)[] = [
    "linkedin",
    "twitter",
    "instagram",
    "portfolioSite",
    "medium",
    "behance",
  ];
  const out: SocialLinks = {};
  for (const k of keys) {
    const v = String(raw?.[k] || "").trim();
    if (v) out[k] = v;
  }
  return out;
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

function achievementForStore(a: Achievement) {
  return {
    id: a.id,
    title: a.title,
    description: a.description || "",
    year: a.year || "",
    proofUrl: a.proofUrl || "",
  };
}

function mapWork(raw: any, i: number): PortfolioWorkItem {
  return {
    id: String(raw?.id || `work_${i}`),
    title: String(raw?.title || "Untitled"),
    projectType: String(raw?.projectType || "Writing"),
    description: String(raw?.description || ""),
    role: String(raw?.role || ""),
    skills: Array.isArray(raw?.skills)
      ? raw.skills.map(String).filter(Boolean)
      : String(raw?.skills || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    clientCompany: String(raw?.clientCompany || ""),
    projectLink: String(raw?.projectLink || ""),
    sampleText: String(raw?.sampleText || ""),
    sampleLabel: String(raw?.sampleLabel || "Writing sample"),
    year: String(raw?.year || ""),
    status: String(raw?.status || "published"),
    sourceType: (raw?.sourceType || "external") as PortfolioWorkItem["sourceType"],
    sourceId: String(raw?.sourceId || ""),
    visibility:
      raw?.visibility === "private" || raw?.visibility === "unlisted" ? raw.visibility : "public",
    sortOrder: Number(raw?.sortOrder ?? i),
  };
}

/** Firestore rejects `undefined` — coerce optional fields before write. */
function workForFirestore(w: PortfolioWorkItem) {
  return {
    id: w.id,
    title: w.title,
    projectType: w.projectType,
    description: w.description || "",
    role: w.role || "",
    skills: Array.isArray(w.skills) ? w.skills : [],
    clientCompany: w.clientCompany || "",
    projectLink: w.projectLink || "",
    sampleText: w.sampleText || "",
    sampleLabel: w.sampleLabel || "Writing sample",
    year: w.year || "",
    status: w.status || "published",
    sourceType: w.sourceType || "external",
    sourceId: w.sourceId || "",
    visibility: w.visibility || "public",
    sortOrder: Number(w.sortOrder || 0),
  };
}

function mapPortfolio(id: string, data: Record<string, any>): WriterPortfolio {
  const works = Array.isArray(data.works)
    ? data.works
        .map((w: any, i: number) => mapWork(w, i))
        .sort((a: PortfolioWorkItem, b: PortfolioWorkItem) => a.sortOrder - b.sortOrder)
    : [];
  const pricingModel = (["per-word", "per-project", "retainer", "per-article"].includes(
    data.pricingModel
  )
    ? data.pricingModel
    : "per-project") as PricingModel;
  const verificationStatus = (
    ["pending", "approved", "rejected", "unverified"].includes(data.verificationStatus)
      ? data.verificationStatus
      : "unverified"
  ) as VerificationStatus;

  return {
    id,
    userId: String(data.userId || ""),
    portfolioName: String(data.portfolioName || "My Portfolio"),
    displayName: String(data.displayName || ""),
    professionalTitle: String(data.professionalTitle || ""),
    bio: String(data.bio || ""),
    coverImageUrl: data.coverImageUrl ? String(data.coverImageUrl) : undefined,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    specialties: Array.isArray(data.specialties) ? data.specialties.map(String) : [],
    yearsExperience: data.yearsExperience != null ? Number(data.yearsExperience) : null,
    location: String(data.location || ""),
    languages: String(data.languages || ""),
    availableForWork: data.availableForWork !== false,
    pricingModel,
    rateAmount: Number(data.rateAmount || 0),
    rateCurrency: String(data.rateCurrency || "NGN"),
    rateNegotiable: data.rateNegotiable !== false,
    social: cleanSocial(data.social || {}),
    achievements: Array.isArray(data.achievements)
      ? data.achievements.map(mapAchievement).filter((a: Achievement) => a.title)
      : [],
    slug: String(data.slug || id),
    layout: data.layout === "grid" || data.layout === "list" ? data.layout : "classic",
    status: data.status === "published" ? "published" : data.status === "disabled" ? "disabled" : "draft",
    verificationStatus,
    verificationNote: String(data.verificationNote || ""),
    verifiedAt: data.verifiedAt ? String(data.verifiedAt) : null,
    works,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
    publishedAt: data.publishedAt ? String(data.publishedAt) : null,
  };
}

async function computeLiveStats(userId: string) {
  let projectsCompleted = 0;
  try {
    const snap = await getFirestore().collection("projects").where("userId", "==", userId).get();
    projectsCompleted = snap.size;
  } catch {
    projectsCompleted = 0;
  }

  let responseTimeLabel: string | null = null;
  try {
    const inquiries = await inquiriesCol().where("writerUserId", "==", userId).get();
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

  return {
    projectsCompleted,
    rating: null as number | null,
    responseTimeLabel,
  };
}

export async function listWorkSources(userId: string): Promise<WorkSource[]> {
  const db = getFirestore();
  const sources: WorkSource[] = [];

  const projectsSnap = await db.collection("projects").where("userId", "==", userId).limit(40).get();
  for (const doc of projectsSnap.docs) {
    const d = doc.data();
    sources.push({
      id: doc.id,
      sourceType: "project",
      title: String(d.name || d.title || "Untitled project"),
      projectType: String(d.type || "novel") === "script" ? "Script" : "Novel / Fiction",
      excerpt: String(d.description || "").slice(0, 280),
      updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || String(d.updatedAt || ""),
    });
  }

  const oneShots = await db.collection("oneShotStories").where("userId", "==", userId).limit(40).get();
  for (const doc of oneShots.docs) {
    const d = doc.data();
    sources.push({
      id: doc.id,
      sourceType: "one-shot",
      title: String(d.title || "One-shot"),
      projectType: "One-Shot Story",
      excerpt: String(d.formattedText || d.originalText || "").slice(0, 280),
      updatedAt: String(d.updatedAt || ""),
    });
  }

  const flash = await db.collection("users").doc(userId).collection("flashDrafts").limit(40).get();
  for (const doc of flash.docs) {
    const d = doc.data();
    sources.push({
      id: doc.id,
      sourceType: "flash-draft",
      title: String(d.title || "Flash draft"),
      projectType: "Flash Fiction",
      excerpt: String(d.body || d.promptText || "").slice(0, 280),
      updatedAt: String(d.updatedAt || ""),
    });
  }

  const books = await db.collection("nonfictionBooks").where("userId", "==", userId).limit(20).get();
  for (const doc of books.docs) {
    const d = doc.data();
    const chapters = Array.isArray(d.chapters) ? d.chapters : [];
    for (const ch of chapters) {
      sources.push({
        id: `${doc.id}:${ch.id}`,
        sourceType: "nonfiction",
        title: String(ch.title || "Chapter"),
        projectType: "Nonfiction Chapter",
        excerpt: String(ch.body || "").slice(0, 280),
        updatedAt: String(ch.updatedAt || d.updatedAt || ""),
      });
    }
  }

  const explainers = await db
    .collection("users")
    .doc(userId)
    .collection("web3ExplainerDrafts")
    .limit(40)
    .get();
  for (const doc of explainers.docs) {
    const d = doc.data();
    sources.push({
      id: doc.id,
      sourceType: "web3-explainer",
      title: String(d.title || "Web3 Explainer"),
      projectType: "Web3 Explainer",
      excerpt: String(d.body || d.topic || "").slice(0, 280),
      updatedAt: String(d.updatedAt || ""),
    });
  }

  const web3Docs = await db
    .collection("users")
    .doc(userId)
    .collection("web3DocsDrafts")
    .limit(40)
    .get();
  for (const doc of web3Docs.docs) {
    const d = doc.data();
    const typeLabel =
      d.docType === "faq"
        ? "FAQ"
        : d.docType === "user-guide"
          ? "User Guide"
          : "Whitepaper Section";
    sources.push({
      id: doc.id,
      sourceType: "web3-docs",
      title: String(d.title || "Web3 Document"),
      projectType: `Web3 Docs — ${typeLabel}`,
      excerpt: String(d.body || d.topic || "").slice(0, 280),
      updatedAt: String(d.updatedAt || ""),
    });
  }

  const threads = await db
    .collection("users")
    .doc(userId)
    .collection("web3ThreadDrafts")
    .limit(40)
    .get();
  for (const doc of threads.docs) {
    const d = doc.data();
    const posts = Array.isArray(d.posts) ? d.posts : [];
    sources.push({
      id: doc.id,
      sourceType: "web3-thread",
      title: String(d.idea || "Web3 Thread").slice(0, 80),
      projectType: "Web3 Social Thread",
      excerpt: String(posts[0] || d.idea || "").slice(0, 280),
      updatedAt: String(d.updatedAt || ""),
    });
  }

  const community = await db
    .collection("users")
    .doc(userId)
    .collection("web3CommunityDrafts")
    .limit(40)
    .get();
  for (const doc of community.docs) {
    const d = doc.data();
    sources.push({
      id: doc.id,
      sourceType: "web3-community",
      title: String(d.body || d.projectName || "Community Post").slice(0, 80),
      projectType: "Web3 Community Post",
      excerpt: String(d.body || "").slice(0, 280),
      updatedAt: String(d.updatedAt || ""),
    });
  }

  sources.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return sources;
}

export async function listMyPortfolios(userId: string): Promise<WriterPortfolio[]> {
  const snap = await col().where("userId", "==", userId).limit(20).get();
  const list = snap.docs.map((d) => mapPortfolio(d.id, d.data()));
  list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return list;
}

export async function getPortfolioForOwner(userId: string, id: string): Promise<WriterPortfolio> {
  const snap = await col().doc(id).get();
  if (!snap.exists) throw Object.assign(new Error("Portfolio not found."), { status: 404 });
  const p = mapPortfolio(snap.id, snap.data()!);
  if (p.userId !== userId) throw Object.assign(new Error("Forbidden."), { status: 403 });
  return p;
}

export async function getPublicPortfolioBySlug(slug: string, opts?: { includeUnlisted?: boolean }) {
  const snap = await col().where("slug", "==", String(slug || "")).limit(1).get();
  if (snap.empty) throw Object.assign(new Error("Portfolio not found."), { status: 404 });
  const p = mapPortfolio(snap.docs[0].id, snap.docs[0].data());
  if (p.status === "disabled") {
    throw Object.assign(new Error("This portfolio is unavailable."), { status: 403 });
  }
  if (p.status !== "published") {
    throw Object.assign(new Error("Portfolio is not published."), { status: 404 });
  }

  const works = p.works
    .filter((w) => {
      if (w.visibility === "private") return false;
      if (w.visibility === "unlisted") return Boolean(opts?.includeUnlisted);
      return true;
    })
    .map((w) => ({
      ...w,
      sampleText: w.sampleText ? w.sampleText.slice(0, 1500) : undefined,
      sampleIsPreview: Boolean(w.sampleText),
    }));

  const stats = await computeLiveStats(p.userId);

  return {
    portfolio: {
      ...p,
      works,
      userId: undefined,
      verificationNote: undefined,
    },
    stats: {
      projectsCompleted: stats.projectsCompleted,
      rating: stats.rating,
      responseTimeLabel: stats.responseTimeLabel,
      verified: p.verificationStatus === "approved",
    },
  };
}

export async function savePortfolio(input: {
  userId: string;
  id?: string;
  portfolioName: string;
  displayName: string;
  professionalTitle: string;
  bio: string;
  coverImageUrl?: string;
  photoUrl?: string;
  specialties?: string[];
  yearsExperience?: number | null;
  location?: string;
  languages?: string;
  availableForWork?: boolean;
  pricingModel?: PricingModel;
  rateAmount?: number;
  rateCurrency?: string;
  rateNegotiable?: boolean;
  social?: SocialLinks;
  achievements?: Achievement[];
  slug?: string;
  layout?: WriterPortfolio["layout"];
  works?: PortfolioWorkItem[];
  status?: PortfolioStatus;
  publish?: boolean;
}): Promise<{ portfolio: WriterPortfolio; stats: Awaited<ReturnType<typeof computeLiveStats>> }> {
  const now = new Date().toISOString();
  const displayName = String(input.displayName || "").trim() || "Writer";
  const portfolioName = String(input.portfolioName || "").trim() || `${displayName} — Writing Portfolio`;

  let existing: WriterPortfolio | null = null;
  if (input.id) {
    existing = await getPortfolioForOwner(input.userId, input.id);
  }

  const slugBase = input.slug || existing?.slug || displayName;
  const slug = await ensureUniqueSlug(slugBase, existing?.id);

  const works = Array.isArray(input.works)
    ? input.works.map((w, i) => mapWork({ ...w, sortOrder: w.sortOrder ?? i }, i))
    : existing?.works || [];

  let status: PortfolioStatus = input.status || existing?.status || "draft";
  let publishedAt = existing?.publishedAt || null;
  if (input.publish) {
    status = "published";
    publishedAt = now;
  }

  // verification is NEVER taken from client
  const verificationStatus = existing?.verificationStatus || "unverified";

  const payload = {
    userId: input.userId,
    portfolioName,
    displayName,
    professionalTitle: String(input.professionalTitle || existing?.professionalTitle || "Freelance Writer").trim(),
    bio: String(input.bio ?? existing?.bio ?? "").trim(),
    coverImageUrl: String(input.coverImageUrl ?? existing?.coverImageUrl ?? "").trim(),
    photoUrl: String(input.photoUrl ?? existing?.photoUrl ?? "").trim(),
    specialties: Array.isArray(input.specialties)
      ? input.specialties.map(String)
      : existing?.specialties || [],
    yearsExperience:
      input.yearsExperience != null
        ? Number(input.yearsExperience)
        : existing?.yearsExperience ?? null,
    location: String(input.location ?? existing?.location ?? "").trim(),
    languages: String(input.languages ?? existing?.languages ?? "").trim(),
    availableForWork:
      input.availableForWork != null
        ? Boolean(input.availableForWork)
        : existing?.availableForWork !== false,
    pricingModel: (input.pricingModel || existing?.pricingModel || "per-project") as PricingModel,
    rateAmount: Number(input.rateAmount ?? existing?.rateAmount ?? 0),
    rateCurrency: String(input.rateCurrency || existing?.rateCurrency || "NGN"),
    rateNegotiable:
      input.rateNegotiable != null ? Boolean(input.rateNegotiable) : existing?.rateNegotiable !== false,
    social: cleanSocial(input.social || existing?.social || {}),
    achievements: (Array.isArray(input.achievements) ? input.achievements : existing?.achievements || [])
      .map(mapAchievement)
      .filter((a) => a.title)
      .map(achievementForStore),
    slug,
    layout: input.layout || existing?.layout || "classic",
    status,
    verificationStatus,
    verificationNote: existing?.verificationNote || "",
    verifiedAt: existing?.verifiedAt || null,
    works: works.map(workForFirestore),
    updatedAt: now,
    publishedAt: publishedAt || null,
    createdAt: existing?.createdAt || now,
  };

  const stats = await computeLiveStats(input.userId);

  if (existing) {
    await col().doc(existing.id).set(payload, { merge: true });
    return {
      portfolio: mapPortfolio(existing.id, (await col().doc(existing.id).get()).data()!),
      stats,
    };
  }

  const ref = col().doc();
  await ref.set({ ...payload, createdAt: now });
  return { portfolio: mapPortfolio(ref.id, (await ref.get()).data()!), stats };
}

export async function submitVerification(userId: string, portfolioId: string, note?: string) {
  const p = await getPortfolioForOwner(userId, portfolioId);
  if (p.verificationStatus === "approved") {
    throw Object.assign(new Error("Already verified."), { status: 400 });
  }
  await col().doc(p.id).set(
    {
      verificationStatus: "pending",
      verificationNote: String(note || "").trim(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return getPortfolioForOwner(userId, portfolioId);
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
  const publicData = await getPublicPortfolioBySlug(input.slug);
  const snap = await col().where("slug", "==", input.slug).limit(1).get();
  const portfolioId = snap.docs[0].id;
  const writerUserId = String(snap.docs[0].data()?.userId || "");

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
  return {
    inquiry: { ...doc, id: ref.id },
    writerName: publicData.portfolio.displayName,
  };
}

export async function listMyInquiries(userId: string, portfolioId?: string) {
  let snap;
  if (portfolioId) {
    snap = await inquiriesCol()
      .where("writerUserId", "==", userId)
      .where("portfolioId", "==", portfolioId)
      .get();
  } else {
    snap = await inquiriesCol().where("writerUserId", "==", userId).get();
  }
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HireInquiry));
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return list;
}

export async function deletePortfolio(userId: string, id: string) {
  const p = await getPortfolioForOwner(userId, id);
  await col().doc(p.id).delete();
  return { ok: true };
}

export async function getPortfolioSettings() {
  const snap = await getFirestore().collection("settings").doc(SETTINGS_DOC).get();
  const data = snap.data() || {};
  return {
    layoutsEnabled: Array.isArray(data.layoutsEnabled) ? data.layoutsEnabled : ["classic", "grid", "list"],
    allowUnlisted: data.allowUnlisted !== false,
    allowPrivateWork: data.allowPrivateWork !== false,
    updatedAt: data.updatedAt || null,
  };
}

export async function savePortfolioSettings(patch: Record<string, any>) {
  const current = await getPortfolioSettings();
  const next = {
    layoutsEnabled: Array.isArray(patch.layoutsEnabled) ? patch.layoutsEnabled : current.layoutsEnabled,
    allowUnlisted: patch.allowUnlisted != null ? Boolean(patch.allowUnlisted) : current.allowUnlisted,
    allowPrivateWork:
      patch.allowPrivateWork != null ? Boolean(patch.allowPrivateWork) : current.allowPrivateWork,
    updatedAt: new Date().toISOString(),
  };
  await getFirestore().collection("settings").doc(SETTINGS_DOC).set(next, { merge: true });
  return next;
}

export async function adminListPortfolios(limit = 50) {
  const snap = await col().limit(limit).get();
  return snap.docs.map((d) => mapPortfolio(d.id, d.data()));
}

export async function adminSetPortfolioStatus(id: string, status: PortfolioStatus) {
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Not found"), { status: 404 });
  await ref.set({ status, updatedAt: new Date().toISOString() }, { merge: true });
  return mapPortfolio(ref.id, (await ref.get()).data()!);
}

export async function adminSetVerification(
  id: string,
  status: VerificationStatus,
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

export async function getPortfolioWithStats(userId: string, id: string) {
  const portfolio = await getPortfolioForOwner(userId, id);
  const stats = await computeLiveStats(userId);
  return { portfolio, stats };
}
