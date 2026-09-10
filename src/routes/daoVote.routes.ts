import express from "express";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import {
  applyWinningChoice,
  castVote,
  closePoll,
  createDaoPoll,
  getPollForUser,
  listActivePolls,
  listPollsForOwner,
} from "../services/daoVote.service";

const router = express.Router();
router.use(verifyFirebaseToken);

router.get("/meta", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({
      votingIdentity: "account",
      note: "One Ink2Wealth account = one vote. Token-weighted DAO voting is not enabled yet.",
      resultsVisibility: [
        { id: "after-vote", label: "Show results after I vote" },
        { id: "after-close", label: "Blind until poll closes" },
      ],
      minOptions: 2,
      maxOptions: 5,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/polls", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const poll = await createDaoPoll({
      userId: req.user.uid,
      projectId: String(req.body?.projectId || ""),
      chapterId: String(req.body?.chapterId || ""),
      question: String(req.body?.question || ""),
      options: req.body?.options,
      closesAt: String(req.body?.closesAt || ""),
      resultsVisibility: req.body?.resultsVisibility,
    });
    return res.json({ poll });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Create failed." });
  }
});

router.get("/polls/mine", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const polls = await listPollsForOwner(req.user.uid);
    return res.json({ polls });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/polls", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const polls = await listActivePolls(req.user.uid);
    return res.json({ polls });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/polls/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const poll = await getPollForUser(String(req.params.id), req.user.uid);
    return res.json({ poll });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Not found." });
  }
});

router.post("/polls/:id/vote", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const poll = await castVote({
      pollId: String(req.params.id),
      userId: req.user.uid,
      optionId: String(req.body?.optionId || ""),
      walletAddress: req.body?.walletAddress,
    });
    return res.json({ poll });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Vote failed." });
  }
});

router.post("/polls/:id/close", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const poll = await closePoll(req.user.uid, String(req.params.id));
    return res.json({ poll });
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Close failed." });
  }
});

router.post("/polls/:id/apply", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const result = await applyWinningChoice({
      userId: req.user.uid,
      pollId: String(req.params.id),
      note: req.body?.note,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(error?.status || 500).json({ error: error.message || "Apply failed." });
  }
});

export default router;
