import express from "express";
import { getFirestore, type Query } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";

const router = express.Router();

export const JOB_CATEGORIES = ["novel", "screenwriting", "ghostwriting", "editing"] as const;
export const JOB_TYPES = ["freelance", "contract", "part-time", "full-time", "one-time"] as const;
export const LOCATION_TYPES = ["remote", "onsite", "hybrid"] as const;
export const BUDGET_TYPES = ["fixed", "hourly", "negotiable"] as const;
export const JOB_STATUSES = ["draft", "pending_review", "active", "rejected", "closed"] as const;
export const APPLICATION_STATUSES = [
  "pending",
  "reviewed",
  "shortlisted",
  "accepted",
  "rejected",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

function nowIso() {
  return new Date().toISOString();
}

function parseBudget(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapJob(id: string, data: Record<string, any>) {
  return {
    id,
    posterId: data.posterId || "",
    posterName: data.posterName || "Poster",
    title: data.title || "",
    category: data.category || "",
    description: data.description || "",
    budget: data.budget ?? null,
    budgetDisplay: data.budgetDisplay || (data.budget != null ? `$${data.budget}` : ""),
    budgetType: data.budgetType || "fixed",
    deadline: data.deadline || null,
    jobType: data.jobType || "contract",
    locationType: data.locationType || "remote",
    urgent: Boolean(data.urgent),
    status: data.status || "pending_review",
    rejectReason: data.rejectReason || null,
    applicationCount: data.applicationCount || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function mapApplication(id: string, data: Record<string, any>) {
  return {
    id,
    jobId: data.jobId || "",
    jobTitle: data.jobTitle || "",
    jobCategory: data.jobCategory || "",
    applicantId: data.applicantId || "",
    applicantName: data.applicantName || "Applicant",
    applicantEmail: data.applicantEmail || null,
    coverMessage: data.coverMessage || "",
    portfolioUrl: data.portfolioUrl || "",
    experience: data.experience || "",
    expectedRate: data.expectedRate || "",
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

/** GET /api/wealth/jobs/mine — must be before /jobs/:id */
router.get("/jobs/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db.collection("jobs").where("posterId", "==", req.user.uid).get();
    const jobs = snap.docs
      .map((d) => mapJob(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ jobs });
  } catch (error: any) {
    console.error("My jobs error:", error);
    return res.status(500).json({ error: error.message || "Failed to load your jobs." });
  }
});

/** GET /api/wealth/applications/mine */
router.get("/applications/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const snap = await db
      .collection("jobApplications")
      .where("applicantId", "==", req.user.uid)
      .get();
    const applications = snap.docs
      .map((d) => mapApplication(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ applications });
  } catch (error: any) {
    console.error("My applications error:", error);
    return res.status(500).json({ error: error.message || "Failed to load applications." });
  }
});

/** GET /api/wealth/jobs — active feed with filters */
router.get("/jobs", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const category = String(req.query.category || "").trim().toLowerCase();
    const locationType = String(req.query.locationType || "").trim().toLowerCase();
    const jobType = String(req.query.jobType || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();
    const urgentOnly = String(req.query.urgent || "") === "true";
    const budgetMin = parseBudget(req.query.budgetMin);
    const budgetMax = parseBudget(req.query.budgetMax);

    let query: Query = db.collection("jobs").where("status", "==", "active");
    if (category && JOB_CATEGORIES.includes(category as JobCategory)) {
      query = query.where("category", "==", category);
    }

    const snap = await query.get();
    let jobs = snap.docs.map((d) => mapJob(d.id, d.data()));

    if (locationType && LOCATION_TYPES.includes(locationType as any)) {
      jobs = jobs.filter((j) => j.locationType === locationType);
    }
    if (jobType && JOB_TYPES.includes(jobType as any)) {
      jobs = jobs.filter((j) => j.jobType === jobType);
    }
    if (urgentOnly) jobs = jobs.filter((j) => j.urgent);
    if (budgetMin != null) {
      jobs = jobs.filter((j) => j.budget != null && Number(j.budget) >= budgetMin);
    }
    if (budgetMax != null) {
      jobs = jobs.filter((j) => j.budget != null && Number(j.budget) <= budgetMax);
    }
    if (search) {
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(search) ||
          j.description.toLowerCase().includes(search) ||
          j.category.toLowerCase().includes(search)
      );
    }

    jobs.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    return res.json({ jobs });
  } catch (error: any) {
    console.error("List jobs error:", error);
    return res.status(500).json({ error: error.message || "Failed to list jobs." });
  }
});

