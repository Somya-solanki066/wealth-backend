import express from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";
import { memoryImageUpload } from "../utils/multerImages";
import { makeUploadFilename, persistPublicUpload } from "../utils/uploadStorage";

const router = express.Router();

export interface ScriptScene {
  id: string;
  index: number;
  heading: string; // e.g. "SCENE 1 - EXT. EKO ATLANTIC HIGHWAY - NIGHT"
  title: string;
  readTime: string; // e.g. "4 min read"
  content: string; // Screenplay format
  createdAt?: string;
}

export interface ScriptCommentReply {
  id: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
  likes: number;
}

export interface ScriptComment {
  id: string;
  scriptId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
  likes: number;
  replies: ScriptCommentReply[];
}

export interface TrendingScript {
  id: string;
  title: string;
  logline: string;
  genre: string;
  writer: string;
  tagline: string;
  tags: string[];
  rating: string;
  format: string; // "Feature Film" | "TV Pilot" | "Short Script"
  pageCount: number;
  scenesTotal: number;
  reads: number;
  likes: number;
  shares: number;
  commentsCount: number;
  status: "Completed" | "In Development" | "Production Ready";
  synopsis: string;
  img: string;
  coverUrl: string;
  pdfUrl?: string;
  scenes: ScriptScene[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 6 Realistic Prototype Screenplay Seeds with Authentic Formatting
const SEED_SCRIPTS: Omit<TrendingScript, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "The Lagos Heist",
    logline: "A disgraced master safe-cracker is forced into one final job beneath Victoria Island's most fortified vault.",
    genre: "Action Thriller",
    writer: "Tunde Williams",
    tagline: "In the city of money, trust is the deadliest currency.",
    tags: ["Action", "Heist", "Lagos", "High Stakes", "Nollywood Action"],
    rating: "4.9",
    format: "Feature Film",
    pageCount: 112,
    scenesTotal: 38,
    reads: 1850000,
    likes: 19400,
    shares: 4200,
    commentsCount: 96,
    status: "Production Ready",
    synopsis: "Femi Cole left the criminal underworld three years ago after a botched Marina heist took his brother's life. But when corrupt oil magnate Chief Balogun kidnaps his daughter, Femi is forced to assemble an elite crew to infiltrate the subterranean federal treasury in Victoria Island during an IMF summit blackout.",
    img: "script0",
    coverUrl: "",
    pdfUrl: "",
    order: 0,
    scenes: [
      {
        id: "scene-1",
        index: 1,
        heading: "SCENE 1 - EXT. EKO ATLANTIC HIGHWAY - NIGHT",
        title: "Rain on Ocean Shore",
        readTime: "3 min read",
        content: `EXT. EKO ATLANTIC HIGHWAY - NIGHT

Torrential tropical rain hammers the asphalt. Lightning carves the Atlantic skyline into silhouettes of glass skyscrapers.

A lone MATTE-BLACK RANGE ROVER idles by the guardrails. Windshield wipers tick like a detonator.

INT. RANGE ROVER - CONTINUOUS

FEMI COLE (40s), weathered hands covered in scar tissue from laser drill burns, stares into the rear-view mirror.

On the passenger seat, an encrypted satellite phone VIBRATES. 
Caller ID reads: [RESTRICTED - BALOGUN].

Femi takes a breath, answers. Puts it on speaker.

CHIEF BALOGUN (V.O.)
(smooth, aristocratic)
Forty-eight hours, Femi. The IMF delegates land at Murtala Muhammed on Thursday. After that, the vault seals permanently.

FEMI
You swore she would have her inhaler.

CHIEF BALOGUN (V.O.)
Your daughter is reading Shakespeare in my guest villa. Finish the job, and you both leave Lagos on my private flight. Fail... and her lungs won't be the only thing failing.

The call DISCONNECTS. Femi grips the steering wheel until his knuckles turn white.

FEMI
(whispering to himself)
One last door. Just one last door.`
      },
      {
        id: "scene-2",
        index: 2,
        heading: "SCENE 2 - INT. UNDERGROUND SAFE HOUSE - LEKKI - NIGHT",
        title: "The Assembly",
        readTime: "4 min read",
        content: `INT. UNDERGROUND SAFE HOUSE - LEKKI - NIGHT

Fluorescent lights buzz overhead. Blueprint schematics of the Federal Reserve vault cover a steel dining table.

ZAINAB (30s), cyber-security architect in glasses with a cigarette perched behind her ear, types furiously on three laptops.

KOLAWOLE (40s), hulking ex-military demolitions specialist, oils a high-frequency pneumatic torch.

FEMI enters through the heavy reinforced iron door. Water streams off his leather trench coat.

ZAINAB
(without looking up)
Tell me he didn't bump the timeline.

FEMI
We move Thursday at midnight.

KOLAWOLE
Thursday?! The kinetic shock sensors alone take six hours to calibrate! If I breach the thermal barrier too fast, the liquid nitrogen dump will freeze us like frozen mackerel!

FEMI
Then don't breach it too fast. Zainab, do we have the grid bypass?

ZAINAB
NEPA scheduled a transformer maintenance cycle for Victoria Island at 00:15. That gives us exactly twenty-two minutes of blind auxiliary power before the diesel backups kick in.

She slides a transparent glass tablet across the table. A 3D hologram of the vault pulses in amber light.

ZAINAB (CONT'D)
Twenty-two minutes to crack four million dollars in bearer bonds and walk out as ghosts.

Kolawole shakes his head, lighting the torch. Blue flame cuts the shadows.

KOLAWOLE
God help anybody who stands in our way.`
      },
      {
        id: "scene-3",
        index: 3,
        heading: "SCENE 3 - INT. TREASURY VAULT CORRIDOR - NIGHT",
        title: "The Pressure Chamber",
        readTime: "5 min read",
        content: `INT. TREASURY VAULT CORRIDOR - NIGHT

Red emergency diodes glow along the polished marble hallway. Absolute silence, broken only by the hum of high-voltage capacitors.

Femi drops silently from an air conditioning grate like a panther. Boots tap gently on the marble.

He unholsters an acoustic sensor, pressing the rubber suction cup against the six-inch titanium door lock.

FEMI
(into radio comm)
Zainab, tap the harmonic frequency.

ZAINAB (OVER COMM)
Transmitting 420 megahertz... now.

A soft HIGH-PITCHED WHINE emanates from the safe dial. Femi's fingers gently rotate the dial. 
CLICK. CLICK. CLACK.

The vault air-lock HISSES as pressure equalizes. Slowly, the heavy door swings open into darkness.`
      }
    ]
  },
  {
    title: "Midnight in Nollywood",
    logline: "An ambitious assistant director uncovers a scandalous conspiracy threatening to derail Nigeria's biggest film festival.",
    genre: "Drama / Satire",
    writer: "Amara Okafor",
    tagline: "Behind the glamour, everyone is acting.",
    tags: ["Drama", "Behind The Scenes", "Satire", "Lagos Elite", "Film Industry"],
    rating: "4.8",
    format: "TV Pilot",
    pageCount: 58,
    scenesTotal: 22,
    reads: 920000,
    likes: 12100,
    shares: 2600,
    commentsCount: 64,
    status: "Completed",
    synopsis: "When veteran Nollywood icon Chief Desmond falls into a coma on the eve of the Eko International Film Festival, 26-year-old assistant director Nkechi discovers his final unfinished screenplay was actually a damning expose of money laundering by the festival's chief financiers.",
    img: "script1",
    coverUrl: "",
    pdfUrl: "",
    order: 1,
    scenes: [
      {
        id: "scene-1",
        index: 1,
        heading: "SCENE 1 - INT. SOUNDSTAGE 4 - SURULERE - DAY",
        title: "Take Thirty-Four",
        readTime: "4 min read",
        content: `INT. SOUNDSTAGE 4 - SURULERE - DAY

HOT, SUFFOCATING STUDIO AIR. Spotlights beam onto a lavish palace set. 

DIVA ACTRESS TIWA (30s) stands in a golden gele, weeping melodramatically.

TIWA
(screaming)
How dare you bring that bastard child into this palace!

DIRECTOR CHIEF DESMOND (60s), silver hair, silk tunic, slumps in his director's chair. His hand trembles violently around a crystal whiskey glass.

NKECHI (26), clipboard in hand, headset askew, spots the tremor immediately.

NKECHI
(whispering to herself)
Chief...

CHIEF DESMOND
(weakly)
Cut. Print it. We are done for today.

TIWA
Excuse me?! That was my emotional peak! The key light wasn't even catching my tear duct!

Suddenly, Chief Desmond's glass SHATTERS on the cement floor. He collapses forward off the chair!

Pandemonium erupts. Crew members scream. Nkechi rushes forward, kneeling in the broken glass.

NKECHI
Call an ambulance! Somebody call an ambulance now!

Desmond grasps Nkechi's wrist with shocking strength. Blood trickles from his lips.

CHIEF DESMOND
(feverish rasp)
The red leather binder in my trunk... Nkechi... don't let Senator Badmus see page forty-four...

His grip goes slack. His eyes roll back into darkness.`
      },
      {
        id: "scene-2",
        index: 2,
        heading: "SCENE 2 - EXT. LEKKI PRODUCTION OFFICE - NIGHT",
        title: "The Red Binder",
        readTime: "4 min read",
        content: `EXT. LEKKI PRODUCTION OFFICE - NIGHT

Rain drums against the tinted windows of Chief Desmond's Mercedes Maybach. 

Nkechi huddles inside the vehicle, shaking. Her phone screens blow up with hundreds of notifications:
'CHIEF DESMOND IN ICU'
'FESTIVAL RED CARPET IN JEOPARDY'

In her lap rests an embossed burgundy leather binder:
"TITLE: PROJECT OBA - BY DESMOND IKECHUKWU".

She flips past the title page. 
Page 40: Scene descriptions.
Page 42: Bank account routing numbers.
Page 44: A full ledger of offshore wire transfers from Senator Badmus directly to international shell corporations disguised as film budgets.

NKECHI
(gasps)
It wasn't a script... it was an audit.`
      }
    ]
  },
  {
    title: "Silent River",
    logline: "When an oil spill unearths ancient relics in the Niger Delta, an environmental investigator becomes the target of shadowy syndicates.",
    genre: "Mystery Thriller",
    writer: "Victor Daniel Bolum",
    tagline: "The water remembers what men try to drown.",
    tags: ["Mystery", "Thriller", "Delta", "Eco-Thriller", "Original Work"],
    rating: "4.9",
    format: "Feature Film",
    pageCount: 105,
    scenesTotal: 34,
    reads: 1420000,
    likes: 16800,
    shares: 3800,
    commentsCount: 82,
    status: "Completed",
    synopsis: "Dr. Tari Briggs returns to her ancestral fishing community in Bonny to investigate a toxic crude leak. Instead of ordinary pipeline sabotage, her sonar scans reveal a pristine bronze shrine deep beneath the mangrove riverbed that an international mercenary conglomerate is violently attempting to excavate.",
    img: "script2",
    coverUrl: "",
    pdfUrl: "",
    order: 2,
    scenes: [
      {
        id: "scene-1",
        index: 1,
        heading: "SCENE 1 - EXT. CREEKS OF BONNY - DAWN",
        title: "The Black Tide",
        readTime: "4 min read",
        content: `EXT. CREEKS OF BONNY - DAWN

Thick river mist curls over the black water of the mangrove swamp. Sunlight pierces the canopy in eerie emerald beams.

A small wooden outboard speedboat cuts silently through the mirrored surface.

DR. TARI BRIGGS (32), environmental toxicologist with dreadlocks tied back in a bandana, dips a glass sample beaker into the water.

The water comes out thick with an iridescent rainbow sheen.

BOATMAN ELDER ASARI (60s), weathered fisherman with calloused arms, shakes his head.

ELDER ASARI
The fish stopped jumping three nights ago, Dr. Tari. But look down there... past the roots.

Tari leans over the gunwale. Switches on her portable sonar depth-finder.

The sonar monitor BEEPS. Instead of river mud, an angular 90-degree geometric shape outlines on the green screen.

TARI
That's not natural limestone. That's carved stonework.

ELDER ASARI
The elders call it the Sanctuary of Orukoro. It was buried before the first white men built slave barracoons here. And last night, black helicopters landed on the dredge island.

A distant LOW THUD OF ROTOR BLADES echoes through the mist. 
Tari looks up. The water begins to vibrate.`
      }
    ]
  },
  {
    title: "The Billionaire's Pilot",
    logline: "A no-nonsense private jet captain refuses to play by the reckless rules of a self-made tech tycoon.",
    genre: "Romance / Drama",
    writer: "Chidi Obi",
    tagline: "Cruising altitude: 41,000 feet. No escape from gravity.",
    tags: ["Romance", "Billionaire", "Aviation", "Witty", "Enemies to Lovers"],
    rating: "4.7",
    format: "Feature Film",
    pageCount: 98,
    scenesTotal: 28,
    reads: 1100000,
    likes: 15300,
    shares: 2900,
    commentsCount: 71,
    status: "Production Ready",
    synopsis: "Captain Kemi Adeyemi is one of the only female long-haul corporate jet captains in West Africa. When she is hired by arrogant fintech billionaire Kunle Vance, she sets one ironclad rule: in her cockpit, she is the sole authority. But a storm over the Sahara forces them both to re-evaluate who is in control.",
    img: "script3",
    coverUrl: "",
    pdfUrl: "",
    order: 3,
    scenes: [
      {
        id: "scene-1",
        index: 1,
        heading: "SCENE 1 - INT. PRIVATE JET HANGAR - IKEJA - SUNSET",
        title: "First Encounter on the Tarmac",
        readTime: "4 min read",
        content: `INT. PRIVATE JET HANGAR - IKEJA - SUNSET

A gleaming brand-new Gulfstream G650 sits like a silver sculpture on the polished epoxy floor.

CAPTAIN KEMI ADEYEMI (31), impeccably crisp in gold-braided pilot uniform, conducts her pre-flight walkaround. She taps a pitot tube cover.

Enter KUNLE VANCE (34), handsome, athletic, wearing custom Italian cashmere with sneakers. He talks into wireless earbuds while drinking iced espresso.

KUNLE
(into earbud)
Tell the London syndicate if they don't wire the seed tranche by 8 PM, I will float the IPO in Singapore instead.

He marches past Kemi without looking, stepping onto the jet's airstairs.

KEMI
Excuse me, sir.

Kunle pauses, turning on the fifth step, lowering his sunglasses.

KUNLE
If you're catering, the smoked salmon needs to be chilled to four degrees.

Kemi smiles politely, her eyes completely ice-cold.

KEMI
I am Captain Adeyemi. And until I complete the exterior weight-and-balance inspection, nobody steps aboard my aircraft. Step down, please.

Kunle stares at her, stunned.

KUNLE
Do you know whose name is painted on the vertical stabilizer?

KEMI
The bank that holds your lease. Step down, Mr. Vance.`
      }
    ]
  },
  {
    title: "The Royal Succession",
    logline: "Amidst palace intrigues in the 18th-century Benin Empire, twin princes fight for the legendary golden throne.",
    genre: "Historical Epic",
    writer: "Victor Daniel Bolum",
    tagline: "Two crowns cannot sit on one head.",
    tags: ["Epic", "Period Drama", "African History", "Palace Intrigue"],
    rating: "4.9",
    format: "Feature Film",
    pageCount: 120,
    scenesTotal: 42,
    reads: 1650000,
    likes: 21000,
    shares: 5100,
    commentsCount: 110,
    status: "Completed",
    synopsis: "In 1740 Benin City, the venerable Oba falls gravely ill without naming which of his royal twin sons was born first. As rival factions of chiefs arm themselves in secret, Queen Mother Idia must prevent a catastrophic civil war before foreign invaders arrive at the kingdom's gates.",
    img: "script4",
    coverUrl: "",
    pdfUrl: "",
    order: 4,
    scenes: [
      {
        id: "scene-1",
        index: 1,
        heading: "SCENE 1 - INT. OBA'S THRONE ROOM - BENIN CITY - DAY",
        title: "The Coral Regalia",
        readTime: "5 min read",
        content: `INT. OBA'S THRONE ROOM - BENIN CITY - DAY

Sunlight pours through bronze skylights, illuminating walls sculpted with intricate bronze plaques depicting centuries of war.

Incense smoke curls around the grand throne of carved mahogany and ivory.

THE AGED OBA EREDIAUWA sits draped in thousands of deep crimson coral beads. His breath is shallow.

Flanking the dais stand his twin sons:
PRINCE OSAGIE (28), broad-shouldered warrior, sword hilt engraved with leopard teeth.
PRINCE ERHUN (28), scholarly diplomat with piercing observant eyes.

HIGH CHIEF OLIHA (60s) steps forward with the sacred ceremonial bronze sword, ADA.

CHIEF OLIHA
My Lord Oba. The council of Uzama demands the naming. The season of harvest draws near, and a kingdom without an heir is a ship without a rudder.

The Oba raises a trembling palm.

OBA EREDIAUWA
A crown is not an ornament of vanity. It is an iron anvil. One of you possesses the heart of a shield. The other, the mind of a spear.

He looks between his sons.

OBA EREDIAUWA (CONT'D)
Before the moon waxes full, the spirits of our ancestors will demand a trial. Not of steel... but of truth.`
      }
    ]
  },
  {
    title: "Cyber City Lagos 2085",
    logline: "In a neon-drenched futuristic Lagos, a rogue neural coder stumbles onto a memory file that corporate overlords will kill to erase.",
    genre: "Sci-Fi / Cyberpunk",
    writer: "Victor Daniel Bolum",
    tagline: "The future has no firewall.",
    tags: ["Cyberpunk", "Afrofuturism", "Sci-Fi", "Neon Lagos", "Action"],
    rating: "4.8",
    format: "TV Pilot",
    pageCount: 62,
    scenesTotal: 25,
    reads: 890000,
    likes: 11800,
    shares: 2400,
    commentsCount: 52,
    status: "In Development",
    synopsis: "In 2085, Lagos has become a three-tier hyper-megacity connected by magnetic sky-trains and brain-computer neural grids. When street coder Jide jacks into an antique biomechanical drive, he discovers a suppressed holographic confession exposing the artificial climate collapse.",
    img: "script5",
    coverUrl: "",
    pdfUrl: "",
    order: 5,
    scenes: [
      {
        id: "scene-1",
        index: 1,
        heading: "SCENE 1 - EXT. THIRD MAINLAND SKYBRIDGE - RAIN - 2085",
        title: "Neon Rain over Lagoon",
        readTime: "4 min read",
        content: `EXT. THIRD MAINLAND SKYBRIDGE - RAIN - 2085

ACID RAIN sizzles against holographic billboards towering fifty stories above the toxic lagoon. 
MASSIVE ADVERTS flash in glowing Yoruba and Pidgin:
'UPGRADE YOUR MEMORY - ZENITH NEURAL DIMS 4.0'

Flying hover-taxis stream along magnetic light trails.

INT. NOODLE STALL - SKY-PLATFORM 7 - CONTINUOUS

JIDE (24), wearing a frayed electromagnetic poncho, synthetic chrome iris glowing cyan in his left eye, slurps spicy synth-noodles.

Under his sleeve, a NEURAL DATA PORT pulses red.

STALL VENDOR (CYBORG, 70s)
You eating fast, Jide. Syndicate hounds sniffing your trail again?

JIDE
Worse. Corporate auditors.

Jide slides a sleek crystal chip into his wrist socket. 
A violent surge of electricity sparks across his fingers. His cyan iris dilates.

A HOLOGRAPHIC PROJECTION flickers directly onto his retina:
A secret underwater laboratory under Bar Beach. Hundreds of cryo-chambers. 
A woman's voice speaks through the static:

VOICE (HOLO-RECORDING)
If you are watching this, the Zenith grid is a lie. The cloud seeders aren't making rain... they're wiping our memories.`
      }
    ]
  }
];

