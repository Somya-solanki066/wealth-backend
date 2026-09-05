import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { getUploadsDir } from "../utils/paths";
import { getPlanById, isFreePlan, subscriptionFieldsForPlan } from "../utils/plans";
import { getCourseProduct } from "../data/courseProducts";
import { getCourseFeatures } from "../data/courseFeatures";

const router = Router();

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, JPG, PNG and WEBP image files are allowed."));
    }
  },
});

// Verify endpoint: checks user doc in Firestore and returns profile
router.post("/verify", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const { uid, email, name, picture } = req.user;
    
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const docSnap = await userRef.get();

    if (!docSnap.exists) {
      // Create user doc if it doesn't exist (e.g. first time sign in via Google)
      const newUser = {
        uid,
        email: email || null,
        displayName: name || "User",
        photoURL: picture || null,
        createdAt: new Date().toISOString(),
      };
      await userRef.set(newUser);
      return res.status(201).json(newUser);
    }

    const existing = docSnap.data() || {};
    const currentName = typeof existing.displayName === "string" ? existing.displayName.trim() : "";
    const needsName =
      !currentName || currentName.toLowerCase() === "user";
    if (needsName && name) {
      await userRef.set(
        { displayName: name, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      const refreshed = await userRef.get();
      return res.status(200).json(refreshed.data());
    }

    return res.status(200).json(existing);
  } catch (error: any) {
    console.error("Error in verify user route:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Avatar upload endpoint
router.post(
  "/upload-avatar",
  verifyFirebaseToken,
  (req, res, next) => {
    // Multer error handling wrapper
    upload.single("avatar")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User payload missing" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No avatar image file uploaded" });
      }

      // Generate host URL for the uploaded file
      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

      // Update Firestore user document
      const db = getFirestore();
      const userRef = db.collection("users").doc(req.user.uid);
      await userRef.update({
        photoURL: fileUrl,
      });

      return res.status(200).json({
        message: "Avatar uploaded successfully",
        photoURL: fileUrl,
      });
    } catch (error: any) {
      console.error("Error in upload avatar route:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// Retrieve writing streak status
router.get("/streak", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const db = getFirestore();
    const userRef = db.collection("users").doc(req.user.uid);
    const docSnap = await userRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const data = docSnap.data() || {};
    return res.status(200).json({
      writingStreak: data.writingStreak || 0,
      lastWriteDate: data.lastWriteDate || null,
      totalWordsWritten: data.totalWordsWritten || 0,
    });
  } catch (error: any) {
    console.error("Error fetching streak:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Record a writing session to increment or reset streak
router.post("/streak/record", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User payload missing" });
    }
    const { wordCount, localDateStr } = req.body;
    if (typeof wordCount !== "number" || !localDateStr) {
      return res.status(400).json({ error: "Invalid body parameters" });
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(req.user.uid);
    const docSnap = await userRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const data = docSnap.data() || {};
    let writingStreak = data.writingStreak || 0;
    let lastWriteDate = data.lastWriteDate || null;
    let totalWordsWritten = data.totalWordsWritten || 0;

    totalWordsWritten += wordCount;

    if (wordCount > 0) {
      if (!lastWriteDate) {
        writingStreak = 1;
        lastWriteDate = localDateStr;
      } else {
        const lastDate = new Date(lastWriteDate);
        const currentDate = new Date(localDateStr);

        lastDate.setUTCHours(0, 0, 0, 0);
        currentDate.setUTCHours(0, 0, 0, 0);

        const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          // Success: written on consecutive day
          writingStreak += 1;
          lastWriteDate = localDateStr;
        } else if (diffDays > 1) {
          // Missed: streak reset
          writingStreak = 1;
          lastWriteDate = localDateStr;
        } else if (diffDays === 0) {
          // Already wrote today: keep streak, update last write date just in case
          lastWriteDate = localDateStr;
        }
      }
    }

    await userRef.update({
      writingStreak,
      lastWriteDate,
      totalWordsWritten,
    });

    return res.status(200).json({
      message: "Writing session recorded successfully",
      writingStreak,
      lastWriteDate,
      totalWordsWritten,
    });
  } catch (error: any) {
    console.error("Error recording streak:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/select-plan", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "planId is required" });

    const plan = await getPlanById(planId);
    if (!plan || !isFreePlan(plan)) {
      return res.status(400).json({
        error: "Only free plans can be selected directly. Paid plans require Stripe checkout.",
      });
    }

    const db = getFirestore();
    await db.collection("users").doc(req.user.uid).set(
      subscriptionFieldsForPlan(plan, "select-plan"),
      { merge: true }
    );
    return res.status(200).json({ success: true, planId: plan.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const VALID_WORLDS = ["writer", "screenwriter", "student"] as const;
type UserWorld = (typeof VALID_WORLDS)[number];

function isUserWorld(value: unknown): value is UserWorld {
  return typeof value === "string" && (VALID_WORLDS as readonly string[]).includes(value);
}

// Current user profile (for mobile routing after login)
router.get("/me", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const db = getFirestore();
    const snap = await db.collection("users").doc(req.user.uid).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "User not found. Call /user/verify first." });
    }
    return res.status(200).json(snap.data());
  } catch (err: any) {
    console.error("Error in GET /user/me:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Persist preferred world (writer | screenwriter | student)
router.put("/world", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const world = req.body?.world;
    if (!isUserWorld(world)) {
      return res.status(400).json({
        error: 'world must be "writer", "screenwriter", or "student"',
      });
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(req.user.uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "User not found. Call /user/verify first." });
    }

    const prev = snap.data() || {};
    const worldChanged = prev.world && prev.world !== world;
    const patch: Record<string, unknown> = {
      world,
      updatedAt: new Date().toISOString(),
    };

    if (worldChanged) {
      patch.onboardingComplete = false;
      patch.onboarding = {};
    }

    await userRef.set(patch, { merge: true });
    const updated = await userRef.get();
    return res.status(200).json(updated.data());
  } catch (err: any) {
    console.error("Error in PUT /user/world:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Merge onboarding preferences; optionally mark complete
router.put("/onboarding", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const world = req.body?.world;
    const data = req.body?.data;
    const complete = req.body?.complete === true;

    if (!isUserWorld(world)) {
      return res.status(400).json({
        error: 'world must be "writer", "screenwriter", or "student"',
      });
    }
    if (data !== undefined && (typeof data !== "object" || data === null || Array.isArray(data))) {
      return res.status(400).json({ error: "data must be an object" });
    }

    const db = getFirestore();
    const userRef = db.collection("users").doc(req.user.uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "User not found. Call /user/verify first." });
    }

    const prev = snap.data() || {};
    const prevOnboarding =
      prev.onboarding && typeof prev.onboarding === "object" && !Array.isArray(prev.onboarding)
        ? { ...(prev.onboarding as Record<string, unknown>) }
        : {};

    const nextOnboarding = {
      ...prevOnboarding,
      ...(data && typeof data === "object" ? data : {}),
    };

    const patch: Record<string, unknown> = {
      world,
      onboarding: nextOnboarding,
      updatedAt: new Date().toISOString(),
    };
    if (complete) {
      patch.onboardingComplete = true;
    }

    await userRef.set(patch, { merge: true });
    const updated = await userRef.get();
    return res.status(200).json(updated.data());
  } catch (err: any) {
    console.error("Error in PUT /user/onboarding:", err);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/user/transactions — course enrollments + subscription payments */
router.get("/transactions", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const db = getFirestore();
    const userId = req.user.uid;

    const [enrollSnap, paySnap, userSnap] = await Promise.all([
      db.collection("courseEnrollments").where("userId", "==", userId).get(),
      db.collection("payments").where("userId", "==", userId).get(),
      db.collection("users").doc(userId).get(),
    ]);

    const courseTransactions = enrollSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: "course" as const,
        enrollmentId: d.enrollmentId || null,
        title: d.courseName || "Course",
        courseId: d.courseId || null,
        amountPaid: d.amountPaid || 0,
        currency: (d.currency || "ngn").toUpperCase(),
        status: d.status || "paid",
        validFrom: d.validFrom || d.createdAt || null,
        validUntil: d.validUntil || null,
        accessType: d.accessType || (d.validUntil ? "limited" : "lifetime"),
        createdAt: d.createdAt || d.confirmedAt || null,
        paymentProvider: d.paymentProvider || "stripe",
      };
    });

    const subscriptionTransactions = paySnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: "subscription" as const,
        enrollmentId: null,
        title: d.planId ? `App Plan — ${String(d.planId).replace(/-/g, " ")}` : "App Subscription",
        courseId: null,
        amountPaid: d.amountTotal ? Math.round(Number(d.amountTotal) / 100) : 0,
        currency: (d.currency || "ngn").toUpperCase(),
        status: d.status || "paid",
        validFrom: d.createdAt || null,
        validUntil: userSnap.data()?.subscriptionExpiry || null,
        accessType: "limited" as const,
        createdAt: d.createdAt || null,
        paymentProvider: "stripe",
      };
    });

    const transactions = [...courseTransactions, ...subscriptionTransactions].sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    return res.json({ transactions, total: transactions.length });
  } catch (err: any) {
    console.error("Error in GET /user/transactions:", err);
    return res.status(500).json({ error: err.message || "Failed to load transactions." });
  }
});

