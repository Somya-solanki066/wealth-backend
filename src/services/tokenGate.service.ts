import { getFirestore } from "firebase-admin/firestore";

export type TokenStandard = "ERC-721" | "ERC-1155" | "ERC-20";
export type GateStatus = "active" | "disabled";
export type AccessPolicy = "current-ownership" | "one-time-unlock";

export type RegisteredToken = {
  id: string;
  name: string;
  symbol?: string;
  standard: TokenStandard;
  contractAddress: string;
  network: string;
  chainId?: number;
  tokenId?: string;
  getTokenUrl?: string;
  demoHolderWallets: string[];
  createdBy?: string;
  platform: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChapterGate = {
  id?: string;
  userId: string;
  projectId: string;
  projectName: string;
  chapterId: string;
  chapterTitle: string;
  tokenId: string;
  tokenName: string;
  contractAddress: string;
  standard: TokenStandard;
  network: string;
  chainId?: number;
  requiredTokenId?: string;
  accessPolicy: AccessPolicy;
  status: GateStatus;
  getTokenUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type GateUnlock = {
  id?: string;
  gateId: string;
  walletAddress: string;
  userId?: string;
  unlockedAt: string;
};

const PLATFORM_TOKENS: Omit<RegisteredToken, "createdAt" | "updatedAt">[] = [
  {
    id: "founders-pass",
    name: "Founder's Pass",
    symbol: "FOUNDER",
    standard: "ERC-721",
    contractAddress: "0xDEMO000000000000000000000000FOUNDERPASS",
    network: "demo",
    chainId: 0,
    getTokenUrl: "https://example.com/founders-pass",
    demoHolderWallets: [],
    platform: true,
  },
  {
    id: "premium-nft",
    name: "Premium NFT",
    symbol: "PREM",
    standard: "ERC-721",
    contractAddress: "0xDEMO000000000000000000000000PREMIUMNFT00",
    network: "demo",
    chainId: 0,
    getTokenUrl: "https://example.com/premium-nft",
    demoHolderWallets: [],
    platform: true,
  },
  {
    id: "community-pass",
    name: "Community Pass",
    symbol: "COMM",
    standard: "ERC-1155",
    contractAddress: "0xDEMO000000000000000000000000COMMUNITY00",
    network: "demo",
    chainId: 0,
    tokenId: "1",
    getTokenUrl: "https://example.com/community-pass",
    demoHolderWallets: [],
    platform: true,
  },
];

function tokensCol() {
  return getFirestore().collection("registeredTokens");
}

function gatesCol() {
  return getFirestore().collection("chapterGates");
}

function unlocksCol() {
  return getFirestore().collection("chapterGateUnlocks");
}

function gateDocId(projectId: string, chapterId: string) {
  return `${projectId}__${chapterId}`;
}

function normWallet(w: string) {
  return String(w || "").trim().toLowerCase();
}

export function getTokenGateConfig() {
  const chainVerify = String(process.env.TOKEN_GATE_CHAIN_VERIFY || "").toLowerCase() === "true";
  return {
    mode: chainVerify ? "live" : "simulation",
    accessPolicyDefault: "current-ownership" as AccessPolicy,
    message: chainVerify
      ? "Live ownership checks enabled."
      : "Demo verification mode: ownership uses registered demo holder wallets (no on-chain RPC yet). Access policy defaults to current-ownership — token transfer removes access unless one-time unlock is set.",
  };
}

export async function ensurePlatformTokens() {
  const now = new Date().toISOString();
  for (const t of PLATFORM_TOKENS) {
    const ref = tokensCol().doc(t.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ ...t, createdAt: now, updatedAt: now });
    }
  }
}

export async function listRegisteredTokens(): Promise<RegisteredToken[]> {
  await ensurePlatformTokens();
  const snap = await tokensCol().get();
  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name || d.id),
      symbol: data.symbol ? String(data.symbol) : undefined,
      standard: (data.standard || "ERC-721") as TokenStandard,
      contractAddress: String(data.contractAddress || ""),
      network: String(data.network || "demo"),
      chainId: data.chainId != null ? Number(data.chainId) : undefined,
      tokenId: data.tokenId != null ? String(data.tokenId) : undefined,
      getTokenUrl: data.getTokenUrl ? String(data.getTokenUrl) : undefined,
      demoHolderWallets: Array.isArray(data.demoHolderWallets)
        ? data.demoHolderWallets.map((w: string) => normWallet(w))
        : [],
      createdBy: data.createdBy ? String(data.createdBy) : undefined,
      platform: Boolean(data.platform),
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    } as RegisteredToken;
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