// Document upload filter for screenplay PDFs and DOCs
const scriptDocFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = /\.(pdf|doc|docx|fdx)$/i;
  if (allowed.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, FDX, DOC, and DOCX screenplay files are allowed."));
  }
};

const memoryScriptDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB for screenplays
  fileFilter: scriptDocFilter,
});

// Optional token extractor
const optionalAuth = async (req: any, _res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split("Bearer ")[1];
      const decoded = await getAuth().verifyIdToken(token);
      req.user = decoded;
    } catch (_) {}
  }
  next();
};

// Seed Firestore with initial trending scripts if empty
export async function seedTrendingScripts(force = false) {
  const db = getFirestore();
  const col = db.collection("trending_scripts");
  const existing = await col.get();

  if (!force && !existing.empty) {
    return { seeded: false, count: existing.size };
  }

  if (force && !existing.empty) {
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  for (let i = 0; i < SEED_SCRIPTS.length; i++) {
    const raw = SEED_SCRIPTS[i];
    const docId = `script-${i + 1}`;
    const docRef = col.doc(docId);
    const now = new Date().toISOString();

    await docRef.set({
      ...raw,
      id: docId,
      createdAt: now,
      updatedAt: now,
    });

    // Sample comments
    const commentsCol = db.collection(`trending_scripts/${docId}/comments`);
    await commentsCol.doc("c1").set({
      id: "c1",
      scriptId: docId,
      userName: "Nollywood Insider",
      userAvatar: "NI",
      text: `Incredible pacing in Scene 1! The dialogue has authentic Lagos grit. Producers should snap this up immediately.`,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      likes: 14,
      replies: [
        {
          id: "r1",
          userName: "ScriptDoc",
          userAvatar: "SD",
          text: "Agreed. The character beats in the opening scene are textbook three-act structure.",
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          likes: 5,
        },
      ],
    });
  }

  return { seeded: true, count: SEED_SCRIPTS.length };
}

// ---------------------------------------------------------------------------
// PUBLIC / USER ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/trending-scripts - List all trending scripts
router.get("/", async (_req, res) => {
  try {
    const db = getFirestore();
    let snapshot = await db.collection("trending_scripts").get();
    if (snapshot.empty) {
      await seedTrendingScripts();
      snapshot = await db.collection("trending_scripts").get();
    }

    const scripts = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });

    scripts.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99));
    res.json({ success: true, data: scripts });
  } catch (error: any) {
    console.error("Error fetching trending scripts:", error);
    res.status(500).json({ error: "Failed to fetch trending scripts" });
  }
});

