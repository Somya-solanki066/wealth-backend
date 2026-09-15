import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import {
  CREDIT_ALLOWANCES,
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  PROVIDER_COST_TABLE,
  RATE_LIMIT_WINDOW_MS,
  resolveCreditPlanKey,
  type CreditPlanKey,
} from "../utils/aiCreditsConfig";
import {
  getAiFeature,
  getCreditCost,
  type AiToolId,
  type AiWorld,
} from "../utils/aiFeatureInventory";

const WALLET_COL = "ai_credits";
const LEDGER_COL = "ai_credit_ledger";
const RATE_COL = "ai_rate_limits";

export type AiCreditWallet = {
  userId: string;
  balance: number;
  periodAllowance: number;
  periodStart: string;
  periodEnd: string;
  planKey: CreditPlanKey;
  creditsUsedToday: number;
  dayKey: string;
  lifetimeGranted: number;
  lifetimeSpent: number;
  welcomeGranted: boolean;
  freeToolUsage: Record<string, number>;
  workspaceId?: string | null;
  updatedAt: string;
};

export type CreditReservation = {
  requestId: string;
  userId: string;
  toolId: string;
  world: AiWorld | string;
  creditsCharged: number;
  balanceAfter: number;
};

export type LedgerStatus = "reserved" | "success" | "failed" | "refunded";

