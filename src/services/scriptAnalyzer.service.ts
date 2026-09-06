import OpenAI from "openai";
import { getFirestore } from "firebase-admin/firestore";
import { getOpenAiModel } from "../utils/catalog";
import {
  buildScriptAnalyzerUserMessage,
  getScriptAnalyzerPrompt,
  type ScriptAnalysisMode,
  type ScriptFormat,
  type ScriptIndustry,
} from "../data/scriptAnalyzerPrompts";

export type ScriptAnalyzerScores = {
  premise: number;
  dialogue: number;
  structure: number;
  character: number;
  scene_purpose: number;
  formatting: number;
};

export type ScriptAnalyzerIssue = {
  category: string;
  label: string;
  detail: string;
  fix: string;
};

export type ScriptAnalyzerLineNote = {
  original: string;
  issue: string;
  suggestion: string;
};

export type ScriptAnalyzerResult = {
  pitch_readiness_score: number;
  verdict: string;
  editor_note: string;
  scores: ScriptAnalyzerScores;
  strengths: string[];
  issues: ScriptAnalyzerIssue[];
  line_notes: ScriptAnalyzerLineNote[];
};

export type AnalyzeScriptInput = {
  userId: string;
  userEmail?: string | null;
  industry: ScriptIndustry;
  format: ScriptFormat;
  analysisMode: ScriptAnalysisMode;
  scriptText: string;
  projectId?: string;
  chapterId?: string;
  projectName?: string;
  chapterTitle?: string;
  saveToFirestore?: boolean;
};

const SCORE_WEIGHTS: Record<keyof ScriptAnalyzerScores, number> = {
  premise: 20,
  dialogue: 15,
  structure: 20,
  character: 20,
  scene_purpose: 15,
  formatting: 10,
};

function clampScore(n: unknown): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

export function computeWeightedPitchScore(scores: ScriptAnalyzerScores): number {
  const total =
    scores.premise * SCORE_WEIGHTS.premise +
    scores.dialogue * SCORE_WEIGHTS.dialogue +
    scores.structure * SCORE_WEIGHTS.structure +
    scores.character * SCORE_WEIGHTS.character +
    scores.scene_purpose * SCORE_WEIGHTS.scene_purpose +
    scores.formatting * SCORE_WEIGHTS.formatting;
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function verdictFromScore(score: number): string {
  if (score >= 85) return "PITCH READY";
  if (score >= 70) return "STRONG CONTENDER";
  if (score >= 50) return "REVISE BEFORE PITCHING";
  return "MAJOR REVISION REQUIRED";
}

function normalizeResult(raw: Record<string, unknown>): ScriptAnalyzerResult {
  const rawScores = (raw.scores as Record<string, unknown>) || {};
  const scores: ScriptAnalyzerScores = {
    premise: clampScore(rawScores.premise),
    dialogue: clampScore(rawScores.dialogue),
    structure: clampScore(rawScores.structure),
    character: clampScore(rawScores.character),
    scene_purpose: clampScore(rawScores.scene_purpose),
    formatting: clampScore(rawScores.formatting),
  };

  const pitch_readiness_score = computeWeightedPitchScore(scores);
  const verdict = verdictFromScore(pitch_readiness_score);

  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths.map((s) => String(s)).filter(Boolean)
    : [];

  const issues: ScriptAnalyzerIssue[] = Array.isArray(raw.issues)
    ? raw.issues.map((item: any) => ({
        category: String(item?.category || "general"),
        label: String(item?.label || "Issue"),
        detail: String(item?.detail || ""),
        fix: String(item?.fix || ""),
      }))
    : [];

  const line_notes: ScriptAnalyzerLineNote[] = Array.isArray(raw.line_notes)
    ? raw.line_notes.map((item: any) => ({
        original: String(item?.original || ""),
        issue: String(item?.issue || ""),
        suggestion: String(item?.suggestion || ""),
      }))
    : [];

  return {
    pitch_readiness_score,
    verdict,
    editor_note: String(raw.editor_note || "Analysis complete."),
    scores,
    strengths,
    issues,
    line_notes,
  };
}

export async function analyzeScript(input: AnalyzeScriptInput): Promise<{
  result: ScriptAnalyzerResult;
  analysisId: string | null;
  tokensUsed: number;
  model: string;
}> {
  const scriptText = String(input.scriptText || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\0/g, "")
    .trim();

  if (scriptText.length < 50) {
    throw new Error("Script text is too short. Paste at least a full scene for analysis.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const systemPrompt = await getScriptAnalyzerPrompt(input.industry);
  const userMessage = buildScriptAnalyzerUserMessage({
    industry: input.industry,
    format: input.format,
    analysisMode: input.analysisMode,
    scriptText,
  });

  const model = await getOpenAiModel();
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 2500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const content = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  const result = normalizeResult(parsed);
  const tokensUsed =
    (completion.usage?.total_tokens ?? 0) ||
    (completion.usage?.prompt_tokens ?? 0) + (completion.usage?.completion_tokens ?? 0);

  let analysisId: string | null = null;
  if (input.saveToFirestore !== false) {
    const db = getFirestore();
    const ref = db.collection("scriptAnalyses").doc();
    analysisId = ref.id;
    await ref.set({
      analysisId,
      userId: input.userId,
      scriptId: input.projectId || null,
      chapterId: input.chapterId || null,
      projectName: input.projectName || null,
      chapterTitle: input.chapterTitle || null,
      targetMarket: input.industry,
      format: input.format,
      analysisMode: input.analysisMode,
      result: {
        pitch_readiness_score: result.pitch_readiness_score,
        verdict: result.verdict,
        editor_note: result.editor_note,
        categories: Object.fromEntries(
          Object.entries(result.scores).map(([k, v]) => [k, { score: v, feedback: "" }])
        ),
        scores: result.scores,
        strengths: result.strengths,
        weaknesses: result.issues.map((i) => i.label),
        issues: result.issues,
        line_notes: result.line_notes,
        recommendation: result.verdict,
      },
      tokensUsed,
      model,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    });
  }

  return { result, analysisId, tokensUsed, model };
}
