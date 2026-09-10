export const VAULT_CATEGORIES = [
  {
    id: "fire_starters",
    label: "Fire Starters",
    description: "Story starts and plot ideas when the page is blank.",
  },
  {
    id: "scene_builders",
    label: "Scene Builders",
    description: "Build a scene inside an existing story.",
  },
  {
    id: "character_voice",
    label: "Character Voice",
    description: "Dialogue and personality exploration prompts.",
  },
] as const;

export type VaultCategoryId = (typeof VAULT_CATEGORIES)[number]["id"];

export const VAULT_GENRES = [
  "All Genres",
  "Werewolf",
  "Vampire",
  "Billionaire",
  "Romance",
  "Fantasy",
  "Thriller",
  "Mystery",
  "Urban Fiction",
  "Dark Romance",
  "Historical",
] as const;

export const VAULT_TONES = [
  "Any",
  "Dark",
  "Emotional",
  "Romantic",
  "Suspenseful",
  "Humorous",
  "Dramatic",
] as const;

export type SeedPrompt = {
  category: VaultCategoryId;
  genre: string;
  tone: string;
  promptText: string;
  title?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
};

/** Curated library used when Firestore has no matching published prompts. */
export const SEED_PROMPTS: SeedPrompt[] = [
  // Fire Starters
  {
    category: "fire_starters",
    genre: "Werewolf",
    tone: "Dark",
    title: "The rule that broke",
    promptText:
      "The pack had a rule for everything except this — and the night they broke it, the alpha's mate was standing on the wrong side of the border.",
  },
  {
    category: "fire_starters",
    genre: "Romance",
    tone: "Emotional",
    promptText:
      "The person who disappeared ten years ago suddenly walks into the protagonist's wedding — as the best man's plus-one.",
  },
  {
    category: "fire_starters",
    genre: "Thriller",
    tone: "Suspenseful",
    promptText:
      "He had spent years hunting monsters. Tonight, the monster was asking him for help.",
  },
  {
    category: "fire_starters",
    genre: "Dark Romance",
    tone: "Dark",
    promptText:
      "She knew exactly who had betrayed her, but she needed him alive until midnight.",
  },
  {
    category: "fire_starters",
    genre: "Vampire",
    tone: "Dramatic",
    promptText:
      "The alpha discovers that the human he has been ordered to kill is his destined mate.",
  },
  {
    category: "fire_starters",
    genre: "Billionaire",
    tone: "Romantic",
    promptText:
      "She'd promised herself she wouldn't come back to this house. Three knocks later, she was standing in the doorway anyway.",
  },
  {
    category: "fire_starters",
    genre: "Fantasy",
    tone: "Suspenseful",
    promptText:
      "The prophecy named the wrong person — and the real chosen one has been cleaning castle floors for seventeen years.",
  },
  {
    category: "fire_starters",
    genre: "Mystery",
    tone: "Dark",
    promptText:
      "Every letter arrives addressed to someone who died last week. This morning, one arrived with your name.",
  },
  {
    category: "fire_starters",
    genre: "Urban Fiction",
    tone: "Dramatic",
    promptText:
      "The city pays people to forget. Tonight someone paid your sister to forget you — and she took the money.",
  },
  {
    category: "fire_starters",
    genre: "Historical",
    tone: "Emotional",
    promptText:
      "On the eve of the treaty, the queen finds a child's drawing of the enemy king tucked inside her late husband's Bible.",
  },

  // Scene Builders
  {
    category: "scene_builders",
    genre: "Thriller",
    tone: "Suspenseful",
    promptText:
      "Two characters are trapped together during a power outage, but one of them knows something the other must never discover.",
  },
  {
    category: "scene_builders",
    genre: "Werewolf",
    tone: "Dark",
    promptText:
      "Luna discovers Kael meeting Ryder in the forbidden forest, but instead of confronting them, she follows them into the ruins.",
  },
  {
    category: "scene_builders",
    genre: "Vampire",
    tone: "Romantic",
    promptText:
      "Write the scene where your vampire protagonist must feed in front of the human they are falling for — without revealing what they are.",
  },
  {
    category: "scene_builders",
    genre: "Romance",
    tone: "Emotional",
    promptText:
      "At a crowded airport gate, they share one last goodbye. Mid-sentence, the boarding call for the wrong flight starts — and only one of them notices.",
  },
  {
    category: "scene_builders",
    genre: "Billionaire",
    tone: "Humorous",
    promptText:
      "Your CEO protagonist's secret identity is about to be exposed at a charity gala by a waitress who used to be their college roommate.",
  },
  {
    category: "scene_builders",
    genre: "Dark Romance",
    tone: "Dark",
    promptText:
      "He brings her a gift. She already knows it belonged to the last person who tried to leave him.",
  },
  {
    category: "scene_builders",
    genre: "Fantasy",
    tone: "Dramatic",
    promptText:
      "During a coronation feast, the hero's magic fails for the first time — and the court is watching.",
  },
  {
    category: "scene_builders",
    genre: "Mystery",
    tone: "Suspenseful",
    promptText:
      "The detective returns to the crime scene alone at 3 a.m. and finds a second version of the same body — still warm.",
  },
  {
    category: "scene_builders",
    genre: "Urban Fiction",
    tone: "Dramatic",
    promptText:
      "A street deal goes sideways when both sides realize the courier is the missing sibling they have been searching for.",
  },
  {
    category: "scene_builders",
    genre: "Historical",
    tone: "Emotional",
    promptText:
      "In a candlelit war tent, an enemy messenger delivers peace terms — written in the handwriting of someone who should be dead.",
  },

  // Character Voice
  {
    category: "character_voice",
    genre: "Romance",
    tone: "Emotional",
    promptText:
      "Write a conversation where the character tries to hide jealousy while pretending to be completely indifferent.",
  },
  {
    category: "character_voice",
    genre: "Werewolf",
    tone: "Dark",
    promptText:
      "Write your alpha's internal monologue as they refuse to claim their mate in public — and the one line they almost say out loud.",
  },
  {
    category: "character_voice",
    genre: "Vampire",
    tone: "Suspenseful",
    promptText:
      "Your character must lie about where they were last night. Every answer is technically true and completely misleading.",
  },
  {
    category: "character_voice",
    genre: "Billionaire",
    tone: "Humorous",
    promptText:
      "Write a voice note your character records and deletes three times before sending a three-word text instead.",
  },
  {
    category: "character_voice",
    genre: "Dark Romance",
    tone: "Dark",
    promptText:
      "Write dialogue where your character apologizes without admitting they were wrong — and the other character calls them on it.",
  },
  {
    category: "character_voice",
    genre: "Fantasy",
    tone: "Dramatic",
    promptText:
      "Your character swears an oath they already plan to break. Capture the exact wording they choose so they can sleep at night.",
  },
  {
    category: "character_voice",
    genre: "Thriller",
    tone: "Suspenseful",
    promptText:
      "Write a phone call where your character keeps the other person talking long enough for someone else to arrive.",
  },
  {
    category: "character_voice",
    genre: "Mystery",
    tone: "Emotional",
    promptText:
      "Your character describes the victim as a stranger — then accidentally uses a nickname only family would know.",
  },
  {
    category: "character_voice",
    genre: "Urban Fiction",
    tone: "Dramatic",
    promptText:
      "Write an argument between siblings where neither says the real issue: one of them is leaving the neighborhood forever.",
  },
  {
    category: "character_voice",
    genre: "Historical",
    tone: "Romantic",
    promptText:
      "Write a letter your character burns halfway through — include the unfinished sentence they cannot bring themselves to finish.",
  },
];

export function isVaultCategoryId(value: string): value is VaultCategoryId {
  return VAULT_CATEGORIES.some((c) => c.id === value);
}

export function normalizeGenre(genre?: string | null): string {
  const g = String(genre || "").trim();
  if (!g || /^all(\s+genres)?$/i.test(g)) return "All Genres";
  return g;
}

export function normalizeTone(tone?: string | null): string {
  const t = String(tone || "").trim();
  if (!t || /^any$/i.test(t)) return "Any";
  return t;
}
