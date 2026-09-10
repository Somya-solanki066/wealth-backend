import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

export type ContentKind = "chapter" | "cover" | "special";
export type MintStatus = "prepared" | "minting" | "minted" | "failed";
export type MintMode = "simulation" | "live";

export type NftMetadata = {
  title: string;
  description: string;
  creator: string;
  genre: string;
  storyTitle: string;
  contentLabel: string;
  contentKind: ContentKind;
  /** Reference to chapter/content — not full manuscript on-chain */
  contentUri: string;
  imageUri?: string;
  editionSize: number;
};

export type NftCollection = {
  id?: string;
  userId: string;
  projectId: string;
  projectName: string;
  contentId: string;
  contentKind: ContentKind;
  contentLabel: string;
  editionSize: number;
  mintedCount: number;
  network: string;
  metadata: NftMetadata;
  createdAt: string;
  updatedAt: string;
};

export type NftCollectible = {
  id?: string;
  userId: string;
  collectionId: string;
  projectId: string;
  projectName: string;
  contentId: string;
  contentLabel: string;
  contentKind: ContentKind;
  editionNumber: number;
  editionSize: number;
  network: string;
  walletAddress: string;
  metadata: NftMetadata;
  tokenId: string;
  txHash: string;
  status: MintStatus;
  mode: MintMode;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

function collectionsCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("nftCollections");
}

function collectiblesCol(userId: string) {
  return getFirestore().collection("users").doc(userId).collection("nftCollectibles");
}

function collectionKey(projectId: string, contentId: string, contentKind: ContentKind) {
  return `${projectId}__${contentKind}__${contentId}`;
}

/** Live network only if env configures it — never invent a production chain. */
export function getNftMintConfig() {
  const mode = (process.env.NFT_MINT_MODE || "simulation").toLowerCase() === "live"
    ? "live"
    : "simulation";
  const contractAddress = String(process.env.NFT_CONTRACT_ADDRESS || "").trim();
  const configuredNetwork = String(process.env.NFT_NETWORK || "").trim().toLowerCase();
  const explorerBase = String(process.env.NFT_EXPLORER_BASE || "").trim();

  const planned = [
    { id: "polygon", label: "Polygon", enabled: false },
    { id: "ethereum", label: "Ethereum", enabled: false },
    { id: "base", label: "Base", enabled: false },
  ];

  if (mode === "live" && contractAddress && configuredNetwork) {
    return {
      mode: "live" as MintMode,
      contractConfigured: true,
      contractAddress,
      explorerBase: explorerBase || null,
      networks: planned.map((n) => ({
        ...n,
        enabled: n.id === configuredNetwork,
      })),
      defaultNetwork: configuredNetwork,
      message:
        "On-chain mint is enabled for the configured network. Confirm the wallet transaction carefully — it is irreversible.",
    };
  }

  return {
    mode: "simulation" as MintMode,
    contractConfigured: false,
    contractAddress: null,
    explorerBase: null,
    networks: planned,
    defaultNetwork: "demo",
    message:
      "No NFT contract/network is configured yet. Mints are recorded as demo collectibles with metadata URI references (chapter text is not stored on-chain). Set NFT_MINT_MODE=live, NFT_NETWORK, and NFT_CONTRACT_ADDRESS to enable a real chain.",
  };
}

