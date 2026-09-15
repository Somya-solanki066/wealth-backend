import {
  SMART_EDIT_CHECK_NAMES,
  SMART_EDIT_CHECK_WEIGHTS,
  SmartEditCheckName,
} from "../utils/smartEditPrompt";

export type SmartEditSeverity = "none" | "low" | "medium" | "high";

export type SmartEditCheck = {
  name: string;
  score: number;
  severity: SmartEditSeverity;
  issueCount: number;
  original: string;
  suggested: string;
  feedback: string;
};

export type SmartEditStrategy = {
  verdict: string;
  summary: string;
  strengths: string[];
  risks: string[];
  priorityFixes: { order: number; check: string; action: string }[];
  nextPassGoal: string;
};

export type SmartEditResult = {
  overallScore: number;
  scoreBand: string;
  scoreMethod: string;
  checks: SmartEditCheck[];
  strategy: SmartEditStrategy;
  breakdown: { name: string; score: number; weight: number; contribution: number }[];
};

function clampScore(n: unknown, fallback = 70): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function asSeverity(v: unknown, score: number, issueCount: number): SmartEditSeverity {
  const s = String(v || "").toLowerCase();
  if (s === "none" || s === "low" || s === "medium" || s === "high") return s;
  if (score >= 90 && issueCount <= 0) return "none";
  if (score >= 75) return "low";
  if (score >= 55) return "medium";
  return "high";
}

function scoreBand(score: number): string {
  if (score >= 90) return "Publish-ready polish";
  if (score >= 75) return "Strong draft";
  if (score >= 60) return "Needs focused revision";
  if (score >= 40) return "Heavy revision required";
  return "Major rewrite required";
}

function inferScoreFromTextFields(check: Record<string, unknown>): number | null {
  const original = String(check.original || "").trim();
  const suggested = String(check.suggested || "").trim().toLowerCase();
  const feedback = String(check.feedback || "").trim().toLowerCase();
  const looksClean =
    !original ||
    suggested.includes("looks good") ||
    suggested.includes("looks strong") ||
    feedback.includes("no issues") ||
    feedback.includes("no major");
  if (looksClean && !original) return 92;
  if (original && suggested && suggested !== "looks good!") return 68;
  return null;
}

function normalizeCheckName(name: unknown): string {
  const raw = String(name || "").trim();
  const lower = raw.toLowerCase();
  const match = SMART_EDIT_CHECK_NAMES.find((n) => n.toLowerCase() === lower);
  if (match) return match;
  if (lower.includes("grammar")) return "Grammar";
  if (lower.includes("passive")) return "Passive Voice";
  if (lower.includes("filler")) return "Filler Words";
  if (lower.includes("verb")) return "Stronger Verbs";
  if (lower.includes("repet")) return "Repetition";
  if (lower.includes("pac") || lower.includes("flow")) return "Pacing & Flow";
  if (lower.includes("dialog") || lower.includes("dialogue")) return "Dialogue Quality";
  if (lower.includes("plagiar") || lower.includes("original")) return "Plagiarism Check";
  return raw || "Check";
}

function buildFallbackStrategy(checks: SmartEditCheck[], overall: number): SmartEditStrategy {
  const ranked = [...checks].sort((a, b) => a.score - b.score);
  const weakest = ranked.slice(0, 3);
  const strongest = [...checks].sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    verdict: scoreBand(overall),
    summary: `Your Smart Edit score is ${overall}/100 (${scoreBand(overall)}). This score is the equal-weight average of all 8 editing checks, so each weak area pulls the total down and each strong area lifts it. Focus the next pass on the lowest-scoring checks first — that raises the overall score fastest.`,
    strengths: strongest
      .filter((c) => c.score >= 75)
      .map((c) => `${c.name} (${c.score}) — ${c.feedback.slice(0, 120)}`),
    risks: weakest.map(
      (c) => `${c.name} (${c.score}/${c.severity}) — ${c.issueCount} issue(s) flagged`
    ),
    priorityFixes: weakest.map((c, i) => ({
      order: i + 1,
      check: c.name,
      action: c.feedback || `Improve ${c.name.toLowerCase()} using the suggested rewrite.`,
    })),
    nextPassGoal: weakest[0]
      ? `Rewrite the passages under "${weakest[0].name}" first, then re-run Smart Edit to confirm the score moved.`
      : "Polish residual line-level issues, then re-run Smart Edit.",
  };
}

