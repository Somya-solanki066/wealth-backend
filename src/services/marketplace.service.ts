import fs from "fs";
import path from "path";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";

const LISTINGS = "marketplaceListings";
const PURCHASES = "marketplacePurchases";
const OPTIONS = "marketplaceOptionRequests";
const TXNS = "marketplaceTransactions";

export const SCRIPT_TYPES = ["Feature", "Short", "Series", "TV"] as const;
export const SCRIPT_GENRES = [
  "Drama",
  "Thriller",
  "Romance",
  "Comedy",
  "Legal Thriller",
  "Romantic Drama",
  "Horror",
  "Action",
  "Sci-Fi",
] as const;

export async function getMarketplaceCommissionRate(): Promise<number> {
  const snap = await getFirestore().collection("settings").doc("marketplace").get();
  const rate = Number(snap.data()?.commissionRate);
  if (Number.isFinite(rate) && rate >= 0.1 && rate <= 0.15) return rate;
  return 0.12;
}

export function getMarketplaceMeta() {
  return {
    scriptTypes: SCRIPT_TYPES,
    genres: SCRIPT_GENRES,
    dealTypes: ["purchase", "option"],
    defaultCommissionRate: 0.12,
    commissionRange: { min: 0.1, max: 0.15 },
  };
}

export function mapListing(id: string, data: Record<string, any>, extras?: Record<string, unknown>) {
  return {
    id,
    writerId: data.writerId || "",
    writerName: data.writerName || "Writer",
    title: data.title || "",
    scriptType: data.scriptType || "Feature",
    genre: data.genre || "",
    logline: data.logline || "",
    description: data.description || "",
    pageCount: Number(data.pageCount || 0),
    priceNGN: Number(data.priceNGN || 0),
    optionPriceNGN: Number(data.optionPriceNGN || 0),
    dealType: data.dealType || "purchase", // purchase | option | both
    status: data.status || "draft",
    rejectReason: data.rejectReason || null,
    views: Number(data.views || 0),
    previewPageCount: Math.min(10, Number(data.previewPageCount || 0)),
    hasPreview: Boolean(data.previewText || (data.previewPages && data.previewPages.length)),
    publishedAt: data.publishedAt || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    ...extras,
  };
}

/** Split extracted PDF/text into ~page chunks; keep first 10 for preview. */
export function splitIntoPages(text: string, maxPages = 10): string[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  let pages = raw.split(/\f+/).map((p) => p.trim()).filter(Boolean);
  if (pages.length <= 1) {
    const chunks: string[] = [];
    const approx = 2800;
    for (let i = 0; i < raw.length; i += approx) {
      chunks.push(raw.slice(i, i + approx).trim());
    }
    pages = chunks.filter(Boolean);
  }
  return pages.slice(0, maxPages);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const pdfData = await parser.getText();
    const text = String(pdfData.text || "");
    const total = Number((pdfData as any).total || (pdfData as any).numpages || 0);
    const guessed = Math.max(total, splitIntoPages(text, 500).length);
    return { text, pageCount: guessed || 1 };
  } finally {
    await parser.destroy();
  }
}

