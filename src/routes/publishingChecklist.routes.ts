import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  CHECKLIST_STAGES,
  deleteChecklist,
  getChecklist,
  getOrCreateForBook,
  listChecklists,
  ROUTE_GUIDES,
  saveChecklist,
} from "../services/publishingChecklist.service";

const router = express.Router();

router.use(verifyFirebaseToken);

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      stages: CHECKLIST_STAGES,
      routes: [
        {
          id: "kdp",
          title: ROUTE_GUIDES.kdp.title,
          subtitle: ROUTE_GUIDES.kdp.subtitle,
          steps: ROUTE_GUIDES.kdp.steps,
        },
        {
          id: "d2d",
          title: ROUTE_GUIDES.d2d.title,
          subtitle: ROUTE_GUIDES.d2d.subtitle,
          steps: ROUTE_GUIDES.d2d.steps,
        },
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/lists", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const lists = await listChecklists(req.user.uid);
    return res.json({ lists });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load checklists." });
  }
});

router.get("/lists/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const list = await getChecklist(req.user.uid, String(req.params.id));
    return res.json({ list });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.post("/lists", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const list = await getOrCreateForBook(req.user.uid, {
      bookId: req.body?.bookId || null,
      bookTitle: String(req.body?.bookTitle || "Untitled book"),
      checklistId: req.body?.checklistId,
    });
    return res.json({ list });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Create failed." });
  }
});

router.patch("/lists/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const list = await saveChecklist(req.user.uid, {
      id: String(req.params.id),
      bookId: req.body?.bookId,
      bookTitle: req.body?.bookTitle,
      checked: req.body?.checked,
      route: req.body?.route,
      toggleItemId: req.body?.toggleItemId,
    });
    return res.json({ list });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.delete("/lists/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteChecklist(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