function normalizeStrategy(raw: unknown, checks: SmartEditCheck[], overall: number): SmartEditStrategy {
  const fallback = buildFallbackStrategy(checks, overall);
  if (!raw || typeof raw !== "object") return fallback;
  const s = raw as Record<string, unknown>;

  const strengths = Array.isArray(s.strengths)
    ? s.strengths.map((x) => String(x || "").trim()).filter(Boolean)
    : fallback.strengths;
  const risks = Array.isArray(s.risks)
    ? s.risks.map((x) => String(x || "").trim()).filter(Boolean)
    : fallback.risks;
  const priorityFixes = Array.isArray(s.priorityFixes)
    ? s.priorityFixes
        .map((item, i) => {
          const row = (item || {}) as Record<string, unknown>;
          return {
            order: Number(row.order) || i + 1,
            check: String(row.check || "").trim() || "General",
            action: String(row.action || "").trim(),
          };
        })
        .filter((p) => p.action)
    : fallback.priorityFixes;

  return {
    verdict: String(s.verdict || "").trim() || fallback.verdict,
    summary: String(s.summary || "").trim() || fallback.summary,
    strengths: strengths.length ? strengths : fallback.strengths,
    risks: risks.length ? risks : fallback.risks,
    priorityFixes: priorityFixes.length ? priorityFixes : fallback.priorityFixes,
    nextPassGoal: String(s.nextPassGoal || "").trim() || fallback.nextPassGoal,
  };
}

export function normalizeSmartEditResult(raw: Record<string, unknown>): SmartEditResult {
  const rawChecks = Array.isArray(raw.checks) ? raw.checks : [];
  const byName = new Map<string, Record<string, unknown>>();

  for (const item of rawChecks) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = normalizeCheckName(row.name);
    byName.set(name, row);
  }

  const checks: SmartEditCheck[] = SMART_EDIT_CHECK_NAMES.map((name) => {
    const row = byName.get(name) || {};
    const inferred = inferScoreFromTextFields(row);
    const score = clampScore(
      row.score ?? row.checkScore ?? inferred ?? raw.overallScore ?? 70,
      inferred ?? 70
    );
    const issueCount = Math.max(
      0,
      Math.round(Number(row.issueCount ?? (String(row.original || "").trim() ? 1 : 0)) || 0)
    );
    return {
      name,
      score,
      severity: asSeverity(row.severity, score, issueCount),
      issueCount,
      original: String(row.original || "").trim(),
      suggested: String(row.suggested || "").trim() || (score >= 90 ? "Looks strong — keep this approach." : ""),
      feedback: String(row.feedback || "").trim() || `Scored ${score}/100 for ${name}.`,
    };
  });

  const totalWeight = SMART_EDIT_CHECK_NAMES.reduce(
    (sum, name) => sum + SMART_EDIT_CHECK_WEIGHTS[name],
    0
  );
  const weightedSum = checks.reduce((sum, check) => {
    const weight = SMART_EDIT_CHECK_WEIGHTS[check.name as SmartEditCheckName] || 1;
    return sum + check.score * weight;
  }, 0);
  const overallScore = Math.round(weightedSum / totalWeight);

  const breakdown = checks.map((check) => {
    const weight = SMART_EDIT_CHECK_WEIGHTS[check.name as SmartEditCheckName] || 1;
    return {
      name: check.name,
      score: check.score,
      weight,
      contribution: Math.round((check.score * weight) / totalWeight),
    };
  });

  const strategy = normalizeStrategy(raw.strategy, checks, overallScore);

  // Prefer server-computed average; ignore model overallScore so sticky 85 cannot win
  return {
    overallScore,
    scoreBand: scoreBand(overallScore),
    scoreMethod:
      "Equal-weight average of the 8 check scores (Grammar, Passive Voice, Filler Words, Stronger Verbs, Repetition, Pacing & Flow, Dialogue Quality, Plagiarism Check)",
    checks,
    strategy,
    breakdown,
  };
}
