import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  applyThreadCta,
  deleteThreadDraft,
  generateThread,
  improveThreadHook,
  listThreadDrafts,
  refineThreadPost,
  saveThreadDraft,
  THREAD_AUDIENCES,
  THREAD_CTAS,
  THREAD_GOALS,
  THREAD_LENGTHS,
  THREAD_TONES,
} from "../services/web3Thread.service";

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
      error: "Premium required for Social Thread Generator AI.",
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
      audiences: THREAD_AUDIENCES.map((id) => ({
        id,
        label:
          id === "web3-beginners"
            ? "Web3 Beginners"
            : id === "crypto-users"
              ? "Crypto Users"
              : id === "developers"
                ? "Developers"
                : id === "investors"
                  ? "Investors"
                  : id === "project-community"
                    ? "Project Community"
                    : "General Audience",
      })),
      goals: THREAD_GOALS.map((id) => ({
        id,
        label:
          id === "educate"
            ? "Educate"
            : id === "explain-product"
              ? "Explain a Product"
              : id === "announce-update"
                ? "Announce an Update"
                : id === "build-awareness"
                  ? "Build Awareness"
                  : id === "community-engagement"
                    ? "Community Engagement"
                    : "Promote a Project",
      })),
      tones: THREAD_TONES.map((id) => ({
        id,
        label:
          id === "educational"
            ? "Educational"
            : id === "professional"
              ? "Professional"
              : id === "conversational"
                ? "Conversational"
                : id === "bold"
                  ? "Bold"
                  : id === "technical"
                    ? "Technical"
                    : "Community-focused",
      })),
      lengths: THREAD_LENGTHS.map((id) => ({
        id,
        label:
          id === "short"
            ? "Short — 5 posts"
            : id === "long"
              ? "Long — 10–12 posts"
              : "Standard — 8 posts",
      })),
      ctas: THREAD_CTAS.map((id) => ({
        id,
        label:
          id === "follow"
            ? "Follow for more"
            : id === "join-community"
              ? "Join community"
              : id === "visit-website"
                ? "Visit website"
                : id === "read-docs"
                  ? "Read documentation"
                  : id === "try-product"
                    ? "Try the product"
                    : "No CTA",
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const thread = await generateThread({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      idea: String(req.body?.idea || ""),
      audience: req.body?.audience,
      goal: req.body?.goal,
      tone: req.body?.tone,
      length: req.body?.length,
      cta: req.body?.cta,
      projectName: req.body?.projectName,
      website: req.body?.website,
      keyInfo: req.body?.keyInfo,
      references: req.body?.references,
    });
    return res.json({ thread });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Generate failed." });
  }
});

router.post("/refine-post", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const result = await refineThreadPost({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      action: String(req.body?.action || "rewrite"),
      post: String(req.body?.post || ""),
      idea: String(req.body?.idea || ""),
      audience: req.body?.audience,
      tone: req.body?.tone,
      index: Number(req.body?.index || 0),
      total: Number(req.body?.total || 1),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Refine failed." });
  }
});

router.post("/improve-hook", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const result = await improveThreadHook({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      idea: String(req.body?.idea || ""),
      currentHook: String(req.body?.currentHook || ""),
      audience: req.body?.audience,
      tone: req.body?.tone,
      goal: req.body?.goal,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Hook failed." });
  }
});

router.post("/apply-cta", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const result = await applyThreadCta({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      idea: String(req.body?.idea || ""),
      lastPost: String(req.body?.lastPost || ""),
      cta: req.body?.cta,
      projectName: req.body?.projectName,
      website: req.body?.website,
      tone: req.body?.tone,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "CTA failed." });
  }
});

router.get("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const drafts = await listThreadDrafts(req.user.uid);
    return res.json({ drafts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load drafts." });
  }
});

router.post("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const draft = await saveThreadDraft(req.user.uid, {
      id: req.body?.id,
      idea: String(req.body?.idea || ""),
      audience: req.body?.audience || "web3-beginners",
      goal: req.body?.goal || "educate",
      tone: req.body?.tone || "conversational",
      length: req.body?.length || "standard",
      cta: req.body?.cta || "follow",
      projectName: req.body?.projectName,
      website: req.body?.website,
      keyInfo: req.body?.keyInfo,
      references: req.body?.references,
      posts: Array.isArray(req.body?.posts) ? req.body.posts : [],
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/drafts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteThreadDraft(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