// GET /api/trending-scripts/:id - Get single script with all scenes
router.get("/:id", async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Script not found" });
    }
    res.json({ success: true, data: { id: snap.id, ...snap.data() } });
  } catch (error: any) {
    console.error("Error fetching script detail:", error);
    res.status(500).json({ error: "Failed to fetch script detail" });
  }
});

// POST /api/trending-scripts/:id/view - Increment reads count
router.post("/:id/view", async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    await docRef.update({
      reads: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to track view" });
  }
});

// POST /api/trending-scripts/:id/like - Toggle / increment like
router.post("/:id/like", async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    const delta = req.body.delta !== undefined ? Number(req.body.delta) : 1;
    await docRef.update({
      likes: FieldValue.increment(delta),
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update like" });
  }
});

// POST /api/trending-scripts/:id/share - Increment share count
router.post("/:id/share", async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    await docRef.update({
      shares: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update shares" });
  }
});

// GET /api/trending-scripts/:id/comments - Paginated comments
router.get("/:id/comments", async (req, res) => {
  try {
    const commentsCol = getFirestore().collection(`trending_scripts/${String(req.params.id)}/comments`);
    const snap = await commentsCol.get();
    const comments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    comments.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    res.json({ success: true, data: comments });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch script comments" });
  }
});

