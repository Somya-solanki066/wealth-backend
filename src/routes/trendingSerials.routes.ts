import express from "express";
import fs from "fs";
import path from "path";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";
import { getUploadsDir } from "../utils/paths";

const router = express.Router();

export interface SerialChapter {
  id: string;
  index: number;
  title: string;
  readTime: string;
  content: string;
  createdAt?: string;
}

export interface SerialCommentReply {
  id: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
  likes: number;
}

export interface SerialComment {
  id: string;
  serialId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
  likes: number;
  replies: SerialCommentReply[];
}

export interface TrendingSerial {
  id: string;
  title: string;
  sub: string; // Category / genre e.g. "Werewolf romance"
  category: string;
  author: string;
  tagline: string;
  tags: string[];
  rating: string;
  chaptersTotal: number;
  reads: number; // Raw count e.g. 2400000
  likes: number; // Raw count e.g. 14200
  shares: number;
  commentsCount: number;
  status: "Ongoing" | "Completed";
  blurb: string;
  img: string; // Cover image URL or data URI
  coverUrl: string;
  chapters: SerialChapter[];
  createdAt: string;
  updatedAt: string;
  order?: number;
}

// Ensure default prototype images are written to uploads/trending-serials if needed
function ensurePrototypeImagesDir(): string {
  const uploadsDir = getUploadsDir();
  const dir = path.join(uploadsDir, "trending-serials");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Default 6 prototype serials
const SEED_SERIALS: Omit<TrendingSerial, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "The Alpha's Hidden Mate",
    sub: "Werewolf romance",
    category: "Werewolf romance",
    author: "Ink2Wealth Author",
    tagline: "Some bonds are written in blood, not just in souls.",
    tags: ["Werewolf", "Fated mates", "Hidden identity", "Slow burn"],
    rating: "4.8",
    chaptersTotal: 112,
    reads: 2400000,
    likes: 14200,
    shares: 3100,
    commentsCount: 128,
    status: "Ongoing",
    blurb:
      "Mara has spent her whole life hiding what she is. When the most feared Alpha in the territory catches her scent at the border, the secret she buried begins to burn. He has hunted for his mate for years. She would rather vanish than be found.",
    img: "book0",
    coverUrl: "",
    order: 0,
    chapters: [
      {
        id: "chap-1",
        index: 1,
        title: "The Scent at the Border",
        readTime: "4 min read",
        content:
          "The border smelled of rain and iron. Mara kept her head down and her breath shallow, the way she had practised every day for nineteen years. Behind her, the trees went quiet. Not the quiet of sleep. The quiet of something enormous deciding to turn around.\n\nShe did not look back. She did not need to. The air itself bent toward him, heavy and warm, and her pulse answered a name she had never spoken aloud.",
      },
      {
        id: "chap-2",
        index: 2,
        title: "A Name She Never Gave",
        readTime: "5 min read",
        content:
          "The Alpha stood at the edge of the treeline, close enough now that she could see the gold in his eyes. He did not growl. He did not move. He simply breathed her in, slowly, as if a lifetime of searching had ended with a single breath.\n\n\"You are not from this pack,\" he said, and his voice was quieter than she expected. \"But you are not a stranger either.\"\n\nMara had rehearsed this moment in nightmares. In every one of them she ran. Now her feet would not move. The old rule her mother had taught her, never let a wolf name what you are, rang in her head like a bell. \"I am only passing through,\" she said. It was the weakest lie she had ever told.",
      },
      {
        id: "chap-3",
        index: 3,
        title: "Moonrise Council",
        readTime: "6 min read",
        content:
          "He smiled then, a small, tired smile that did not belong to the monster in the stories. \"Passing through,\" he repeated. \"Then let me walk you to the river. The woods are not safe tonight.\" Behind him, the pack stood still as stone, every eye on the girl who smelled like home and like danger.\n\nShe should have refused. She knew it. But when he turned and began to walk, the thread between them pulled tight, and Mara followed, because for the first time in nineteen years something inside her had stopped running.",
      },
      {
        id: "chap-4",
        index: 4,
        title: "The Mark",
        readTime: "5 min read",
        content:
          "The Moonrise Council had gathered in the ancient stone clearing. Every elder watched Mara as she stood beside the Alpha. A mark had appeared on her collarbone, faint silver under the torchlight, mirroring the crest on his signet ring.\n\n\"You brought an outsider to the sacred hearth,\" Elder Corin rasped. The Alpha didn't blink. \"She is no outsider,\" he answered, his voice echoing off the pine trees. \"She is the missing heir of the Silver Creek line.\"",
      },
      {
        id: "chap-5",
        index: 5,
        title: "What the Pack Remembers",
        readTime: "7 min read",
        content:
          "Mara remembered the night her mother packed the small leather satchel and whispered, \"Run until the trees change color.\" She was only seven then. Now the scent of burning cedar brought every forgotten memory rushing back like a flood.\n\nThe pack bowed their heads one by one. Mara looked at the Alpha, and for the first time in nineteen years, the fear was gone.",
      },
    ],
  },
  {
    title: "The Dragon's Heir",
    sub: "Fantasy romance",
    category: "Fantasy romance",
    author: "Ink2Wealth Author",
    tagline: "A kingdom. A prophecy. Her destiny.",
    tags: ["Dragons", "Royal court", "Prophecy", "Enemies to lovers"],
    rating: "4.7",
    chaptersTotal: 96,
    reads: 1900000,
    likes: 11800,
    shares: 2400,
    commentsCount: 94,
    status: "Ongoing",
    blurb:
      "The old queen's last words named an heir no one expected: a servant girl with ash on her hands. Now the court wants her gone, the dragons want her chosen, and the only man who can protect her is the one sworn to end her bloodline.",
    img: "book1",
    coverUrl: "",
    order: 1,
    chapters: [
      {
        id: "chap-1",
        index: 1,
        title: "Ash on the Stairs",
        readTime: "4 min read",
        content:
          "Ash still clung to Nia's sleeves when the bell began to ring for the dead queen. Servants were meant to kneel and stay invisible. Instead the great doors opened, and every lord in the hall turned to look at her.\n\nSomewhere above the roof, wings the size of sails folded against the wind. The dragons had come for the funeral. They stayed for her.",
      },
      {
        id: "chap-2",
        index: 2,
        title: "The Last Words of the Queen",
        readTime: "5 min read",
        content:
          "Lord Havric was the first to speak. \"This is an insult to the throne,\" he said, and the hall rumbled agreement. Nia kept her eyes on the floor, on the soot she had carried in on her shoes. She had only come to deliver the funeral wine. She had not asked for a hundred stares and the weight of a name read aloud by a dying woman.",
      },
      {
        id: "chap-3",
        index: 3,
        title: "A Crown Nobody Wanted",
        readTime: "6 min read",
        content:
          "A hush rolled across the room as the herald unrolled the scroll. \"By the queen's final decree,\" he read, hands shaking, \"the crown passes to the one the dragons will not burn.\" Nobody laughed. Everybody looked at the doors, where the shadow of a wing had begun to cover the light.",
      },
      {
        id: "chap-4",
        index: 4,
        title: "What the Dragon Saw",
        readTime: "6 min read",
        content:
          "The great red dragon landed in the courtyard with a sound like thunder. Stone cracked. Torches guttered. And through the smoke came Prince Kael, sword drawn, his gaze fixed not on the beast but on the girl standing in its path. \"Step away from her,\" he told the dragon. Then, quieter, to Nia: \"Run.\"",
      },
      {
        id: "chap-5",
        index: 5,
        title: "The Oath at Midnight",
        readTime: "7 min read",
        content:
          "She did not run. She did something far more dangerous. She walked toward the dragon, hand outstretched, ash still staining her fingers, and the whole kingdom held its breath as the creature lowered its enormous head and let her touch its scales.",
      },
    ],
  },
  {
    title: "Vampire Prince",
    sub: "Vampire romance",
    category: "Vampire romance",
    author: "Ink2Wealth Author",
    tagline: "He rules the night. She owns his heart.",
    tags: ["Vampires", "Forbidden love", "Royal bloodlines", "Dark romance"],
    rating: "4.6",
    chaptersTotal: 84,
    reads: 1600000,
    likes: 9800,
    shares: 1800,
    commentsCount: 68,
    status: "Ongoing",
    blurb:
      "Every night the prince feeds on the city's secrets. Then a human archivist walks into his court and reads his name out of a book that was supposed to be burned. He should silence her. Instead he cannot stop asking her to stay.",
    img: "book2",
    coverUrl: "",
    order: 2,
    chapters: [
      {
        id: "chap-1",
        index: 1,
        title: "The Archivist",
        readTime: "4 min read",
        content:
          "The archive beneath the palace was never meant to be found. Lena found it on a Tuesday, because the lamp she followed was burning and nobody had lit it. The book on the table opened itself to a name written in red.\n\nBehind her, a voice said her name softly, as if tasting it. \"You were not supposed to read that,\" said the prince. He did not sound angry. He sounded afraid.",
      },
      {
        id: "chap-2",
        index: 2,
        title: "Ink and Blood",
        readTime: "5 min read",
        content:
          "\"Please,\" Lena whispered, though she was not sure whether she was asking him to leave or to stay. The prince crossed the room without a sound. Up close he was younger than the portraits, and far more tired. His eyes were the colour of candle smoke.",
      },
      {
        id: "chap-3",
        index: 3,
        title: "Invitation After Dark",
        readTime: "5 min read",
        content:
          "\"That book is a record of everyone who has ever tried to kill me,\" he said. \"Your name is not in it. Yet.\" He let the word hang in the air like a blade. Lena swallowed. \"Then why is the page warm?\" she asked. For the first time, the prince looked startled.",
      },
      {
        id: "chap-4",
        index: 4,
        title: "Rules of the Court",
        readTime: "6 min read",
        content:
          "He stepped closer, and the lamp flames leaned toward him. \"Because the book writes itself,\" he said slowly. \"And it only grows warm for someone it has chosen.\" He should have been furious. Instead he looked at her the way a man looks at a door he has spent centuries trying to open.",
      },
      {
        id: "chap-5",
        index: 5,
        title: "The Name in the Book",
        readTime: "6 min read",
        content:
          "Upstairs, the palace clock began to strike midnight. \"You have until the last bell to decide,\" said the prince, \"whether to run or to read the next page.\" Lena looked at the book. Then, against every instinct that had kept her alive, she turned the page.",
      },
    ],
  },
  {
    title: "Married Again",
    sub: "Second-chance romance",
    category: "Second-chance romance",
    author: "Ink2Wealth Author",
    tagline: "Some love stories get a second chance.",
    tags: ["Second chance", "Marriage", "Family drama", "Emotional"],
    rating: "4.9",
    chaptersTotal: 64,
    reads: 3100000,
    likes: 18400,
    shares: 4200,
    commentsCount: 156,
    status: "Completed",
    blurb:
      "Five years after the divorce, Adaeze is asked to plan a wedding, and the groom is the man she once promised forever. Vows are easy to say twice. Forgiving what broke the first ones is harder.",
    img: "book3",
    coverUrl: "",
    order: 3,
    chapters: [
      {
        id: "chap-1",
        index: 1,
        title: "The Invitation",
        readTime: "4 min read",
        content:
          "The invitation was cream-coloured and perfectly printed, and Adaeze hated how much she admired the handwriting. She turned it over twice before she let herself read the names. The first was a stranger's. The second was his.\n\nFive years was long enough to learn how to breathe around his memory. It was not long enough to learn how to stand in the same room and not remember everything.",
      },
      {
        id: "chap-2",
        index: 2,
        title: "Five Years Later",
        readTime: "5 min read",
        content:
          "She almost threw it away. She almost told the planner's office she was ill. Instead she found herself at the venue three days later, clipboard in hand, pretending the garden did not still smell of the jasmine they had once planted together outside their first flat.",
      },
      {
        id: "chap-3",
        index: 3,
        title: "A Dress for Someone Else",
        readTime: "6 min read",
        content:
          "\"Adaeze.\" His voice reached her before he did. She did not turn at once. She finished the line she was writing, steadied her hand, and only then looked up. Chidi stood in the doorway in a grey suit, older at the temples, carrying a box of white roses as if they might break.",
      },
      {
        id: "chap-4",
        index: 4,
        title: "The Rehearsal",
        readTime: "6 min read",
        content:
          "\"You look well,\" he said. \"I am working,\" she replied, and he nodded as though that were the answer he had hoped for. They walked the length of the aisle in silence, two professionals discussing chairs and lighting, while everything unsaid walked beside them.",
      },
      {
        id: "chap-5",
        index: 5,
        title: "What We Never Said",
        readTime: "7 min read",
        content:
          "At the end of the aisle he stopped. \"I am not the one getting married,\" he said quietly. \"My brother is. I did not know you would be the planner.\" Adaeze let out a breath she had been holding for five years. It did not feel like relief. It felt like the beginning of something she was not ready to name.",
      },
    ],
  },
  {
    title: "The Silent Client",
    sub: "Legal thriller",
    category: "Legal thriller",
    author: "Ink2Wealth Author",
    tagline: "Some secrets should stay buried.",
    tags: ["Legal drama", "Murder case", "Secrets", "Suspense"],
    rating: "4.7",
    chaptersTotal: 58,
    reads: 1200000,
    likes: 7600,
    shares: 1500,
    commentsCount: 52,
    status: "Ongoing",
    blurb:
      "Defense lawyer Chika takes a case with a client who will not say a word, not to the judge, not to her. The evidence says guilty. The silence says someone is being protected. With every file she opens, someone wants it closed.",
    img: "book4",
    coverUrl: "",
    order: 4,
    chapters: [
      {
        id: "chap-1",
        index: 1,
        title: "The Client Who Would Not Speak",
        readTime: "4 min read",
        content:
          "Chika had defended liars, thieves, and one very charming forger. She had never defended silence. The man across the table folded his hands and looked at the wall, and no question she asked made it past his eyes.\n\nThe file was thin. Too thin. Whoever built this case had removed everything that mattered and left only what would convict.",
      },
      {
        id: "chap-2",
        index: 2,
        title: "Exhibit A",
        readTime: "5 min read",
        content:
          "\"Mr. Okoye,\" she tried again. \"If you do not speak, I cannot save you.\" For the first time, his eyes moved from the wall to her face. He held her gaze for three full seconds, then slid a folded napkin across the table with two fingers.",
      },
      {
        id: "chap-3",
        index: 3,
        title: "Midnight at the Courthouse",
        readTime: "5 min read",
        content:
          "On it, in careful block letters, someone had written an address. Below the address, a single word: TUESDAY. Chika turned the napkin over. The back was blank. \"Who gave you this?\" she asked, and the guard at the door stirred as if he had heard something he should not have.",
      },
      {
        id: "chap-4",
        index: 4,
        title: "The Witness List",
        readTime: "6 min read",
        content:
          "By evening the address had led her to an empty warehouse, a locked door, and a key hanging from a nail as if someone had left it for her. Inside was one filing cabinet. Inside the cabinet were forty folders, and every folder had the name of a judge on it.",
      },
      {
        id: "chap-5",
        index: 5,
        title: "Not Guilty Yet",
        readTime: "7 min read",
        content:
          "Chika sat down on the cold floor with the first folder open on her knees. The date on the top page was tomorrow's. She read the first line twice. Then she closed the folder, picked up her phone, and realised that the only person she could call was the man who refused to speak.",
      },
    ],
  },
  {
    title: "The First Contact",
    sub: "Science fiction",
    category: "Science fiction",
    author: "Ink2Wealth Author",
    tagline: "Not everyone is alone.",
    tags: ["Science fiction", "First contact", "Space", "Mystery"],
    rating: "4.5",
    chaptersTotal: 72,
    reads: 980000,
    likes: 6200,
    shares: 1200,
    commentsCount: 45,
    status: "Ongoing",
    blurb:
      "When a signal answers a message sent forty years ago, linguist Zuri is the only person who can read it. The world wants a weapon, the agencies want a translator, and the voice on the other side wants her by name.",
    img: "book5",
    coverUrl: "",
    order: 5,
    chapters: [
      {
        id: "chap-1",
        index: 1,
        title: "The Signal",
        readTime: "4 min read",
        content:
          "The signal repeated every eleven seconds, and every eleven seconds the whole control room held its breath. Zuri pressed her headphones tighter. Under the noise there was a pattern, and under the pattern there was a voice.\n\nIt said a word she had not heard since her grandmother's kitchen, and it said it in her grandmother's accent.",
      },
      {
        id: "chap-2",
        index: 2,
        title: "Forty Years Late",
        readTime: "5 min read",
        content:
          "\"Run it again,\" said General Mbeki. Zuri ran it again. The word came back, soft and unmistakable, and the room filled with the sound of people trying not to breathe. \"It is not a word from any language we have,\" said the lead engineer. \"It is a word from mine,\" said Zuri.",
      },
      {
        id: "chap-3",
        index: 3,
        title: "A Voice That Knew Her",
        readTime: "5 min read",
        content:
          "No one spoke. Somewhere beyond the glass, the great dish turned its face to the stars. Zuri's hands were cold. She thought of her grandmother's kitchen, of the smell of palm oil and rain, of the lullaby no one else alive could possibly know. \"How is that possible?\" the general asked.",
      },
      {
        id: "chap-4",
        index: 4,
        title: "The Translation",
        readTime: "6 min read",
        content:
          "\"It is not,\" said Zuri. \"Unless they have been listening to us for much longer than forty years.\" A new line of symbols crawled across the screen. She leaned closer, reading, and felt the room tilt. The message was addressed. It had her name in it, spelled the way only her family spelled it.",
      },
      {
        id: "chap-5",
        index: 5,
        title: "What Answers Back",
        readTime: "7 min read",
        content:
          "The general reached for the red phone. \"Do not,\" said Zuri, without turning around. \"If they wanted soldiers, they would have asked for soldiers.\" On the screen the last symbol blinked once, patiently, like a hand held out in the dark. \"They asked for me. I think I should answer.\"",
      },
    ],
  },
];

