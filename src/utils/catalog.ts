import { getFirestore } from "firebase-admin/firestore";
import { DEFAULT_ANALYZER_PROMPTS } from "./analyzerPrompts";
import { DEFAULT_SMART_EDIT_PROMPT } from "./smartEditPrompt";

export type CatalogItem = { id: string; name: string; enabled: boolean };

export type AiConfig = {
  openaiModel: string;
  platforms: CatalogItem[];
  genres: CatalogItem[];
};

export const DEFAULT_AI_CONFIG: AiConfig = {
  openaiModel: "gpt-4o-mini",
  platforms: [
    "PocketFM",
    "Dreame",
    "GoodNovel",
    "WebNovel",
    "MegaNovel",
    "AlphaNovel",
    "Letterlux",
    "Stary",
    "NovelSnack",
  ].map((name) => ({ id: name, name, enabled: true })),
  genres: [
    "Romance",
    "Werewolf",
    "Billionaire",
    "Fantasy",
    "Urban",
    "Thriller",
    "Sci-Fi",
    "Adventure",
  ].map((name) => ({ id: name, name, enabled: true })),
};

function normalizeItems(raw: any[], fallback: CatalogItem[]): CatalogItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  return raw
    .map((item) => {
      const name = String(item?.name || item?.id || "").trim();
      const id = String(item?.id || name).trim();
      if (!id || !name) return null;
      return { id, name, enabled: item?.enabled !== false };
    })
    .filter(Boolean) as CatalogItem[];
}

export function normalizeAiConfig(raw: any): AiConfig {
  return {
    openaiModel: String(raw?.openaiModel || DEFAULT_AI_CONFIG.openaiModel),
    platforms: normalizeItems(raw?.platforms, DEFAULT_AI_CONFIG.platforms),
    genres: normalizeItems(raw?.genres, DEFAULT_AI_CONFIG.genres),
  };
}

export async function getAiConfig(): Promise<AiConfig> {
  const db = getFirestore();
  const snap = await db.collection("settings").doc("ai_config").get();
  if (!snap.exists) {
    await db.collection("settings").doc("ai_config").set(DEFAULT_AI_CONFIG);
    return DEFAULT_AI_CONFIG;
  }
  return normalizeAiConfig(snap.data());
}

export async function getPublicCatalog() {
  const config = await getAiConfig();
  return {
    openaiModel: config.openaiModel,
    platforms: config.platforms.filter((item) => item.enabled),
    genres: config.genres.filter((item) => item.enabled),
  };
}

export async function getOpenAiModel(): Promise<string> {
  const config = await getAiConfig();
  return config.openaiModel || DEFAULT_AI_CONFIG.openaiModel;
}

export async function getSmartEditPrompt(): Promise<string> {
  const db = getFirestore();
  const snap = await db.collection("settings").doc("smart_edit").get();
  const prompt = String(snap.data()?.prompt || "").trim();
  return prompt || DEFAULT_SMART_EDIT_PROMPT;
}

export async function getAnalyzerPrompt(platform: string): Promise<string> {
  const db = getFirestore();
  const snap = await db.collection("analyzer_prompts").doc(platform).get();
  const stored = String(snap.data()?.prompt || "").trim();
  if (stored) return stored;
  return DEFAULT_ANALYZER_PROMPTS[platform] || DEFAULT_ANALYZER_PROMPTS.GoodNovel;
}

export async function listAnalyzerPromptPlatforms(): Promise<string[]> {
  const config = await getAiConfig();
  const fromConfig = config.platforms.map((item) => item.id);
  const fromDefaults = Object.keys(DEFAULT_ANALYZER_PROMPTS);
  return Array.from(new Set([...fromConfig, ...fromDefaults]));
}
