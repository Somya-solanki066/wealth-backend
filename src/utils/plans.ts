import { getFirestore } from "firebase-admin/firestore";

export type PlanFeature = { name: string; included: boolean };

export type PlanWorld = "writer" | "screenwriter" | "student";

export type BillingPlan = {
  id: string;
  world: PlanWorld;
  name: string;
  price: string;
  priceAmount: number;
  currency: string;
  durationDays: number;
  period: string;
  badge: string;
  discount: string;
  cta: string;
  type: "free" | "monthly" | "yearly";
  isFree: boolean;
  stripePriceId: string;
  revenueCatId: string;
  unlimitedAnalyzer: boolean;
  unlimitedSmartEdit: boolean;
  ghostWriter: boolean;
  wealthEngine: boolean;
  features: PlanFeature[];
};

export type GlobalSettings = {
  aiAnalyzerFreeLimit: number;
  smartEditFreeLimit: number;
  plans: BillingPlan[];
};

export const PLAN_WORLDS: PlanWorld[] = ["writer", "screenwriter", "student"];

export function isPlanWorld(value: unknown): value is PlanWorld {
  return value === "writer" || value === "screenwriter" || value === "student";
}

const WRITER_PLANS: BillingPlan[] = [
  {
    id: "free",
    world: "writer",
    name: "FREE",
    price: "₦0",
    priceAmount: 0,
    currency: "ngn",
    durationDays: 0,
    period: "Forever free",
    badge: "",
    discount: "",
    cta: "Start Free",
    type: "free",
    isFree: true,
    stripePriceId: "",
    revenueCatId: "",
    unlimitedAnalyzer: false,
    unlimitedSmartEdit: false,
    ghostWriter: false,
    wealthEngine: false,
    features: [
      { name: "3 chapter analyses per month", included: true },
      { name: "Novel Editor — unlimited", included: true },
      { name: "3 Smart Edit checks free", included: true },
      { name: "Writing Vault — browse all prompts", included: true },
      { name: "AI Ghost Writer", included: false },
      { name: "Book Cover Generator", included: false },
    ],
  },
  {
    id: "6-month",
    world: "writer",
    name: "6-MONTH",
    price: "₦24,900",
    priceAmount: 24900,
    currency: "ngn",
    durationDays: 180,
    period: "every 6 months · Save 40%",
    badge: "BEST VALUE",
    discount: "Save 40% vs monthly",
    cta: "Get 6-Month Access",
    type: "yearly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "six_month_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: true,
    wealthEngine: true,
    features: [
      { name: "Unlimited chapter analysis — all 9 platforms", included: true },
      { name: "AI Ghost Writer — unlimited", included: true },
      { name: "All 10 Smart Edit checks", included: true },
      { name: "Book Cover Generator — unlimited", included: true },
      { name: "Full WEALTH Engine", included: true },
      { name: "Priority support", included: true },
    ],
  },
  {
    id: "yearly",
    world: "writer",
    name: "YEARLY",
    price: "₦49,900",
    priceAmount: 49900,
    currency: "ngn",
    durationDays: 365,
    period: "per year · Save 60%",
    badge: "",
    discount: "Save 60% — maximum value",
    cta: "Get Yearly Access",
    type: "yearly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "yearly_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: true,
    wealthEngine: true,
    features: [
      { name: "Everything in 6-Month", included: true },
      { name: "Early access to new features", included: true },
      { name: "WIT-WEB Academy discount", included: true },
      { name: "Founding member badge", included: true },
      { name: "1 free coaching session", included: true },
    ],
  },
  {
    id: "monthly",
    world: "writer",
    name: "MONTHLY",
    price: "₦6,900",
    priceAmount: 6900,
    currency: "ngn",
    durationDays: 30,
    period: "per month",
    badge: "",
    discount: "Cancel anytime",
    cta: "Get Monthly Access",
    type: "monthly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "monthly_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: true,
    wealthEngine: true,
    features: [
      { name: "Unlimited chapter analysis — all 9 platforms", included: true },
      { name: "AI Ghost Writer — unlimited", included: true },
      { name: "All 10 Smart Edit checks", included: true },
      { name: "Book Cover Generator — unlimited", included: true },
      { name: "Full WEALTH Engine", included: true },
      { name: "Cancel anytime", included: true },
    ],
  },
];