const DEFAULT_COMMENTS = [
  {
    userName: "Amara O.",
    userAvatar: "AO",
    text: "I read this in one sitting. The end of chapter 3 had me gasping!",
    likes: 128,
    time: "2h ago",
    replies: [
      {
        id: "rep-1",
        userName: "Chioma B.",
        userAvatar: "CB",
        text: "Same here! The chemistry is unmatched.",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        likes: 14,
      },
    ],
  },
  {
    userName: "David K.",
    userAvatar: "DK",
    text: "The pacing is perfect. Please do not make us wait long for the next chapter.",
    likes: 64,
    time: "5h ago",
    replies: [],
  },
  {
    userName: "Ngozi E.",
    userAvatar: "NE",
    text: "Finally a story with a lead who does not make me roll my eyes. Subscribed.",
    likes: 41,
    time: "1d ago",
    replies: [],
  },
  {
    userName: "Tunde A.",
    userAvatar: "TA",
    text: "Ten out of ten. Recommending this to my whole book club.",
    likes: 19,
    time: "2d ago",
    replies: [],
  },
];

// Helper to seed Firestore with default serials and sample comments
async function runSeeder(force = false) {
  const db = getFirestore();
  const serialsCol = db.collection("trending_serials");
  const existing = await serialsCol.get();

  if (!force && !existing.empty) {
    return { count: existing.size, seeded: false };
  }

  ensurePrototypeImagesDir();

  const batch = db.batch();
  let count = 0;

  for (let i = 0; i < SEED_SERIALS.length; i++) {
    const raw = SEED_SERIALS[i];
    const docId = `serial-${i + 1}`;
    const docRef = serialsCol.doc(docId);

    const serialData: TrendingSerial = {
      ...raw,
      id: docId,
      coverUrl: raw.coverUrl || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(docRef, serialData);
    count++;
  }

  await batch.commit();

  // Seed sample comments for each serial
  for (let i = 0; i < SEED_SERIALS.length; i++) {
    const docId = `serial-${i + 1}`;
    const commentsCol = db.collection(`trending_serials/${docId}/comments`);
    const cSnapshot = await commentsCol.get();
    if (cSnapshot.empty) {
      for (let c = 0; c < DEFAULT_COMMENTS.length; c++) {
        const item = DEFAULT_COMMENTS[c];
        await commentsCol.doc(`cm-${c + 1}`).set({
          id: `cm-${c + 1}`,
          serialId: docId,
          userName: item.userName,
          userAvatar: item.userAvatar,
          text: item.text,
          createdAt: new Date(Date.now() - (c + 1) * 3600000 * 2).toISOString(),
          likes: item.likes,
          replies: item.replies,
        });
      }
    }
  }

  return { count, seeded: true };
}

// -------------------------------------------------------------
// PUBLIC ENDPOINTS
// -------------------------------------------------------------

// GET /api/trending-serials - List all trending serials
router.get("/", async (_req, res) => {
  try {
    const db = getFirestore();
    let snapshot = await db.collection("trending_serials").get();

    if (snapshot.empty) {
      // Auto seed if empty
      await runSeeder(false);
      snapshot = await db.collection("trending_serials").get();
    }

    const list = snapshot.docs.map((d) => d.data() as TrendingSerial);
    list.sort((a, b) => {
      const ordA = a.order ?? 999;
      const ordB = b.order ?? 999;
      if (ordA !== ordB) return ordA - ordB;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    res.json({ data: list });
  } catch (error) {
    console.error("Error fetching trending serials:", error);
    res.status(500).json({ error: "Failed to fetch trending serials" });
  }
});

// GET /api/trending-serials/:id - Get single serial with all chapters
router.get("/:id", async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Serial not found" });
    }

    res.json({ data: doc.data() });
  } catch (error) {
    console.error("Error fetching serial:", error);
    res.status(500).json({ error: "Failed to fetch serial" });
  }
});