// POST /api/trending-scripts/:id/comments - Add comment
router.post("/:id/comments", optionalAuth, async (req: any, res) => {
  try {
    const scriptId = String(req.params.id);
    const { text, userName, userAvatar } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text cannot be empty" });
    }

    const commentId = `comm-${Date.now()}`;
    const commentData: ScriptComment = {
      id: commentId,
      scriptId: scriptId,
      userName: userName || (req.user?.name || req.user?.email?.split("@")[0]) || "Screenwriter",
      userAvatar: userAvatar || (userName ? userName.slice(0, 2).toUpperCase() : "SW"),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: [],
    };

    const commentRef = getFirestore().doc(`trending_scripts/${scriptId}/comments/${commentId}`);
    await commentRef.set(commentData);

    const scriptRef = getFirestore().collection("trending_scripts").doc(scriptId);
    await scriptRef.update({
      commentsCount: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: commentData });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// POST /api/trending-scripts/:id/comments/:commentId/like - Like a comment
router.post("/:id/comments/:commentId/like", async (req, res) => {
  try {
    const commentRef = getFirestore().doc(
      `trending_scripts/${String(req.params.id)}/comments/${String(req.params.commentId)}`
    );
    await commentRef.update({
      likes: FieldValue.increment(1),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to like comment" });
  }
});

// POST /api/trending-scripts/:id/comments/:commentId/reply - Add reply
router.post("/:id/comments/:commentId/reply", optionalAuth, async (req: any, res) => {
  try {
    const { text, userName, userAvatar } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Reply text cannot be empty" });
    }

    const replyData: ScriptCommentReply = {
      id: `rep-${Date.now()}`,
      userName: userName || (req.user?.name || req.user?.email?.split("@")[0]) || "Screenwriter",
      userAvatar: userAvatar || "SW",
      text: text.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    const commentRef = getFirestore().doc(
      `trending_scripts/${String(req.params.id)}/comments/${String(req.params.commentId)}`
    );
    await commentRef.update({
      replies: FieldValue.arrayUnion(replyData),
    });

    res.json({ success: true, data: replyData });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add reply" });
  }
});

// ---------------------------------------------------------------------------
// FILE UPLOADS & USER SUBMISSIONS
// ---------------------------------------------------------------------------

// POST /api/trending-scripts/upload-manuscript - Public/user script document upload
router.post("/upload-manuscript", optionalAuth, memoryScriptDocUpload.single("manuscript"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No screenplay PDF file provided" });
    }
    const filename = makeUploadFilename("screenplay", req.file.originalname);
    const fileUrl = await persistPublicUpload(req, req.file, filename);
    res.json({ success: true, url: fileUrl, filename: req.file.originalname });
  } catch (error: any) {
    console.error("Error uploading script manuscript:", error);
    res.status(500).json({ error: error.message || "Failed to upload screenplay file" });
  }
});

// POST /api/trending-scripts/upload-cover-public - Public/user poster image upload
router.post("/upload-cover-public", optionalAuth, memoryImageUpload.single("cover"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No poster image file provided" });
    }
    const filename = makeUploadFilename("script-poster", req.file.originalname);
    const fileUrl = await persistPublicUpload(req, req.file, filename);
    res.json({ success: true, url: fileUrl, filename: req.file.originalname });
  } catch (error: any) {
    console.error("Error uploading poster cover:", error);
    res.status(500).json({ error: error.message || "Failed to upload poster image" });
  }
});

