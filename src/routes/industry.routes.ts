import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";

const router = express.Router();

export const CALL_TYPES = [
  "script_submission",
  "short_film",
  "competition",
  "commission",
  "collaboration",
] as const;
export const CALL_STATUSES = ["draft", "pending_review", "active", "rejected", "closed"] as const;
export const PITCH_STATUSES = [
  "pending",
  "reviewed",
  "shortlisted",
  "accepted",
  "rejected",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function mapCall(id: string, data: Record<string, any>, extras: { saved?: boolean } = {}) {
  const skills = Array.isArray(data.skills)
    ? data.skills.map((s: unknown) => String(s).trim()).filter(Boolean)
    : String(data.skills || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  return {
    id,
    posterId: data.posterId || "",
    posterName: data.posterName || "Poster",
    title: data.title || "",
    organization: data.organization || "",
    callType: data.callType || "script_submission",
    genre: data.genre || "",
    targetMarket: data.targetMarket || "",
    description: data.description || "",
    requirements: data.requirements || "",
    applyFormat: data.applyFormat || data.requirements || "",
    experience: data.experience || "",
    duration: data.duration || "",
    payType: data.payType || "Fixed price",
    deadline: data.deadline || null,
    prize: data.prize || "",
    fee: data.fee || "",
    budget: data.budget || data.prize || "",
    location: data.location || "",
    locationType: data.locationType || "remote",
    skills,
    pinned: data.pinned === true,
    verified: data.verified !== false,
    clientRating: Number(data.clientRating) || 0,
    clientJobs: Number(data.clientJobs) || 0,
    clientSpent: data.clientSpent || "",
    status: data.status || "pending_review",
    rejectReason: data.rejectReason || null,
    pitchCount: data.pitchCount || 0,
    saved: extras.saved === true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function mapPitch(id: string, data: Record<string, any>) {
  return {
    id,
    callId: data.callId || "",
    callTitle: data.callTitle || "",
    callType: data.callType || "",
    applicantId: data.applicantId || "",
    applicantName: data.applicantName || "Applicant",
    applicantEmail: data.applicantEmail || null,
    pitchMessage: data.pitchMessage || "",
    portfolioUrl: data.portfolioUrl || "",
    sampleUrl: data.sampleUrl || "",
    experience: data.experience || "",
    bidAmount: data.bidAmount || "",
    deliveryTime: data.deliveryTime || "",
    status: data.status || "pending",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

async function getUserProfile(uid: string) {
  const db = getFirestore();
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() || {} : {};
}

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function savedCallIds(uid: string): Promise<Set<string>> {
  const db = getFirestore();
  const snap = await db.collection("savedOpenCalls").where("userId", "==", uid).get();
  return new Set(snap.docs.map((d) => String(d.data().callId || "")));
}

router.use(verifyFirebaseToken);

/** GET /api/wealth/industry/mine */
router.get("/industry/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db.collection("openCalls").where("posterId", "==", req.user.uid).get();
    const calls = snap.docs
      .map((d) => mapCall(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ calls });
  } catch (error: any) {
    console.error("My open calls error:", error);
    return res.status(500).json({ error: error.message || "Failed to load your listings." });
  }
});

/** GET /api/wealth/pitches/mine */
router.get("/pitches/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db
      .collection("industryPitches")
      .where("applicantId", "==", req.user.uid)
      .get();
    const pitches = snap.docs
      .map((d) => mapPitch(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ pitches });
  } catch (error: any) {
    console.error("My pitches error:", error);
    return res.status(500).json({ error: error.message || "Failed to load pitches." });
  }
});

/** GET /api/wealth/industry — active open calls */
router.get("/industry", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db.collection("openCalls").where("status", "==", "active").get();
    const saved = await savedCallIds(req.user.uid);
    let calls = snap.docs.map((d) => mapCall(d.id, d.data(), { saved: saved.has(d.id) }));

    const search = String(req.query.search || "").trim().toLowerCase();
    const callType = String(req.query.callType || "").trim();
    const genre = String(req.query.genre || "").trim().toLowerCase();
    const locationType = String(req.query.locationType || "").trim();

    if (callType) calls = calls.filter((c) => c.callType === callType);
    if (locationType) calls = calls.filter((c) => c.locationType === locationType);
    if (genre) {
      calls = calls.filter(
        (c) =>
          String(c.genre).toLowerCase().includes(genre) ||
          String(c.targetMarket).toLowerCase().includes(genre)
      );
    }
    if (search) {
      calls = calls.filter(
        (c) =>
          c.title.toLowerCase().includes(search) ||
          c.organization.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search)
      );
    }

    calls.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ calls });
  } catch (error: any) {
    console.error("Industry feed error:", error);
    return res.status(500).json({ error: error.message || "Failed to load open calls." });
  }
});