// POST /api/trending-serials/:id/view - Live increment reads count
router.post("/:id/view", async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(req.params.id);
    await docRef.update({
      reads: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });

    const updated = await docRef.get();
    res.json({
      success: true,
      reads: updated.data()?.reads || 0,
    });
  } catch (error) {
    console.error("Error recording serial view:", error);
    res.status(500).json({ error: "Failed to record view" });
  }
});

// POST /api/trending-serials/:id/like - Live toggle/increment like
router.post("/:id/like", async (req, res) => {
  try {
    const { action } = req.body; // "like" or "unlike"
    const delta = action === "unlike" ? -1 : 1;
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(req.params.id);

    await docRef.update({
      likes: FieldValue.increment(delta),
      updatedAt: new Date().toISOString(),
    });

    const updated = await docRef.get();
    res.json({
      success: true,
      likes: Math.max(0, updated.data()?.likes || 0),
    });
  } catch (error) {
    console.error("Error liking serial:", error);
    res.status(500).json({ error: "Failed to like serial" });
  }
});

// POST /api/trending-serials/:id/share - Live increment share count
router.post("/:id/share", async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(req.params.id);

    await docRef.update({
      shares: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });

    const updated = await docRef.get();
    res.json({
      success: true,
      shares: updated.data()?.shares || 0,
    });
  } catch (error) {
    console.error("Error sharing serial:", error);
    res.status(500).json({ error: "Failed to record share" });
  }
});

