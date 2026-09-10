export const COVER_PLATFORMS = [
  {
    id: "pocketfm",
    label: "PocketFM",
    aesthetic:
      "Audio-fiction mobile thumbnail energy: bold central character, high contrast, cinematic lighting, strong emotional hook, readable silhouette at small size. Do not copy PocketFM branding or logos.",
  },
  {
    id: "dreame",
    label: "Dreame",
    aesthetic:
      "Romance-first serialized fiction cover: intimate couple or heroine focus, soft glam lighting, emotional close-up, mobile-first composition with clear focal subject. Do not copy Dreame branding or logos.",
  },
  {
    id: "goodnovel",
    label: "GoodNovel",
    aesthetic:
      "Commercial webnovel cover: polished character portrait, vivid color grading, dramatic atmosphere, genre-readable tropes, title-safe negative space in upper third. Do not copy GoodNovel branding or logos.",
  },
  {
    id: "webnovel",
    label: "WebNovel",
    aesthetic:
      "Epic serialized fiction cover: high-drama character or world shot, sharp detail, bold mood, fantasy/romance marketplace look. Do not copy WebNovel branding or logos.",
  },
] as const;

export const COVER_GENRES = [
  "Werewolf",
  "Vampire",
  "Billionaire Romance",
  "Contemporary Romance",
  "Fantasy",
  "Dark Romance",
  "Thriller",
  "Mystery",
  "Historical",
  "Urban Fiction",
  "Sci-Fi",
  "Horror",
] as const;

export const COVER_MOODS = [
  "Dark",
  "Romantic",
  "Emotional",
  "Mysterious",
  "Intense",
  "Elegant",
  "Dangerous",
  "Cinematic",
  "Dreamy",
] as const;

export const COVER_VISUAL_STYLES = [
  {
    id: "photographic",
    label: "Photographic",
    hint: "Photorealistic characters and lighting",
  },
  {
    id: "illustrated",
    label: "Illustrated",
    hint: "Painted / digital illustration look",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    hint: "Movie-poster composition and lighting",
  },
  {
    id: "dark_fantasy",
    label: "Dark Fantasy",
    hint: "Moody shadows, mythic atmosphere",
  },
  {
    id: "minimal",
    label: "Minimal",
    hint: "Clean focal subject, restrained palette",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    hint: "High contrast, bold emotion",
  },
] as const;

export const COVER_FORMATS = [
  {
    id: "serialized",
    label: "Serialized Fiction",
    size: "1024x1792" as const,
    aspectHint: "portrait mobile thumbnail",
  },
  {
    id: "ebook",
    label: "Ebook",
    size: "1024x1792" as const,
    aspectHint: "ebook portrait cover",
  },
  {
    id: "print",
    label: "Print",
    size: "1024x1792" as const,
    aspectHint: "print-ready portrait cover",
  },
] as const;

export type CoverPlatformId = (typeof COVER_PLATFORMS)[number]["id"];
export type CoverVisualStyleId = (typeof COVER_VISUAL_STYLES)[number]["id"];
export type CoverFormatId = (typeof COVER_FORMATS)[number]["id"];

export function getPlatformAesthetic(id: string) {
  return COVER_PLATFORMS.find((p) => p.id === id) || COVER_PLATFORMS[1];
}

export function getVisualStyle(id: string) {
  return COVER_VISUAL_STYLES.find((s) => s.id === id) || COVER_VISUAL_STYLES[2];
}

export function getCoverFormat(id: string) {
  return COVER_FORMATS.find((f) => f.id === id) || COVER_FORMATS[0];
}

export function buildCoverImagePrompt(input: {
  title: string;
  platform: string;
  genre: string;
  mood: string;
  visualStyle: string;
  sceneDescription?: string;
  variationHint?: string;
}) {
  const platform = getPlatformAesthetic(input.platform);
  const style = getVisualStyle(input.visualStyle);
  const scene = String(input.sceneDescription || "").trim();

  const parts = [
    `Create an original book-cover artwork background for a serialized fiction novel titled conceptually "${input.title}" (do NOT paint any words).`,
    `Platform visual direction (${platform.label}-inspired, not branded): ${platform.aesthetic}`,
    `Genre: ${input.genre}.`,
    `Mood: ${input.mood}.`,
    `Visual style: ${style.label} — ${style.hint}.`,
    scene
      ? `Scene / character direction: ${scene}`
      : `Infer a compelling central scene from the title, genre, and mood.`,
    "Composition: leave soft clear space in the upper third and lower fifth for later typography overlay.",
    "Absolutely no text, letters, words, logos, watermarks, UI, barcodes, or typography of any kind in the image.",
    "High detail, commercial cover quality, single cohesive scene.",
  ];

  if (input.variationHint) {
    parts.push(`Create a fresh variation: ${input.variationHint}`);
  }

  return parts.join("\n");
}