/** POST /api/wealth/industry — create → pending_review */
router.post("/industry", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const organization = String(body.organization || "").trim();
    const callType = String(body.callType || "").trim();
    const description = String(body.description || "").trim();
    const requirements = String(body.requirements || "").trim();
    const deadline = String(body.deadline || "").trim();
    const genre = String(body.genre || "").trim();
    const targetMarket = String(body.targetMarket || "").trim();
    const prize = String(body.prize || "").trim();
    const fee = String(body.fee || "").trim();
    const budget = String(body.budget || body.prize || "").trim();
    const location = String(body.location || "").trim();
    const locationType = String(body.locationType || "remote").trim();
    const applyFormat = String(body.applyFormat || "").trim();
    const experience = String(body.experience || "").trim();
    const duration = String(body.duration || "").trim();
    const payType = String(body.payType || "Fixed price").trim() || "Fixed price";
    const skills = parseSkills(body.skills);

    if (!title) return res.status(400).json({ error: "Title is required." });
    if (!organization) return res.status(400).json({ error: "Organization is required." });
    if (!(CALL_TYPES as readonly string[]).includes(callType)) {
      return res.status(400).json({ error: "Invalid call type." });
    }
    if (description.length < 40) {
      return res.status(400).json({ error: "Description must be at least 40 characters." });
    }
    if (!deadline) return res.status(400).json({ error: "Deadline is required." });

    const profile = await getUserProfile(req.user.uid);
    const now = nowIso();
    const db = getFirestore();
    const ref = db.collection("openCalls").doc();
    const doc = {
      posterId: req.user.uid,
      posterName: profile.displayName || profile.name || profile.email || "Poster",
      title,
      organization,
      callType,
      genre,
      targetMarket,
      description,
      requirements,
      applyFormat,
      experience,
      duration,
      payType,
      skills,
      deadline,
      prize: prize || budget,
      fee,
      budget,
      location,
      locationType: ["remote", "onsite", "hybrid"].includes(locationType) ? locationType : "remote",
      status: "pending_review",
      rejectReason: null,
      pitchCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);
    return res.status(201).json({
      call: mapCall(ref.id, doc),
      message: "Open call submitted for admin review.",
    });
  } catch (error: any) {
    console.error("Create open call error:", error);
    return res.status(500).json({ error: error.message || "Failed to post open call." });
  }
});

