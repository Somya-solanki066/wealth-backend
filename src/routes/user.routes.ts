import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { getUploadsDir } from "../utils/paths";

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

    return res.status(200).json(docSnap.data());
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
// Simulated Upgrade Endpoint for Testing
router.post("/simulate-upgrade", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const db = getFirestore();
    
    // Simulate dates
    const now = new Date();
    const expiryDate = new Date();
    // Default to 1 year expiry for simulated upgrade for now
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await db.collection("users").doc(req.user.uid).update({
      isPremium: true,
      subscriptionPlan: req.body.planId || "plan_premium",
      subscriptionDate: now.toISOString(),
      subscriptionExpiry: expiryDate.toISOString(),
    });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Select Plan (Onboarding)
router.post("/select-plan", verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "planId is required" });

    const db = getFirestore();
    const isPremium = planId !== "free";
    
    const now = new Date();
    let expiryDate: string | null = null;
    
    if (isPremium) {
      // Basic simulation based on period if provided, else default 30 days
      const d = new Date();
      // Assume monthly for general plans if not specified
      d.setDate(d.getDate() + 30);
      expiryDate = d.toISOString();
    }
    
    await db.collection("users").doc(req.user.uid).update({
      subscriptionPlan: planId,
      isPremium: isPremium,
      subscriptionDate: now.toISOString(),
      subscriptionExpiry: expiryDate
    });
    return res.status(200).json({ success: true, planId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

