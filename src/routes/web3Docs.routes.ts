import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  deleteDocsDraft,
  DOC_AUDIENCES,
  DOC_TYPES,
  FAQ_COUNTS,
  generateDocBody,
  generateDocStructure,
  listDocsDrafts,
  saveDocsDraft,
  USER_LEVELS,
} from "../services/web3Docs.service";

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
      error: "Premium required for Whitepaper & Docs Assistant AI.",
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
      docTypes: DOC_TYPES.map((id) => ({
        id,
        label:
          id === "whitepaper"
            ? "Whitepaper section"
            : id === "user-guide"
              ? "User guide"
              : "FAQ",
      })),
      audiences: DOC_AUDIENCES.map((id) => ({
        id,
        label:
          id === "general"
            ? "General users"
            : id === "web3-beginners"
              ? "Web3 beginners"
              : id === "crypto-users"
                ? "Crypto users"
                : id === "developers"
                  ? "Developers"
                  : "Technical users",
      })),
      userLevels: USER_LEVELS.map((id) => ({
        id,
        label: id === "beginner" ? "Beginner" : id === "advanced" ? "Advanced" : "Intermediate",
      })),
      faqCounts: FAQ_COUNTS.map((n) => ({ id: String(n), label: `${n} questions` })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/structure", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const structure = await generateDocStructure({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      docType: req.body?.docType,
      topic: String(req.body?.topic || ""),
      projectName: req.body?.projectName,
      projectDescription: req.body?.projectDescription,
      technicalNotes: req.body?.technicalNotes,
      docsUrl: req.body?.docsUrl,
      references: req.body?.references,
      audience: req.body?.audience,
      userLevel: req.body?.userLevel,
      faqCount: req.body?.faqCount != null ? Number(req.body.faqCount) : undefined,
    });
    return res.json({ structure });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Structure failed." });
  }
});

router.post("/document", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const document = await generateDocBody({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      docType: req.body?.docType,
      topic: String(req.body?.topic || ""),
      projectName: req.body?.projectName,
      projectDescription: req.body?.projectDescription,
      technicalNotes: req.body?.technicalNotes,
      docsUrl: req.body?.docsUrl,
      references: req.body?.references,
      audience: req.body?.audience,
      userLevel: req.body?.userLevel,
      faqCount: req.body?.faqCount != null ? Number(req.body.faqCount) : undefined,
      structure: Array.isArray(req.body?.structure) ? req.body.structure : [],
      title: req.body?.title,
    });
    return res.json({ document });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Document failed." });
  }
});

router.get("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const drafts = await listDocsDrafts(req.user.uid);
    return res.json({ drafts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load drafts." });
  }
});

router.post("/drafts", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const draft = await saveDocsDraft(req.user.uid, {
      id: req.body?.id,
      docType: req.body?.docType || "whitepaper",
      topic: String(req.body?.topic || ""),
      projectName: req.body?.projectName,
      projectDescription: req.body?.projectDescription,
      technicalNotes: req.body?.technicalNotes,
      docsUrl: req.body?.docsUrl,
      references: req.body?.references,
      audience: req.body?.audience || "web3-beginners",
      userLevel: req.body?.userLevel,
      faqCount: req.body?.faqCount,
      structure: Array.isArray(req.body?.structure) ? req.body.structure : [],
      title: String(req.body?.title || "Untitled doc"),
      body: String(req.body?.body || ""),
      wordCount: Number(req.body?.wordCount || 0),
    });
    return res.json({ draft });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/drafts/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteDocsDraft(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