// GET /api/trending-serials/:id/comments - Paginated 10 per page
router.get("/:id/comments", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit || "10"), 10)));
    const offset = (page - 1) * limit;

    const db = getFirestore();
    const commentsCol = db.collection(`trending_serials/${req.params.id}/comments`);

    const snapshot = await commentsCol.orderBy("createdAt", "desc").get();
    const allComments = snapshot.docs.map((d) => d.data() as SerialComment);

    const total = allComments.length;
    const items = allComments.slice(offset, offset + limit);

    res.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/trending-serials/:id/comments - Add new comment
router.post("/:id/comments", async (req, res) => {
  try {
    const { text, userName, userAvatar } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const name = userName?.trim() || "Reader";
    const avatar =
      userAvatar ||
      name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const db = getFirestore();
    const commentId = `cm-${Date.now()}`;
    const commentRef = db.doc(`trending_serials/${req.params.id}/comments/${commentId}`);

    const newComment: SerialComment = {
      id: commentId,
      serialId: req.params.id,
      userName: name,
      userAvatar: avatar,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: [],
    };

    await commentRef.set(newComment);

    // Increment commentsCount on serial
    const serialRef = db.collection("trending_serials").doc(req.params.id);
    await serialRef.update({
      commentsCount: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: newComment });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// POST /api/trending-serials/:id/comments/:commentId/like - Like a comment
router.post("/:id/comments/:commentId/like", async (req, res) => {
  try {
    const { action } = req.body;
    const delta = action === "unlike" ? -1 : 1;
    const db = getFirestore();
    const commentRef = db.doc(
      `trending_serials/${req.params.id}/comments/${req.params.commentId}`
    );

    await commentRef.update({
      likes: FieldValue.increment(delta),
    });

    const doc = await commentRef.get();
    res.json({
      success: true,
      likes: Math.max(0, doc.data()?.likes || 0),
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({ error: "Failed to like comment" });
  }
});

// POST /api/trending-serials/:id/comments/:commentId/reply - Add reply to comment
router.post("/:id/comments/:commentId/reply", async (req, res) => {
  try {
    const { text, userName, userAvatar } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const name = userName?.trim() || "Reader";
    const avatar =
      userAvatar ||
      name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const db = getFirestore();
    const commentRef = db.doc(
      `trending_serials/${req.params.id}/comments/${req.params.commentId}`
    );

    const doc = await commentRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const reply: SerialCommentReply = {
      id: `rep-${Date.now()}`,
      userName: name,
      userAvatar: avatar,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    await commentRef.update({
      replies: FieldValue.arrayUnion(reply),
    });

    res.json({ success: true, data: reply });
  } catch (error) {
    console.error("Error replying to comment:", error);
    res.status(500).json({ error: "Failed to reply to comment" });
  }
});

// -------------------------------------------------------------
// ADMIN CRUD & SEED ENDPOINTS
// -------------------------------------------------------------

// POST /api/trending-serials/seed - Run or force-reset seeder
router.post("/seed", verifyAdmin, async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await runSeeder(force);
    res.json({ success: true, message: "Trending serials seeded successfully", result });
  } catch (error) {
    console.error("Seeder error:", error);
    res.status(500).json({ error: "Failed to run serials seeder" });
  }
});

// POST /api/trending-serials/upload-cover - Upload cover image file
router.post("/upload-cover", verifyAdmin, memoryImageUpload.single("cover"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    const filename = makeUploadFilename("trending-cover", req.file.originalname);
    const fileUrl = await persistPublicUpload(req, req.file, filename);
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Error uploading cover:", error);
    res.status(500).json({ error: "Failed to upload cover image" });
  }
});

// POST /api/trending-serials - Create new serial
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      sub,
      category,
      author,
      tagline,
      tags,
      rating,
      chaptersTotal,
      status,
      blurb,
      img,
      coverUrl,
      order,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const db = getFirestore();
    const id = `serial-${Date.now()}`;
    const docRef = db.collection("trending_serials").doc(id);

    const serial: TrendingSerial = {
      id,
      title: title.trim(),
      sub: sub?.trim() || category?.trim() || "Romance",
      category: category?.trim() || sub?.trim() || "Romance",
      author: author?.trim() || "Ink2Wealth Author",
      tagline: tagline?.trim() || "",
      tags: Array.isArray(tags) ? tags : [],
      rating: rating ? String(rating) : "4.8",
      chaptersTotal: parseInt(chaptersTotal || "0", 10),
      reads: 0,
      likes: 0,
      shares: 0,
      commentsCount: 0,
      status: status === "Completed" ? "Completed" : "Ongoing",
      blurb: blurb?.trim() || "",
      img: coverUrl || img || "book0",
      coverUrl: coverUrl || img || "",
      chapters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: typeof order === "number" ? order : 999,
    };

    await docRef.set(serial);
    res.status(201).json({ success: true, data: serial });
  } catch (error) {
    console.error("Error creating serial:", error);
    res.status(500).json({ error: "Failed to create serial" });
  }
});