function stripHtml(html: string) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildNftPreview(input: {
  userId: string;
  projectId: string;
  contentId: string;
  contentKind: ContentKind;
  creator?: string;
  genre?: string;
  description?: string;
  title?: string;
}) {
  const db = getFirestore();
  const projectSnap = await db.collection("projects").doc(input.projectId).get();
  if (!projectSnap.exists) {
    throw Object.assign(new Error("Story not found."), { status: 404 });
  }
  const project = projectSnap.data()!;
  if (project.userId !== input.userId) {
    throw Object.assign(new Error("Forbidden."), { status: 403 });
  }

  const storyTitle = String(project.name || "Untitled Story");
  let contentLabel = "Cover";
  let excerpt = "";

  if (input.contentKind === "chapter") {
    const chSnap = await db
      .collection("projects")
      .doc(input.projectId)
      .collection("chapters")
      .doc(input.contentId)
      .get();
    if (!chSnap.exists) {
      throw Object.assign(new Error("Chapter not found."), { status: 404 });
    }
    const ch = chSnap.data()!;
    contentLabel = String(ch.title || "Chapter");
    excerpt = stripHtml(String(ch.content || "")).slice(0, 220);
  } else if (input.contentKind === "special") {
    contentLabel = "Special Edition";
  } else {
    contentLabel = "Cover";
  }

  const title =
    String(input.title || "").trim() || `${storyTitle} — ${contentLabel}`;
  const description =
    String(input.description || "").trim() ||
    (excerpt
      ? `${contentLabel} of ${storyTitle}. ${excerpt}${excerpt.length >= 220 ? "…" : ""}`
      : `${contentLabel} collectible from ${storyTitle}.`);

  const userSnap = await db.collection("users").doc(input.userId).get();
  const user = userSnap.data() || {};
  const creator =
    String(input.creator || "").trim() ||
    String(user.displayName || user.name || user.email || "Author");

  const metadata: NftMetadata = {
    title,
    description,
    creator,
    genre: String(input.genre || project.genre || "Fiction").trim() || "Fiction",
    storyTitle,
    contentLabel,
    contentKind: input.contentKind,
    contentUri: `ink2wealth://projects/${input.projectId}/${input.contentKind}/${input.contentId}`,
    imageUri: undefined,
    editionSize: 0,
  };

  return {
    projectId: input.projectId,
    projectName: storyTitle,
    contentId: input.contentId,
    contentKind: input.contentKind,
    contentLabel,
    metadata,
  };
}

export async function getCollectionSupply(
  userId: string,
  projectId: string,
  contentId: string,
  contentKind: ContentKind
) {
  const key = collectionKey(projectId, contentId, contentKind);
  const snap = await collectionsCol(userId).doc(key).get();
  if (!snap.exists) {
    return { exists: false, editionSize: 0, mintedCount: 0, remaining: 0 };
  }
  const d = snap.data()!;
  const editionSize = Number(d.editionSize || 0);
  const mintedCount = Number(d.mintedCount || 0);
  return {
    exists: true,
    editionSize,
    mintedCount,
    remaining: Math.max(0, editionSize - mintedCount),
    network: String(d.network || ""),
    collectionId: snap.id,
  };
}

