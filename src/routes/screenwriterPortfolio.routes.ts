import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  createHireInquiry,
  getMyScreenwriterPortfolio,
  getPublicScreenwriterPortfolio,
  getScreenwriterPortfolioMeta,
  listMyInquiries,
  saveScreenwriterPortfolio,
  submitVerification,
} from "../services/screenwriterPortfolio.service";

const router = express.Router();

router.get("/meta", async (_req, res) => {
  try {
    return res.json(getScreenwriterPortfolioMeta());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/mine", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const data = await getMyScreenwriterPortfolio(req.user.uid);
    return res.json(data || { portfolio: null, stats: { scriptsSold: 0, rating: null, responseTimeLabel: null } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/save", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await saveScreenwriterPortfolio(req.user.uid, {
      ...req.body,
      publish: Boolean(req.body?.publish),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.post("/verify", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await submitVerification(req.user.uid, req.body?.note);
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Verify request failed." });
  }
});

router.get("/inquiries", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const inquiries = await listMyInquiries(req.user.uid);
    return res.json({ inquiries });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const publicScreenwriterPortfolioRouter = express.Router();

publicScreenwriterPortfolioRouter.get("/:slug", async (req, res) => {
  try {
    const data = await getPublicScreenwriterPortfolio(String(req.params.slug));
    return res.json(data);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

publicScreenwriterPortfolioRouter.post("/:slug/inquiry", async (req, res) => {
  try {
    const result = await createHireInquiry({
      slug: String(req.params.slug),
      fromUserId: req.body?.fromUserId,
      fromName: String(req.body?.fromName || ""),
      fromEmail: String(req.body?.fromEmail || ""),
      projectTitle: String(req.body?.projectTitle || ""),
      lookingFor: String(req.body?.lookingFor || ""),
      budget: req.body?.budget,
      deadline: req.body?.deadline,
      message: String(req.body?.message || ""),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Inquiry failed." });
  }
});

export default router;
