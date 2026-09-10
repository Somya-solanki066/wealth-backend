import { getFirestore } from "firebase-admin/firestore";

export type PublishRoute = "kdp" | "d2d";

export type ChecklistItemDef = {
  id: string;
  label: string;
  /** If set, only one item in the group needs to be checked for that bucket */
  group?: string;
};

export type ChecklistStageDef = {
  id: string;
  title: string;
  items: ChecklistItemDef[];
};

export const CHECKLIST_STAGES: ChecklistStageDef[] = [
  {
    id: "manuscript",
    title: "Manuscript",
    items: [
      { id: "ms_complete", label: "Manuscript complete" },
      { id: "ms_editing", label: "Final editing complete" },
      { id: "ms_proof", label: "Proofreading complete" },
      { id: "ms_format", label: "Formatting complete" },
      { id: "ms_order", label: "Chapter order checked" },
      { id: "ms_toc", label: "Table of contents checked" },
    ],
  },
  {
    id: "cover",
    title: "Book Cover",
    items: [
      { id: "cover_front", label: "Front cover designed" },
      { id: "cover_dims", label: "Correct dimensions checked" },
      { id: "cover_title", label: "Title & author name checked" },
      { id: "cover_thumb", label: "Thumbnail / readability checked" },
    ],
  },
  {
    id: "metadata",
    title: "Book Metadata",
    items: [
      { id: "meta_title", label: "Book title finalized" },
      { id: "meta_subtitle", label: "Subtitle finalized" },
      { id: "meta_desc", label: "Book description written" },
      { id: "meta_bio", label: "Author bio written" },
      { id: "meta_keywords", label: "Keywords selected" },
      { id: "meta_categories", label: "Categories selected" },
    ],
  },
  {
    id: "account",
    title: "Publishing Account",
    items: [
      { id: "acct_kdp", label: "Amazon KDP account ready", group: "account" },
      { id: "acct_d2d", label: "Draft2Digital account ready", group: "account" },
    ],
  },
  {
    id: "upload",
    title: "Final Upload",
    items: [
      { id: "up_ms", label: "Manuscript file ready" },
      { id: "up_cover", label: "Cover file ready" },
      { id: "up_meta", label: "Metadata entered" },
      { id: "up_preview", label: "Preview checked" },
      { id: "up_fix", label: "Final corrections completed" },
    ],
  },
];

export const ROUTE_GUIDES: Record<
  PublishRoute,
  { title: string; subtitle: string; steps: string[] }
> = {
  kdp: {
    title: "Amazon KDP",
    subtitle: "Kindle + Amazon print",
    steps: [
      "Prepare manuscript (DOCX / EPUB / KPF)",
      "Prepare cover (ebook + paperback if needed)",
      "Enter title, description, keywords & categories",
      "Upload manuscript and cover",
      "Preview on Kindle Previewer",
      "Set pricing and territories",
      "Publish (or schedule)",
    ],
  },
  d2d: {
    title: "Draft2Digital",
    subtitle: "Wide distribution",
    steps: [
      "Prepare manuscript (EPUB / DOCX)",
      "Prepare cover image",
      "Enter metadata and description",
      "Upload files to Draft2Digital",
      "Choose retail partners",
      "Review pricing & distribution",
      "Publish to selected stores",
    ],
  },
};

export type PublishingChecklist = {
  id?: string;
  userId?: string;
  bookId?: string | null;
  bookTitle: string;
  checked: Record<string, boolean>;
  route?: PublishRoute | null;
  createdAt?: string;
  updatedAt?: string;
};

function col(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("publishingChecklists");
}

function allItems() {
  return CHECKLIST_STAGES.flatMap((s) => s.items);
}

