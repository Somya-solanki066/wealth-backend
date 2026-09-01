import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { DEFAULT_SETTINGS, normalizeSettings } from "../utils/plans";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("settings").doc("global");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      await docRef.set(DEFAULT_SETTINGS);
      return res.status(200).json({ success: true, data: DEFAULT_SETTINGS });
    }

    return res.status(200).json({ success: true, data: normalizeSettings(docSnap.data()) });
  } catch (error: any) {
    console.error("Error retrieving settings:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.put("/", verifyAdmin, async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("settings").doc("global");
    const normalized = normalizeSettings(req.body);

    await docRef.set(normalized, { merge: false });
    return res.status(200).json({ success: true, data: normalized });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
