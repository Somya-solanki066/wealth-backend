import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Firestore Collections for Writing Vault Hub Sections
export const VAULT_COLLECTIONS = {
  SPARKS: "writingVaultSparks",
  CONTESTS: "writingVaultContests",
  MOTION: "writingVaultMotion",
  GAMES: "writingVaultGames",
  ARENA: "writingVaultArena",
  CONFIG: "writingVaultConfig",
} as const;

export type VaultHubSection = keyof typeof VAULT_COLLECTIONS;

// Default Data (from Prototype) for Seeding and Fallbacks
export const DEFAULT_SPARKS = [
  {
    id: "spark_1",
    text: "Write the moment a promise breaks, in exactly 100 words.",
    words: 100,
    mins: 8,
    order: 1,
    isActive: true,
  },
  {
    id: "spark_2",
    text: "Your character finds a door that was not there yesterday. Write what is on the other side.",
    words: 150,
    mins: 10,
    order: 2,
    isActive: true,
  },
  {
    id: "spark_3",
    text: "Two rivals are stuck in a lift. Show the tension without ever naming it.",
    words: 150,
    mins: 10,
    order: 3,
    isActive: true,
  },
  {
    id: "spark_4",
    text: "End a scene with a line that changes everything the reader believed.",
    words: 120,
    mins: 8,
    order: 4,
    isActive: true,
  },
];

export const DEFAULT_CONTESTS = [
  {
    id: "contest_c1",
    kind: "Daily challenge",
    title: "The 100-Word Door",
    brief: "Write exactly 100 words that begin with a door opening and end with a lie.",
    words: 100,
    left: "Ends tonight",
    entries: "412 entries",
    prize: "XP and a featured badge",
    dates: "Opens 12:00 AM, closes 11:59 PM today",
    judging: "Panel of 3 judges and the rubric below. Results the next morning.",
    sponsored: false,
    order: 1,
    isActive: true,
  },
  {
    id: "contest_c2",
    kind: "Weekly prompt contest",
    title: "The Last Letter",
    brief: "Write a scene built around a letter that arrives too late. Up to 600 words.",
    words: 600,
    left: "2 days 4 hours left",
    entries: "1,284 entries",
    prize: "Featured on the Home banner and a coaching call with Coach Victor",
    dates: "Opens Monday, closes Sunday 11:59 PM",
    judging: "Panel of 5 judges. Top 10 are read aloud in a live session.",
    sponsored: false,
    order: 2,
    isActive: true,
  },
  {
    id: "contest_c3",
    kind: "Partner contest",
    title: "Short Story Showcase",
    brief: "A 1,500-word story about a stranger who changes a town. (Sample partner contest layout.)",
    words: 1500,
    left: "18 days left",
    entries: "206 entries",
    prize: "Set by the partner. Shown here before you enter.",
    dates: "Opens 1st, closes 28th",
    judging: "Judged by the partner's editors.",
    sponsored: true,
    order: 3,
    isActive: true,
  },
];

export const DEFAULT_MOTION = [
  {
    id: "motion_romance",
    genre: "Romance",
    title: "Rain at Platform 9",
    gradientColors: ["#3A2A6B", "#C4577A", "#F3B27A"],
    segments: [
      "Rain hammers the station roof. A woman checks her watch for the tenth time. Her train is gone.",
      "A stranger lowers an umbrella over her head without a word. His hand is shaking.",
      "The last announcement echoes. Neither of them moves.",
    ],
    questions: [
      "She looks up at him. What does she say, and what does she notice about his face?",
      "He finally speaks. What does he confess, and why now?",
      "The platform lights go out. Write the last line of the scene.",
    ],
    order: 1,
    isActive: true,
  },
  {
    id: "motion_horror",
    genre: "Horror",
    title: "The Corridor",
    gradientColors: ["#050714", "#1B1F3A", "#4A1F2A"],
    segments: [
      "A hospital corridor at 3 a.m. Every light flickers in turn, moving toward you.",
      "A trolley rolls by, empty. The wheel squeaks a lullaby.",
      "At the far end, a door you have never seen is slightly open.",
    ],
    questions: [
      "What do you do first, and what do you hear?",
      "Who or what pushed the trolley? Describe it.",
      "You reach the door. Write what is behind it, in two lines.",
    ],
    order: 2,
    isActive: true,
  },
  {
    id: "motion_fantasy",
    genre: "Fantasy",
    title: "The Dragon's Bell",
    gradientColors: ["#0F3A52", "#2B8A7E", "#E8C26A"],
    segments: [
      "A mountain village at dawn. The temple bell rings by itself, three times.",
      "Far above the clouds, something enormous turns its head.",
      "A girl with ash on her sleeves steps into the road.",
    ],
    questions: [
      "Why did the bell ring, and what do the villagers fear?",
      "Describe the creature and what it wants.",
      "The girl speaks to it. What are her first words?",
    ],
    order: 3,
    isActive: true,
  },
  {
    id: "motion_thriller",
    genre: "Thriller",
    title: "Platform Zero",
    gradientColors: ["#10151F", "#1E3A5F", "#7A8AA0"],
    segments: [
      "A city at night. A man in a grey coat leaves a bag on a bench and walks away fast.",
      "A woman across the street sees his face and goes pale.",
      "Her phone buzzes. The message has her name and an address.",
    ],
    questions: [
      "What is in the bag, and why does he leave it?",
      "Why does his face frighten her?",
      "She reads the message. Write what she does next.",
    ],
    order: 4,
    isActive: true,
  },
];