/** POST /api/wealth/industry/seed-demo — create sample active calls if board empty */
router.post("/industry/seed-demo", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const existing = await db.collection("openCalls").where("status", "==", "active").limit(1).get();
    if (!existing.empty) {
      const all = await db.collection("openCalls").where("status", "==", "active").get();
      return res.json({
        seeded: 0,
        message: "Board already has listings.",
        calls: all.docs.map((d) => mapCall(d.id, d.data())),
      });
    }

    const now = nowIso();
    const morning = new Date();
    morning.setHours(7, 0, 0, 0);
    const samples = [
      {
        title: "Feature drama seeks Nollywood screenwriter",
        organization: "Nkem Pictures",
        callType: "script_submission",
        genre: "Drama",
        targetMarket: "Nollywood",
        description:
          "A Lagos production company is developing a family drama and needs a screenwriter to take a treatment to a full first draft. You will work with the director every week.",
        requirements: "Logline, 10 pages and a one-page synopsis.",
        applyFormat: "Logline, 10 pages and a one-page synopsis",
        experience: "Intermediate",
        duration: "2 to 3 months",
        payType: "Fixed price",
        skills: ["Nollywood", "Drama", "Feature film", "Treatment"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "₦5M to ₦20M",
        location: "Lagos, Nigeria",
        locationType: "hybrid",
        pinned: true,
        verified: true,
        clientRating: 4.9,
        clientJobs: 18,
        clientSpent: "₦42M",
        createdAt: morning.toISOString(),
      },
      {
        title: "Ten-minute thriller short film",
        organization: "Blue Door Films",
        callType: "short_film",
        genre: "Thriller",
        targetMarket: "Nollywood",
        description:
          "A first-time director needs a tight, atmospheric script for a night-set thriller shot in one location.",
        requirements: "Logline and script PDF.",
        applyFormat: "Logline and script PDF",
        experience: "Entry level",
        duration: "Under 1 month",
        payType: "Fixed price",
        skills: ["Thriller", "Short film", "One location"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "Under ₦2M",
        location: "Abuja, Nigeria",
        locationType: "onsite",
        pinned: false,
        verified: true,
        clientRating: 4.6,
        clientJobs: 4,
        clientSpent: "₦3.1M",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      },
      {
        title: "Audio drama series, 8 episodes",
        organization: "Evergreen Audio",
        callType: "collaboration",
        genre: "Romance",
        targetMarket: "Audio Drama",
        description:
          "An international audio platform is commissioning a romance series. Weekly episodes of 12 minutes each, with a show bible.",
        requirements: "Pilot script and series outline.",
        applyFormat: "Pilot script and series outline",
        experience: "Expert",
        duration: "3 to 6 months",
        payType: "Fixed price",
        skills: ["Audio drama", "Romance", "Series bible"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "$1,500 to $4,000",
        location: "London, UK",
        locationType: "remote",
        pinned: true,
        verified: true,
        clientRating: 4.8,
        clientJobs: 31,
        clientSpent: "$180K",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      },
      {
        title: "TV pilot for a family comedy",
        organization: "Sunlit Studios",
        callType: "commission",
        genre: "Comedy",
        targetMarket: "Streaming",
        description:
          "A streaming-focused producer wants a half-hour pilot with a repeatable family set-up and strong ensemble voices.",
        requirements: "Pitch deck and pilot script.",
        applyFormat: "Pitch deck and pilot script",
        experience: "Expert",
        duration: "3 to 6 months",
        payType: "Fixed price",
        skills: ["Comedy", "TV pilot", "Ensemble"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "Not disclosed",
        location: "Accra, Ghana",
        locationType: "remote",
        pinned: false,
        verified: true,
        clientRating: 4.7,
        clientJobs: 12,
        clientSpent: "₦28M",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      },
      {
        title: "Hollywood indie thriller, polish and rewrite",
        organization: "Northline Pictures",
        callType: "script_submission",
        genre: "Thriller",
        targetMarket: "Hollywood",
        description:
          "A US indie team needs a dialogue polish and a stronger second act on an existing thriller script.",
        requirements: "Query letter and logline.",
        applyFormat: "Query letter and logline",
        experience: "Expert",
        duration: "1 to 3 months",
        payType: "Fixed price",
        skills: ["Hollywood", "Thriller", "Rewrite", "Dialogue"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "$250K to $1M budget",
        location: "Atlanta, USA",
        locationType: "remote",
        pinned: false,
        verified: true,
        clientRating: 4.9,
        clientJobs: 9,
        clientSpent: "$62K",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      },
      {
        title: "Web series, 6 short episodes",
        organization: "Campus Reel",
        callType: "commission",
        genre: "Comedy",
        targetMarket: "Web",
        description:
          "A youth-focused web series about university life needs a writer for six five-minute episodes.",
        requirements: "Logline and sample scene.",
        applyFormat: "Logline and sample scene",
        experience: "Intermediate",
        duration: "1 to 3 months",
        payType: "Fixed price",
        skills: ["Web series", "Comedy", "Campus"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "₦800K to ₦2M",
        location: "Enugu, Nigeria",
        locationType: "remote",
        pinned: false,
        verified: false,
        clientRating: 4.2,
        clientJobs: 2,
        clientSpent: "₦400K",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      },
      {
        title: "Adapt a bestselling novel into a feature script",
        organization: "Harbour Films",
        callType: "script_submission",
        genre: "Drama",
        targetMarket: "Nollywood",
        description:
          "Rights are secured. We need an adapter who understands the book's tone and can deliver a shooting draft.",
        requirements: "Query letter and 10 pages.",
        applyFormat: "Query letter and 10 pages",
        experience: "Expert",
        duration: "3 to 6 months",
        payType: "Fixed price",
        skills: ["Adaptation", "Drama", "Feature film"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 50).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "₦3M to ₦8M",
        location: "Lagos, Nigeria",
        locationType: "hybrid",
        pinned: false,
        verified: true,
        clientRating: 5.0,
        clientJobs: 6,
        clientSpent: "₦19M",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
      },
      {
        title: "Documentary narration script",
        organization: "Craft Lens",
        callType: "short_film",
        genre: "Documentary",
        targetMarket: "Nollywood",
        description:
          "A 20-minute documentary about Nigerian crafts needs a warm, clear narration script.",
        requirements: "Writing sample.",
        applyFormat: "Writing sample",
        experience: "Entry level",
        duration: "Under 1 month",
        payType: "Fixed price",
        skills: ["Documentary", "Narration"],
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10),
        prize: "",
        fee: "",
        budget: "₦300K to ₦700K",
        location: "Kano, Nigeria",
        locationType: "remote",
        pinned: false,
        verified: true,
        clientRating: 4.5,
        clientJobs: 3,
        clientSpent: "₦900K",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
      },
    ];

    const batch = db.batch();
    const created = [];
    for (const sample of samples) {
      const ref = db.collection("openCalls").doc();
      const doc = {
        posterId: "system-demo",
        posterName: "Ink2Wealth Industry",
        ...sample,
        status: "active",
        rejectReason: null,
        pitchCount: 0,
        updatedAt: now,
      };
      batch.set(ref, doc);
      created.push(mapCall(ref.id, doc));
    }
    await batch.commit();
    return res.json({ seeded: created.length, calls: created, message: `Seeded ${created.length} demo open calls.` });
  } catch (error: any) {
    console.error("Seed open calls error:", error);
    return res.status(500).json({ error: error.message || "Failed to seed demo calls." });
  }
});

/** GET /api/wealth/industry/saved */
router.get("/industry/saved", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const saved = await savedCallIds(req.user.uid);
    if (saved.size === 0) return res.json({ calls: [] });
    const snaps = await Promise.all(
      [...saved].map((id) => db.collection("openCalls").doc(id).get())
    );
    const calls = snaps
      .filter((snap) => snap.exists && snap.data()?.status === "active")
      .map((snap) => mapCall(snap.id, snap.data()!, { saved: true }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ calls });
  } catch (error: any) {
    console.error("Saved open calls error:", error);
    return res.status(500).json({ error: error.message || "Failed to load saved jobs." });
  }
});

/** POST /api/wealth/industry/:id/save */
router.post("/industry/:id/save", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const callId = String(req.params.id);
    const db = getFirestore();
    const callSnap = await db.collection("openCalls").doc(callId).get();
    if (!callSnap.exists || callSnap.data()?.status !== "active") {
      return res.status(404).json({ error: "Open call not found." });
    }
    const id = `${req.user.uid}_${callId}`;
    await db.collection("savedOpenCalls").doc(id).set({
      userId: req.user.uid,
      callId,
      createdAt: nowIso(),
    });
    return res.json({ saved: true, call: mapCall(callSnap.id, callSnap.data()!, { saved: true }) });
  } catch (error: any) {
    console.error("Save open call error:", error);
    return res.status(500).json({ error: error.message || "Failed to save job." });
  }
});