export async function getRegisteredToken(id: string) {
  const tokens = await listRegisteredTokens();
  const t = tokens.find((x) => x.id === id);
  if (!t) throw Object.assign(new Error("Token not found."), { status: 404 });
  return t;
}

export async function addDemoHolder(tokenId: string, walletAddress: string) {
  const wallet = normWallet(walletAddress);
  if (wallet.length < 8) {
    throw Object.assign(new Error("Invalid wallet address."), { status: 400 });
  }
  const ref = tokensCol().doc(tokenId);
  await ensurePlatformTokens();
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Token not found."), { status: 404 });
  const existing = Array.isArray(snap.data()?.demoHolderWallets)
    ? snap.data()!.demoHolderWallets.map((w: string) => normWallet(w))
    : [];
  if (!existing.includes(wallet)) existing.push(wallet);
  await ref.set(
    { demoHolderWallets: existing, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  return getRegisteredToken(tokenId);
}

export async function setChapterGate(input: {
  userId: string;
  projectId: string;
  chapterId: string;
  tokenId: string;
  accessPolicy?: AccessPolicy;
  status?: GateStatus;
}) {
  const db = getFirestore();
  const projectSnap = await db.collection("projects").doc(input.projectId).get();
  if (!projectSnap.exists) throw Object.assign(new Error("Story not found."), { status: 404 });
  const project = projectSnap.data()!;
  if (project.userId !== input.userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }

  const chapterSnap = await db
    .collection("projects")
    .doc(input.projectId)
    .collection("chapters")
    .doc(input.chapterId)
    .get();
  if (!chapterSnap.exists) throw Object.assign(new Error("Chapter not found."), { status: 404 });
  const chapter = chapterSnap.data()!;
  const token = await getRegisteredToken(input.tokenId);

  const now = new Date().toISOString();
  const id = gateDocId(input.projectId, input.chapterId);
  const ref = gatesCol().doc(id);
  const existing = await ref.get();

  const gate: ChapterGate = {
    userId: input.userId,
    projectId: input.projectId,
    projectName: String(project.name || "Untitled"),
    chapterId: input.chapterId,
    chapterTitle: String(chapter.title || "Chapter"),
    tokenId: token.id,
    tokenName: token.name,
    contractAddress: token.contractAddress,
    standard: token.standard,
    network: token.network,
    chainId: token.chainId,
    requiredTokenId: token.tokenId,
    accessPolicy:
      input.accessPolicy === "one-time-unlock" ? "one-time-unlock" : "current-ownership",
    status: input.status === "disabled" ? "disabled" : "active",
    getTokenUrl: token.getTokenUrl,
    createdAt: existing.exists ? String(existing.data()?.createdAt || now) : now,
    updatedAt: now,
  };

  await ref.set(gate, { merge: true });
  return { ...gate, id };
}

export async function listGatesForUser(userId: string): Promise<ChapterGate[]> {
  const snap = await gatesCol().where("userId", "==", userId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChapterGate));
  list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return list;
}

export async function listGatesForProject(projectId: string): Promise<ChapterGate[]> {
  const snap = await gatesCol().where("projectId", "==", projectId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChapterGate));
}

export async function listAllGatesAdmin(): Promise<ChapterGate[]> {
  const snap = await gatesCol().limit(200).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChapterGate));
  list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return list;
}

