import fs from "fs";
import path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { getUploadsDir } from "../utils/paths";

export type DocType = "nda" | "brief" | "draft" | "final" | "invoice" | "other";
export type ReviewStatus = "waiting" | "approved" | "changes" | null;
export type InvoiceStatus = "none" | "created" | "sent" | "paid";

export type HandoffDoc = {
  id: string;
  type: DocType;
  name: string;
  url: string;
  status?: string;
  uploadedAt: string;
};

export type ChecklistItemDef = {
  id: string;
  label: string;
  section: "nda" | "brief" | "manuscript" | "invoice" | "delivery";
};

/** Detailed + summary checklist items */
export const HANDOFF_ITEMS: ChecklistItemDef[] = [
  { id: "nda_sent", label: "NDA sent", section: "nda" },
  { id: "nda_signed", label: "NDA signed", section: "nda" },
  { id: "nda_uploaded", label: "NDA document uploaded", section: "nda" },
  { id: "brief_received", label: "Brief received", section: "brief" },
  { id: "brief_scope", label: "Scope confirmed", section: "brief" },
  { id: "brief_deadline", label: "Deadline confirmed", section: "brief" },
  { id: "brief_budget", label: "Budget confirmed", section: "brief" },
  { id: "brief_revisions", label: "Revision terms confirmed", section: "brief" },
  { id: "brief_confirmed", label: "Brief confirmed with client", section: "delivery" },
  { id: "ms_draft", label: "Draft ready", section: "manuscript" },
  { id: "ms_internal", label: "Internal review complete", section: "manuscript" },
  { id: "ms_delivered", label: "Final manuscript delivered", section: "manuscript" },
  { id: "ms_received", label: "Client received", section: "manuscript" },
  { id: "inv_created", label: "Invoice created", section: "invoice" },
  { id: "inv_sent", label: "Invoice sent", section: "invoice" },
  { id: "inv_paid", label: "Payment received", section: "invoice" },
];

export type ClientHandoffProject = {
  id?: string;
  userId?: string;
  bookId?: string | null;
  clientName: string;
  bookTitle: string;
  checked: Record<string, boolean>;
  reviewStatus: ReviewStatus;
  clientFeedback: string;
  invoiceAmount: number;
  invoiceStatus: InvoiceStatus;
  briefText: string;
  documents: HandoffDoc[];
  archived: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function col(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("clientHandoffs");
}

function emptyChecked(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const item of HANDOFF_ITEMS) out[item.id] = false;
  return out;
}

function normalizeChecked(raw: any): Record<string, boolean> {
  const out = emptyChecked();
  if (raw && typeof raw === "object") {
    for (const item of HANDOFF_ITEMS) {
      out[item.id] = !!raw[item.id];
    }
  }
  return out;
}

/** Milestone progress for the project bar */
export function computeProgress(project: {
  checked: Record<string, boolean>;
  reviewStatus: ReviewStatus;
  invoiceStatus: InvoiceStatus;
}) {
  const c = project.checked || {};
  const briefOk =
    !!c.brief_confirmed ||
    (!!c.brief_scope && !!c.brief_deadline && !!c.brief_budget);
  const milestones = [
    { id: "nda", label: "NDA", done: !!c.nda_signed },
    { id: "brief", label: "Brief", done: briefOk },
    { id: "manuscript", label: "Manuscript", done: !!c.ms_delivered },
    {
      id: "approval",
      label: "Client Approval",
      done: project.reviewStatus === "approved",
    },
    {
      id: "invoice",
      label: "Invoice",
      done: !!c.inv_sent || project.invoiceStatus === "sent" || project.invoiceStatus === "paid",
    },
    {
      id: "payment",
      label: "Payment",
      done: !!c.inv_paid || project.invoiceStatus === "paid",
    },
  ];
  const done = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  const percent = Math.round((done / total) * 100);
  return {
    done,
    total,
    percent,
    complete: percent >= 100,
    milestones,
  };
}

function mapDoc(id: string, data: Record<string, any>): ClientHandoffProject & {
  progress: ReturnType<typeof computeProgress>;
} {
  const checked = normalizeChecked(data.checked);
  const reviewStatus =
    data.reviewStatus === "waiting" ||
    data.reviewStatus === "approved" ||
    data.reviewStatus === "changes"
      ? data.reviewStatus
      : null;
  const invoiceStatus = (
    ["none", "created", "sent", "paid"] as const
  ).includes(data.invoiceStatus)
    ? data.invoiceStatus
    : "none";
  const project = {
    id,
    userId: String(data.userId || ""),
    bookId: data.bookId ? String(data.bookId) : null,
    clientName: String(data.clientName || "Client"),
    bookTitle: String(data.bookTitle || "Untitled book"),
    checked,
    reviewStatus,
    clientFeedback: String(data.clientFeedback || ""),
    invoiceAmount: Number(data.invoiceAmount || 0),
    invoiceStatus: invoiceStatus as InvoiceStatus,
    briefText: String(data.briefText || ""),
    documents: Array.isArray(data.documents) ? data.documents : [],
    archived: !!data.archived,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
  };
  return { ...project, progress: computeProgress(project) };
}

export async function listHandoffs(userId: string, includeArchived = false) {
  const snap = await col(userId).orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs
    .map((d) => mapDoc(d.id, d.data()))
    .filter((p) => includeArchived || !p.archived);
}

export async function getHandoff(userId: string, id: string) {
  const snap = await col(userId).doc(id).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Project not found."), { status: 404 });
  }
  return mapDoc(snap.id, snap.data() || {});
}