export function ensureListingUploadDir(listingId: string) {
  const dir = path.join(getUploadsDir(), "marketplace", listingId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function listPublishedListings(filters: {
  search?: string;
  scriptType?: string;
  genre?: string;
  dealType?: string;
  minPrice?: number;
  maxPrice?: number;
}) {
  const snap = await getFirestore().collection(LISTINGS).where("status", "==", "published").get();
  let items = snap.docs.map((d) => mapListing(d.id, d.data()));

  const search = String(filters.search || "").trim().toLowerCase();
  if (search) {
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(search) ||
        i.writerName.toLowerCase().includes(search) ||
        i.genre.toLowerCase().includes(search) ||
        i.logline.toLowerCase().includes(search)
    );
  }
  if (filters.scriptType) {
    items = items.filter((i) => i.scriptType.toLowerCase() === filters.scriptType!.toLowerCase());
  }
  if (filters.genre) {
    items = items.filter((i) => i.genre.toLowerCase().includes(filters.genre!.toLowerCase()));
  }
  if (filters.dealType === "purchase") {
    items = items.filter((i) => i.dealType === "purchase" || i.dealType === "both");
  }
  if (filters.dealType === "option") {
    items = items.filter((i) => i.dealType === "option" || i.dealType === "both");
  }
  if (typeof filters.minPrice === "number") {
    items = items.filter((i) => Math.max(i.priceNGN, i.optionPriceNGN) >= filters.minPrice!);
  }
  if (typeof filters.maxPrice === "number") {
    items = items.filter(
      (i) =>
        (i.priceNGN > 0 && i.priceNGN <= filters.maxPrice!) ||
        (i.optionPriceNGN > 0 && i.optionPriceNGN <= filters.maxPrice!)
    );
  }

  items.sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")));
  return items;
}

export async function getListing(listingId: string, viewerId?: string) {
  const snap = await getFirestore().collection(LISTINGS).doc(listingId).get();
  if (!snap.exists) throw Object.assign(new Error("Listing not found."), { status: 404 });
  const data = snap.data()!;
  const isOwner = viewerId && data.writerId === viewerId;
  if (data.status !== "published" && !isOwner) {
    throw Object.assign(new Error("Listing not found."), { status: 404 });
  }

  let hasPurchased = false;
  let optionStatus: string | null = null;
  if (viewerId) {
    const purchaseId = `${viewerId}_${listingId}`;
    const p = await getFirestore().collection(PURCHASES).doc(purchaseId).get();
    hasPurchased = p.exists && p.data()?.status === "completed";
    const optSnap = await getFirestore()
      .collection(OPTIONS)
      .where("listingId", "==", listingId)
      .where("buyerId", "==", viewerId)
      .limit(5)
      .get();
    const opt = optSnap.docs[0]?.data();
    optionStatus = opt ? String(opt.status) : null;
  }

  return mapListing(snap.id, data, {
    isOwner: Boolean(isOwner),
    hasPurchased,
    optionStatus,
    canAccessFull: Boolean(isOwner || hasPurchased),
  });
}

export async function getPreview(listingId: string) {
  const snap = await getFirestore().collection(LISTINGS).doc(listingId).get();
  if (!snap.exists) throw Object.assign(new Error("Listing not found."), { status: 404 });
  const data = snap.data()!;
  if (data.status !== "published") {
    // owners can preview drafts via separate path; public only published
  }
  const pages: string[] = Array.isArray(data.previewPages)
    ? data.previewPages.map(String)
    : splitIntoPages(String(data.previewText || ""), 10);

  await getFirestore()
    .collection(LISTINGS)
    .doc(listingId)
    .update({ views: FieldValue.increment(1) })
    .catch(() => undefined);

  return {
    listingId,
    title: data.title,
    pages,
    pageCount: pages.length,
    lockedMessage: "Pages 11+ available after purchase",
  };
}

export async function getFullScript(userId: string, listingId: string) {
  const db = getFirestore();
  const snap = await db.collection(LISTINGS).doc(listingId).get();
  if (!snap.exists) throw Object.assign(new Error("Listing not found."), { status: 404 });
  const data = snap.data()!;
  const isOwner = data.writerId === userId;
  const purchaseId = `${userId}_${listingId}`;
  const purchase = await db.collection(PURCHASES).doc(purchaseId).get();
  const bought = purchase.exists && purchase.data()?.status === "completed";
  if (!isOwner && !bought) {
    throw Object.assign(new Error("Purchase required to access the full script."), {
      status: 403,
    });
  }
  return {
    listingId,
    title: data.title,
    fullText: String(data.fullText || ""),
    pageCount: Number(data.pageCount || 0),
    originalFilePath: data.originalFilePath || null,
  };
}

export async function createOrUpdateListing(
  writerId: string,
  writerName: string,
  body: Record<string, any>,
  listingId?: string
) {
  const title = String(body.title || "").trim();
  if (!title) throw Object.assign(new Error("Title is required."), { status: 400 });

  const priceNGN = Number(body.priceNGN || 0);
  const optionPriceNGN = Number(body.optionPriceNGN || 0);
  const dealType = String(body.dealType || "purchase");
  if (!["purchase", "option", "both"].includes(dealType)) {
    throw Object.assign(new Error("Invalid deal type."), { status: 400 });
  }
  if ((dealType === "purchase" || dealType === "both") && priceNGN <= 0) {
    throw Object.assign(new Error("Purchase price is required."), { status: 400 });
  }
  if ((dealType === "option" || dealType === "both") && optionPriceNGN <= 0) {
    throw Object.assign(new Error("Option price is required."), { status: 400 });
  }

  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    title,
    scriptType: String(body.scriptType || "Feature"),
    genre: String(body.genre || "Drama"),
    logline: String(body.logline || "").trim(),
    description: String(body.description || "").trim(),
    pageCount: Number(body.pageCount || 0),
    priceNGN,
    optionPriceNGN,
    dealType,
    updatedAt: now,
  };

  const db = getFirestore();
  if (listingId) {
    const ref = db.collection(LISTINGS).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.writerId !== writerId) {
      throw Object.assign(new Error("Listing not found."), { status: 404 });
    }
    await ref.set(payload, { merge: true });
    const next = await ref.get();
    return mapListing(next.id, next.data()!);
  }

  const ref = db.collection(LISTINGS).doc();
  await ref.set({
    writerId,
    writerName,
    ...payload,
    status: "draft",
    rejectReason: null,
    views: 0,
    previewPages: [],
    previewText: "",
    fullText: "",
    originalFilePath: null,
    publishedAt: null,
    createdAt: now,
  });
  const next = await ref.get();
  return mapListing(next.id, next.data()!);
}

