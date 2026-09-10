import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  assistWritePart,
  defaultOutlineParts,
  deleteMicroSerial,
  generateMicroOutline,
  getMicroSerial,
  listMyMicroSerials,
  MICRO_GENRE_LABELS,
  MICRO_GENRES,
  PART_PURPOSES,
  saveMicroSerial,
} from "../services/microSerial.service";

const router = express.Router();

router.use(verifyFirebaseToken);

async function requirePremium(req: AuthenticatedRequest, res: express.Response) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  const snap = await getFirestore().collection("users").doc(req.user.uid).get();
  if (!isUserPremium(snap.data())) {
    res.status(403).json({
      error: "Premium required for Micro-Serial AI.",
      premiumRequired: true,
    });
    return null;
  }
  return snap.data() || {};
}

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      genres: MICRO_GENRES.map((id) => ({ id, label: MICRO_GENRE_LABELS[id] })),
      purposes: PART_PURPOSES,
      partCounts: [5, 6, 7],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const serials = await listMyMicroSerials(req.user.uid);
    return res.json({ serials });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load." });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const serial = await getMicroSerial(req.user.uid, String(req.params.id));
    return res.json({ serial });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.post("/blank", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const partCount = Number(req.body?.partCount || 5);
    const parts = defaultOutlineParts(partCount);
    return res.json({
      title: String(req.body?.title || ""),
      storyIdea: String(req.body?.storyIdea || ""),
      genre: String(req.body?.genre || "romance"),
      partCount: parts.length,
      parts,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/generate-outline", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const outline = await generateMicroOutline({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      storyIdea: String(req.body?.storyIdea || ""),
      genre: String(req.body?.genre || "other"),
      partCount: Number(req.body?.partCount || 5),
      title: req.body?.title,
    });
    return res.json({ outline });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Generate failed." });
  }
});

router.post("/save", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const serial = await saveMicroSerial({
      userId: req.user.uid,
      id: req.body?.id ? String(req.body.id) : undefined,
      title: String(req.body?.title || ""),
      storyIdea: String(req.body?.storyIdea || ""),
      genre: String(req.body?.genre || "other"),
      parts: Array.isArray(req.body?.parts) ? req.body.parts : [],
      status: req.body?.status,
    });
    return res.json({ serial });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.post("/:id/assist-part", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const serial = await getMicroSerial(req.user!.uid, String(req.params.id));
    const partIndex = Number(req.body?.partIndex);
    if (!Number.isFinite(partIndex) || partIndex < 0 || partIndex >= serial.parts.length) {
      return res.status(400).json({ error: "Invalid partIndex." });
    }
    const result = await assistWritePart({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      serial,
      partIndex,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Assist failed." });
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteMicroSerial(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
