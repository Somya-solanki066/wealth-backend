import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";

export type RoyaltySource =
  | "nft-chapter-sale"
  | "token-gated-unlock"
  | "dao-vote-reward"
  | "other";

export type RoyaltyStatus = "pending" | "confirmed" | "failed";

export type RoyaltySettings = {
  creatorRoyaltyPercent: number;
  platformFeePercent: number;
  currency: string;
  updatedAt: string;
};

export type LinkedWallet = {
  userId: string;
  address: string;
  networks: string[];
  verified: boolean;
  verifiedAt?: string | null;
  linkedAt: string;
  updatedAt: string;
};

export type RoyaltyTransaction = {
  id?: string;
  userId: string;
  walletAddress: string;
  source: RoyaltySource;
  title: string;
  storyTitle?: string;
  chapterLabel?: string;
  grossAmountUsd: number;
  platformFeeUsd: number;
  creatorAmountUsd: number;
  network: string;
  txHash: string;
  status: RoyaltyStatus;
  paidAt: string;
  createdAt: string;
  explorerUrl?: string | null;
};

export type PeriodKey = "7d" | "30d" | "90d" | "all";

const SETTINGS_DOC = "walletRoyalties";

function linkCol() {
  return getFirestore().collection("users");
}

function challengesCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("walletLinkChallenges");
}

function txsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("royaltyTransactions");
}

function settingsRef() {
  return getFirestore().collection("platformSettings").doc(SETTINGS_DOC);
}

function normAddr(a: string) {
  return String(a || "").trim().toLowerCase();
}

function shortHash() {
  return `0x${crypto.randomBytes(20).toString("hex")}`;
}

function explorerFor(network: string, txHash: string) {
  const n = network.replace(/^demo:/, "").toLowerCase();
  if (txHash.startsWith("demo_")) return null;
  if (n === "polygon") return `https://polygonscan.com/tx/${txHash}`;
  if (n === "ethereum") return `https://etherscan.io/tx/${txHash}`;
  if (n === "base") return `https://basescan.org/tx/${txHash}`;
  return null;
}