function dayKeyUtc(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function addDays(isoOrDate: string | Date, days: number) {
  const d = new Date(isoOrDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function emptyWallet(userId: string, planKey: CreditPlanKey): AiCreditWallet {
  const allowance = CREDIT_ALLOWANCES[planKey];
  const start = new Date().toISOString();
  const periodDays = allowance.periodDays || 30;
  return {
    userId,
    balance: 0,
    periodAllowance: allowance.periodCredits,
    periodStart: start,
    periodEnd: addDays(start, periodDays),
    planKey,
    creditsUsedToday: 0,
    dayKey: dayKeyUtc(),
    lifetimeGranted: 0,
    lifetimeSpent: 0,
    welcomeGranted: false,
    freeToolUsage: {},
    workspaceId: null,
    updatedAt: start,
  };
}

export function estimateProviderCostUsd(opts: {
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  imageUnits?: number;
}): number {
  const model = String(opts.model || "gpt-4o-mini");
  const provider = String(opts.provider || "openai");
  if (provider === "openai" && (model.includes("dall-e") || (opts.imageUnits || 0) > 0)) {
    const per = PROVIDER_COST_TABLE.openai["dall-e-3"].perImage;
    return Number(((opts.imageUnits || 1) * per).toFixed(6));
  }
  const table =
    (PROVIDER_COST_TABLE.openai as Record<string, { inputPer1M?: number; outputPer1M?: number }>)[
      model
    ] || PROVIDER_COST_TABLE.openai["gpt-4o-mini"];
  const inCost = ((opts.promptTokens || 0) / 1_000_000) * (table.inputPer1M || 0);
  const outCost = ((opts.completionTokens || 0) / 1_000_000) * (table.outputPer1M || 0);
  return Number((inCost + outCost).toFixed(6));
}

async function loadUserData(userId: string) {
  const db = getFirestore();
  const snap = await db.collection("users").doc(userId).get();
  return snap.exists ? snap.data() || {} : {};
}

export async function getCreditWallet(userId: string): Promise<AiCreditWallet> {
  const db = getFirestore();
  const ref = db.collection(WALLET_COL).doc(userId);
  const snap = await ref.get();
  const userData = await loadUserData(userId);
  const planKey = resolveCreditPlanKey(userData);

  if (!snap.exists) {
    const wallet = emptyWallet(userId, planKey);
    await ref.set(wallet);
    return wallet;
  }

  let wallet = { ...emptyWallet(userId, planKey), ...(snap.data() as AiCreditWallet), userId };
  const now = Date.now();
  const periodEnd = new Date(wallet.periodEnd).getTime();
  const today = dayKeyUtc();

  // Roll daily counter
  if (wallet.dayKey !== today) {
    wallet.creditsUsedToday = 0;
    wallet.dayKey = today;
  }

  // Period expired → refill for current plan
  if (!Number.isFinite(periodEnd) || periodEnd <= now || wallet.planKey !== planKey) {
    wallet = await refillWalletForPlan(userId, planKey, wallet);
  } else {
    await ref.set(
      {
        creditsUsedToday: wallet.creditsUsedToday,
        dayKey: wallet.dayKey,
        planKey,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    wallet.planKey = planKey;
  }

  return wallet;
}

async function refillWalletForPlan(
  userId: string,
  planKey: CreditPlanKey,
  prev?: AiCreditWallet
): Promise<AiCreditWallet> {
  const db = getFirestore();
  const allowance = CREDIT_ALLOWANCES[planKey];
  const start = new Date().toISOString();
  const periodDays = allowance.periodDays || 30;
  const granted = allowance.periodCredits;
  const wallet: AiCreditWallet = {
    userId,
    balance: granted,
    periodAllowance: granted,
    periodStart: start,
    periodEnd: addDays(start, periodDays),
    planKey,
    creditsUsedToday: 0,
    dayKey: dayKeyUtc(),
    lifetimeGranted: Number(prev?.lifetimeGranted || 0) + granted,
    lifetimeSpent: Number(prev?.lifetimeSpent || 0),
    welcomeGranted: Boolean(prev?.welcomeGranted),
    freeToolUsage: {},
    workspaceId: prev?.workspaceId || null,
    updatedAt: start,
  };
  await db.collection(WALLET_COL).doc(userId).set(wallet, { merge: true });
  await db.collection(LEDGER_COL).add({
    requestId: `grant_${randomUUID()}`,
    userId,
    workspaceId: wallet.workspaceId || null,
    world: null,
    tool: null,
    operation: "period_refill",
    provider: null,
    model: null,
    input_tokens: 0,
    output_tokens: 0,
    image_units: 0,
    provider_cost: 0,
    credits_charged: -granted,
    credits_delta: granted,
    balance_after: granted,
    status: "success",
    created_at: new Date().toISOString(),
  });
  return wallet;
}

/** Welcome / first-touch: ensure free period credits once for new accounts */
export async function ensureWelcomeCredits(userId: string): Promise<AiCreditWallet> {
  const db = getFirestore();
  const ref = db.collection(WALLET_COL).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) {
    const wallet = await refillWalletForPlan(userId, "free");
    await ref.set({ welcomeGranted: true }, { merge: true });
    return { ...wallet, welcomeGranted: true };
  }
  const data = snap.data() as AiCreditWallet;
  if (!data.welcomeGranted && Number(data.lifetimeGranted || 0) === 0) {
    const wallet = await refillWalletForPlan(userId, resolveCreditPlanKey(await loadUserData(userId)), data);
    await ref.set({ welcomeGranted: true }, { merge: true });
    return { ...wallet, welcomeGranted: true };
  }
  return getCreditWallet(userId);
}

/** Call when subscription plan changes — refill to plan allowance */
export async function syncCreditsForPlanChange(userId: string): Promise<AiCreditWallet> {
  const userData = await loadUserData(userId);
  const planKey = resolveCreditPlanKey(userData);
  const prev = await getCreditWallet(userId).catch(() => emptyWallet(userId, planKey));
  return refillWalletForPlan(userId, planKey, prev);
}

async function checkRateLimit(userId: string, toolId: string, limitPerMin: number) {
  const db = getFirestore();
  const key = `${userId}_${toolId}`;
  const ref = db.collection(RATE_COL).doc(key);
  const snap = await ref.get();
  const now = Date.now();
  const data = snap.data() || {};
  const windowStart = Number(data.windowStart || 0);
  let count = Number(data.count || 0);
  if (!windowStart || now - windowStart > RATE_LIMIT_WINDOW_MS) {
    await ref.set({ windowStart: now, count: 1, updatedAt: new Date().toISOString() });
    return { ok: true as const };
  }
  if (count >= limitPerMin) {
    return { ok: false as const, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - windowStart) };
  }
  await ref.set({ count: count + 1, updatedAt: new Date().toISOString() }, { merge: true });
  return { ok: true as const };
}

export type ChargeFailure = {
  ok: false;
  status: number;
  code:
    | "insufficient_credits"
    | "daily_cap"
    | "rate_limit"
    | "free_tool_limit"
    | "tool_unknown"
    | "input_too_large";
  error: string;
  creditsRequired?: number;
  balance?: number;
  dailyRemaining?: number;
};

export type ChargeSuccess = {
  ok: true;
  reservation: CreditReservation;
  wallet: AiCreditWallet;
  featureCreditCost: number;
};

/**
 * Charge credits BEFORE expensive AI work. Refund via refundAiCredits on failure.
 */
export async function chargeAiCredits(opts: {
  userId: string;
  toolId: AiToolId | string;
  operation?: string;
  inputChars?: number;
  workspaceId?: string | null;
}): Promise<ChargeSuccess | ChargeFailure> {
  const feature = getAiFeature(opts.toolId);
  if (!feature) {
    return { ok: false, status: 400, code: "tool_unknown", error: "Unknown AI tool." };
  }

  if (feature.maxInputChars && opts.inputChars && opts.inputChars > feature.maxInputChars) {
    return {
      ok: false,
      status: 400,
      code: "input_too_large",
      error: `Input too large for ${feature.name}. Max ~${feature.maxInputChars} characters.`,
    };
  }

  const rate = await checkRateLimit(
    opts.userId,
    feature.id,
    feature.dailyRateLimitPerMinute || DEFAULT_RATE_LIMIT_PER_MINUTE
  );
  if (!rate.ok) {
    return {
      ok: false,
      status: 429,
      code: "rate_limit",
      error: "Too many AI requests. Please wait a moment and try again.",
    };
  }

  await ensureWelcomeCredits(opts.userId);
  const db = getFirestore();
  const ref = db.collection(WALLET_COL).doc(opts.userId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const userSnap = await tx.get(db.collection("users").doc(opts.userId));
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const planKey = resolveCreditPlanKey(userData);
    const allowance = CREDIT_ALLOWANCES[planKey];

    let wallet: AiCreditWallet = snap.exists
      ? ({ ...emptyWallet(opts.userId, planKey), ...(snap.data() as object) } as AiCreditWallet)
      : emptyWallet(opts.userId, planKey);

    const today = dayKeyUtc();
    if (wallet.dayKey !== today) {
      wallet.creditsUsedToday = 0;
      wallet.dayKey = today;
    }

    const now = Date.now();
    if (new Date(wallet.periodEnd).getTime() <= now || wallet.planKey !== planKey) {
      const periodDays = allowance.periodDays || 30;
      const start = new Date().toISOString();
      wallet = {
        ...wallet,
        balance: allowance.periodCredits,
        periodAllowance: allowance.periodCredits,
        periodStart: start,
        periodEnd: addDays(start, periodDays),
        planKey,
        creditsUsedToday: 0,
        dayKey: today,
        lifetimeGranted: Number(wallet.lifetimeGranted || 0) + allowance.periodCredits,
        freeToolUsage: {},
        updatedAt: start,
      };
    }

    const cost = getCreditCost(feature.id);
    const freeUsed = Number(wallet.freeToolUsage?.[feature.id] || 0);
    if (
      planKey === "free" &&
      typeof feature.freeMaxPerPeriod === "number" &&
      freeUsed >= feature.freeMaxPerPeriod
    ) {
      return {
        ok: false as const,
        status: 403,
        code: "free_tool_limit" as const,
        error: `${feature.name} is limited on the free plan. Upgrade for more access.`,
        creditsRequired: cost,
        balance: wallet.balance,
      };
    }

    const dailyRemaining = Math.max(0, allowance.dailyCap - Number(wallet.creditsUsedToday || 0));
    if (cost > dailyRemaining) {
      return {
        ok: false as const,
        status: 429,
        code: "daily_cap" as const,
        error: `Daily AI credit cap reached (${allowance.dailyCap}/day). Try again tomorrow or upgrade.`,
        creditsRequired: cost,
        balance: wallet.balance,
        dailyRemaining,
      };
    }

    if (wallet.balance < cost) {
      return {
        ok: false as const,
        status: 403,
        code: "insufficient_credits" as const,
        error: `Not enough AI Credits. This tool costs ${cost} credit${cost === 1 ? "" : "s"}; you have ${wallet.balance}.`,
        creditsRequired: cost,
        balance: wallet.balance,
        dailyRemaining,
      };
    }

    const requestId = randomUUID();
    const balanceAfter = wallet.balance - cost;
    const nextFree = { ...(wallet.freeToolUsage || {}) };
    if (planKey === "free" && typeof feature.freeMaxPerPeriod === "number") {
      nextFree[feature.id] = freeUsed + 1;
    }

    const updated: AiCreditWallet = {
      ...wallet,
      balance: balanceAfter,
      creditsUsedToday: Number(wallet.creditsUsedToday || 0) + cost,
      lifetimeSpent: Number(wallet.lifetimeSpent || 0) + cost,
      freeToolUsage: nextFree,
      updatedAt: new Date().toISOString(),
    };

    tx.set(ref, updated, { merge: true });

    const ledgerRef = db.collection(LEDGER_COL).doc(requestId);
    tx.set(ledgerRef, {
      request_id: requestId,
      user_id: opts.userId,
      workspace_id: opts.workspaceId || wallet.workspaceId || null,
      world: feature.world,
      tool: feature.id,
      operation: opts.operation || feature.id,
      provider: feature.provider,
      model: null,
      input_tokens: 0,
      output_tokens: 0,
      image_units: 0,
      provider_cost: 0,
      credits_charged: cost,
      credits_delta: -cost,
      balance_after: balanceAfter,
      status: "reserved" as LedgerStatus,
      created_at: new Date().toISOString(),
    });

    return {
      ok: true as const,
      reservation: {
        requestId,
        userId: opts.userId,
        toolId: feature.id,
        world: feature.world,
        creditsCharged: cost,
        balanceAfter,
      },
      wallet: updated,
      featureCreditCost: cost,
    };
  });
}

export async function finalizeAiCredits(opts: {
  requestId: string;
  userId: string;
  status: "success" | "failed";
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  imageUnits?: number;
  errorMessage?: string;
}): Promise<void> {
  const db = getFirestore();
  const ledgerRef = db.collection(LEDGER_COL).doc(opts.requestId);
  const snap = await ledgerRef.get();
  if (!snap.exists) return;

  const data = snap.data() || {};
  if (opts.status === "failed") {
    await refundAiCredits({
      requestId: opts.requestId,
      userId: opts.userId,
      reason: opts.errorMessage || "job_failed",
    });
    return;
  }

  const providerCost = estimateProviderCostUsd({
    provider: opts.provider || data.provider,
    model: opts.model || undefined,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    imageUnits: opts.imageUnits,
  });

  await ledgerRef.set(
    {
      status: "success",
      provider: opts.provider || data.provider || "openai",
      model: opts.model || null,
      input_tokens: opts.promptTokens || 0,
      output_tokens: opts.completionTokens || 0,
      image_units: opts.imageUnits || 0,
      provider_cost: providerCost,
      finalized_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function refundAiCredits(opts: {
  requestId: string;
  userId: string;
  reason?: string;
}): Promise<void> {
  const db = getFirestore();
  const ledgerRef = db.collection(LEDGER_COL).doc(opts.requestId);
  const walletRef = db.collection(WALLET_COL).doc(opts.userId);

  await db.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef);
    if (!ledgerSnap.exists) return;
    const ledger = ledgerSnap.data() || {};
    if (ledger.status === "refunded" || ledger.status === "failed") return;

    const charged = Number(ledger.credits_charged || 0);
    if (charged <= 0) {
      tx.set(ledgerRef, { status: "failed", error: opts.reason || null }, { merge: true });
      return;
    }

    const walletSnap = await tx.get(walletRef);
    const wallet = (walletSnap.data() || {}) as AiCreditWallet;
    const balance = Number(wallet.balance || 0) + charged;
    const usedToday = Math.max(0, Number(wallet.creditsUsedToday || 0) - charged);
    const lifetimeSpent = Math.max(0, Number(wallet.lifetimeSpent || 0) - charged);

    tx.set(
      walletRef,
      {
        balance,
        creditsUsedToday: usedToday,
        lifetimeSpent,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    tx.set(
      ledgerRef,
      {
        status: "refunded",
        refund_reason: opts.reason || "job_failed",
        balance_after: balance,
        refunded_at: new Date().toISOString(),
      },
      { merge: true }
    );
  });
}

export async function getPublicCreditSummary(userId: string) {
  const wallet = await ensureWelcomeCredits(userId);
  const allowance = CREDIT_ALLOWANCES[wallet.planKey];
  return {
    balance: wallet.balance,
    periodAllowance: wallet.periodAllowance,
    periodStart: wallet.periodStart,
    periodEnd: wallet.periodEnd,
    planKey: wallet.planKey,
    planLabel: allowance.label,
    dailyCap: allowance.dailyCap,
    dailyUsed: wallet.creditsUsedToday,
    dailyRemaining: Math.max(0, allowance.dailyCap - wallet.creditsUsedToday),
    /** Customers see Ink2Wealth Credits only — no provider token economics */
    displayName: "Ink2Wealth AI Credits",
  };
}

export async function adminCreditMetrics(opts?: { days?: number }) {
  const db = getFirestore();
  const days = opts?.days || 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const snap = await db
    .collection(LEDGER_COL)
    .where("created_at", ">=", since.toISOString())
    .limit(5000)
    .get();

  let totalCost = 0;
  let totalCredits = 0;
  let success = 0;
  let failed = 0;
  const byTool: Record<string, { count: number; cost: number; credits: number }> = {};
  const byProvider: Record<string, { count: number; cost: number }> = {};
  const byUser: Record<string, { cost: number; credits: number }> = {};

  snap.docs.forEach((d) => {
    const row = d.data() || {};
    if (row.status === "reserved") return;
    const cost = Number(row.provider_cost || 0);
    const credits = Number(row.credits_charged || 0);
    if (row.status === "success") {
      success += 1;
      totalCost += cost;
      totalCredits += credits;
      const tool = String(row.tool || "unknown");
      const provider = String(row.provider || "unknown");
      const userId = String(row.user_id || "unknown");
      byTool[tool] = byTool[tool] || { count: 0, cost: 0, credits: 0 };
      byTool[tool].count += 1;
      byTool[tool].cost += cost;
      byTool[tool].credits += credits;
      byProvider[provider] = byProvider[provider] || { count: 0, cost: 0 };
      byProvider[provider].count += 1;
      byProvider[provider].cost += cost;
      byUser[userId] = byUser[userId] || { cost: 0, credits: 0 };
      byUser[userId].cost += cost;
      byUser[userId].credits += credits;
    } else if (row.status === "failed" || row.status === "refunded") {
      failed += 1;
    }
  });

  const userCosts = Object.values(byUser).map((u) => u.cost).sort((a, b) => a - b);
  const p95 =
    userCosts.length > 0 ? userCosts[Math.min(userCosts.length - 1, Math.floor(userCosts.length * 0.95))] : 0;

  return {
    days,
    totalProviderCostUsd: Number(totalCost.toFixed(4)),
    totalCreditsCharged: totalCredits,
    successCount: success,
    failedOrRefunded: failed,
    costByTool: byTool,
    costByProvider: byProvider,
    activeUsers: Object.keys(byUser).length,
    avgCostPerActiveUser: Object.keys(byUser).length
      ? Number((totalCost / Object.keys(byUser).length).toFixed(4))
      : 0,
    p95UserCostUsd: Number(p95.toFixed(4)),
    maxUserCostUsd: userCosts.length ? Number(userCosts[userCosts.length - 1].toFixed(4)) : 0,
  };
}

/** Express-friendly error body for paywalls */
export function creditErrorBody(failure: ChargeFailure) {
  return {
    error: failure.error,
    code: failure.code,
    creditsRequired: failure.creditsRequired,
    balance: failure.balance,
    dailyRemaining: failure.dailyRemaining,
    creditsExhausted: failure.code === "insufficient_credits" || failure.code === "daily_cap",
    limitExceeded: true,
    upgradeSuggested: failure.code === "insufficient_credits" || failure.code === "free_tool_limit",
  };
}
