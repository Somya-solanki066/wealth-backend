import express, { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import {
  getVisaGuides,
  listOpportunities,
  toggleDeadlineReminder,
  toggleOpportunityBookmark,
} from "../services/globalOpportunities.service";

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
      req.user = { uid: "guest_global_student", email: "student@ink2wealth.com", name: "Scholar" };
    }
  } else {
    req.user = { uid: "guest_global_student", email: "student@ink2wealth.com", name: "Scholar" };
  }
  next();
}

const router = express.Router();

// 1. List opportunities with category & keyword filters
router.get("/", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const type = req.query.type ? String(req.query.type) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const userId = req.user?.uid;
    const opportunities = await listOpportunities({ type, search, userId });
    return res.json({ success: true, opportunities });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load opportunities" });
  }
});

// 2. Events & Seminars
router.get("/events", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid;
    const all = await listOpportunities({ userId });
    const events = all.filter((o) => o.type === "Seminar" || o.type === "Exam");
    return res.json({ success: true, events });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load events" });
  }
});

// 3. Toggle Bookmark
router.post("/:id/bookmark", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || "guest_global_student";
    const opportunityId = String(req.params.id);
    const result = await toggleOpportunityBookmark(userId, opportunityId);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Bookmark failed" });
  }
});

// 4. Toggle Deadline Reminder
router.post("/:id/reminder", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || "guest_global_student";
    const opportunityId = String(req.params.id);
    const result = await toggleDeadlineReminder(userId, opportunityId);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Reminder failed" });
  }
});

// 5. Official Visa Guide Resources
router.get("/visa-guides", async (_req, res) => {
  try {
    const guides = await getVisaGuides();
    return res.json({ success: true, guides });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load visa guides" });
  }
});

export default router;