// POST /api/trending-scripts/submissions - Submit screenplay for trending scripts review
router.post("/submissions", optionalAuth, async (req: any, res) => {
  try {
    const {
      actionType,
      type,
      title,
      genre,
      manuscriptUrl,
      manuscriptFilename,
      coverUrl,
      synopsis,
      penName,
      pageCount,
      rightsConfirmed,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Script title is required" });
    }
    if (!synopsis || !synopsis.trim()) {
      return res.status(400).json({ error: "Synopsis / logline is required" });
    }
    if (!penName || !penName.trim()) {
      return res.status(400).json({ error: "Pen name is required" });
    }
    if (!rightsConfirmed) {
      return res.status(400).json({ error: "You must confirm that you own the rights to this screenplay" });
    }

    const subData = {
      userId: req.user?.uid || req.body.userId || "anonymous",
      userEmail: req.user?.email || req.body.userEmail || "",
      actionType: actionType || "featured",
      type: type || "Completed script",
      title: title.trim(),
      genre: genre || "Action",
      manuscriptUrl: manuscriptUrl || "",
      manuscriptFilename: manuscriptFilename || "",
      coverUrl: coverUrl || "",
      synopsis: synopsis.trim(),
      penName: penName.trim(),
      pageCount: pageCount ? String(pageCount).trim() : "",
      rightsConfirmed: true,
      status: "pending",
      adminNotes: "",
      rejectionReasons: [],
      editorNote: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await getFirestore().collection("trending_script_submissions").add(subData);
    res.json({
      success: true,
      message: "Screenplay submitted successfully for review",
      submissionId: docRef.id,
      data: { id: docRef.id, ...subData },
    });
  } catch (error: any) {
    console.error("Error creating script submission:", error);
    res.status(500).json({ error: "Failed to submit screenplay for review" });
  }
});

// GET /api/trending-scripts/my-submissions - Get user's own script submissions
router.get("/my-submissions", optionalAuth, async (req: any, res) => {
  try {
    const userId = req.user?.uid || req.query.userId;
    if (!userId) {
      return res.json({ success: true, data: [] });
    }
    const snapshot = await getFirestore()
      .collection("trending_script_submissions")
      .where("userId", "==", userId)
      .get();

    const list = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    list.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Error fetching user script submissions:", error);
    res.status(500).json({ error: "Failed to fetch user submissions" });
  }
});

// ---------------------------------------------------------------------------
// ADMIN ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/trending-scripts/admin/submissions - Get all script submissions for admin review
router.get("/admin/submissions", verifyAdmin, async (_req, res) => {
  try {
    const snapshot = await getFirestore().collection("trending_script_submissions").get();
    const submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    submissions.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    res.json({ success: true, data: submissions });
  } catch (error: any) {
    console.error("Error fetching admin script submissions:", error);
    res.status(500).json({ error: "Failed to fetch script submissions queue" });
  }
});

// POST /api/trending-scripts/admin/submissions/:id/action - Approve, Feature, or Reject
router.post("/admin/submissions/:id/action", verifyAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { action, notes, rejectionReasons, editorNote } = req.body;

    if (!["approve", "feature", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be approve, feature, or reject." });
    }

    const docRef = getFirestore().collection("trending_script_submissions").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Script submission not found" });
    }

    const sub = snap.data() || {};
    const newStatus = action === "reject" ? "rejected" : (action === "feature" ? "featured" : "approved");

    let createdScriptId = null;
    if (action === "feature") {
      const scriptDoc: Omit<TrendingScript, "id"> = {
        title: sub.title || "Untitled Screenplay",
        logline: sub.synopsis ? (sub.synopsis.slice(0, 110) + (sub.synopsis.length > 110 ? "..." : "")) : "Featured in Trending Scripts.",
        genre: sub.genre || "Action",
        writer: sub.penName || "Featured Screenwriter",
        tagline: sub.synopsis ? (sub.synopsis.slice(0, 80) + "...") : "Featured Screenplay.",
        tags: [sub.genre || "Screenplay", sub.type || "Feature Film"].filter(Boolean),
        rating: "4.9",
        format: sub.type || "Feature Film",
        pageCount: parseInt(sub.pageCount || "90", 10) || 90,
        scenesTotal: 1,
        reads: 120,
        likes: 18,
        shares: 6,
        commentsCount: 0,
        status: "Production Ready",
        synopsis: sub.synopsis || "",
        img: "",
        coverUrl: sub.coverUrl || "",
        pdfUrl: sub.manuscriptUrl || "",
        scenes: [
          {
            id: `scene-${Date.now()}`,
            index: 1,
            heading: "SCENE 1 - EXT. LOCATION - OPENING",
            title: "Opening Scene",
            readTime: "4 min read",
            content: `${sub.title.toUpperCase()}\nWritten by ${sub.penName}\n\nLOGLINE:\n${sub.synopsis}\n\n${sub.manuscriptUrl ? `[Full Screenplay PDF: ${sub.manuscriptUrl}]` : ""}`,
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        order: 0,
      };

      const scriptRef = await getFirestore().collection("trending_scripts").add(scriptDoc);
      createdScriptId = scriptRef.id;
    }

    await docRef.update({
      status: newStatus,
      adminNotes: notes || sub.adminNotes || "",
      rejectionReasons: rejectionReasons || sub.rejectionReasons || [],
      editorNote: editorNote || sub.editorNote || "",
      featuredScriptId: createdScriptId || sub.featuredScriptId || null,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Script submission marked as ${newStatus}`,
      status: newStatus,
      scriptId: createdScriptId,
    });
  } catch (error: any) {
    console.error("Error updating script submission action:", error);
    res.status(500).json({ error: "Failed to update submission action" });
  }
});

// POST /api/trending-scripts/admin/seed - Force seed
router.post("/admin/seed", verifyAdmin, async (_req, res) => {
  try {
    const result = await seedTrendingScripts(true);
    res.json({ success: true, message: "Trending scripts seeded successfully", result });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to run scripts seeder" });
  }
});

// POST /api/trending-scripts - Create new script directly (admin)
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.title.trim()) {
      return res.status(400).json({ error: "Script title is required" });
    }

    const now = new Date().toISOString();
    const docData = {
      title: data.title.trim(),
      logline: data.logline || data.sub || "",
      genre: data.genre || data.category || "Drama",
      writer: data.writer || data.author || "Screenwriter",
      tagline: data.tagline || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      rating: data.rating || "4.8",
      format: data.format || "Feature Film",
      pageCount: parseInt(data.pageCount || "100", 10) || 100,
      scenesTotal: Array.isArray(data.scenes) ? data.scenes.length : 1,
      reads: parseInt(data.reads || "0", 10) || 0,
      likes: parseInt(data.likes || "0", 10) || 0,
      shares: parseInt(data.shares || "0", 10) || 0,
      commentsCount: 0,
      status: data.status || "Production Ready",
      synopsis: data.synopsis || data.blurb || "",
      img: data.img || "",
      coverUrl: data.coverUrl || "",
      pdfUrl: data.pdfUrl || "",
      scenes: Array.isArray(data.scenes) ? data.scenes : [],
      order: parseInt(data.order || "0", 10) || 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await getFirestore().collection("trending_scripts").add(docData);
    res.json({ success: true, data: { id: docRef.id, ...docData } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create script" });
  }
});

// PUT /api/trending-scripts/:id - Update script (admin)
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Script not found" });
    }
    const update = {
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    await docRef.update(update);
    res.json({ success: true, data: { id: req.params.id, ...snap.data(), ...update } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update script" });
  }
});

// DELETE /api/trending-scripts/:id - Delete script (admin)
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    await getFirestore().collection("trending_scripts").doc(String(req.params.id)).delete();
    res.json({ success: true, message: "Script deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete script" });
  }
});

// POST /api/trending-scripts/:id/scenes - Add scene to script (admin)
router.post("/:id/scenes", verifyAdmin, async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Script not found" });
    }

    const script = snap.data() as TrendingScript;
    const scenes = script.scenes || [];
    const newIndex = scenes.length + 1;
    const sceneId = `scene-${Date.now()}`;

    const newScene: ScriptScene = {
      id: sceneId,
      index: newIndex,
      heading: req.body.heading || `SCENE ${newIndex} - INT. LOCATION - DAY`,
      title: req.body.title || `Scene ${newIndex}`,
      readTime: req.body.readTime || "4 min read",
      content: req.body.content || "",
      createdAt: new Date().toISOString(),
    };

    scenes.push(newScene);
    await docRef.update({
      scenes,
      scenesTotal: scenes.length,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: newScene });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add scene" });
  }
});

// PUT /api/trending-scripts/:id/scenes/:sceneId - Update scene
router.put("/:id/scenes/:sceneId", verifyAdmin, async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Script not found" });
    }

    const script = snap.data() as TrendingScript;
    const scenes = (script.scenes || []).map((sc) => {
      if (sc.id === String(req.params.sceneId)) {
        return {
          ...sc,
          ...req.body,
          id: sc.id,
          index: sc.index,
        };
      }
      return sc;
    });

    await docRef.update({
      scenes,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: "Scene updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update scene" });
  }
});

// DELETE /api/trending-scripts/:id/scenes/:sceneId - Delete scene
router.delete("/:id/scenes/:sceneId", verifyAdmin, async (req, res) => {
  try {
    const docRef = getFirestore().collection("trending_scripts").doc(String(req.params.id));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Script not found" });
    }

    const script = snap.data() as TrendingScript;
    const scenes = (script.scenes || []).filter((sc) => sc.id !== String(req.params.sceneId));

    // Re-index scenes
    const reindexed = scenes.map((sc, i) => ({ ...sc, index: i + 1 }));

    await docRef.update({
      scenes: reindexed,
      scenesTotal: reindexed.length,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: "Scene deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete scene" });
  }
});

export default router;