export const DEFAULT_GAMES = {
  scrambleWords: [
    { word: "PROTAGONIST", hint: "The main character" },
    { word: "CLIFFHANGER", hint: "A suspenseful chapter ending" },
    { word: "METAPHOR", hint: "One thing described as another" },
    { word: "ANTAGONIST", hint: "The force against the hero" },
    { word: "FORESHADOW", hint: "Hint at what is coming" },
  ],
  logicPuzzle: {
    title: "The Missing Manuscript",
    intro:
      "Only three people had a key: the editor, the intern and the cleaner. Read the clues, then choose who took it.",
    clues: [
      "1. The window was locked from the inside.",
      "2. There was coffee on the manuscript's last page, and on the intern's sleeve.",
      "3. The editor was on a recorded call at the time.",
      "4. The cleaner's shift ended an hour before the manuscript was last seen.",
    ],
    options: ["The editor", "The intern", "The cleaner"],
    solution: "The intern",
    explanation:
      "The intern is the only one with coffee on their sleeve, a key, and no alibi. The editor was recorded and the cleaner had left.",
  },
  wordSearch: {
    targetWords: ["PLOT", "HERO", "TWIST", "VOICE", "HOOK"],
    grid: [
      ["P", "L", "O", "T", "X", "Y", "Z", "H"],
      ["A", "B", "C", "D", "E", "F", "G", "E"],
      ["Q", "T", "W", "I", "S", "T", "K", "R"],
      ["M", "N", "O", "P", "R", "S", "T", "O"],
      ["H", "O", "O", "K", "U", "V", "W", "X"],
      ["Y", "Z", "V", "O", "I", "C", "E", "A"],
      ["B", "C", "D", "E", "F", "G", "H", "I"],
      ["J", "K", "L", "M", "N", "O", "P", "Q"],
    ],
  },
};

export const DEFAULT_TICKER = [
  "Prompt Duel starts in 02:14",
  "128 writers online",
  "Weekly contest closes in 2d 4h",
  "New: Horror Adventure is live",
  "Chioma A. just won a Character Clash",
];

// ——————————————————————————————————————————————————————————
// CLIENT-FACING HUB AGGREGATOR
// ——————————————————————————————————————————————————————————

export async function getWritingVaultHubData() {
  const db = getFirestore();

  let sparks = DEFAULT_SPARKS;
  let contests = DEFAULT_CONTESTS;
  let motion = DEFAULT_MOTION;
  let games = DEFAULT_GAMES;
  let ticker = DEFAULT_TICKER;

  try {
    const [sparksSnap, contestsSnap, motionSnap, gamesSnap, configSnap] = await Promise.all([
      db.collection(VAULT_COLLECTIONS.SPARKS).where("isActive", "==", true).get().catch(() => null),
      db.collection(VAULT_COLLECTIONS.CONTESTS).where("isActive", "==", true).get().catch(() => null),
      db.collection(VAULT_COLLECTIONS.MOTION).where("isActive", "==", true).get().catch(() => null),
      db.collection(VAULT_COLLECTIONS.GAMES).doc("main").get().catch(() => null),
      db.collection(VAULT_COLLECTIONS.CONFIG).doc("general").get().catch(() => null),
    ]);

    if (sparksSnap && !sparksSnap.empty) {
      sparks = sparksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any;
      sparks.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    }

    if (contestsSnap && !contestsSnap.empty) {
      contests = contestsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any;
      contests.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    }

    if (motionSnap && !motionSnap.empty) {
      motion = motionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any;
      motion.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    }

    if (gamesSnap && gamesSnap.exists) {
      games = gamesSnap.data() as any;
    }

    if (configSnap && configSnap.exists) {
      const data = configSnap.data();
      if (Array.isArray(data?.ticker) && data.ticker.length > 0) {
        ticker = data.ticker;
      }
    }
  } catch (err) {
    console.warn("Writing Vault Hub DB fetch fallback to defaults:", err);
  }

  return {
    sparks,
    contests,
    motion,
    games,
    ticker,
    leaderboard: [
      { rank: 1, name: "Chioma A.", initials: "CA", xp: "1,820 XP" },
      { rank: 2, name: "Tobi M.", initials: "TM", xp: "1,655 XP" },
      { rank: 3, name: "Zainab K.", initials: "ZK", xp: "1,490 XP" },
    ],
  };
}

// ——————————————————————————————————————————————————————————
// ADMIN SECTION CONTROLLERS (CRUD & SEEDING)
// ——————————————————————————————————————————————————————————

