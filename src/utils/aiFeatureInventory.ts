/**
 * Master AI feature inventory for Ink2Wealth Credits.
 * Provisional creditCost values are starting points — validate against provider costs before launch.
 */

export type AiWorld = "writer" | "screenwriter" | "student" | "wealth" | "web3";

export type AiProvider = "openai" | "ideogram" | "claude" | "other";

export type AiToolId =
  | "smart-edit"
  | "chapter-analyzer"
  | "ghost-writer"
  | "book-cover"
  | "writing-vault"
  | "write-something"
  | "pitch-templates"
  | "one-shot-formatter"
  | "micro-serial"
  | "self-interview-builder"
  | "outline-builder"
  | "script-analyzer"
  | "pitch-synopsis"
  | "query-letter"
  | "pitch-deck"
  | "study-planner"
  | "flashcards"
  | "citation"
  | "video-finder"
  | "essay-writer"
  | "book-blurb"
  | "author-bio"
  | "press-release"
  | "booktok-hook"
  | "medium-outline"
  | "social-kit"
  | "web3-explainer"
  | "web3-docs"
  | "web3-thread"
  | "web3-community";

export type AiFeatureInventoryItem = {
  id: AiToolId;
  world: AiWorld;
  name: string;
  aiFunction: string;
  provider: AiProvider;
  /** Model is resolved at runtime; this is the intended default family */
  modelHint: string;
  inputTypical: string;
  outputTypical: string;
  frequencyHint: string;
  status: "free" | "premium" | "mixed" | "undecided";
  /** Provisional Ink2Wealth credit cost per successful operation */
  creditCost: number;
  /** Extra free-tier hard limit per period (in addition to credit balance) */
  freeMaxPerPeriod?: number;
  dailyRateLimitPerMinute?: number;
  maxInputChars?: number;
  notes?: string;
  legacyUsageField:
    | "aiAnalyzerCount"
    | "smartEditCount"
    | "ghostWriterCount"
    | "scriptAnalyzerCount"
    | "studentHubCount"
    | "wealthEngineCount";
};