/** POST /api/wealth/jobs — create → pending_review */
router.post("/jobs", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });

    const title = String(req.body?.title || "").trim();
    const category = String(req.body?.category || "").trim().toLowerCase();
    const description = String(req.body?.description || "").trim();
    const budgetRaw = req.body?.budget;
    const budget = parseBudget(budgetRaw);
    const budgetDisplay = String(req.body?.budgetDisplay || budgetRaw || "").trim();
    const budgetType = String(req.body?.budgetType || "fixed").trim().toLowerCase();
    const deadline = String(req.body?.deadline || "").trim();
    const jobType = String(req.body?.jobType || "contract").trim().toLowerCase();
    const locationType = String(req.body?.locationType || "remote").trim().toLowerCase();
    const urgent = Boolean(req.body?.urgent);

    if (!title) return res.status(400).json({ error: "Job title is required." });
    if (!JOB_CATEGORIES.includes(category as JobCategory)) {
      return res.status(400).json({ error: "Invalid category." });
    }
    if (!description || description.length < 40) {
      return res.status(400).json({ error: "Description must be at least 40 characters." });
    }
    if (budget == null && !budgetDisplay) {
      return res.status(400).json({ error: "Budget is required." });
    }
    if (!deadline) return res.status(400).json({ error: "Deadline is required." });
    if (!JOB_TYPES.includes(jobType as any)) {
      return res.status(400).json({ error: "Invalid job type." });
    }
    if (!LOCATION_TYPES.includes(locationType as any)) {
      return res.status(400).json({ error: "Invalid location type." });
    }
    if (!BUDGET_TYPES.includes(budgetType as any)) {
      return res.status(400).json({ error: "Invalid budget type." });
    }

    const profile = await getUserProfile(req.user.uid);
    const now = nowIso();
    const db = getFirestore();
    const ref = db.collection("jobs").doc();
    const doc = {
      posterId: req.user.uid,
      posterName: profile.displayName || profile.name || req.user.email || "Poster",
      title,
      category,
      description,
      budget,
      budgetDisplay: budgetDisplay || (budget != null ? `$${budget}` : ""),
      budgetType,
      deadline,
      jobType,
      locationType,
      urgent,
      status: "pending_review" as JobStatus,
      rejectReason: null,
      applicationCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);

    return res.status(201).json({
      job: mapJob(ref.id, doc),
      message: "Job submitted for admin review.",
    });
  } catch (error: any) {
    console.error("Create job error:", error);
    return res.status(500).json({ error: error.message || "Failed to create job." });
  }
});

/** GET /api/wealth/jobs/:id */
router.get("/jobs/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const doc = await db.collection("jobs").doc(String(req.params.id)).get();
    if (!doc.exists) return res.status(404).json({ error: "Job not found." });
    const data = doc.data()!;
    const isOwner = data.posterId === req.user.uid;
    if (data.status !== "active" && !isOwner) {
      return res.status(404).json({ error: "Job not found." });
    }

    let myApplication = null;
    if (!isOwner) {
      const appSnap = await db
        .collection("jobApplications")
        .where("jobId", "==", doc.id)
        .where("applicantId", "==", req.user.uid)
        .limit(1)
        .get();
      if (!appSnap.empty) {
        const a = appSnap.docs[0];
        myApplication = mapApplication(a.id, a.data());
      }
    }

    return res.json({
      job: mapJob(doc.id, data),
      isOwner,
      myApplication,
    });
  } catch (error: any) {
    console.error("Get job error:", error);
    return res.status(500).json({ error: error.message || "Failed to load job." });
  }
});

/** PATCH /api/wealth/jobs/:id — owner edit draft/pending only */
router.patch("/jobs/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const ref = db.collection("jobs").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Job not found." });
    const data = doc.data()!;
    if (data.posterId !== req.user.uid) return res.status(403).json({ error: "Forbidden." });
    if (!["draft", "pending_review", "rejected"].includes(data.status)) {
      return res.status(400).json({ error: "Only draft, pending, or rejected jobs can be edited." });
    }

    const updates: Record<string, unknown> = { updatedAt: nowIso() };
    const fields = [
      "title",
      "category",
      "description",
      "budgetType",
      "deadline",
      "jobType",
      "locationType",
    ] as const;

    for (const key of fields) {
      if (req.body?.[key] !== undefined) {
        updates[key] =
          key === "category" || key === "budgetType" || key === "jobType" || key === "locationType"
            ? String(req.body[key]).trim().toLowerCase()
            : String(req.body[key]).trim();
      }
    }
    if (req.body?.budget !== undefined) {
      updates.budget = parseBudget(req.body.budget);
      updates.budgetDisplay = String(req.body.budgetDisplay || req.body.budget || "").trim();
    }
    if (req.body?.urgent !== undefined) updates.urgent = Boolean(req.body.urgent);
    if (req.body?.resubmit) {
      updates.status = "pending_review";
      updates.rejectReason = null;
    }

    await ref.update(updates);
    const next = await ref.get();
    return res.json({ job: mapJob(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Update job error:", error);
    return res.status(500).json({ error: error.message || "Failed to update job." });
  }
});