export async function createHandoff(
  userId: string,
  input: {
    clientName: string;
    bookTitle: string;
    bookId?: string | null;
    briefText?: string;
  }
) {
  const now = new Date().toISOString();
  const ref = col(userId).doc();
  const doc = {
    userId,
    bookId: input.bookId || null,
    clientName: String(input.clientName || "Client").trim() || "Client",
    bookTitle: String(input.bookTitle || "Untitled book").trim() || "Untitled book",
    checked: emptyChecked(),
    reviewStatus: null,
    clientFeedback: "",
    invoiceAmount: 0,
    invoiceStatus: "none",
    briefText: String(input.briefText || ""),
    documents: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return mapDoc(ref.id, doc);
}

export async function getOrCreateForBook(
  userId: string,
  input: { bookId: string; clientName?: string; bookTitle?: string }
) {
  const existing = await col(userId).where("bookId", "==", input.bookId).limit(1).get();
  if (!existing.empty) {
    return mapDoc(existing.docs[0].id, existing.docs[0].data());
  }
  return createHandoff(userId, {
    bookId: input.bookId,
    clientName: input.clientName || "Client",
    bookTitle: input.bookTitle || "Untitled book",
  });
}

export async function saveHandoff(
  userId: string,
  id: string,
  patch: {
    clientName?: string;
    bookTitle?: string;
    checked?: Record<string, boolean>;
    toggleItemId?: string;
    reviewStatus?: ReviewStatus;
    clientFeedback?: string;
    invoiceAmount?: number;
    invoiceStatus?: InvoiceStatus;
    briefText?: string;
    archived?: boolean;
  }
) {
  const ref = col(userId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error("Project not found."), { status: 404 });
  }
  const existing = snap.data() || {};
  let checked = normalizeChecked(existing.checked);
  if (patch.checked) checked = normalizeChecked({ ...checked, ...patch.checked });
  if (patch.toggleItemId && HANDOFF_ITEMS.some((i) => i.id === patch.toggleItemId)) {
    checked[patch.toggleItemId] = !checked[patch.toggleItemId];
  }

  // Sync summary delivery flags
  if (checked.nda_signed) checked.nda_sent = true;
  if (
    checked.brief_scope &&
    checked.brief_deadline &&
    checked.brief_budget &&
    checked.brief_revisions
  ) {
    checked.brief_confirmed = true;
  }

  let invoiceStatus: InvoiceStatus = (
    ["none", "created", "sent", "paid"] as const
  ).includes(existing.invoiceStatus)
    ? existing.invoiceStatus
    : "none";
  if (patch.invoiceStatus) invoiceStatus = patch.invoiceStatus;
  if (checked.inv_paid) invoiceStatus = "paid";
  else if (checked.inv_sent && invoiceStatus !== "paid") invoiceStatus = "sent";
  else if (checked.inv_created && invoiceStatus === "none") invoiceStatus = "created";

  const now = new Date().toISOString();
  const doc = {
    ...existing,
    userId,
    clientName:
      patch.clientName != null
        ? String(patch.clientName).trim()
        : existing.clientName,
    bookTitle:
      patch.bookTitle != null ? String(patch.bookTitle).trim() : existing.bookTitle,
    checked,
    reviewStatus:
      patch.reviewStatus !== undefined ? patch.reviewStatus : existing.reviewStatus ?? null,
    clientFeedback:
      patch.clientFeedback != null
        ? String(patch.clientFeedback)
        : existing.clientFeedback || "",
    invoiceAmount:
      patch.invoiceAmount != null
        ? Number(patch.invoiceAmount) || 0
        : Number(existing.invoiceAmount || 0),
    invoiceStatus,
    briefText:
      patch.briefText != null ? String(patch.briefText) : existing.briefText || "",
    archived: patch.archived != null ? !!patch.archived : !!existing.archived,
    updatedAt: now,
  };
  await ref.set(doc, { merge: true });
  return mapDoc(id, doc);
}

export async function attachDocument(
  userId: string,
  projectId: string,
  opts: {
    type: DocType;
    originalName: string;
    buffer: Buffer;
    status?: string;
  }
) {
  const project = await getHandoff(userId, projectId);
  const safeName = opts.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const filename = `${Date.now()}_${safeName}`;
  const dir = path.join(getUploadsDir(), "client-handoff", userId, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), opts.buffer);
  const url = `/uploads/client-handoff/${userId}/${projectId}/${filename}`;
  const doc: HandoffDoc = {
    id: `doc_${Date.now()}`,
    type: opts.type,
    name: opts.originalName,
    url,
    status: opts.status || "uploaded",
    uploadedAt: new Date().toISOString(),
  };
  const documents = [
    ...project.documents.filter((d) => d.type !== opts.type),
    doc,
  ];
  const checked = { ...project.checked };
  if (opts.type === "nda") {
    checked.nda_uploaded = true;
    checked.nda_sent = true;
  }
  if (opts.type === "brief") {
    checked.brief_received = true;
  }
  if (opts.type === "draft") checked.ms_draft = true;
  if (opts.type === "final") {
    checked.ms_draft = true;
    checked.ms_delivered = true;
  }
  if (opts.type === "invoice") checked.inv_created = true;

  const now = new Date().toISOString();
  await col(userId).doc(projectId).set(
    { documents, checked, updatedAt: now },
    { merge: true }
  );
  return getHandoff(userId, projectId);
}

export async function deleteHandoff(userId: string, id: string) {
  await col(userId).doc(id).delete();
  return { ok: true };
}
