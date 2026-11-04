import express, { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import {
  addMedicalPostComment,
  createMedicalPost,
  getMedicalVerification,
  listMedicalPostComments,
  listMedicalPosts,
  listMedicalRooms,
  submitMedicalReport,
  submitMedicalVerification,
  toggleMedicalPostLike,
} from "../services/medicalCommunity.service";

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
      req.user = { uid: "guest_student_med", email: "student@ink2wealth.com", name: "Medical Scholar" };
    }
  } else {
    req.user = { uid: "guest_student_med", email: "student@ink2wealth.com", name: "Medical Scholar" };
  }
  next();
}

const router = express.Router();

// 1. Get all Medical Communities (Rooms)
router.get("/rooms", async (_req, res) => {
  try {
    const rooms = await listMedicalRooms();
    return res.json({ success: true, rooms });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load rooms" });
  }
});

// 2. Get posts for room/channel
router.get("/posts", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const roomId = req.query.roomId ? String(req.query.roomId) : undefined;
    const channel = req.query.channel ? String(req.query.channel) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const userId = req.user?.uid;

    const posts = await listMedicalPosts({ roomId, channel, search, userId });
    return res.json({ success: true, posts });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load posts" });
  }
});

// 3. Create a medical post (confidentiality confirmation required)
router.post("/posts", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { roomId, channel, title, content, confidentialityConfirmed, authorName, authorRole } = req.body || {};
    if (!roomId) return res.status(400).json({ success: false, error: "roomId is required" });
    if (!content?.trim()) return res.status(400).json({ success: false, error: "Content is required" });
    if (!confidentialityConfirmed) {
      return res.status(400).json({
        success: false,
        error: "Patient confidentiality confirmation is required before posting.",
      });
    }

    const post = await createMedicalPost({
      userId: req.user?.uid || "guest_student_med",
      authorName: authorName || req.user?.name || "Medical Scholar",
      authorRole: authorRole || "Student",
      roomId: String(roomId),
      channel: channel ? String(channel) : "Discussion",
      title: title ? String(title) : "Clinical Case Question",
      content: String(content),
      confidentialityConfirmed: Boolean(confidentialityConfirmed),
    });

    return res.status(201).json({ success: true, post });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || "Post creation failed" });
  }
});

// 4. Toggle like on a medical post
router.post("/posts/:id/like", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = String(req.params.id);
    const userId = req.user?.uid || "guest_student_med";
    const result = await toggleMedicalPostLike(userId, postId);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Like failed" });
  }
});

// 5. Get comments for a post
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const comments = await listMedicalPostComments(String(req.params.id));
    return res.json({ success: true, comments });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to load comments" });
  }
});

// 6. Add comment to a post
router.post("/posts/:id/comments", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const content = req.body?.content;
    if (!content?.trim()) return res.status(400).json({ success: false, error: "Content is required" });

    const comment = await addMedicalPostComment({
      postId: String(req.params.id),
      userId: req.user?.uid || "guest_student_med",
      authorName: req.body?.authorName || req.user?.name || "Medical Peer",
      content: String(content),
    });

    return res.status(201).json({ success: true, comment });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || "Comment failed" });
  }
});

// 7. Get verification status
router.get("/verification", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || "guest_student_med";
    const status = await getMedicalVerification(userId);
    return res.json({ success: true, verification: status });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to get verification" });
  }
});

// 8. Submit verification
router.post("/verify", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { profession, fullName, councilNumber, licenceDocumentUrl, confirmIdentity, acceptRules } =
      req.body || {};
    const userId = req.user?.uid || "guest_student_med";

    const result = await submitMedicalVerification({
      userId,
      profession: profession || "Doctor",
      fullName: fullName || "Doctor / Nurse",
      councilNumber: councilNumber || "MDCN/P-9021",
      licenceDocumentUrl,
      confirmIdentity: Boolean(confirmIdentity),
      acceptRules: Boolean(acceptRules),
    });

    return res.json({ success: true, verification: result, message: "Verification completed successfully" });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || "Verification failed" });
  }
});

// 9. Report post or breach
router.post("/report", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { postId, reason, details } = req.body || {};
    if (!postId || !reason) {
      return res.status(400).json({ success: false, error: "postId and reason are required" });
    }

    const report = await submitMedicalReport({
      userId: req.user?.uid || "guest_student_med",
      postId: String(postId),
      reason: String(reason),
      details: details ? String(details) : undefined,
    });

    return res.json({ success: true, report, message: "Report submitted to medical moderation board." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Report failed" });
  }
});

export default router;

