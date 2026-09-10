import express from "express";
import multer from "multer";
import path from "path";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  addComment,
  addFeedbackComment,
  adminListPosts,
  adminListReports,
  adminListRooms,
  adminResolveReport,
  adminUpsertRoom,
  attachFeedbackFile,
  createPost,
  getCommunityMeta,
  getCommunityProfile,
  getFeedbackSubmission,
  getMentor,
  getPost,
  getRoom,
  joinRoom,
  leaveRoom,
  listComments,
  listFeedbackSubmissions,
  listMentors,
  listMentorshipRequests,
  listMyRooms,
  listNotifications,
  listPosts,
  listRooms,
  markNotificationsRead,
  registerAsMentor,
  reportContent,
  requestMentorship,
  respondMentorship,
  seedDemoCommunityContent,
  submitFeedback,
  togglePostLike,
} from "../services/community.service";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes("pdf") ||
      file.mimetype.includes("text") ||
      [".pdf", ".txt"].includes(path.extname(file.originalname || "").toLowerCase());
    if (ok) cb(null, true);
    else cb(new Error("Upload PDF or TXT only."));
  },
});

router.get("/meta", (_req, res) => res.json(getCommunityMeta()));

router.get("/rooms", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await seedDemoCommunityContent();
    const rooms = await listRooms(req.user.uid);
    return res.json({ rooms, meta: getCommunityMeta() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load rooms." });
  }
});

router.get("/rooms/mine", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const rooms = await listMyRooms(req.user.uid);
    return res.json({ rooms });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/rooms/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const room = await getRoom(String(req.params.id), req.user.uid);
    return res.json({ room });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/rooms/:id/join", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await joinRoom(req.user.uid, String(req.params.id));
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/rooms/:id/leave", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await leaveRoom(req.user.uid, String(req.params.id));
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/posts", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const posts = await listPosts({
      roomId: req.query.roomId ? String(req.query.roomId) : undefined,
      authorId: req.query.mine === "1" ? req.user.uid : req.query.authorId ? String(req.query.authorId) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      userId: req.user.uid,
    });
    return res.json({ posts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/posts", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const { roomId, title, content, postType, attachmentUrl } = req.body || {};
    if (!roomId || !title || !content) {
      return res.status(400).json({ error: "roomId, title, and content are required." });
    }
    const post = await createPost({
      userId: req.user.uid,
      roomId: String(roomId),
      title: String(title),
      content: String(content),
      postType: postType ? String(postType) : "Discussion",
      attachmentUrl: attachmentUrl || null,
    });
    return res.json({ post });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.get("/posts/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const post = await getPost(String(req.params.id), req.user.uid);
    const comments = await listComments(String(req.params.id));
    return res.json({ post, comments });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/posts/:id/comments", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ error: "content is required." });
    const comment = await addComment({ userId: req.user.uid, postId: String(req.params.id), content });
    return res.json({ comment });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/posts/:id/like", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await togglePostLike(req.user.uid, String(req.params.id));
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/report", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const { targetType, targetId, reason, details } = req.body || {};
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: "targetType, targetId, and reason are required." });
    }
    const report = await reportContent({
      userId: req.user.uid,
      targetType,
      targetId: String(targetId),
      reason: String(reason),
      details: details ? String(details) : "",
    });
    return res.json({ report });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/feedback", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const weekOnly = req.query.week !== "all";
    const submissions = await listFeedbackSubmissions({
      weekOnly,
      userId: req.user.uid,
    });
    return res.json({ submissions, meta: getCommunityMeta() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/feedback", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const { title, genre, requestedAreas, previewText, pageCount, roomId } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required." });
    const submission = await submitFeedback({
      userId: req.user.uid,
      roomId: roomId || "weekly-feedback",
      title: String(title),
      genre: String(genre || "Drama"),
      requestedAreas: Array.isArray(requestedAreas) ? requestedAreas.map(String) : [],
      previewText: String(previewText || ""),
      pageCount: pageCount ? Number(pageCount) : 0,
    });
    return res.json({ submission });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post(
  "/feedback/:id/upload",
  verifyFirebaseToken,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      if (!req.file) return res.status(400).json({ error: "file is required." });
      const result = await attachFeedbackFile(String(req.params.id), req.file);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get("/feedback/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const submission = await getFeedbackSubmission(String(req.params.id), req.user.uid);
    return res.json({ submission });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/feedback/:id/comments", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ error: "content is required." });
    const comment = await addFeedbackComment({
      userId: req.user.uid,
      submissionId: String(req.params.id),
      content,
    });
    return res.json({ comment });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.get("/mentors", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const mentors = await listMentors({
      genre: req.query.genre ? String(req.query.genre) : undefined,
      need: req.query.need ? String(req.query.need) : undefined,
    });
    return res.json({ mentors });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/mentors/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const mentor = await getMentor(String(req.params.id));
    return res.json({ mentor });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.post("/mentors/register", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const mentor = await registerAsMentor({ userId: req.user.uid, ...req.body });
    return res.json({ mentor });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/mentorship/request", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const { mentorId, workingOn, helpNeeded, preferredTime } = req.body || {};
    if (!mentorId || !workingOn || !helpNeeded) {
      return res.status(400).json({ error: "mentorId, workingOn, and helpNeeded are required." });
    }
    const request = await requestMentorship({
      menteeId: req.user.uid,
      mentorId: String(mentorId),
      workingOn: String(workingOn),
      helpNeeded: String(helpNeeded),
      preferredTime: preferredTime ? String(preferredTime) : "",
    });
    return res.json({ request });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.get("/mentorship/requests", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const role = req.query.role === "mentor" ? "mentor" : "mentee";
    const requests = await listMentorshipRequests(req.user.uid, role);
    return res.json({ requests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/mentorship/requests/:id/respond", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const action = req.body?.action === "decline" ? "decline" : "accept";
    const result = await respondMentorship({
      userId: req.user.uid,
      requestId: String(req.params.id),
      action,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message });
  }
});

router.get("/notifications", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const notifications = await listNotifications(req.user.uid);
    return res.json({ notifications });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/notifications/read", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    await markNotificationsRead(req.user.uid);
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/profile/me", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getCommunityProfile(req.user.uid);
    return res.json({ profile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/profile/:userId", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const profile = await getCommunityProfile(String(req.params.userId));
    return res.json({ profile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
