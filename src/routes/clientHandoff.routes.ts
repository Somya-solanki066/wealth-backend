import express from "express";
import multer from "multer";
import path from "path";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  attachDocument,
  createHandoff,
  deleteHandoff,
  getHandoff,
  getOrCreateForBook,
  HANDOFF_ITEMS,
  listHandoffs,
  saveHandoff,
} from "../services/clientHandoff.service";

const router = express.Router();
router.use(verifyFirebaseToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const ok =
      [".pdf", ".docx", ".doc", ".txt"].includes(ext) ||
      file.mimetype.includes("pdf") ||
      file.mimetype.includes("word") ||
      file.mimetype.includes("text");
    if (ok) cb(null, true);
    else cb(new Error("Upload PDF, DOCX, or TXT only."));
  },
});

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const bySection: Record<string, typeof HANDOFF_ITEMS> = {
      nda: [],
      brief: [],
      manuscript: [],
      invoice: [],
      delivery: [],
    };
    for (const item of HANDOFF_ITEMS) {
      bySection[item.section].push(item);
    }
    return res.json({
      items: HANDOFF_ITEMS,
      sections: bySection,
      docTypes: [
        { id: "nda", label: "NDA" },
        { id: "brief", label: "Client Brief" },
        { id: "draft", label: "Manuscript Draft" },
        { id: "final", label: "Final Manuscript" },
        { id: "invoice", label: "Invoice" },
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/projects", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const projects = await listHandoffs(req.user.uid, req.query.archived === "1");
    return res.json({ projects });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load projects." });
  }
});

router.post("/projects", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    if (req.body?.bookId) {
      const project = await getOrCreateForBook(req.user.uid, {
        bookId: String(req.body.bookId),
        clientName: req.body?.clientName,
        bookTitle: req.body?.bookTitle,
      });
      return res.json({ project });
    }
    const project = await createHandoff(req.user.uid, {
      clientName: String(req.body?.clientName || "Client"),
      bookTitle: String(req.body?.bookTitle || "Untitled book"),
      bookId: req.body?.bookId || null,
      briefText: req.body?.briefText,
    });
    return res.json({ project });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Create failed." });
  }
});

router.get("/projects/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const project = await getHandoff(req.user.uid, String(req.params.id));
    return res.json({ project });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.patch("/projects/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const project = await saveHandoff(req.user.uid, String(req.params.id), {
      clientName: req.body?.clientName,
      bookTitle: req.body?.bookTitle,
      checked: req.body?.checked,
      toggleItemId: req.body?.toggleItemId,
      reviewStatus: req.body?.reviewStatus,
      clientFeedback: req.body?.clientFeedback,
      invoiceAmount: req.body?.invoiceAmount != null ? Number(req.body.invoiceAmount) : undefined,
      invoiceStatus: req.body?.invoiceStatus,
      briefText: req.body?.briefText,
      archived: req.body?.archived,
    });
    return res.json({ project });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.post(
  "/projects/:id/upload",
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      if (!req.file) return res.status(400).json({ error: "No file uploaded." });
      const type = String(req.body?.type || "other") as any;
      const project = await attachDocument(req.user.uid, String(req.params.id), {
        type: ["nda", "brief", "draft", "final", "invoice", "other"].includes(type)
          ? type
          : "other",
        originalName: req.file.originalname || "document",
        buffer: req.file.buffer,
        status: req.body?.status ? String(req.body.status) : undefined,
      });
      return res.json({ project });
    } catch (error: any) {
      return res.status(error?.status || 500).json({ error: error.message || "Upload failed." });
    }
  }
);

router.delete("/projects/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deleteHandoff(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
});

export default router;
