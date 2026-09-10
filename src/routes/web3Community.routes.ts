import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  assembleCommunityPost,
  deleteCommunityDraft,
  deleteCommunityTemplate,
  getCommunityMeta,
  listCommunityDrafts,
  listCommunityTemplates,
  polishCommunityPost,
  saveCommunityDraft,
  saveCommunityTemplate,
} from "../services/web3Community.service";

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
      error: "Premium required to polish community posts with AI.",
      premiumRequired: true,
    });
    return null;
  }
  return snap.data() || {};
}

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json(getCommunityMeta(true));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/assemble", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const post = assembleCommunityPost({
      postType: req.body?.postType,
      tone: req.body?.tone,
      length: req.body?.length,
      projectName: req.body?.projectName,
      website: req.body?.website,
      communityName: req.body?.communityName,
      fields: req.body?.fields && typeof req.body.fields === "object" ? req.body.fields : {},
    });
    return res.json({ post });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Assemble failed." });
  }
});

router.post("/polish", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const post = await polishCommunityPost({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      postType: req.body?.postType,
      tone: req.body?.tone,
      length: req.body?.length,
      projectName: req.body?.projectName,
      website: req.body?.website,
      communityName: req.body?.communityName,
      socialLinks: req.body?.socialLinks,
      fields: req.body?.fields && typeof req.body.fields === "object" ? req.body.fields : {},
      draftBody: req.body?.draftBody,
    });
    return res.json({ post });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Polish failed." });
  }
});

router.get("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const drafts = await listCommunityDrafts(req.user.uid);
    return res.json({ drafts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load drafts." });
  }
});

router.post("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const draft = await saveCommunityDraft(req.user.uid, {
      id: req.body?.id,
      postType: req.body?.postType || "product-update",
      tone: req.body?.tone || "friendly",
      length: req.body?.length || "standard",
      projectName: req.body?.projectName,
      website: req.body?.website,
      communityName: req.body?.communityName,
      socialLinks: req.body?.socialLinks,
      fields: req.body?.fields || {},
      body: String(req.body?.body || ""),
      templateName: req.body?.templateName,
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/drafts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteCommunityDraft(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

router.get("/templates", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const templates = await listCommunityTemplates(req.user.uid);
    return res.json({ templates });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load templates." });
  }
});

router.post("/templates", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const template = await saveCommunityTemplate(req.user.uid, {
      id: req.body?.id,
      templateName: String(req.body?.templateName || ""),
      postType: req.body?.postType || "product-update",
      tone: req.body?.tone || "friendly",
      length: req.body?.length || "standard",
      projectName: req.body?.projectName,
      website: req.body?.website,
      communityName: req.body?.communityName,
      socialLinks: req.body?.socialLinks,
      fields: req.body?.fields || {},
      body: String(req.body?.body || ""),
    });
    return res.json({ template });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/templates/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteCommunityTemplate(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