export async function mintCollectible(input: {
  userId: string;
  projectId: string;
  contentId: string;
  contentKind: ContentKind;
  editionSize: number;
  network: string;
  walletAddress: string;
  creator?: string;
  genre?: string;
  description?: string;
  title?: string;
}) {
  const config = getNftMintConfig();
  const editionSize = Math.floor(Number(input.editionSize));
  if (!Number.isFinite(editionSize) || editionSize < 1 || editionSize > 10000) {
    throw Object.assign(new Error("Edition size must be between 1 and 10,000."), { status: 400 });
  }
  const wallet = String(input.walletAddress || "").trim();
  if (wallet.length < 8) {
    throw Object.assign(new Error("Connect a wallet before minting."), { status: 400 });
  }

  let network = String(input.network || "").trim().toLowerCase() || "demo";
  if (config.mode === "live") {
    const allowed = config.networks.find((n) => n.enabled && n.id === network);
    if (!allowed) {
      throw Object.assign(
        new Error("Selected network is not enabled. Only the configured live network can mint."),
        { status: 400 }
      );
    }
  } else {
    // Simulation: accept planned labels for UX, but record as demo
    network = network === "demo" ? "demo" : `demo:${network}`;
  }

  const preview = await buildNftPreview({
    userId: input.userId,
    projectId: input.projectId,
    contentId: input.contentId,
    contentKind: input.contentKind,
    creator: input.creator,
    genre: input.genre,
    description: input.description,
    title: input.title,
  });

  const key = collectionKey(input.projectId, input.contentId, input.contentKind);
  const colRef = collectionsCol(input.userId).doc(key);
  const now = new Date().toISOString();

  const result = await getFirestore().runTransaction(async (tx) => {
    const existing = await tx.get(colRef);
    let mintedCount = 0;
    let storedEditionSize = editionSize;

    if (existing.exists) {
      const d = existing.data()!;
      mintedCount = Number(d.mintedCount || 0);
      storedEditionSize = Number(d.editionSize || editionSize);
      if (storedEditionSize !== editionSize && mintedCount > 0) {
        throw Object.assign(
          new Error(
            `This chapter already has an edition size of ${storedEditionSize}. Remaining: ${Math.max(0, storedEditionSize - mintedCount)}.`
          ),
          { status: 400 }
        );
      }
      if (mintedCount >= storedEditionSize) {
        throw Object.assign(new Error("Edition sold out — no remaining supply."), { status: 400 });
      }
    }

    const editionNumber = mintedCount + 1;
    const metadata: NftMetadata = { ...preview.metadata, editionSize: storedEditionSize };

    const collection: NftCollection = {
      userId: input.userId,
      projectId: input.projectId,
      projectName: preview.projectName,
      contentId: input.contentId,
      contentKind: input.contentKind,
      contentLabel: preview.contentLabel,
      editionSize: storedEditionSize,
      mintedCount: editionNumber,
      network,
      metadata,
      createdAt: existing.exists ? String(existing.data()!.createdAt || now) : now,
      updatedAt: now,
    };
    tx.set(colRef, collection, { merge: true });

    const tokenId = `${key}-${String(editionNumber).padStart(4, "0")}`;
    const txHash = `demo_0x${crypto.randomBytes(20).toString("hex")}`;

    const mintRef = collectiblesCol(input.userId).doc();
    const collectible: NftCollectible = {
      userId: input.userId,
      collectionId: key,
      projectId: input.projectId,
      projectName: preview.projectName,
      contentId: input.contentId,
      contentLabel: preview.contentLabel,
      contentKind: input.contentKind,
      editionNumber,
      editionSize: storedEditionSize,
      network,
      walletAddress: wallet,
      metadata,
      tokenId,
      txHash,
      // Chain submission (RPC/contract call) is not wired yet — always record demo collectibles.
      status: "minted",
      mode: "simulation",
      createdAt: now,
      updatedAt: now,
    };

    if (config.mode === "live") {
      collectible.errorMessage =
        "NFT_MINT_MODE=live is set, but on-chain submission is not implemented yet. Recorded as a demo collectible with metadata URI.";
    }

    tx.set(mintRef, collectible);
    return { ...collectible, id: mintRef.id };
  });

  return result;
}

export async function listCollectibles(userId: string): Promise<NftCollectible[]> {
  const snap = await collectiblesCol(userId).orderBy("createdAt", "desc").limit(60).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userId,
      collectionId: String(data.collectionId || ""),
      projectId: String(data.projectId || ""),
      projectName: String(data.projectName || ""),
      contentId: String(data.contentId || ""),
      contentLabel: String(data.contentLabel || ""),
      contentKind: (data.contentKind || "chapter") as ContentKind,
      editionNumber: Number(data.editionNumber || 0),
      editionSize: Number(data.editionSize || 0),
      network: String(data.network || ""),
      walletAddress: String(data.walletAddress || ""),
      metadata: data.metadata || {},
      tokenId: String(data.tokenId || ""),
      txHash: String(data.txHash || ""),
      status: (data.status || "minted") as MintStatus,
      mode: (data.mode || "simulation") as MintMode,
      errorMessage: data.errorMessage ? String(data.errorMessage) : undefined,
      createdAt: String(data.createdAt || ""),
      updatedAt: String(data.updatedAt || ""),
    } as NftCollectible;
  });
}

export async function getCollectible(userId: string, id: string) {
  const snap = await collectiblesCol(userId).doc(id).get();
  if (!snap.exists) throw Object.assign(new Error("Collectible not found."), { status: 404 });
  const data = snap.data()!;
  return { id: snap.id, ...data, userId } as NftCollectible;
}