export const AI_FEATURE_INVENTORY: AiFeatureInventoryItem[] = [
  {
    id: "smart-edit",
    world: "writer",
    name: "Smart Edit Suite",
    aiFunction: "8 editing checks with scored feedback",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "500–4k words",
    outputTypical: "structured JSON ~1–2k tokens",
    frequencyHint: "multiple per writing session",
    status: "mixed",
    creditCost: 1,
    maxInputChars: 15000,
    notes: "Quick edit / short feedback band",
    legacyUsageField: "smartEditCount",
  },
  {
    id: "chapter-analyzer",
    world: "writer",
    name: "AI Chapter Analyzer",
    aiFunction: "Platform-specific chapter scoring and tips",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "800–2.5k words",
    outputTypical: "structured analysis",
    frequencyHint: "1–3 per chapter",
    status: "mixed",
    creditCost: 2,
    maxInputChars: 20000,
    notes: "Standard chapter analysis",
    legacyUsageField: "aiAnalyzerCount",
  },
  {
    id: "ghost-writer",
    world: "writer",
    name: "AI Ghost Writer",
    aiFunction: "Generate full chapter or scene prose",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "plot + context ~500–2k words",
    outputTypical: "800–2500 words",
    frequencyHint: "heavy when drafting",
    status: "premium",
    creditCost: 3,
    freeMaxPerPeriod: 1,
    maxInputChars: 12000,
    notes: "Larger generation cost; free trial max 1",
    legacyUsageField: "ghostWriterCount",
  },
  {
    id: "book-cover",
    world: "writer",
    name: "Book Cover Generator",
    aiFunction: "Image generation for covers",
    provider: "openai",
    modelHint: "dall-e-3",
    inputTypical: "short prompt",
    outputTypical: "1 image",
    frequencyHint: "few per book",
    status: "premium",
    creditCost: 4,
    freeMaxPerPeriod: 0,
    notes: "Image economics; Ideogram later via provider layer",
    legacyUsageField: "ghostWriterCount",
  },
  {
    id: "writing-vault",
    world: "writer",
    name: "Writing Vault (AI assist)",
    aiFunction: "Optional AI expansion of vault prompts",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short–medium",
    frequencyHint: "occasional",
    status: "mixed",
    creditCost: 1,
    legacyUsageField: "ghostWriterCount",
  },
  {
    id: "write-something",
    world: "writer",
    name: "Write Something",
    aiFunction: "Structure / draft / edit freelance copy",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "brief + notes",
    outputTypical: "medium draft",
    frequencyHint: "per client job",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "pitch-templates",
    world: "writer",
    name: "Pitch Templates",
    aiFunction: "Generate pitch copy from template",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short form",
    outputTypical: "short–medium",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "one-shot-formatter",
    world: "writer",
    name: "One-Shot Formatter",
    aiFunction: "Format one-shot fiction",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "medium",
    outputTypical: "medium",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "micro-serial",
    world: "writer",
    name: "Micro-Serial Mode",
    aiFunction: "Outline / part assist for micro-serials",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short–medium",
    outputTypical: "medium",
    frequencyHint: "per episode",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "self-interview-builder",
    world: "writer",
    name: "Self-Interview Builder",
    aiFunction: "Draft / refine interview manuscript",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "medium",
    outputTypical: "medium–large",
    frequencyHint: "project-based",
    status: "premium",
    creditCost: 3,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "outline-builder",
    world: "writer",
    name: "Outline Builder",
    aiFunction: "Generate story outlines",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "medium",
    frequencyHint: "project start",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "script-analyzer",
    world: "screenwriter",
    name: "Script Analyzer",
    aiFunction: "Deep screenplay coverage / analysis",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "scene to full script",
    outputTypical: "large structured analysis",
    frequencyHint: "per draft pass",
    status: "mixed",
    creditCost: 5,
    freeMaxPerPeriod: 1,
    maxInputChars: 80000,
    notes: "Full script analysis band",
    legacyUsageField: "scriptAnalyzerCount",
  },
  {
    id: "pitch-synopsis",
    world: "screenwriter",
    name: "Pitch Synopsis AI",
    aiFunction: "Generate synopsis for pitch",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "project notes",
    outputTypical: "short–medium",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "query-letter",
    world: "screenwriter",
    name: "Query Letter AI",
    aiFunction: "Generate query letter",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "project notes",
    outputTypical: "short",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "pitch-deck",
    world: "screenwriter",
    name: "Pitch Deck AI",
    aiFunction: "Generate pitch deck copy",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "project notes",
    outputTypical: "medium",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 3,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "study-planner",
    world: "student",
    name: "Study Planner",
    aiFunction: "Build study plan",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short form",
    outputTypical: "medium",
    frequencyHint: "weekly",
    status: "mixed",
    creditCost: 1,
    legacyUsageField: "studentHubCount",
  },
  {
    id: "flashcards",
    world: "student",
    name: "Active Recall Flashcards",
    aiFunction: "Generate flashcards",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "notes / topic",
    outputTypical: "medium",
    frequencyHint: "study sessions",
    status: "mixed",
    creditCost: 1,
    legacyUsageField: "studentHubCount",
  },
  {
    id: "citation",
    world: "student",
    name: "Citation Generator",
    aiFunction: "Format citations",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short",
    frequencyHint: "per paper",
    status: "mixed",
    creditCost: 1,
    legacyUsageField: "studentHubCount",
  },
  {
    id: "video-finder",
    world: "student",
    name: "Course Video Finder",
    aiFunction: "Suggest learning videos",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short–medium",
    frequencyHint: "occasional",
    status: "mixed",
    creditCost: 1,
    legacyUsageField: "studentHubCount",
  },
  {
    id: "essay-writer",
    world: "student",
    name: "Essay & Project Writer",
    aiFunction: "Draft essays / projects",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "brief + outline",
    outputTypical: "large",
    frequencyHint: "per assignment",
    status: "premium",
    creditCost: 3,
    freeMaxPerPeriod: 0,
    legacyUsageField: "studentHubCount",
  },
  {
    id: "book-blurb",
    world: "wealth",
    name: "Book Blurb Writer",
    aiFunction: "Marketing blurb",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 1,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "author-bio",
    world: "wealth",
    name: "Author Bio Generator",
    aiFunction: "Author bio copy",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short",
    frequencyHint: "rare",
    status: "premium",
    creditCost: 1,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "press-release",
    world: "wealth",
    name: "Press Release Writer",
    aiFunction: "Press release draft",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short–medium",
    outputTypical: "medium",
    frequencyHint: "rare",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "booktok-hook",
    world: "wealth",
    name: "BookTok Strategy",
    aiFunction: "Social hooks",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short",
    frequencyHint: "campaign",
    status: "premium",
    creditCost: 1,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "medium-outline",
    world: "wealth",
    name: "Medium Strategy",
    aiFunction: "Article outline strategy",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "medium",
    frequencyHint: "occasional",
    status: "premium",
    creditCost: 1,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "social-kit",
    world: "wealth",
    name: "Social Media Kit",
    aiFunction: "Social post kit",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "medium",
    frequencyHint: "campaign",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "web3-explainer",
    world: "web3",
    name: "Explainer Article Builder",
    aiFunction: "Web3 explainer outline/article",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "medium",
    outputTypical: "medium–large",
    frequencyHint: "per article",
    status: "premium",
    creditCost: 2,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "web3-docs",
    world: "web3",
    name: "Whitepaper & Docs Assistant",
    aiFunction: "Docs structure / document",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "medium",
    outputTypical: "large",
    frequencyHint: "project-based",
    status: "premium",
    creditCost: 3,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "web3-thread",
    world: "web3",
    name: "Social Thread Generator",
    aiFunction: "Thread generate / refine",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "medium",
    frequencyHint: "campaign",
    status: "premium",
    creditCost: 1,
    legacyUsageField: "wealthEngineCount",
  },
  {
    id: "web3-community",
    world: "web3",
    name: "Community Post Polish",
    aiFunction: "Polish community posts",
    provider: "openai",
    modelHint: "gpt-4o-mini",
    inputTypical: "short",
    outputTypical: "short",
    frequencyHint: "frequent light",
    status: "premium",
    creditCost: 1,
    legacyUsageField: "wealthEngineCount",
  },
];

export function getAiFeature(id: string): AiFeatureInventoryItem | null {
  return AI_FEATURE_INVENTORY.find((f) => f.id === id) || null;
}

export function getCreditCost(toolId: string): number {
  const feature = getAiFeature(toolId);
  return feature?.creditCost ?? 1;
}
