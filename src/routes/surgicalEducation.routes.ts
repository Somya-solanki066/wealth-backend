import express, { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import {
  getLiveBroadcast,
  getSurgicalAccess,
  grantSurgicalAccess,
  listSurgicalCases,
  toggleLiveReminder,
} from "../services/surgicalEducation.service";

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || (decoded as any).displayName,
      };
    } catch (_) {
      req.user = { uid: "guest_surg_student", email: "student@ink2wealth.com", name: "Surgical Scholar" };
    }
  } else {
    req.user = { uid: "guest_surg_student", email: "student@ink2wealth.com", name: "Surgical Scholar" };
  }
  next();
}

const router = express.Router();

// 1. Get surgical cases library
router.get("/cases", async (req, res) => {
  try {
    const specialty = req.query.specialty ? String(req.query.specialty) : undefined;
    const cases = await listSurgicalCases(specialty);
    return res.json({ success: true, cases });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load surgical cases" });
  }
});

// 2. Get live broadcast information & reminder status
router.get("/live", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid;
    const broadcast = await getLiveBroadcast(userId);
    return res.json({ success: true, broadcast });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load live broadcast" });
  }
});

// 3. Toggle reminder for live broadcast
router.post("/live/:id/reminder", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || "guest_surg_student";
    const broadcastId = String(req.params.id);
    const result = await toggleLiveReminder(userId, broadcastId);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to toggle reminder" });
  }
});

// 4. Get surgical access status & account watermark
router.get("/access", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || "guest_surg_student";
    const access = await getSurgicalAccess(userId);
    return res.json({ success: true, access });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load access" });
  }
});

// 5. Grant / request professional verification access
router.post("/verify", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || "guest_surg_student";
    const { institutionName, studentOrLicenceId, role } = req.body || {};
    const access = await grantSurgicalAccess({
      userId,
      institutionName,
      studentOrLicenceId,
      role,
    });
    return res.json({ success: true, access, message: "Surgical access granted successfully" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Verification failed" });
  }
});

export default router;