const SCREENWRITER_PLANS: BillingPlan[] = [
  {
    id: "screenwriter-free",
    world: "screenwriter",
    name: "FREE",
    price: "₦0",
    priceAmount: 0,
    currency: "ngn",
    durationDays: 0,
    period: "Forever free",
    badge: "",
    discount: "",
    cta: "Start Free",
    type: "free",
    isFree: true,
    stripePriceId: "",
    revenueCatId: "",
    unlimitedAnalyzer: false,
    unlimitedSmartEdit: false,
    ghostWriter: false,
    wealthEngine: false,
    features: [
      { name: "Script Editor — unlimited", included: true },
      { name: "3 Open Calls per day", included: true },
      { name: "Community access", included: true },
      { name: "Public screenwriter profile", included: true },
      { name: "Script Marketplace", included: false },
      { name: "Short Film Showcase", included: false },
    ],
  },
  {
    id: "screenwriter-6-month",
    world: "screenwriter",
    name: "6-MONTH",
    price: "₦24,900",
    priceAmount: 24900,
    currency: "ngn",
    durationDays: 180,
    period: "every 6 months",
    badge: "BEST VALUE",
    discount: "",
    cta: "Get 6-Month Access",
    type: "yearly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "screenwriter_six_month_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: true,
    wealthEngine: true,
    features: [
      { name: "Unlimited Open Calls access", included: true },
      { name: "Script Marketplace — sell scripts", included: true },
      { name: "Short Film Showcase — pitch films", included: true },
      { name: "Pitch Deck and Query Builder", included: true },
      { name: "Book a Call with producers", included: true },
      { name: "Verified Pro badge", included: true },
    ],
  },
  {
    id: "screenwriter-yearly",
    world: "screenwriter",
    name: "YEARLY",
    price: "₦49,900",
    priceAmount: 49900,
    currency: "ngn",
    durationDays: 365,
    period: "per year · Save 60%",
    badge: "",
    discount: "Save 60%",
    cta: "Get Yearly Access",
    type: "yearly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "screenwriter_yearly_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: true,
    wealthEngine: true,
    features: [
      { name: "Everything in 6-Month", included: true },
      { name: "SSG Blueprint discount", included: true },
      { name: "Priority open calls — 24hr early access", included: true },
      { name: "1 free coaching session", included: true },
      { name: "Featured profile placement", included: true },
    ],
  },
];