/** DELETE /api/wealth/industry/:id/save */
router.delete("/industry/:id/save", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const callId = String(req.params.id);
    const db = getFirestore();
    await db.collection("savedOpenCalls").doc(`${req.user.uid}_${callId}`).delete();
    const callSnap = await db.collection("openCalls").doc(callId).get();
    return res.json({
      saved: false,
      call: callSnap.exists ? mapCall(callSnap.id, callSnap.data()!, { saved: false }) : { id: callId, saved: false },
    });
  } catch (error: any) {
    console.error("Unsave open call error:", error);
    return res.status(500).json({ error: error.message || "Failed to remove saved job." });
  }
});

/** GET /api/wealth/industry/:id */
router.get("/industry/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db.collection("openCalls").doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ error: "Open call not found." });
    const data = snap.data()!;
    const isOwner = data.posterId === req.user.uid;
    const isAdmin = (await getUserProfile(req.user.uid)).role === "admin";
    if (data.status !== "active" && !isOwner && !isAdmin) {
      return res.status(404).json({ error: "Open call not found." });
    }
    const saved = (await savedCallIds(req.user.uid)).has(snap.id);
    return res.json({ call: mapCall(snap.id, data, { saved }) });
  } catch (error: any) {
    console.error("Get open call error:", error);
    return res.status(500).json({ error: error.message || "Failed to load open call." });
  }
});