function computeIsActive(params: {
  status: string;
  accessType: string;
  validUntil: string | null;
}): boolean {
  if (params.status !== "paid") return false;
  if (params.accessType === "lifetime" || !params.validUntil) return true;
  const expiry = new Date(params.validUntil);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
}

function daysRemaining(validUntil: string | null): number | null {
  if (!validUntil) return null;
  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) return null;
  const diff = expiry.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}

/** GET /api/user/transactions/:type/:id — full transaction detail */
router.get("/transactions/:type/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const txType = String(req.params.type || "");
    const txId = String(req.params.id || "");
    const userId = req.user.uid;
    const db = getFirestore();

    if (txType === "course") {
      const doc = await db.collection("courseEnrollments").doc(txId).get();
      if (!doc.exists) return res.status(404).json({ error: "Transaction not found." });

      const d = doc.data()!;
      if (d.userId !== userId) return res.status(403).json({ error: "Access denied." });

      const courseId = String(d.courseId || "");
      const product = getCourseProduct(courseId);
      const accessType = d.accessType || (d.validUntil ? "limited" : "lifetime");
      const validFrom = d.validFrom || d.createdAt || null;
      const validUntil = d.validUntil || null;

      return res.json({
        transaction: {
          id: doc.id,
          type: "course",
          title: d.courseName || product?.name || "Course",
          description: product?.description || null,
          enrollmentId: d.enrollmentId || null,
          courseId: courseId || null,
          planId: null,
          planName: null,
          amountPaid: d.amountPaid || 0,
          amountPaidKobo: d.amountPaidKobo || null,
          currency: (d.currency || "ngn").toUpperCase(),
          status: d.status || "paid",
          validFrom,
          validUntil,
          accessType,
          createdAt: d.createdAt || d.confirmedAt || null,
          confirmedAt: d.confirmedAt || null,
          paymentProvider: d.paymentProvider || "stripe",
          stripeSessionId: d.stripeSessionId || null,
          source: d.source || null,
          userEmail: d.userEmail || null,
          isActive: computeIsActive({ status: d.status || "paid", accessType, validUntil }),
          daysRemaining: accessType === "lifetime" ? null : daysRemaining(validUntil),
          features: getCourseFeatures(courseId),
        },
      });
    }

    if (txType === "subscription") {
      const doc = await db.collection("payments").doc(txId).get();
      if (!doc.exists) return res.status(404).json({ error: "Transaction not found." });

      const d = doc.data()!;
      if (d.userId !== userId) return res.status(403).json({ error: "Access denied." });

      const planId = String(d.planId || "");
      const plan = planId ? await getPlanById(planId) : null;
      const validFrom = d.createdAt || null;
      let validUntil: string | null = null;
      if (plan && !plan.isFree && plan.durationDays > 0 && validFrom) {
        const start = new Date(validFrom);
        if (!Number.isNaN(start.getTime())) {
          validUntil = new Date(start.getTime() + plan.durationDays * 86400000).toISOString();
        }
      }

      const userSnap = await db.collection("users").doc(userId).get();
      const currentExpiry = userSnap.data()?.subscriptionExpiry || null;

      return res.json({
        transaction: {
          id: doc.id,
          type: "subscription",
          title: plan ? `App Plan — ${plan.name}` : d.planId ? `App Plan — ${planId.replace(/-/g, " ")}` : "App Subscription",
          description: plan ? `${plan.period} · ${plan.world} world access` : null,
          enrollmentId: null,
          courseId: null,
          planId: planId || null,
          planName: plan?.name || null,
          amountPaid: d.amountTotal ? Math.round(Number(d.amountTotal) / 100) : 0,
          amountPaidKobo: d.amountTotal || null,
          currency: (d.currency || "ngn").toUpperCase(),
          status: d.status || "paid",
          validFrom,
          validUntil,
          accessType: "limited",
          createdAt: d.createdAt || null,
          confirmedAt: d.createdAt || null,
          paymentProvider: "stripe",
          stripeSessionId: doc.id,
          source: d.source || null,
          userEmail: d.email || null,
          subscriptionWorld: plan?.world || userSnap.data()?.subscriptionWorld || null,
          currentSubscriptionExpiry: currentExpiry,
          isActive: computeIsActive({ status: d.status || "paid", accessType: "limited", validUntil }),
          daysRemaining: daysRemaining(validUntil),
          features: plan?.features || [],
        },
      });
    }

    return res.status(400).json({ error: "Invalid transaction type." });
  } catch (err: any) {
    console.error("Error in GET /user/transactions/:type/:id:", err);
    return res.status(500).json({ error: err.message || "Failed to load transaction." });
  }
});

export default router;

