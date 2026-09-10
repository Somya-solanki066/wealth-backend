import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  addDemoHolder,
  getChapterAccessState,
  getTokenGateConfig,
  listGatesForProject,
  listGatesForUser,
  listRegisteredTokens,
  removeGate,
  setChapterGate,
  updateGateStatus,
  verifyChapterAccess,
} from "../services/tokenGate.service";

const router = express.Router();
router.use(verifyFirebaseToken);

router.get("/config", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({ config: getTokenGateConfig() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/tokens", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const tokens = await listRegisteredTokens();
    return res.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        label: `${t.name} (${t.standard})`,
        standard: t.standard,
        contractAddress: t.contractAddress,
        network: t.network,
        chainId: t.chainId,
        tokenId: t.tokenId,
        getTokenUrl: t.getTokenUrl,
        platform: t.platform,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/tokens/:id/demo-holder", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const token = await addDemoHolder(String(req.params.id), String(req.body?.walletAddress || ""));
    return res.json({
      token: {
        id: token.id,
        name: token.name,
        demoHolderCount: token.demoHolderWallets.length,
      },
    });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Failed." });
  }
});

router.get("/gates", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const projectId = req.query.projectId ? String(req.query.projectId) : "";
    const gates = projectId
      ? (await listGatesForProject(projectId)).filter((g) => g.userId === req.user!.uid)
      : await listGatesForUser(req.user.uid);
    return res.json({ gates });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/gates", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const gate = await setChapterGate({
      userId: req.user.uid,
      projectId: String(req.body?.projectId || ""),
      chapterId: String(req.body?.chapterId || ""),
      tokenId: String(req.body?.tokenId || ""),
      accessPolicy: req.body?.accessPolicy,
      status: req.body?.status,
    });
    return res.json({ gate });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Set gate failed." });
  }
});

router.patch("/gates/:projectId/:chapterId", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const status = req.body?.status === "disabled" ? "disabled" : "active";
    const gate = await updateGateStatus(
      req.user.uid,
      String(req.params.projectId),
      String(req.params.chapterId),
      status
    );
    return res.json({ gate });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Update failed." });
  }
});

router.delete("/gates/:projectId/:chapterId", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await removeGate(req.user.uid, String(req.params.projectId), String(req.params.chapterId));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Remove failed." });
  }
});

router.get("/access/:projectId/:chapterId", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const state = await getChapterAccessState({
      projectId: String(req.params.projectId),
      chapterId: String(req.params.chapterId),
    });
    return res.json(state);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/verify", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await verifyChapterAccess({
      projectId: String(req.body?.projectId || ""),
      chapterId: String(req.body?.chapterId || ""),
      walletAddress: String(req.body?.walletAddress || ""),
      userId: req.user.uid,
    });
    return res.json({ result });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Verify failed." });
  }
});

export default router;