const STUDENT_PLANS: BillingPlan[] = [
  {
    id: "student-free",
    world: "student",
    name: "FREE",
    price: "₦0",
    priceAmount: 0,
    currency: "ngn",
    durationDays: 0,
    period: "No account needed to start",
    badge: "",
    discount: "",
    cta: "Start Studying Free",
    type: "free",
    isFree: true,
    stripePriceId: "",
    revenueCatId: "",
    unlimitedAnalyzer: false,
    unlimitedSmartEdit: false,
    ghostWriter: false,
    wealthEngine: false,
    features: [
      { name: "3 years of past questions per course", included: true },
      { name: "JAMB practice — 5 years free", included: true },
      { name: "Smart analytics and weak areas", included: true },
      { name: "Daily challenge question", included: true },
      { name: "Drug Calculator for nurses", included: true },
      { name: "Full 25-year JAMB archive", included: false },
    ],
  },
  {
    id: "student-6-month",
    world: "student",
    name: "6-MONTH",
    price: "₦24,900",
    priceAmount: 24900,
    currency: "ngn",
    durationDays: 180,
    period: "every 6 months · Save 40%",
    badge: "MOST POPULAR",
    discount: "Save 40%",
    cta: "Get Full Access",
    type: "yearly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "student_six_month_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: false,
    wealthEngine: false,
    features: [
      { name: "Full 25-year JAMB archive — all subjects", included: true },
      { name: "All university past questions — all years", included: true },
      { name: "All professional courses — full access", included: true },
      { name: "Unlimited CBT simulations", included: true },
      { name: "AI explanations for every answer", included: true },
      { name: "Offline practice mode", included: true },
    ],
  },
  {
    id: "student-yearly",
    world: "student",
    name: "YEARLY",
    price: "₦49,900",
    priceAmount: 49900,
    currency: "ngn",
    durationDays: 365,
    period: "per year · Maximum value",
    badge: "",
    discount: "Maximum value",
    cta: "Get Yearly Access",
    type: "yearly",
    isFree: false,
    stripePriceId: "",
    revenueCatId: "student_yearly_sub",
    unlimitedAnalyzer: true,
    unlimitedSmartEdit: true,
    ghostWriter: false,
    wealthEngine: false,
    features: [
      { name: "Everything in 6-Month", included: true },
      { name: "NCLEX preparation (nurses going abroad)", included: true },
      { name: "New questions added weekly", included: true },
      { name: "Priority new university additions", included: true },
      { name: "WIT-WEB and SSG course discount", included: true },
    ],
  },
];

export const DEFAULT_SETTINGS: GlobalSettings = {
  aiAnalyzerFreeLimit: 3,
  smartEditFreeLimit: 3,
  plans: [...WRITER_PLANS, ...SCREENWRITER_PLANS, ...STUDENT_PLANS],
};