// PUT /api/trending-serials/:id - Update existing serial
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(String(req.params.id));
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Serial not found" });
    }

    const payload = req.body;
    const updates: Partial<TrendingSerial> = {
      updatedAt: new Date().toISOString(),
    };

    if (payload.title !== undefined) updates.title = payload.title.trim();
    if (payload.sub !== undefined) updates.sub = payload.sub.trim();
    if (payload.category !== undefined) updates.category = payload.category.trim();
    if (payload.author !== undefined) updates.author = payload.author.trim();
    if (payload.tagline !== undefined) updates.tagline = payload.tagline.trim();
    if (payload.tags !== undefined) updates.tags = Array.isArray(payload.tags) ? payload.tags : [];
    if (payload.rating !== undefined) updates.rating = String(payload.rating);
    if (payload.chaptersTotal !== undefined) updates.chaptersTotal = Number(payload.chaptersTotal);
    if (payload.reads !== undefined) updates.reads = Number(payload.reads);
    if (payload.likes !== undefined) updates.likes = Number(payload.likes);
    if (payload.shares !== undefined) updates.shares = Number(payload.shares);
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.blurb !== undefined) updates.blurb = payload.blurb.trim();
    if (payload.img !== undefined) updates.img = payload.img;
    if (payload.coverUrl !== undefined) updates.coverUrl = payload.coverUrl;
    if (payload.order !== undefined) updates.order = Number(payload.order);
    if (payload.chapters !== undefined) updates.chapters = payload.chapters;

    await docRef.update(updates);
    const updated = await docRef.get();
    res.json({ success: true, data: updated.data() });
  } catch (error) {
    console.error("Error updating serial:", error);
    res.status(500).json({ error: "Failed to update serial" });
  }
});