/** POST /api/wealth/industry/:id/close */
router.post("/industry/:id/close", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const ref = db.collection("openCalls").doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Open call not found." });
    if (snap.data()!.posterId !== req.user.uid) {
      return res.status(403).json({ error: "Only the poster can close this listing." });
    }
    const now = nowIso();
    await ref.update({ status: "closed", updatedAt: now });
    const next = await ref.get();
    return res.json({ call: mapCall(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Close open call error:", error);
    return res.status(500).json({ error: error.message || "Failed to close listing." });
  }
});

/** POST /api/wealth/industry/:id/pitches — pitch / apply */
router.post("/industry/:id/pitches", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const callId = String(req.params.id);
    const db = getFirestore();
    const callRef = db.collection("openCalls").doc(callId);
    const callSnap = await callRef.get();
    if (!callSnap.exists) return res.status(404).json({ error: "Open call not found." });
    const call = callSnap.data()!;
    if (call.status !== "active") {
      return res.status(400).json({ error: "This open call is not accepting pitches." });
    }
    if (call.posterId === req.user.uid) {
      return res.status(400).json({ error: "You cannot pitch to your own listing." });
    }

    const existing = await db
      .collection("industryPitches")
      .where("callId", "==", callId)
      .where("applicantId", "==", req.user.uid)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(400).json({ error: "You already pitched to this open call." });
    }

    const pitchMessage = String(req.body?.pitchMessage || "").trim();
    if (pitchMessage.length < 20) {
      return res.status(400).json({ error: "Pitch message must be at least 20 characters." });
    }

    const profile = await getUserProfile(req.user.uid);
    const now = nowIso();
    const pitchRef = db.collection("industryPitches").doc();
    const doc = {
      callId,
      callTitle: call.title || "",
      callType: call.callType || "",
      applicantId: req.user.uid,
      applicantName: profile.displayName || profile.name || profile.email || "Applicant",
      applicantEmail: profile.email || req.user.email || null,
      pitchMessage,
      portfolioUrl: String(req.body?.portfolioUrl || "").trim(),
      sampleUrl: String(req.body?.sampleUrl || "").trim(),
      experience: String(req.body?.experience || "").trim(),
      bidAmount: String(req.body?.bidAmount || "").trim(),
      deliveryTime: String(req.body?.deliveryTime || "").trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await pitchRef.set(doc);
    await callRef.update({
      pitchCount: Number(call.pitchCount || 0) + 1,
      updatedAt: now,
    });
    return res.status(201).json({
      pitch: mapPitch(pitchRef.id, doc),
      message: "Pitch submitted.",
    });
  } catch (error: any) {
    console.error("Submit pitch error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit pitch." });
  }
});

/** GET /api/wealth/industry/:id/pitches — poster only */
router.get("/industry/:id/pitches", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const callId = String(req.params.id);
    const db = getFirestore();
    const callSnap = await db.collection("openCalls").doc(callId).get();
    if (!callSnap.exists) return res.status(404).json({ error: "Open call not found." });
    if (callSnap.data()!.posterId !== req.user.uid) {
      return res.status(403).json({ error: "Only the poster can view pitches." });
    }
    const snap = await db.collection("industryPitches").where("callId", "==", callId).get();
    const pitches = snap.docs
      .map((d) => mapPitch(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ pitches });
  } catch (error: any) {
    console.error("List pitches error:", error);
    return res.status(500).json({ error: error.message || "Failed to load pitches." });
  }
});

/** PATCH /api/wealth/pitches/:id — poster updates status */
router.patch("/pitches/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const status = String(req.body?.status || "").trim();
    if (!(PITCH_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: "Invalid pitch status." });
    }
    const db = getFirestore();
    const ref = db.collection("industryPitches").doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Pitch not found." });
    const pitch = snap.data()!;
    const callSnap = await db.collection("openCalls").doc(pitch.callId).get();
    if (!callSnap.exists || callSnap.data()!.posterId !== req.user.uid) {
      return res.status(403).json({ error: "Only the listing poster can update this pitch." });
    }
    const now = nowIso();
    await ref.update({ status, updatedAt: now });
    const next = await ref.get();
    return res.json({ pitch: mapPitch(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Update pitch error:", error);
    return res.status(500).json({ error: error.message || "Failed to update pitch." });
  }
});

export default router;