export async function attachScriptFile(opts: {
  writerId: string;
  listingId: string;
  filename: string;
  buffer: Buffer;
  mime: string;
}) {
  const db = getFirestore();
  const ref = db.collection(LISTINGS).doc(opts.listingId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.writerId !== opts.writerId) {
    throw Object.assign(new Error("Listing not found."), { status: 404 });
  }

  let text = "";
  let pageCount = 0;
  if (opts.mime.includes("pdf") || opts.filename.toLowerCase().endsWith(".pdf")) {
    const extracted = await extractTextFromPdf(opts.buffer);
    text = extracted.text;
    pageCount = extracted.pageCount;
  } else {
    text = opts.buffer.toString("utf8");
    pageCount = Math.max(1, splitIntoPages(text, 500).length);
  }

  const dir = ensureListingUploadDir(opts.listingId);
  const filePath = path.join(dir, opts.filename);
  fs.writeFileSync(filePath, opts.buffer);
  const rel = `/uploads/marketplace/${opts.listingId}/${opts.filename}`;
  const previewPages = splitIntoPages(text, 10);

  await ref.update({
    fullText: text,
    previewPages,
    previewText: previewPages.join("\n\n---PAGE---\n\n"),
    previewPageCount: previewPages.length,
    pageCount: pageCount || previewPages.length,
    originalFilePath: rel,
    updatedAt: new Date().toISOString(),
  });

  const next = await ref.get();
  return mapListing(next.id, next.data()!);
}

export async function submitListing(writerId: string, listingId: string) {
  const db = getFirestore();
  const ref = db.collection(LISTINGS).doc(listingId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.writerId !== writerId) {
    throw Object.assign(new Error("Listing not found."), { status: 404 });
  }
  const data = snap.data()!;
  if (!data.fullText && !data.originalFilePath) {
    throw Object.assign(new Error("Upload a script file before submitting."), { status: 400 });
  }
  if (!String(data.title || "").trim()) {
    throw Object.assign(new Error("Title is required."), { status: 400 });
  }
  await ref.update({
    status: "pending_review",
    rejectReason: null,
    updatedAt: new Date().toISOString(),
  });
  const next = await ref.get();
  return mapListing(next.id, next.data()!);
}