export async function adminGetVaultSection(section: string) {
  const db = getFirestore();
  const sec = section.toLowerCase();

  if (sec === "sparks") {
    const snap = await db.collection(VAULT_COLLECTIONS.SPARKS).get();
    if (snap.empty) return DEFAULT_SPARKS;
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (sec === "contests") {
    const snap = await db.collection(VAULT_COLLECTIONS.CONTESTS).get();
    if (snap.empty) return DEFAULT_CONTESTS;
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (sec === "motion") {
    const snap = await db.collection(VAULT_COLLECTIONS.MOTION).get();
    if (snap.empty) return DEFAULT_MOTION;
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (sec === "games") {
    const snap = await db.collection(VAULT_COLLECTIONS.GAMES).doc("main").get();
    if (!snap.exists) return DEFAULT_GAMES;
    return snap.data();
  }

  if (sec === "config" || sec === "ticker") {
    const snap = await db.collection(VAULT_COLLECTIONS.CONFIG).doc("general").get();
    if (!snap.exists) return { ticker: DEFAULT_TICKER };
    return snap.data();
  }

  throw Object.assign(new Error(`Invalid vault section: ${section}`), { status: 400 });
}

export async function adminUpsertVaultItem(
  section: string,
  data: any,
  id?: string,
  adminId?: string
) {
  const db = getFirestore();
  const sec = section.toLowerCase();

  const basePayload = {
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminId || "admin",
  };

  if (sec === "sparks") {
    const collection = db.collection(VAULT_COLLECTIONS.SPARKS);
    if (id) {
      await collection.doc(id).set(basePayload, { merge: true });
      return { id };
    }
    const ref = await collection.add({
      ...basePayload,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  }

  if (sec === "contests") {
    const collection = db.collection(VAULT_COLLECTIONS.CONTESTS);
    if (id) {
      await collection.doc(id).set(basePayload, { merge: true });
      return { id };
    }
    const ref = await collection.add({
      ...basePayload,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  }

  if (sec === "motion") {
    const collection = db.collection(VAULT_COLLECTIONS.MOTION);
    if (id) {
      await collection.doc(id).set(basePayload, { merge: true });
      return { id };
    }
    const ref = await collection.add({
      ...basePayload,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  }

  if (sec === "games") {
    await db.collection(VAULT_COLLECTIONS.GAMES).doc("main").set(basePayload, { merge: true });
    return { id: "main" };
  }

  if (sec === "config" || sec === "ticker") {
    await db.collection(VAULT_COLLECTIONS.CONFIG).doc("general").set(basePayload, { merge: true });
    return { id: "general" };
  }

  throw Object.assign(new Error(`Invalid vault section: ${section}`), { status: 400 });
}

export async function adminDeleteVaultItem(section: string, id: string) {
  const db = getFirestore();
  const sec = section.toLowerCase();

  if (sec === "sparks") {
    await db.collection(VAULT_COLLECTIONS.SPARKS).doc(id).delete();
    return { ok: true };
  }

  if (sec === "contests") {
    await db.collection(VAULT_COLLECTIONS.CONTESTS).doc(id).delete();
    return { ok: true };
  }

  if (sec === "motion") {
    await db.collection(VAULT_COLLECTIONS.MOTION).doc(id).delete();
    return { ok: true };
  }

  throw Object.assign(new Error(`Section ${section} does not support deleting individual documents`), { status: 400 });
}

export async function adminSeedAllHubDefaults(adminId?: string) {
  const db = getFirestore();
  const batch = db.batch();

  // 1. Seed Sparks
  for (const s of DEFAULT_SPARKS) {
    const ref = db.collection(VAULT_COLLECTIONS.SPARKS).doc(s.id);
    batch.set(ref, {
      ...s,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      addedBy: adminId || "seed",
    }, { merge: true });
  }

  // 2. Seed Contests
  for (const c of DEFAULT_CONTESTS) {
    const ref = db.collection(VAULT_COLLECTIONS.CONTESTS).doc(c.id);
    batch.set(ref, {
      ...c,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      addedBy: adminId || "seed",
    }, { merge: true });
  }

  // 3. Seed Motion
  for (const m of DEFAULT_MOTION) {
    const ref = db.collection(VAULT_COLLECTIONS.MOTION).doc(m.id);
    batch.set(ref, {
      ...m,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      addedBy: adminId || "seed",
    }, { merge: true });
  }

  // 4. Seed Games
  const gamesRef = db.collection(VAULT_COLLECTIONS.GAMES).doc("main");
  batch.set(gamesRef, {
    ...DEFAULT_GAMES,
    updatedAt: FieldValue.serverTimestamp(),
    addedBy: adminId || "seed",
  }, { merge: true });

  // 5. Seed Config/Ticker
  const configRef = db.collection(VAULT_COLLECTIONS.CONFIG).doc("general");
  batch.set(configRef, {
    ticker: DEFAULT_TICKER,
    updatedAt: FieldValue.serverTimestamp(),
    addedBy: adminId || "seed",
  }, { merge: true });

  await batch.commit();
  return { ok: true, message: "Successfully seeded Writing Vault Hub sections." };
}