/** Progress: regular items count 1 each; account group counts as 1 bucket */
export function computeProgress(checked: Record<string, boolean>) {
  const items = allItems();
  const groups = new Map<string, string[]>();
  const singles: string[] = [];

  for (const item of items) {
    if (item.group) {
      const list = groups.get(item.group) || [];
      list.push(item.id);
      groups.set(item.group, list);
    } else {
      singles.push(item.id);
    }
  }

  const total = singles.length + groups.size;
  let done = singles.filter((id) => !!checked[id]).length;
  for (const ids of groups.values()) {
    if (ids.some((id) => !!checked[id])) done += 1;
  }

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = [
    ...singles.filter((id) => !checked[id]).map((id) => items.find((i) => i.id === id)!),
    ...[...groups.entries()]
      .filter(([, ids]) => !ids.some((id) => !!checked[id]))
      .map(([group]) => ({
        id: `group_${group}`,
        label:
          group === "account"
            ? "Publishing account (KDP or Draft2Digital)"
            : group,
      })),
  ];

  return {
    done,
    total,
    percent,
    complete: percent >= 100,
    remaining: remaining.map((r) => ({ id: r.id, label: r.label })),
  };
}

function normalizeChecked(raw: any): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const item of allItems()) {
    out[item.id] = !!(raw && raw[item.id]);
  }
  return out;
}

function mapDoc(id: string, data: Record<string, any>): PublishingChecklist & {
  progress: ReturnType<typeof computeProgress>;
} {
  const checked = normalizeChecked(data.checked);
  return {
    id,
    userId: String(data.userId || ""),
    bookId: data.bookId ? String(data.bookId) : null,
    bookTitle: String(data.bookTitle || "Untitled book"),
    checked,
    route: data.route === "kdp" || data.route === "d2d" ? data.route : null,
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
    progress: computeProgress(checked),
  };
}

export async function listChecklists(userId: string) {
  const snap = await col(userId).orderBy("updatedAt", "desc").limit(40).get();
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getChecklist(userId: string, id: string) {
  const snap = await col(userId).doc(id).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Checklist not found."), { status: 404 });
  }
  return mapDoc(snap.id, snap.data() || {});
}

export async function getOrCreateForBook(
  userId: string,
  input: { bookId?: string | null; bookTitle: string; checklistId?: string }
) {
  if (input.checklistId) {
    return getChecklist(userId, input.checklistId);
  }

  if (input.bookId) {
    const existing = await col(userId).where("bookId", "==", input.bookId).limit(1).get();
    if (!existing.empty) {
      const d = existing.docs[0];
      return mapDoc(d.id, d.data());
    }
  }

  const now = new Date().toISOString();
  const ref = col(userId).doc();
  const checked = normalizeChecked({});
  const doc = {
    userId,
    bookId: input.bookId || null,
    bookTitle: String(input.bookTitle || "Untitled book").trim() || "Untitled book",
    checked,
    route: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return mapDoc(ref.id, doc);
}

export async function saveChecklist(
  userId: string,
  input: {
    id?: string;
    bookId?: string | null;
    bookTitle?: string;
    checked?: Record<string, boolean>;
    route?: PublishRoute | null;
    toggleItemId?: string;
  }
) {
  const now = new Date().toISOString();
  let ref = input.id ? col(userId).doc(input.id) : col(userId).doc();
  let existing: Record<string, any> = {};

  if (input.id) {
    const snap = await ref.get();
    if (!snap.exists) {
      throw Object.assign(new Error("Checklist not found."), { status: 404 });
    }
    existing = snap.data() || {};
  } else if (input.bookId) {
    const q = await col(userId).where("bookId", "==", input.bookId).limit(1).get();
    if (!q.empty) {
      ref = q.docs[0].ref;
      existing = q.docs[0].data();
    }
  }

  let checked = normalizeChecked(existing.checked || input.checked || {});
  if (input.checked) {
    checked = normalizeChecked({ ...checked, ...input.checked });
  }
  if (input.toggleItemId) {
    const id = String(input.toggleItemId);
    if (allItems().some((i) => i.id === id)) {
      checked[id] = !checked[id];
    }
  }

  const route =
    input.route === undefined
      ? existing.route === "kdp" || existing.route === "d2d"
        ? existing.route
        : null
      : input.route;

  const doc = {
    userId,
    bookId:
      input.bookId !== undefined
        ? input.bookId || null
        : existing.bookId || null,
    bookTitle: String(
      input.bookTitle ?? existing.bookTitle ?? "Untitled book"
    ).trim(),
    checked,
    route,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };

  await ref.set(doc, { merge: true });
  return mapDoc(ref.id, doc);
}

export async function deleteChecklist(userId: string, id: string) {
  await col(userId).doc(id).delete();
  return { ok: true };
}
