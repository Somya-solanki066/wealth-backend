import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  buildNftPreview,
  getCollectionSupply,
  getCollectible,
  getNftMintConfig,
  listCollectibles,
  mintCollectible,
} from "../services/nftMint.service";

const router = express.Router();
router.use(verifyFirebaseToken);

router.get("/config", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({ config: getNftMintConfig() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/preview", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const preview = await buildNftPreview({
      userId: req.user.uid,
      projectId: String(req.body?.projectId || ""),
      contentId: String(req.body?.contentId || ""),
      contentKind: (req.body?.contentKind || "chapter") as any,
      creator: req.body?.creator,
      genre: req.body?.genre,
      description: req.body?.description,
      title: req.body?.title,
    });
    const supply = await getCollectionSupply(
      req.user.uid,
      preview.projectId,
      preview.contentId,
      preview.contentKind
    );
    return res.json({ preview, supply });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Preview failed." });
  }
});

router.get("/supply", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const supply = await getCollectionSupply(
      req.user.uid,
      String(req.query.projectId || ""),
      String(req.query.contentId || ""),
      (String(req.query.contentKind || "chapter") as any)
    );
    return res.json({ supply });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Supply failed." });
  }
});

router.post("/mint", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const collectible = await mintCollectible({
      userId: req.user.uid,
      projectId: String(req.body?.projectId || ""),
      contentId: String(req.body?.contentId || ""),
      contentKind: (req.body?.contentKind || "chapter") as any,
      editionSize: Number(req.body?.editionSize || 100),
      network: String(req.body?.network || "demo"),
      walletAddress: String(req.body?.walletAddress || ""),
      creator: req.body?.creator,
      genre: req.body?.genre,
      description: req.body?.description,
      title: req.body?.title,
    });
    return res.json({ collectible });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Mint failed." });
  }
});

router.get("/collectibles", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const collectibles = await listCollectibles(req.user.uid);
    return res.json({ collectibles });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load collectibles." });
  }
});

router.get("/collectibles/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const collectible = await getCollectible(req.user.uid, String(req.params.id));
    return res.json({ collectible });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

export default router;
