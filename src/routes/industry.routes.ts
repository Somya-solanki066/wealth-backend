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

function mapCall(id: string, data: Record<string, any>) {
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
    deadline: data.deadline || null,
    prize: data.prize || "",
    fee: data.fee || "",
    locationType: data.locationType || "remote",
    status: data.status || "pending_review",
    rejectReason: data.rejectReason || null,
    pitchCount: data.pitchCount || 0,
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
    let calls = snap.docs.map((d) => mapCall(d.id, d.data()));

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
    const locationType = String(body.locationType || "remote").trim();

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
      deadline,
      prize,
      fee,
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
    return res.json({ call: mapCall(snap.id, data) });
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
