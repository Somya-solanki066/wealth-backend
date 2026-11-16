import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";
import {
  DEFAULT_BANNER_SETTINGS,
  SEED_WORLD_BANNERS,
  WORLD_BANNER_SETTINGS_COLLECTION,
  WORLD_BANNER_SETTINGS_DOC,
  WORLD_BANNERS_COLLECTION,
  isBannerLive,
  mergeBannerSettings,
  normalizeBannerKind,
  normalizeBannerWorld,
  sortBanners,
  type WorldBanner,
  type WorldBannerSettings,
} from "../utils/worldBannerDefaults";

const router = express.Router();

function bannersRef() {
  return getFirestore().collection(WORLD_BANNERS_COLLECTION);
}

function settingsRef() {
  return getFirestore()
    .collection(WORLD_BANNER_SETTINGS_COLLECTION)
    .doc(WORLD_BANNER_SETTINGS_DOC);
}

function asBanner(id: string, data: FirebaseFirestore.DocumentData | undefined): WorldBanner {
  const raw = data || {};
  return {
    id,
    world: normalizeBannerWorld(raw.world),
    kind: normalizeBannerKind(raw.kind),
    title: String(raw.title || ""),
    description: String(raw.description || ""),
    ctaLabel: String(raw.ctaLabel || ""),
    ctaHref: String(raw.ctaHref || ""),
    imageUrl: String(raw.imageUrl || ""),
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 0,
    enabled: raw.enabled !== false,
    isUrgent: raw.isUrgent === true,
    startsAt: String(raw.startsAt || ""),
    endsAt: String(raw.endsAt || ""),
    createdAt: String(raw.createdAt || ""),
    updatedAt: String(raw.updatedAt || ""),
  };
}

function payloadFromBody(body: Record<string, unknown>, id: string, prev?: WorldBanner): WorldBanner {
  const now = new Date().toISOString();
  return {
    id,
    world: normalizeBannerWorld(body.world ?? prev?.world),
    kind: normalizeBannerKind(body.kind ?? prev?.kind),
    title: String(body.title ?? prev?.title ?? ""),
    description: String(body.description ?? prev?.description ?? ""),
    ctaLabel: String(body.ctaLabel ?? prev?.ctaLabel ?? ""),
    ctaHref: String(body.ctaHref ?? prev?.ctaHref ?? ""),
    imageUrl: String(body.imageUrl ?? prev?.imageUrl ?? ""),
    sortOrder:
      typeof body.sortOrder === "number"
        ? body.sortOrder
        : prev?.sortOrder ?? Date.now(),
    enabled: body.enabled !== undefined ? body.enabled !== false : prev?.enabled !== false,
    isUrgent: body.isUrgent !== undefined ? body.isUrgent === true : prev?.isUrgent === true,
    startsAt: String(body.startsAt ?? prev?.startsAt ?? ""),
    endsAt: String(body.endsAt ?? prev?.endsAt ?? ""),
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
}

async function listAllBanners(): Promise<WorldBanner[]> {
  const snap = await bannersRef().get();
  return snap.docs.map((doc) => asBanner(doc.id, doc.data())).sort(sortBanners);
}

async function readSettings(): Promise<WorldBannerSettings> {
  const snap = await settingsRef().get();
  return mergeBannerSettings(snap.exists ? (snap.data() as Partial<WorldBannerSettings>) : DEFAULT_BANNER_SETTINGS);
}

export async function ensureSeedWorldBanners() {
  const snap = await bannersRef().limit(1).get();
  if (!snap.empty) return;
  const now = new Date().toISOString();
  const batch = getFirestore().batch();
  for (const seed of SEED_WORLD_BANNERS) {
    batch.set(bannersRef().doc(seed.id), {
      ...seed,
      createdAt: now,
      updatedAt: now,
    });
  }
  batch.set(settingsRef(), { ...DEFAULT_BANNER_SETTINGS, updatedAt: now }, { merge: true });
  await batch.commit();
  console.log(`Seeded ${SEED_WORLD_BANNERS.length} world banners.`);
}

router.get("/", async (req, res) => {
  try {
    await ensureSeedWorldBanners();
    const world = normalizeBannerWorld(req.query.world || "writer");
    const all = await listAllBanners();
    const now = Date.now();
    const banners = all.filter((item) => {
      if (!isBannerLive(item, now)) return false;
      if (world === "all") return true;
      return item.world === world || item.world === "all";
    });
    const settings = await readSettings();
    res.json({ data: { banners, settings } });
  } catch (error) {
    console.error("Error listing world banners:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/admin", verifyAdmin, async (_req, res) => {
  try {
    await ensureSeedWorldBanners();
    const banners = await listAllBanners();
    const settings = await readSettings();
    res.json({ data: { banners, settings } });
  } catch (error) {
    console.error("Error listing admin world banners:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/settings", verifyAdmin, async (req, res) => {
  try {
    const merged = mergeBannerSettings({
      ...(await readSettings()),
      ...(req.body || {}),
      updatedAt: new Date().toISOString(),
    });
    await settingsRef().set(merged, { merge: true });
    res.json({ message: "Banner settings saved.", data: merged });
  } catch (error) {
    console.error("Error saving banner settings:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/reorder", verifyAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) {
      return res.status(400).json({ error: "ids array is required." });
    }
    const now = new Date().toISOString();
    const batch = getFirestore().batch();
    ids.forEach((id: string, index: number) => {
      batch.set(bannersRef().doc(id), { sortOrder: index + 1, updatedAt: now }, { merge: true });
    });
    await batch.commit();
    const banners = await listAllBanners();
    res.json({ message: "Order updated.", data: { banners } });
  } catch (error) {
    console.error("Error reordering banners:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post(
  "/upload",
  verifyAdmin,
  (req, res, next) => {
    memoryImageUpload.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded." });
      }
      const filename = makeUploadFilename("world-banner", req.file.originalname);
      const url = await persistPublicUpload(req, req.file, filename);
      res.json({ success: true, url });
    } catch (error) {
      console.error("Error uploading world banner:", error);
      res.status(500).json({ error: "Failed to upload image." });
    }
  }
);

router.post("/", verifyAdmin, async (req, res) => {
  try {
    const body = req.body?.banner ?? req.body ?? {};
    const id = String(body.id || `banner-${Date.now()}`);
    const banner = payloadFromBody(body, id);
    await bannersRef().doc(id).set(banner);
    res.status(201).json({ message: "Banner created.", data: banner });
  } catch (error) {
    console.error("Error creating world banner:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await bannersRef().doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Banner not found." });
    }
    const body = req.body?.banner ?? req.body ?? {};
    const banner = payloadFromBody(body, id, asBanner(id, doc.data()));
    await bannersRef().doc(id).set(banner, { merge: true });
    res.json({ message: "Banner updated.", data: banner });
  } catch (error) {
    console.error("Error updating world banner:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    await bannersRef().doc(id).delete();
    res.json({ message: "Banner deleted." });
  } catch (error) {
    console.error("Error deleting world banner:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
