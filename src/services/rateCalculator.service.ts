import { getFirestore } from "firebase-admin/firestore";

const DOC = "rateCalculator";

export type RateCalculatorSettings = {
  currency: string;
  perWord: {
    rate: number;
    minWords: number;
    maxWords: number;
  };
  perProject: Array<{ id: string; name: string; rate: number }>;
  retainer: Array<{ id: string; name: string; quantity: string; monthlyRate: number }>;
  updatedAt?: string;
};

export const DEFAULT_RATE_SETTINGS: RateCalculatorSettings = {
  currency: "USD",
  perWord: {
    rate: 0.08,
    minWords: 500,
    maxWords: 10000,
  },
  perProject: [
    { id: "blog", name: "Blog Article", rate: 120 },
    { id: "social", name: "Social Media Package", rate: 80 },
    { id: "newsletter", name: "Newsletter", rate: 75 },
    { id: "ugc", name: "UGC Script", rate: 100 },
    { id: "website", name: "Website Copy", rate: 250 },
  ],
  retainer: [
    { id: "starter", name: "Starter", quantity: "4 articles/month", monthlyRate: 400 },
    { id: "growth", name: "Growth", quantity: "8 articles/month", monthlyRate: 750 },
    { id: "pro", name: "Pro", quantity: "12 articles/month", monthlyRate: 1050 },
  ],
};

export async function getRateCalculatorSettings(): Promise<RateCalculatorSettings> {
  const snap = await getFirestore().collection("settings").doc(DOC).get();
  if (!snap.exists) return { ...DEFAULT_RATE_SETTINGS };
  const data = snap.data() || {};
  return {
    currency: String(data.currency || DEFAULT_RATE_SETTINGS.currency),
    perWord: {
      rate: Number(data.perWord?.rate ?? DEFAULT_RATE_SETTINGS.perWord.rate),
      minWords: Number(data.perWord?.minWords ?? DEFAULT_RATE_SETTINGS.perWord.minWords),
      maxWords: Number(data.perWord?.maxWords ?? DEFAULT_RATE_SETTINGS.perWord.maxWords),
    },
    perProject:
      Array.isArray(data.perProject) && data.perProject.length
        ? data.perProject.map((p: any, i: number) => ({
            id: String(p.id || `project_${i}`),
            name: String(p.name || "Project"),
            rate: Number(p.rate || 0),
          }))
        : DEFAULT_RATE_SETTINGS.perProject,
    retainer:
      Array.isArray(data.retainer) && data.retainer.length
        ? data.retainer.map((r: any, i: number) => ({
            id: String(r.id || `retainer_${i}`),
            name: String(r.name || "Package"),
            quantity: String(r.quantity || ""),
            monthlyRate: Number(r.monthlyRate || 0),
          }))
        : DEFAULT_RATE_SETTINGS.retainer,
    updatedAt: data.updatedAt,
  };
}

export async function saveRateCalculatorSettings(
  patch: Partial<RateCalculatorSettings>
): Promise<RateCalculatorSettings> {
  const current = await getRateCalculatorSettings();
  const next: RateCalculatorSettings = {
    currency: patch.currency != null ? String(patch.currency) : current.currency,
    perWord: {
      rate: Number(patch.perWord?.rate ?? current.perWord.rate),
      minWords: Number(patch.perWord?.minWords ?? current.perWord.minWords),
      maxWords: Number(patch.perWord?.maxWords ?? current.perWord.maxWords),
    },
    perProject: Array.isArray(patch.perProject) ? patch.perProject : current.perProject,
    retainer: Array.isArray(patch.retainer) ? patch.retainer : current.retainer,
    updatedAt: new Date().toISOString(),
  };

  if (!(next.perWord.rate > 0)) throw Object.assign(new Error("perWord.rate must be > 0"), { status: 400 });
  if (next.perWord.minWords < 1 || next.perWord.maxWords < next.perWord.minWords) {
    throw Object.assign(new Error("Invalid word count bounds"), { status: 400 });
  }

  await getFirestore().collection("settings").doc(DOC).set(next, { merge: true });
  return next;
}

/** Public-safe pricing (no secrets) for the calculator UI */
export async function getPublicRateMeta() {
  const s = await getRateCalculatorSettings();
  return {
    currency: s.currency,
    perWord: {
      rate: s.perWord.rate,
      minWords: s.perWord.minWords,
      maxWords: s.perWord.maxWords,
      label:
        s.currency === "USD"
          ? `$${s.perWord.rate} / word`
          : `${s.perWord.rate} ${s.currency} / word`,
    },
    perProject: s.perProject.map((p) => ({
      id: p.id,
      name: p.name,
      rate: p.rate,
    })),
    retainer: s.retainer.map((r) => ({
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      monthlyRate: r.monthlyRate,
    })),
  };
}

export async function calculateRateEstimate(input: {
  model: "perWord" | "perProject" | "retainer";
  wordCount?: number;
  projectTypeId?: string;
  retainerId?: string;
}) {
  const s = await getRateCalculatorSettings();
  const currency = s.currency;
  const money = (n: number) =>
    currency === "USD" ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `${n} ${currency}`;

  if (input.model === "perWord") {
    const words = Number(input.wordCount);
    if (!Number.isFinite(words) || words < s.perWord.minWords || words > s.perWord.maxWords) {
      throw Object.assign(
        new Error(`Word count must be between ${s.perWord.minWords} and ${s.perWord.maxWords}.`),
        { status: 400 }
      );
    }
    const fee = Math.round(words * s.perWord.rate * 100) / 100;
    return {
      model: "Per Word",
      currency,
      breakdown: [
        { label: "Word Count", value: `${words.toLocaleString()} words` },
        { label: "Rate", value: `${money(s.perWord.rate)} / word` },
        { label: "Estimated Fee", value: money(fee) },
      ],
      estimatedFee: fee,
      estimatedFeeLabel: money(fee),
      note: "This is an estimated rate based on current platform pricing.",
    };
  }

  if (input.model === "perProject") {
    const item = s.perProject.find((p) => p.id === input.projectTypeId);
    if (!item) throw Object.assign(new Error("Select a valid project type."), { status: 400 });
    return {
      model: "Per Project",
      currency,
      breakdown: [
        { label: "Project Type", value: item.name },
        { label: "Standard Project Rate", value: money(item.rate) },
        { label: "Estimated Fee", value: money(item.rate) },
      ],
      estimatedFee: item.rate,
      estimatedFeeLabel: money(item.rate),
      note: "This is an estimated rate based on current platform pricing.",
    };
  }

  if (input.model === "retainer") {
    const pack = s.retainer.find((r) => r.id === input.retainerId);
    if (!pack) throw Object.assign(new Error("Select a valid retainer package."), { status: 400 });
    return {
      model: "Retainer",
      currency,
      breakdown: [
        { label: "Package", value: pack.name },
        { label: "Includes", value: pack.quantity },
        { label: "Monthly Rate", value: money(pack.monthlyRate) },
        { label: "Estimated Monthly Fee", value: money(pack.monthlyRate) },
      ],
      estimatedFee: pack.monthlyRate,
      estimatedFeeLabel: money(pack.monthlyRate),
      note: "This is an estimated monthly retainer based on current platform pricing.",
    };
  }

  throw Object.assign(new Error("Invalid pricing model."), { status: 400 });
}
