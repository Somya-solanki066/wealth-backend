/**
 * Provisional Ink2Wealth AI Credit allowances & safety caps.
 * Validate against real provider costs before public launch (brief §4 / §14).
 */

export type CreditPlanKey = "free" | "monthly" | "six_month" | "yearly" | "b2b";

export type CreditAllowance = {
  key: CreditPlanKey;
  /** Credits granted at period start */
  periodCredits: number;
  /** Max credits consumable in a rolling 24h window */
  dailyCap: number;
  /** Period length in days (null = calendar month rolling from grant) */
  periodDays: number | null;
  label: string;
};

export const CREDIT_ALLOWANCES: Record<CreditPlanKey, CreditAllowance> = {
  free: {
    key: "free",
    periodCredits: 3,
    dailyCap: 3,
    periodDays: 30,
    label: "Free",
  },
  monthly: {
    key: "monthly",
    periodCredits: 40,
    dailyCap: 8,
    periodDays: 30,
    label: "Premium Monthly",
  },
  six_month: {
    key: "six_month",
    periodCredits: 240,
    dailyCap: 8,
    periodDays: 180,
    label: "6-Month",
  },
  yearly: {
    key: "yearly",
    periodCredits: 480,
    dailyCap: 8,
    periodDays: 365,
    label: "Yearly",
  },
  b2b: {
    key: "b2b",
    periodCredits: 0,
    dailyCap: 40,
    periodDays: 30,
    label: "B2B / Team",
  },
};

/** Rough USD cost per 1M tokens for auditing (update when pricing changes). */
export const PROVIDER_COST_TABLE = {
  openai: {
    "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
    "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
    "dall-e-3": { perImage: 0.04 },
  },
} as const;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 8;

export function resolveCreditPlanKey(userData?: Record<string, any> | null): CreditPlanKey {
  if (!userData) return "free";
  if (userData.workspaceId || userData.b2bPlan) return "b2b";

  const planId = String(userData.subscriptionPlan || "").toLowerCase();
  const isPremium = userData.isPremium === true;
  const expiry = userData.subscriptionExpiry ? new Date(userData.subscriptionExpiry) : null;
  const expired =
    expiry && !Number.isNaN(expiry.getTime()) ? expiry.getTime() <= Date.now() : false;

  if (!isPremium || expired || !planId || planId === "free" || planId.endsWith("-free")) {
    return "free";
  }

  if (planId.includes("year") || planId.includes("annual") || planId.includes("12")) {
    return "yearly";
  }
  if (planId.includes("6") || planId.includes("six") || planId.includes("180")) {
    return "six_month";
  }
  return "monthly";
}
