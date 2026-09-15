import express, { Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  isValidScriptIndustry,
  type ScriptAnalysisMode,
  type ScriptFormat,
  type ScriptIndustry,
} from "../data/scriptAnalyzerPrompts";
import { analyzeScript } from "../services/scriptAnalyzer.service";
import { countWords, recordAiUsage } from "../utils/aiUsage";
import {
  chargeAiCredits,
  creditErrorBody,
  finalizeAiCredits,
  refundAiCredits,
} from "../services/aiCredits.service";

const router = express.Router();

const VALID_FORMATS = new Set<ScriptFormat>(["feature", "tv_pilot", "short", "audio_drama"]);
const VALID_MODES = new Set<ScriptAnalysisMode>([
  "full_script",
  "scene_analysis",
  "dialogue_punchup",
]);

/** POST /api/script/analyze */
router.post("/analyze", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const industry = String(req.body?.industry || "").trim() as ScriptIndustry;
    const format = String(req.body?.format || "feature").trim() as ScriptFormat;
    const analysisMode = String(req.body?.analysisMode || "full_script").trim() as ScriptAnalysisMode;
    const scriptText = String(req.body?.scriptText || req.body?.content || "").trim();
    const projectId = String(req.body?.projectId || "").trim();
    const chapterId = String(req.body?.chapterId || "").trim();

    if (!isValidScriptIndustry(industry)) {
      return res.status(400).json({ error: "Invalid industry selection." });
    }
    if (!VALID_FORMATS.has(format)) {
      return res.status(400).json({ error: "Invalid format selection." });
    }
    if (!VALID_MODES.has(analysisMode)) {
      return res.status(400).json({ error: "Invalid analysis mode." });
    }
    if (!scriptText) {
      return res.status(400).json({ error: "Script text is required." });
    }

    const charged = await chargeAiCredits({
      userId: req.user.uid,
      toolId: "script-analyzer",
      inputChars: scriptText.length,
    });
    if (!charged.ok) {
      return res.status(charged.status).json(creditErrorBody(charged));
    }

    try {
      let projectName = "";
      let chapterTitle = "";
      if (projectId) {
        const projectSnap = await getFirestore().collection("projects").doc(projectId).get();
        if (projectSnap.exists && projectSnap.data()?.userId === req.user.uid) {
          projectName = String(projectSnap.data()?.name || "");
          if (chapterId) {
            const chSnap = await projectSnap.ref.collection("chapters").doc(chapterId).get();
            if (chSnap.exists) chapterTitle = String(chSnap.data()?.title || "");
          }
        }
      }

      const { result, analysisId, tokensUsed, model } = await analyzeScript({
        userId: req.user.uid,
        userEmail: req.user.email || null,
        industry,
        format,
        analysisMode,
        scriptText,
        projectId: projectId || undefined,
        chapterId: chapterId || undefined,
        projectName,
        chapterTitle,
      });

      await recordAiUsage({
        userId: req.user.uid,
        userEmail: req.user.email || null,
        field: "scriptAnalyzerCount",
        tool: "script-analyzer",
        wordsAnalyzed: countWords(scriptText),
        tokensUsed,
        model,
        projectId,
        projectName,
        chapterId,
        chapterTitle,
        platform: industry,
        genre: format,
        score: result.pitch_readiness_score,
        inputPreview: scriptText.slice(0, 280),
      });

      await finalizeAiCredits({
        requestId: charged.reservation.requestId,
        userId: req.user.uid,
        status: "success",
        provider: "openai",
        model,
        promptTokens: 0,
        completionTokens: 0,
      });

      return res.json({
        success: true,
        analysisId,
        ...result,
        creditsCharged: charged.featureCreditCost,
        creditsRemaining: charged.reservation.balanceAfter,
      });
    } catch (inner: any) {
      await refundAiCredits({
        requestId: charged.reservation.requestId,
        userId: req.user.uid,
        reason: inner?.message || "script_analyze_failed",
      });
      throw inner;
    }
  } catch (error: any) {
    console.error("Script analyze error:", error);
    return res.status(500).json({ error: error.message || "Script analysis failed." });
  }
});

/** GET /api/script/industries — public catalog for UI dropdowns */
router.get("/industries", async (_req, res) => {
  const { SCRIPT_INDUSTRIES, SCRIPT_FORMATS, SCRIPT_ANALYSIS_MODES } = await import(
    "../data/scriptAnalyzerPrompts"
  );
  return res.json({
    industries: SCRIPT_INDUSTRIES,
    formats: SCRIPT_FORMATS,
    analysisModes: SCRIPT_ANALYSIS_MODES,
  });
});

export default router;