export async function listWriterListings(writerId: string) {
  const snap = await getFirestore().collection(LISTINGS).where("writerId", "==", writerId).get();
  return snap.docs
    .map((d) => mapListing(d.id, d.data()))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export async function listBuyerPurchases(buyerId: string) {
  const snap = await getFirestore().collection(PURCHASES).where("buyerId", "==", buyerId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function requestOption(opts: {
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  listingId: string;
  message?: string;
}) {
  const db = getFirestore();
  const listingSnap = await db.collection(LISTINGS).doc(opts.listingId).get();
  if (!listingSnap.exists || listingSnap.data()?.status !== "published") {
    throw Object.assign(new Error("Listing not found."), { status: 404 });
  }
  const listing = listingSnap.data()!;
  if (listing.dealType === "purchase") {
    throw Object.assign(new Error("This listing is purchase-only."), { status: 400 });
  }
  if (listing.writerId === opts.buyerId) {
    throw Object.assign(new Error("You cannot option your own script."), { status: 400 });
  }

  const ref = db.collection(OPTIONS).doc();
  const now = new Date().toISOString();
  const doc = {
    listingId: opts.listingId,
    listingTitle: listing.title,
    writerId: listing.writerId,
    writerName: listing.writerName,
    buyerId: opts.buyerId,
    buyerName: opts.buyerName,
    buyerEmail: opts.buyerEmail || null,
    message: String(opts.message || "").trim(),
    optionPriceNGN: Number(listing.optionPriceNGN || 0),
    status: "pending", // pending | accepted | rejected | paid | active
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function respondOption(
  writerId: string,
  optionId: string,
  action: "accept" | "reject"
) {
  const db = getFirestore();
  const ref = db.collection(OPTIONS).doc(optionId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.writerId !== writerId) {
    throw Object.assign(new Error("Option request not found."), { status: 404 });
  }
  if (snap.data()?.status !== "pending") {
    throw Object.assign(new Error("Option request already handled."), { status: 400 });
  }
  const now = new Date().toISOString();
  await ref.update({
    status: action === "accept" ? "accepted" : "rejected",
    updatedAt: now,
  });
  const next = await ref.get();
  return { id: next.id, ...next.data() };
}

export async function listOptionsForUser(userId: string, role: "buyer" | "writer") {
  const field = role === "buyer" ? "buyerId" : "writerId";
  const snap = await getFirestore().collection(OPTIONS).where(field, "==", userId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function fulfillMarketplacePurchase(opts: {
  buyerId: string;
  listingId: string;
  dealType: "purchase" | "option";
  stripeSessionId: string;
  amountTotalKobo: number;
  optionRequestId?: string | null;
}) {
  const db = getFirestore();
  const txnRef = db.collection(TXNS).doc(opts.stripeSessionId);
  const existing = await txnRef.get();
  if (existing.exists) return existing.data();

  const listingRef = db.collection(LISTINGS).doc(opts.listingId);
  const listingSnap = await listingRef.get();
  if (!listingSnap.exists) throw new Error("Listing not found for purchase fulfillment");
  const listing = listingSnap.data()!;

  const amountNGN = Math.round((opts.amountTotalKobo || 0) / 100);
  const commissionRate = await getMarketplaceCommissionRate();
  const commission = Math.round(amountNGN * commissionRate);
  const writerAmount = amountNGN - commission;
  const now = new Date().toISOString();

  const purchaseId = `${opts.buyerId}_${opts.listingId}`;
  await db.collection(PURCHASES).doc(purchaseId).set(
    {
      buyerId: opts.buyerId,
      writerId: listing.writerId,
      listingId: opts.listingId,
      listingTitle: listing.title,
      dealType: opts.dealType,
      amountNGN,
      commission,
      writerAmount,
      commissionRate,
      status: "completed",
      stripeSessionId: opts.stripeSessionId,
      createdAt: now,
    },
    { merge: true }
  );

  await txnRef.set({
    buyerId: opts.buyerId,
    writerId: listing.writerId,
    listingId: opts.listingId,
    listingTitle: listing.title,
    amount: amountNGN,
    commission,
    writerAmount,
    commissionRate,
    dealType: opts.dealType,
    paymentStatus: "paid",
    stripeSessionId: opts.stripeSessionId,
    createdAt: now,
  });

  if (opts.dealType === "purchase") {
    await listingRef.update({
      status: "sold",
      updatedAt: now,
    });
  } else {
    await listingRef.update({
      status: "optioned",
      updatedAt: now,
    });
    if (opts.optionRequestId) {
      await db.collection(OPTIONS).doc(opts.optionRequestId).set(
        {
          status: "active",
          stripeSessionId: opts.stripeSessionId,
          updatedAt: now,
        },
        { merge: true }
      );
    }
  }

  // Writer earnings aggregate
  const earnRef = db.collection("marketplaceEarnings").doc(listing.writerId);
  await earnRef.set(
    {
      writerId: listing.writerId,
      totalSales: FieldValue.increment(amountNGN),
      totalCommission: FieldValue.increment(commission),
      availableBalance: FieldValue.increment(writerAmount),
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    purchaseId,
    listingId: opts.listingId,
    listingTitle: listing.title,
    amountNGN,
    commission,
    writerAmount,
  };
}

export async function getWriterEarnings(writerId: string) {
  const db = getFirestore();
  const earnSnap = await db.collection("marketplaceEarnings").doc(writerId).get();
  const earnings = earnSnap.exists
    ? earnSnap.data()
    : { totalSales: 0, totalCommission: 0, availableBalance: 0 };
  const txnSnap = await db.collection(TXNS).where("writerId", "==", writerId).get();
  const transactions = txnSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return { earnings, transactions };
}

export async function adminListListings(status?: string) {
  const snap = await getFirestore().collection(LISTINGS).limit(300).get();
  let items = snap.docs.map((d) => mapListing(d.id, d.data()));
  if (status) items = items.filter((i) => i.status === status);
  items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return items;
}

export async function adminModerateListing(
  listingId: string,
  action: "approve" | "reject",
  rejectReason?: string
) {
  const db = getFirestore();
  const ref = db.collection(LISTINGS).doc(listingId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Listing not found."), { status: 404 });
  const now = new Date().toISOString();
  if (action === "approve") {
    await ref.update({
      status: "published",
      rejectReason: null,
      publishedAt: snap.data()?.publishedAt || now,
      updatedAt: now,
    });
  } else {
    await ref.update({
      status: "rejected",
      rejectReason: String(rejectReason || "Needs changes").trim(),
      updatedAt: now,
    });
  }
  const next = await ref.get();
  return mapListing(next.id, next.data()!);
}

export async function seedDemoListings() {
  const db = getFirestore();
  const existing = await db.collection(LISTINGS).where("status", "==", "published").limit(1).get();
  if (!existing.empty) {
    return { seeded: 0, listings: await listPublishedListings({}), message: "Marketplace already has listings." };
  }

  const now = new Date().toISOString();
  const samples = [
    {
      title: "The Fifth Signature",
      scriptType: "Feature",
      genre: "Legal Thriller",
      pageCount: 108,
      priceNGN: 180000,
      optionPriceNGN: 0,
      dealType: "purchase",
      writerName: "John Doe",
      logline: "A forged signature reopens a closed murder case — and names the judge who sealed it.",
      description: "A legal thriller feature about truth, power, and the cost of silence in Lagos courtrooms.",
      previewPages: [
        "THE FIFTH SIGNATURE\n\nFADE IN:\n\nINT. HIGH COURT — DAY\n\nDust motes hang in the shaft of light above the gallery. ADAEZE (30s) places a sealed envelope on the counsel table.",
        "Page 2\n\nThe clerk opens the envelope. Five signatures. Four match the verdict. The fifth does not.",
        "Page 3\n\nADAEZE\nYour Honor, this case was never closed. It was buried.",
      ],
    },
    {
      title: "Harmattan Bride",
      scriptType: "Feature",
      genre: "Romantic Drama",
      pageCount: 96,
      priceNGN: 0,
      optionPriceNGN: 95000,
      dealType: "option",
      writerName: "Amaka Okoro",
      logline: "A wedding contract made in harmattan season unravels when the bride returns with a different name.",
      description: "Romantic drama about family, migration, and the promises we inherit.",
      previewPages: [
        "HARMATTAN BRIDE\n\nFADE IN:\n\nEXT. DUSTY ROAD — DAWN\n\nWind pushes red dust across the path. NNEKA (28) walks toward the compound gate with a suitcase and a secret.",
        "Page 2\n\nInside, the family is already dressing for a wedding that may not happen.",
      ],
    },
  ];

  const batch = db.batch();
  const created = [];
  for (const s of samples) {
    const ref = db.collection(LISTINGS).doc();
    const fullText = s.previewPages.join("\n\n") + "\n\n[Full script available after purchase]";
    const doc = {
      writerId: "system-demo",
      writerName: s.writerName,
      title: s.title,
      scriptType: s.scriptType,
      genre: s.genre,
      logline: s.logline,
      description: s.description,
      pageCount: s.pageCount,
      priceNGN: s.priceNGN,
      optionPriceNGN: s.optionPriceNGN,
      dealType: s.dealType,
      status: "published",
      rejectReason: null,
      views: Math.floor(Math.random() * 200) + 40,
      previewPages: s.previewPages,
      previewText: s.previewPages.join("\n\n---PAGE---\n\n"),
      previewPageCount: s.previewPages.length,
      fullText,
      originalFilePath: null,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(ref, doc);
    created.push(mapListing(ref.id, doc));
  }
  await batch.commit();
  return { seeded: created.length, listings: created, message: `Seeded ${created.length} demo listings.` };
}