export function parsePriceAmount(price: string | number | undefined): number {
  if (typeof price === "number" && Number.isFinite(price)) return Math.max(0, Math.round(price));
  if (!price) return 0;
  const digits = String(price).replace(/[^\d.]/g, "");
  const value = parseFloat(digits);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function formatPriceDisplay(amount: number, currency = "ngn"): string {
  if (!amount) return currency.toLowerCase() === "ngn" ? "₦0" : "0";
  const formatted = amount.toLocaleString("en-NG");
  return currency.toLowerCase() === "ngn" ? `₦${formatted}` : formatted;
}

export function isFreePlan(plan: Partial<BillingPlan> | undefined): boolean {
  if (!plan) return false;
  if (plan.isFree === true) return true;
  if (plan.type === "free") return true;
  const id = String(plan.id || "");
  if (id === "free" || id === "plan_free" || id.endsWith("-free")) return true;
  if (typeof plan.priceAmount === "number" && plan.priceAmount === 0) return true;
  return false;
}

function inferWorld(raw: any, id: string): PlanWorld {
  if (isPlanWorld(raw?.world)) return raw.world;
  if (id.startsWith("screenwriter")) return "screenwriter";
  if (id.startsWith("student")) return "student";
  if (id.startsWith("writer")) return "writer";
  return "writer";
}

export function normalizePlan(raw: any, index = 0): BillingPlan {
  const id = String(raw?.id || `plan_${index + 1}`);
  const priceAmount =
    typeof raw?.priceAmount === "number" ? raw.priceAmount : parsePriceAmount(raw?.price);
  const isFree = isFreePlan({ ...raw, id, priceAmount });
  const currency = String(raw?.currency || "ngn").toLowerCase();
  const parsedDuration = Number(raw?.durationDays);
  const durationDays =
    Number.isFinite(parsedDuration) && parsedDuration >= 0
      ? parsedDuration
      : isFree
        ? 0
        : id.includes("6-month") || String(raw?.period || "").includes("6")
          ? 180
          : raw?.type === "monthly"
            ? 30
            : 365;
  const features: PlanFeature[] = Array.isArray(raw?.features)
    ? raw.features.map((f: any) =>
        typeof f === "string"
          ? { name: f, included: true }
          : { name: String(f?.name || "Feature"), included: f?.included !== false }
      )
    : [];

  const world = inferWorld(raw, id);
  const defaultCta = isFree
    ? world === "student"
      ? "Start Studying Free"
      : "Start Free"
    : id.includes("6-month")
      ? world === "student"
        ? "Get Full Access"
        : "Get 6-Month Access"
      : "Get Yearly Access";

  return {
    id,
    world,
    name: String(raw?.name || "Untitled Plan"),
    price: raw?.price ? String(raw.price) : formatPriceDisplay(priceAmount, currency),
    priceAmount: isFree ? 0 : priceAmount,
    currency,
    durationDays,
    period: String(raw?.period || (isFree ? "Forever free" : "per year")),
    badge: String(raw?.badge || ""),
    discount: String(raw?.discount || ""),
    cta: String(raw?.cta || defaultCta),
    type: isFree ? "free" : raw?.type === "monthly" ? "monthly" : "yearly",
    isFree,
    stripePriceId: String(raw?.stripePriceId || ""),
    revenueCatId: String(raw?.revenueCatId || ""),
    unlimitedAnalyzer: raw?.unlimitedAnalyzer === true || (!isFree && raw?.unlimitedAnalyzer !== false),
    unlimitedSmartEdit: raw?.unlimitedSmartEdit === true || (!isFree && raw?.unlimitedSmartEdit !== false),
    ghostWriter: raw?.ghostWriter === true,
    wealthEngine: raw?.wealthEngine === true,
    features,
  };
}

export function normalizeSettings(raw: any): GlobalSettings {
  const plans =
    Array.isArray(raw?.plans) && raw.plans.length > 0
      ? raw.plans.map((plan: any, i: number) => normalizePlan(plan, i))
      : DEFAULT_SETTINGS.plans;

  return {
    aiAnalyzerFreeLimit: Number(raw?.aiAnalyzerFreeLimit) || DEFAULT_SETTINGS.aiAnalyzerFreeLimit,
    smartEditFreeLimit: Number(raw?.smartEditFreeLimit) || DEFAULT_SETTINGS.smartEditFreeLimit,
    plans,
  };
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const db = getFirestore();
  const snap = await db.collection("settings").doc("global").get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  return normalizeSettings(snap.data());
}

export async function getPlanById(planId: string): Promise<BillingPlan | null> {
  const settings = await getGlobalSettings();
  return settings.plans.find((plan) => plan.id === planId) || null;
}

export function getPlansForWorld(settings: GlobalSettings, world: PlanWorld): BillingPlan[] {
  return settings.plans.filter((plan) => plan.world === world);
}

export function isUserPremium(data?: Record<string, any> | null): boolean {
  if (!data) return false;
  const expiry = data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null;
  if (expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) {
    return false;
  }
  if (data.isPremium === true) return true;
  const plan = String(data.subscriptionPlan || "");
  return Boolean(plan) && plan !== "free" && !plan.endsWith("-free") && plan !== "None" && plan !== "none";
}

export function subscriptionFieldsForPlan(
  plan: BillingPlan,
  source: "stripe" | "admin" | "select-plan"
) {
  const now = new Date();
  const expiry =
    plan.isFree || plan.durationDays <= 0
      ? null
      : new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  return {
    subscriptionPlan: plan.id,
    isPremium: !plan.isFree,
    subscriptionDate: now.toISOString(),
    subscriptionExpiry: expiry ? expiry.toISOString() : null,
    subscriptionSource: source,
    subscriptionWorld: plan.world,
  };
}

export function revokeSubscriptionFields() {
  return {
    subscriptionPlan: "free",
    isPremium: false,
    subscriptionExpiry: new Date().toISOString(),
    subscriptionSource: "admin_revoke",
  };
}

export function toStripeUnitAmount(priceAmount: number): number {
  return Math.max(0, Math.round(priceAmount * 100));
}