// DELETE /api/trending-serials/:id - Delete serial
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    await db.collection("trending_serials").doc(String(req.params.id)).delete();
    res.json({ success: true, message: "Serial deleted" });
  } catch (error) {
    console.error("Error deleting serial:", error);
    res.status(500).json({ error: "Failed to delete serial" });
  }
});

// POST /api/trending-serials/:id/chapters - Add chapter to serial
router.post("/:id/chapters", verifyAdmin, async (req, res) => {
  try {
    const { title, readTime, content } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Chapter title is required" });
    }

    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(String(req.params.id));
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Serial not found" });
    }

    const serial = doc.data() as TrendingSerial;
    const chapters = serial.chapters || [];
    const newIndex = chapters.length + 1;
    const chapId = `chap-${Date.now()}`;

    const newChapter: SerialChapter = {
      id: chapId,
      index: newIndex,
      title: title.trim(),
      readTime: readTime?.trim() || `${Math.max(3, Math.ceil((content?.length || 200) / 400))} min read`,
      content: content?.trim() || "",
      createdAt: new Date().toISOString(),
    };

    chapters.push(newChapter);

    await docRef.update({
      chapters,
      chaptersTotal: Math.max(serial.chaptersTotal || 0, chapters.length),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: newChapter });
  } catch (error) {
    console.error("Error adding chapter:", error);
    res.status(500).json({ error: "Failed to add chapter" });
  }
});

