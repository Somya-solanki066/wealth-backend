import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  createHireInquiry,
  deletePortfolio,
  getPortfolioBuilderMeta,
  getPortfolioForOwner,
  getPortfolioWithStats,
  getPublicPortfolioBySlug,
  listMyInquiries,
  listMyPortfolios,
  listWorkSources,
  savePortfolio,
  submitVerification,
} from "../services/portfolioBuilder.service";

const router = express.Router();

router.get("/meta", async (_req, res) => {
  try {
    return res.json(getPortfolioBuilderMeta());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.use(verifyFirebaseToken);

router.get("/sources", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sources = await listWorkSources(req.user.uid);
    return res.json({ sources });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load sources." });
  }
});

router.get("/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const portfolios = await listMyPortfolios(req.user.uid);
    return res.json({ portfolios });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load portfolios." });
  }
});

router.get("/inquiries", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const portfolioId = req.query.portfolioId ? String(req.query.portfolioId) : undefined;
    const inquiries = await listMyInquiries(req.user.uid, portfolioId);
    return res.json({ inquiries });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const data = await getPortfolioWithStats(req.user.uid, String(req.params.id));
    return res.json(data);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.post("/save", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await savePortfolio({
      userId: req.user.uid,
      id: req.body?.id ? String(req.body.id) : undefined,
      portfolioName: String(req.body?.portfolioName || ""),
      displayName: String(req.body?.displayName || ""),
      professionalTitle: String(req.body?.professionalTitle || ""),
      bio: String(req.body?.bio || ""),
      coverImageUrl: req.body?.coverImageUrl,
      photoUrl: req.body?.photoUrl,
      specialties: Array.isArray(req.body?.specialties) ? req.body.specialties : undefined,
      yearsExperience: req.body?.yearsExperience,
      location: req.body?.location,
      languages: req.body?.languages,
      availableForWork: req.body?.availableForWork,
      pricingModel: req.body?.pricingModel,
      rateAmount: req.body?.rateAmount,
      rateCurrency: req.body?.rateCurrency,
      rateNegotiable: req.body?.rateNegotiable,
      social: req.body?.social,
      achievements: Array.isArray(req.body?.achievements) ? req.body.achievements : undefined,
      slug: req.body?.slug,
      layout: req.body?.layout,
      works: Array.isArray(req.body?.works) ? req.body.works : undefined,
      status: req.body?.status,
      publish: Boolean(req.body?.publish),
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Save failed." });
  }
});

router.post("/:id/publish", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const current = await getPortfolioForOwner(req.user.uid, String(req.params.id));
    const result = await savePortfolio({
      userId: req.user.uid,
      id: current.id,
      portfolioName: current.portfolioName,
      displayName: current.displayName,
      professionalTitle: current.professionalTitle,
      bio: current.bio,
      coverImageUrl: current.coverImageUrl,
      photoUrl: current.photoUrl,
      specialties: current.specialties,
      yearsExperience: current.yearsExperience,
      location: current.location,
      languages: current.languages,
      availableForWork: current.availableForWork,
      pricingModel: current.pricingModel,
      rateAmount: current.rateAmount,
      rateCurrency: current.rateCurrency,
      rateNegotiable: current.rateNegotiable,
      social: current.social,
      achievements: current.achievements,
      slug: current.slug,
      layout: current.layout,
      works: current.works,
      publish: true,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Publish failed." });
  }
});

router.post("/:id/verify", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const portfolio = await submitVerification(req.user.uid, String(req.params.id), req.body?.note);
    return res.json({ portfolio });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Verify failed." });
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deletePortfolio(req.user.uid, String(req.params.id));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Delete failed." });
  }
});

export default router;

/** Public (no auth) portfolio viewer */
export const publicPortfolioRouter = express.Router();

publicPortfolioRouter.get("/:slug", async (req, res) => {
  try {
    const data = await getPublicPortfolioBySlug(String(req.params.slug), {
      includeUnlisted: String(req.query.unlisted || "") === "1",
    });
    return res.json(data);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

publicPortfolioRouter.post("/:slug/inquiry", async (req, res) => {
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