export function getWalletRoyaltiesConfig() {
  const live = String(process.env.WALLET_ROYALTIES_LIVE || "").toLowerCase() === "true";
  const networksEnv = String(process.env.WALLET_ROYALTIES_NETWORKS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const planned = [
    { id: "polygon", label: "Polygon" },
    { id: "ethereum", label: "Ethereum" },
    { id: "base", label: "Base" },
  ];
  return {
    mode: live ? "live" : "simulation",
    networks: planned.map((n) => ({
      ...n,
      enabled: networksEnv.length ? networksEnv.includes(n.id) : !live,
    })),
    message: live
      ? "Live royalty indexing enabled for configured networks."
      : "Demo royalties mode: earnings are recorded by the backend (not editable from the browser). Chain indexing is not wired yet — connect/verify wallet and use demo activity to exercise the dashboard.",
  };
}

export async function getRoyaltySettings(): Promise<RoyaltySettings> {
  const snap = await settingsRef().get();
  if (!snap.exists) {
    return {
      creatorRoyaltyPercent: 90,
      platformFeePercent: 10,
      currency: "USD",
      updatedAt: new Date().toISOString(),
    };
  }
  const d = snap.data()!;
  const creator = Number(d.creatorRoyaltyPercent ?? 90);
  const platform = Number(d.platformFeePercent ?? 10);
  return {
    creatorRoyaltyPercent: creator,
    platformFeePercent: platform,
    currency: String(d.currency || "USD"),
    updatedAt: String(d.updatedAt || ""),
  };
}

export async function saveRoyaltySettings(input: {
  creatorRoyaltyPercent?: number;
  platformFeePercent?: number;
  currency?: string;
}): Promise<RoyaltySettings> {
  let creator = Number(input.creatorRoyaltyPercent ?? 90);
  let platform = Number(input.platformFeePercent ?? 10);
  if (!Number.isFinite(creator) || creator < 0 || creator > 100) {
    throw Object.assign(new Error("Creator royalty must be 0–100."), { status: 400 });
  }
  if (!Number.isFinite(platform) || platform < 0 || platform > 100) {
    throw Object.assign(new Error("Platform fee must be 0–100."), { status: 400 });
  }
  if (Math.round(creator + platform) !== 100) {
    // normalize platform to remainder
    platform = Math.round((100 - creator) * 100) / 100;
  }
  const doc: RoyaltySettings = {
    creatorRoyaltyPercent: creator,
    platformFeePercent: platform,
    currency: String(input.currency || "USD"),
    updatedAt: new Date().toISOString(),
  };
  await settingsRef().set(doc, { merge: true });
  return doc;
}

export function splitRoyalty(grossAmountUsd: number, settings: RoyaltySettings) {
  const gross = Math.round(Number(grossAmountUsd) * 100) / 100;
  if (!Number.isFinite(gross) || gross < 0) {
    throw Object.assign(new Error("Invalid gross amount."), { status: 400 });
  }
  const platformFeeUsd =
    Math.round(((gross * settings.platformFeePercent) / 100) * 100) / 100;
  const creatorAmountUsd = Math.round((gross - platformFeeUsd) * 100) / 100;
  return { grossAmountUsd: gross, platformFeeUsd, creatorAmountUsd };
}

export async function createLinkChallenge(userId: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = [
    "INK2WEALTH — Verify wallet ownership",
    `User: ${userId}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
    "",
    "This signature does not spend funds or approve transactions.",
  ].join("\n");

  await challengesCol(userId).doc(nonce).set({
    nonce,
    message,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return { nonce, message, expiresAt };
}

export async function linkWallet(input: {
  userId: string;
  address: string;
  signature: string;
  nonce: string;
  networks?: string[];
}) {
  const address = normAddr(input.address);
  const okAddr = /^0x[a-f0-9]{40}$/.test(address) || address.startsWith("0xdemo");
  if (!okAddr) {
    throw Object.assign(new Error("Invalid wallet address."), { status: 400 });
  }
  if (!String(input.signature || "").trim()) {
    throw Object.assign(new Error("Signature required."), { status: 400 });
  }

  const challengeSnap = await challengesCol(input.userId).doc(String(input.nonce || "")).get();
  if (!challengeSnap.exists) {
    throw Object.assign(new Error("Challenge expired. Request a new one."), { status: 400 });
  }
  const challenge = challengeSnap.data()!;
  if (new Date(String(challenge.expiresAt)).getTime() < Date.now()) {
    throw Object.assign(new Error("Challenge expired. Request a new one."), { status: 400 });
  }

  // Simulation: require signature presence + matching challenge. Live ECDSA recover can be added with ethers later.
  const config = getWalletRoyaltiesConfig();
  const signature = String(input.signature || "");
  if (config.mode === "live" && !signature.startsWith("0x")) {
    throw Object.assign(new Error("Invalid signature."), { status: 400 });
  }

  const networks = Array.isArray(input.networks)
    ? input.networks.map(String).map((n) => n.toLowerCase())
    : ["polygon"];

  const now = new Date().toISOString();
  const link: LinkedWallet = {
    userId: input.userId,
    address,
    networks: networks.length ? networks : ["polygon"],
    verified: true,
    verifiedAt: now,
    linkedAt: now,
    updatedAt: now,
  };

  // Preserve historical linkedAt if changing wallet — do NOT merge old txs to new address
  const userRef = linkCol().doc(input.userId);
  const existing = await userRef.get();
  const prev = existing.data()?.linkedRoyaltyWallet;
  if (prev?.address && normAddr(prev.address) === address && prev.linkedAt) {
    link.linkedAt = String(prev.linkedAt);
  }

  await userRef.set({ linkedRoyaltyWallet: link }, { merge: true });
  await challengesCol(input.userId).doc(String(input.nonce)).delete().catch(() => undefined);

  return link;
}

export async function getLinkedWallet(userId: string): Promise<LinkedWallet | null> {
  const snap = await linkCol().doc(userId).get();
  const data = snap.data()?.linkedRoyaltyWallet;
  if (!data?.address) return null;
  return {
    userId,
    address: String(data.address),
    networks: Array.isArray(data.networks) ? data.networks.map(String) : ["polygon"],
    verified: Boolean(data.verified),
    verifiedAt: data.verifiedAt || null,
    linkedAt: String(data.linkedAt || ""),
    updatedAt: String(data.updatedAt || ""),
  };
}

export async function unlinkWallet(userId: string) {
  await linkCol().doc(userId).set(
    { linkedRoyaltyWallet: null, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  return { ok: true };
}

export async function recordRoyaltyTransaction(input: {
  userId: string;
  walletAddress: string;
  source: RoyaltySource;
  title: string;
  storyTitle?: string;
  chapterLabel?: string;
  grossAmountUsd: number;
  network?: string;
  txHash?: string;
  status?: RoyaltyStatus;
  paidAt?: string;
}) {
  const settings = await getRoyaltySettings();
  const split = splitRoyalty(input.grossAmountUsd, settings);
  const network = String(input.network || "demo").toLowerCase();
  const txHash = String(input.txHash || `demo_${shortHash()}`);
  const now = new Date().toISOString();
  const paidAt = input.paidAt || now;
  const status: RoyaltyStatus =
    input.status === "pending" || input.status === "failed" ? input.status : "confirmed";

  const doc: RoyaltyTransaction = {
    userId: input.userId,
    walletAddress: normAddr(input.walletAddress),
    source: input.source,
    title: String(input.title || "Royalty"),
    storyTitle: input.storyTitle ? String(input.storyTitle) : undefined,
    chapterLabel: input.chapterLabel ? String(input.chapterLabel) : undefined,
    ...split,
    network,
    txHash,
    status,
    paidAt,
    createdAt: now,
    explorerUrl: explorerFor(network, txHash),
  };

  const ref = txsCol(input.userId).doc();
  await ref.set(doc);
  return { ...doc, id: ref.id };
}

function periodStart(period: PeriodKey): Date | null {
  const now = Date.now();
  if (period === "7d") return new Date(now - 7 * 86400000);
  if (period === "30d") return new Date(now - 30 * 86400000);
  if (period === "90d") return new Date(now - 90 * 86400000);
  return null;
}

export async function getRoyaltiesDashboard(userId: string, period: PeriodKey = "30d") {
  const link = await getLinkedWallet(userId);
  const settings = await getRoyaltySettings();
  const config = getWalletRoyaltiesConfig();
  const snap = await txsCol(userId).orderBy("paidAt", "desc").limit(200).get();
  const start = periodStart(period);

  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoyaltyTransaction));

  // Only current linked wallet's txs — never merge old wallet history
  const forWallet = link
    ? all.filter((t) => normAddr(t.walletAddress) === normAddr(link.address))
    : [];

  const inPeriod = forWallet.filter((t) => {
    if (!start) return true;
    return new Date(t.paidAt).getTime() >= start.getTime();
  });

  const confirmed = inPeriod.filter((t) => t.status === "confirmed");
  const pending = inPeriod.filter((t) => t.status === "pending");

  const totalEarned = confirmed.reduce((s, t) => s + Number(t.creatorAmountUsd || 0), 0);
  const pendingAmount = pending.reduce((s, t) => s + Number(t.creatorAmountUsd || 0), 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = forWallet
    .filter((t) => t.status === "confirmed" && new Date(t.paidAt) >= monthStart)
    .reduce((s, t) => s + Number(t.creatorAmountUsd || 0), 0);

  return {
    config,
    settings: {
      creatorRoyaltyPercent: settings.creatorRoyaltyPercent,
      platformFeePercent: settings.platformFeePercent,
      currency: settings.currency,
    },
    wallet: link,
    period,
    summary: {
      totalEarnedUsd: Math.round(totalEarned * 100) / 100,
      confirmedTransactions: confirmed.length,
      pendingAmountUsd: Math.round(pendingAmount * 100) / 100,
      pendingTransactions: pending.length,
      thisMonthUsd: Math.round(thisMonth * 100) / 100,
    },
    activity: inPeriod.slice(0, 40).map((t) => ({
      id: t.id,
      source: t.source,
      title: t.title,
      storyTitle: t.storyTitle,
      chapterLabel: t.chapterLabel,
      creatorAmountUsd: t.creatorAmountUsd,
      grossAmountUsd: t.grossAmountUsd,
      platformFeeUsd: t.platformFeeUsd,
      status: t.status,
      network: t.network,
      txHash: t.txHash,
      paidAt: t.paidAt,
      walletAddress: t.walletAddress,
      explorerUrl: t.explorerUrl || explorerFor(t.network, t.txHash),
    })),
  };
}

export async function getRoyaltyTransaction(userId: string, id: string) {
  const snap = await txsCol(userId).doc(id).get();
  if (!snap.exists) throw Object.assign(new Error("Transaction not found."), { status: 404 });
  const t = { id: snap.id, ...snap.data() } as RoyaltyTransaction;
  return {
    ...t,
    explorerUrl: t.explorerUrl || explorerFor(t.network, t.txHash),
  };
}

/** Demo seed — backend-authored amounts only */
export async function seedDemoRoyalties(userId: string) {
  const link = await getLinkedWallet(userId);
  if (!link?.verified) {
    throw Object.assign(new Error("Link and verify a wallet first."), { status: 400 });
  }
  const existing = await txsCol(userId).limit(1).get();
  if (!existing.empty) {
    return { seeded: false, message: "Activity already exists for this account." };
  }

  const network = link.networks[0] || "polygon";
  const samples: Array<{
    source: RoyaltySource;
    title: string;
    storyTitle?: string;
    chapterLabel?: string;
    gross: number;
    status: RoyaltyStatus;
    daysAgo: number;
  }> = [
    {
      source: "nft-chapter-sale",
      title: "NFT chapter sale — Soul Recaller #12",
      storyTitle: "Soul Recaller",
      chapterLabel: "#12",
      gross: 42.22,
      status: "confirmed",
      daysAgo: 2,
    },
    {
      source: "token-gated-unlock",
      title: "Token-gated unlock royalty",
      storyTitle: "Soul Recaller",
      chapterLabel: "Chapter 40",
      gross: 16.11,
      status: "confirmed",
      daysAgo: 5,
    },
    {
      source: "dao-vote-reward",
      title: "DAO vote reward payout",
      gross: 6.67,
      status: "confirmed",
      daysAgo: 8,
    },
    {
      source: "nft-chapter-sale",
      title: "NFT chapter sale — pending settle",
      storyTitle: "Finding My Fated Mate",
      chapterLabel: "Chapter 1",
      gross: 20,
      status: "pending",
      daysAgo: 0,
    },
  ];

  const created = [];
  for (const s of samples) {
    const paidAt = new Date(Date.now() - s.daysAgo * 86400000).toISOString();
    created.push(
      await recordRoyaltyTransaction({
        userId,
        walletAddress: link.address,
        source: s.source,
        title: s.title,
        storyTitle: s.storyTitle,
        chapterLabel: s.chapterLabel,
        grossAmountUsd: s.gross,
        network: `demo:${network}`,
        status: s.status,
        paidAt,
      })
    );
  }

  return { seeded: true, count: created.length };
}

export const SOURCE_LABELS: Record<RoyaltySource, string> = {
  "nft-chapter-sale": "NFT Chapter Sale",
  "token-gated-unlock": "Token-Gated Unlock",
  "dao-vote-reward": "DAO Vote Reward",
  other: "Other Web3 Revenue",
};
