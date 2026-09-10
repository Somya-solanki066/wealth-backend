import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  createLinkChallenge,
  getLinkedWallet,
  getRoyaltiesDashboard,
  getRoyaltyTransaction,
  getWalletRoyaltiesConfig,
  linkWallet,
  seedDemoRoyalties,
  SOURCE_LABELS,
  unlinkWallet,
} from "../services/walletRoyalties.service";

const router = express.Router();
router.use(verifyFirebaseToken);

router.get("/config", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      config: getWalletRoyaltiesConfig(),
      sources: Object.entries(SOURCE_LABELS).map(([id, label]) => ({ id, label })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/challenge", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const challenge = await createLinkChallenge(req.user.uid);
    return res.json({ challenge });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/wallet", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const wallet = await getLinkedWallet(req.user.uid);
    return res.json({ wallet });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/wallet/link", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const wallet = await linkWallet({
      userId: req.user.uid,
      address: String(req.body?.address || ""),
      signature: String(req.body?.signature || ""),
      nonce: String(req.body?.nonce || ""),
      networks: Array.isArray(req.body?.networks) ? req.body.networks : undefined,
    });
    return res.json({ wallet });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Link failed." });
  }
});

router.delete("/wallet", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await unlinkWallet(req.user.uid);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/dashboard", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const period = String(req.query.period || "30d") as any;
    const allowed = ["7d", "30d", "90d", "all"];
    const p = allowed.includes(period) ? period : "30d";
    const dashboard = await getRoyaltiesDashboard(req.user.uid, p);
    return res.json({ dashboard });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/transactions/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const transaction = await getRoyaltyTransaction(req.user.uid, String(req.params.id));
    return res.json({ transaction });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.post("/demo/seed", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await seedDemoRoyalties(req.user.uid);
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Seed failed." });
  }
});

export default router;
