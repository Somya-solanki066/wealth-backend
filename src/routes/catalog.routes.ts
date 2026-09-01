import { Router, Request, Response } from "express";
import { getPublicCatalog } from "../utils/catalog";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const data = await getPublicCatalog();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Error loading catalog:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
