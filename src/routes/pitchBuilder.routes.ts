import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { isUserPremium } from "../utils/plans";
import {
  buildDownloadPackage,
  createPitchProject,
  deletePitchProject,
  generatePitchDeck,
  generateQueryLetter,
  generateSynopsis,
  getPitchProject,
  listPitchProjects,
  savePackageToProject,
  updatePitchProject,
} from "../services/pitchBuilder.service";

const router = express.Router();

async function requirePremium(req: AuthenticatedRequest, res: express.Response) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  const snap = await getFirestore().collection("users").doc(req.user.uid).get();
  if (!isUserPremium(snap.data())) {
    res.status(403).json({
      error: "Premium required for Pitch Deck & Query Builder.",
      premiumRequired: true,
    });
    return null;
  }
  return snap.data() || {};
}

router.use(verifyFirebaseToken);

router.get("/projects", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const projects = await listPitchProjects(req.user.uid);
    return res.json({ projects });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/projects", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const project = await createPitchProject(req.user!.uid, req.body || {});
    return res.json({ project });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/projects/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const project = await getPitchProject(req.user.uid, String(req.params.id));
    return res.json({ project });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.put("/projects/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const project = await updatePitchProject(req.user.uid, String(req.params.id), req.body || {});
    return res.json({ project });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.delete("/projects/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await deletePitchProject(req.user.uid, String(req.params.id));
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/projects/:id/ai/synopsis", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const project = (await getPitchProject(req.user!.uid, String(req.params.id))) as any;
    const mode = req.body?.mode === "improve" ? "improve" : "generate";
    const content = await generateSynopsis({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      data: { ...project, synopsis: project.synopsis },
      mode,
      previous: String(req.body?.previous || project.synopsis || ""),
    });
    const updated = await updatePitchProject(req.user!.uid, String(req.params.id), {
      synopsis: content,
      currentStep: Math.max(Number(project.currentStep) || 3, 3),
    });
    return res.json({ content, project: updated });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Synopsis AI failed." });
  }
});

router.post("/projects/:id/ai/query", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const project = (await getPitchProject(req.user!.uid, String(req.params.id))) as any;
    const mode =
      req.body?.mode === "improve"
        ? "improve"
        : req.body?.mode === "regenerate"
          ? "regenerate"
          : "generate";
    const patch: any = {};
    if (req.body?.agentName != null) patch.agentName = String(req.body.agentName);
    if (req.body?.personalization != null) patch.personalization = String(req.body.personalization);
    if (req.body?.authorBio != null) patch.authorBio = String(req.body.authorBio);
    const base = Object.keys(patch).length
      ? await updatePitchProject(req.user!.uid, String(req.params.id), patch)
      : project;

    const content = await generateQueryLetter({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      data: base as any,
      mode,
      previous: String(req.body?.previous || (base as any).queryLetter || ""),
    });
    const updated = await updatePitchProject(req.user!.uid, String(req.params.id), {
      queryLetter: content,
      currentStep: 4,
    });
    return res.json({ content, project: updated });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Query AI failed." });
  }
});

router.post("/projects/:id/ai/pitch-deck", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await requirePremium(req, res);
    if (!profile) return;
    const project = (await getPitchProject(req.user!.uid, String(req.params.id))) as any;
    const mode = req.body?.mode === "improve" ? "improve" : "generate";
    const content = await generatePitchDeck({
      userId: req.user!.uid,
      userEmail: profile.email || req.user!.email,
      data: project,
      mode,
      previous: String(req.body?.previous || project.pitchDeck || ""),
    });
    const updated = await updatePitchProject(req.user!.uid, String(req.params.id), {
      pitchDeck: content,
      status: "completed",
    });
    return res.json({ content, project: updated });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Pitch deck AI failed." });
  }
});

router.post("/projects/:id/save-to-project", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const projectId = String(req.body?.projectId || "").trim();
    if (!projectId) return res.status(400).json({ error: "projectId is required." });
    const result = await savePackageToProject({
      userId: req.user.uid,
      pitchId: String(req.params.id),
      projectId,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.get("/projects/:id/download", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const project = await getPitchProject(req.user.uid, String(req.params.id));
    const pack = buildDownloadPackage(project);
    return res.json(pack);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

export default router;