// PUT /api/trending-serials/:id/chapters/:chapId - Update chapter
router.put("/:id/chapters/:chapId", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(String(req.params.id));
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Serial not found" });
    }

    const serial = doc.data() as TrendingSerial;
    const chapters = serial.chapters || [];
    const chapIndex = chapters.findIndex((c) => c.id === String(req.params.chapId));

    if (chapIndex === -1) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    const existing = chapters[chapIndex];
    chapters[chapIndex] = {
      ...existing,
      title: req.body.title !== undefined ? req.body.title.trim() : existing.title,
      readTime: req.body.readTime !== undefined ? req.body.readTime.trim() : existing.readTime,
      content: req.body.content !== undefined ? req.body.content.trim() : existing.content,
    };

    await docRef.update({
      chapters,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: chapters[chapIndex] });
  } catch (error) {
    console.error("Error updating chapter:", error);
    res.status(500).json({ error: "Failed to update chapter" });
  }
});

// DELETE /api/trending-serials/:id/chapters/:chapId - Delete chapter
router.delete("/:id/chapters/:chapId", verifyAdmin, async (req, res) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("trending_serials").doc(String(req.params.id));
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Serial not found" });
    }

    const serial = doc.data() as TrendingSerial;
    const chapters = (serial.chapters || []).filter((c) => c.id !== String(req.params.chapId));

    // Re-index chapters
    const reindexed = chapters.map((c, i) => ({ ...c, index: i + 1 }));

    await docRef.update({
      chapters: reindexed,
      chaptersTotal: reindexed.length,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: "Chapter deleted" });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({ error: "Failed to delete chapter" });
  }
});

export default router;
