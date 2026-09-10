import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  deleteSavedPitch,
  generatePersonalizedPitch,
  listActivePitchTemplates,
  listSavedPitches,
  saveUserPitch,
  updateSavedPitch,
} from "../services/pitchTemplates.service";

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
      error: "Premium required for Pitch Templates AI.",
      premiumRequired: true,
    });
    return null;
  }
  return snap.data() || {};
}

router.get("/templates", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const templates = await listActivePitchTemplates();
    return res.json({ templates });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load templates." });
  }
});

router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const templateId = String(req.body?.templateId || "").trim();
    if (!templateId) return res.status(400).json({ error: "templateId is required." });
    const details =
      req.body?.details && typeof req.body.details === "object" ? req.body.details : {};
    const result = await generatePersonalizedPitch({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      templateId,
      details,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Generate failed." });
  }
});

router.get("/saved", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const pitches = await listSavedPitches(req.user.uid);
    return res.json({ pitches });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load saved pitches." });
  }
});

router.post("/saved", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const pitch = await saveUserPitch({
      userId: req.user.uid,
      title: req.body?.title,
      templateId: String(req.body?.templateId || ""),
      templateName: String(req.body?.templateName || "Pitch"),
      pitch: String(req.body?.pitch || ""),
      details: req.body?.details && typeof req.body.details === "object" ? req.body.details : {},
    });
    return res.json({ pitch });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.patch("/saved/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const pitch = await updateSavedPitch(req.user.uid, String(req.params.id), {
      title: req.body?.title,
      pitch: req.body?.pitch,
    });
    return res.json({ pitch });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Update failed." });
  }
});

router.delete("/saved/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteSavedPitch(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