/** POST /api/wealth/jobs/:id/close */
router.post("/jobs/:id/close", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const ref = db.collection("jobs").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Job not found." });
    if (doc.data()?.posterId !== req.user.uid) return res.status(403).json({ error: "Forbidden." });

    await ref.update({ status: "closed", updatedAt: nowIso() });
    const next = await ref.get();
    return res.json({ job: mapJob(next.id, next.data()!), message: "Job closed." });
  } catch (error: any) {
    console.error("Close job error:", error);
    return res.status(500).json({ error: error.message || "Failed to close job." });
  }
});

/** POST /api/wealth/jobs/:id/applications — apply */
router.post("/jobs/:id/applications", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const jobRef = db.collection("jobs").doc(String(req.params.id));
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) return res.status(404).json({ error: "Job not found." });
    const job = jobDoc.data()!;
    if (job.status !== "active") {
      return res.status(400).json({ error: "This job is not open for applications." });
    }
    if (job.posterId === req.user.uid) {
      return res.status(400).json({ error: "You cannot apply to your own job." });
    }

    const coverMessage = String(req.body?.coverMessage || "").trim();
    if (!coverMessage || coverMessage.length < 20) {
      return res.status(400).json({ error: "Cover message must be at least 20 characters." });
    }

    const existing = await db
      .collection("jobApplications")
      .where("jobId", "==", jobDoc.id)
      .where("applicantId", "==", req.user.uid)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(400).json({ error: "You already applied to this job." });
    }

    const profile = await getUserProfile(req.user.uid);
    const now = nowIso();
    const appRef = db.collection("jobApplications").doc();
    const appDoc = {
      jobId: jobDoc.id,
      jobTitle: job.title || "",
      jobCategory: job.category || "",
      applicantId: req.user.uid,
      applicantName: profile.displayName || profile.name || req.user.email || "Applicant",
      applicantEmail: profile.email || req.user.email || null,
      coverMessage,
      portfolioUrl: String(req.body?.portfolioUrl || "").trim(),
      experience: String(req.body?.experience || "").trim(),
      expectedRate: String(req.body?.expectedRate || "").trim(),
      status: "pending" as ApplicationStatus,
      createdAt: now,
      updatedAt: now,
    };
    await appRef.set(appDoc);
    await jobRef.update({
      applicationCount: (job.applicationCount || 0) + 1,
      updatedAt: now,
    });

    return res.status(201).json({
      application: mapApplication(appRef.id, appDoc),
      message: "Application submitted successfully.",
    });
  } catch (error: any) {
    console.error("Apply error:", error);
    return res.status(500).json({ error: error.message || "Failed to submit application." });
  }
});

/** GET /api/wealth/jobs/:id/applications — poster only */
router.get("/jobs/:id/applications", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const db = getFirestore();
    const jobDoc = await db.collection("jobs").doc(String(req.params.id)).get();
    if (!jobDoc.exists) return res.status(404).json({ error: "Job not found." });
    if (jobDoc.data()?.posterId !== req.user.uid) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const snap = await db
      .collection("jobApplications")
      .where("jobId", "==", jobDoc.id)
      .get();
    const applications = snap.docs
      .map((d) => mapApplication(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return res.json({
      job: mapJob(jobDoc.id, jobDoc.data()!),
      applications,
    });
  } catch (error: any) {
    console.error("List applicants error:", error);
    return res.status(500).json({ error: error.message || "Failed to load applicants." });
  }
});

/** PATCH /api/wealth/applications/:id — poster updates status */
router.patch("/applications/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!APPLICATION_STATUSES.includes(status as ApplicationStatus)) {
      return res.status(400).json({ error: "Invalid application status." });
    }

    const db = getFirestore();
    const appRef = db.collection("jobApplications").doc(String(req.params.id));
    const appDoc = await appRef.get();
    if (!appDoc.exists) return res.status(404).json({ error: "Application not found." });
    const app = appDoc.data()!;

    const jobDoc = await db.collection("jobs").doc(app.jobId).get();
    if (!jobDoc.exists || jobDoc.data()?.posterId !== req.user.uid) {
      return res.status(403).json({ error: "Forbidden." });
    }

    await appRef.update({ status, updatedAt: nowIso() });
    const next = await appRef.get();
    return res.json({ application: mapApplication(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Update application error:", error);
    return res.status(500).json({ error: error.message || "Failed to update application." });
  }
});

export default router;