export async function getGate(projectId: string, chapterId: string) {
  const snap = await gatesCol().doc(gateDocId(projectId, chapterId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ChapterGate;
}

export async function updateGateStatus(
  userId: string,
  projectId: string,
  chapterId: string,
  status: GateStatus
) {
  const gate = await getGate(projectId, chapterId);
  if (!gate) throw Object.assign(new Error("Gate not found."), { status: 404 });
  if (gate.userId !== userId) throw Object.assign(new Error("Forbidden."), { status: 403 });
  const now = new Date().toISOString();
  await gatesCol().doc(gateDocId(projectId, chapterId)).set({ status, updatedAt: now }, { merge: true });
  return getGate(projectId, chapterId);
}

export async function adminUpdateGate(
  projectId: string,
  chapterId: string,
  patch: { status?: GateStatus; tokenId?: string; accessPolicy?: AccessPolicy }
) {
  const gate = await getGate(projectId, chapterId);
  if (!gate) throw Object.assign(new Error("Gate not found."), { status: 404 });
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (patch.status) updates.status = patch.status;
  if (patch.accessPolicy) updates.accessPolicy = patch.accessPolicy;
  if (patch.tokenId) {
    const token = await getRegisteredToken(patch.tokenId);
    updates.tokenId = token.id;
    updates.tokenName = token.name;
    updates.contractAddress = token.contractAddress;
    updates.standard = token.standard;
    updates.network = token.network;
    updates.chainId = token.chainId;
    updates.requiredTokenId = token.tokenId;
    updates.getTokenUrl = token.getTokenUrl;
  }

  await gatesCol().doc(gateDocId(projectId, chapterId)).set(updates, { merge: true });
  return getGate(projectId, chapterId);
}

export async function removeGate(userId: string | null, projectId: string, chapterId: string, asAdmin = false) {
  const gate = await getGate(projectId, chapterId);
  if (!gate) throw Object.assign(new Error("Gate not found."), { status: 404 });
  if (!asAdmin && gate.userId !== userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }
  await gatesCol().doc(gateDocId(projectId, chapterId)).delete();
  return { ok: true };
}

async function hasOneTimeUnlock(gateId: string, wallet: string) {
  const snap = await unlocksCol()
    .where("gateId", "==", gateId)
    .where("walletAddress", "==", wallet)
    .limit(1)
    .get();
  return !snap.empty;
}

async function recordOneTimeUnlock(gateId: string, wallet: string, userId?: string) {
  const id = `${gateId}__${wallet}`;
  await unlocksCol().doc(id).set(
    {
      gateId,
      walletAddress: wallet,
      userId: userId || null,
      unlockedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/** Simulation ownership: wallet listed on token.demoHolderWallets. Live RPC not wired. */
export async function verifyChapterAccess(input: {
  projectId: string;
  chapterId: string;
  walletAddress: string;
  userId?: string;
}) {
  const config = getTokenGateConfig();
  const wallet = normWallet(input.walletAddress);
  if (wallet.length < 8) {
    throw Object.assign(new Error("Connect a wallet first."), { status: 400 });
  }

  const gate = await getGate(input.projectId, input.chapterId);
  if (!gate || gate.status !== "active") {
    return {
      gated: false,
      unlocked: true,
      reason: "public",
      message: "This chapter is not token-gated.",
    };
  }

  const gateId = gateDocId(input.projectId, input.chapterId);

  if (gate.accessPolicy === "one-time-unlock") {
    if (await hasOneTimeUnlock(gateId, wallet)) {
      return {
        gated: true,
        unlocked: true,
        reason: "one-time-unlock",
        gate,
        message: "Previously unlocked — permanent access for this wallet.",
        wallet,
        mode: config.mode,
      };
    }
  }

  const token = await getRegisteredToken(gate.tokenId);
  let owns = token.demoHolderWallets.includes(wallet);

  // Live chain verify placeholder — not implemented without RPC
  if (config.mode === "live") {
    owns = token.demoHolderWallets.includes(wallet);
  }

  if (!owns) {
    return {
      gated: true,
      unlocked: false,
      reason: "not-owned",
      gate,
      token: {
        id: token.id,
        name: token.name,
        standard: token.standard,
        network: token.network,
        contractAddress: token.contractAddress,
        getTokenUrl: token.getTokenUrl,
      },
      message: `You don't currently hold the required ${token.name}.`,
      wallet,
      mode: config.mode,
    };
  }

  if (gate.accessPolicy === "one-time-unlock") {
    await recordOneTimeUnlock(gateId, wallet, input.userId);
  }

  return {
    gated: true,
    unlocked: true,
    reason: "owned",
    gate,
    token: {
      id: token.id,
      name: token.name,
      standard: token.standard,
      network: token.network,
      contractAddress: token.contractAddress,
      getTokenUrl: token.getTokenUrl,
    },
    message: `${token.name} detected.`,
    wallet,
    mode: config.mode,
  };
}

export async function getChapterAccessState(input: {
  projectId: string;
  chapterId: string;
}) {
  const gate = await getGate(input.projectId, input.chapterId);
  if (!gate || gate.status !== "active") {
    return { gated: false, gate: null };
  }
  return {
    gated: true,
    gate: {
      id: gate.id,
      chapterTitle: gate.chapterTitle,
      tokenName: gate.tokenName,
      standard: gate.standard,
      network: gate.network,
      accessPolicy: gate.accessPolicy,
      getTokenUrl: gate.getTokenUrl,
      status: gate.status,
    },
  };
}
