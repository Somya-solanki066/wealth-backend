import { Router, Response } from "express";
import { verifyAdmin } from "../middleware/admin.middleware";
import {
  sendCoachingSessionReminder,
  sendPaymentFailedEmail,
} from "../services/email.service";

const router = Router();

/** Future Coaching Hub: send session reminder with branded template */
router.post("/send-coaching-reminder", verifyAdmin, async (req, res: Response) => {
  try {
    const { to, name, sessionDate, sessionTime, coachName, joinUrl, notes, dedupeKey } =
      req.body || {};
    if (!to || !sessionDate || !sessionTime) {
      return res.status(400).json({ error: "to, sessionDate, and sessionTime are required" });
    }
    const result = await sendCoachingSessionReminder({
      to: String(to),
      name: String(name || "Writer"),
      sessionDate: String(sessionDate),
      sessionTime: String(sessionTime),
      coachName: coachName ? String(coachName) : undefined,
      joinUrl: joinUrl ? String(joinUrl) : undefined,
      notes: notes ? String(notes) : undefined,
      dedupeKey: dedupeKey ? String(dedupeKey) : undefined,
    });
    return res.json({ success: result.ok, result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to send coaching reminder" });
  }
});

/** Ready for Stripe subscription failures / admin tests */
router.post("/send-payment-failed", verifyAdmin, async (req, res: Response) => {
  try {
    const { to, name, planName, amount, updatePaymentUrl } = req.body || {};
    if (!to || !planName) {
      return res.status(400).json({ error: "to and planName are required" });
    }
    const result = await sendPaymentFailedEmail({
      to: String(to),
      name: String(name || "Writer"),
      planName: String(planName),
      amount: String(amount || ""),
      updatePaymentUrl: updatePaymentUrl ? String(updatePaymentUrl) : undefined,
    });
    return res.json({ success: result.ok, result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to send payment-failed email" });
  }
});

export default router;
