import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import {
  frontendUrl,
  sendTransactional,
} from "../services/email.service";
import { getPlanById } from "../utils/plans";

const router = Router();

function assertCronSecret(req: Request, res: Response): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return false;
  }
  const header = String(req.headers["x-cron-secret"] || req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== secret) {
    res.status(401).json({ error: "Unauthorized cron request" });
    return false;
  }
  return true;
}

function daysFromNow(n: number): { start: Date; end: Date } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + n);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Users whose subscriptionExpiry falls ~3 days from now */
async function runSubscriptionReminders(_req: Request, res: Response) {
  if (!assertCronSecret(_req, res)) return;
  try {
    const db = getFirestore();
    const { start, end } = daysFromNow(3);
    const snap = await db
      .collection("users")
      .where("subscriptionExpiry", ">=", start.toISOString())
      .where("subscriptionExpiry", "<", end.toISOString())
      .get();

    let sent = 0;
    let skipped = 0;
    const renewUrl = `${frontendUrl()}/pricing`;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const email = String(data.email || "").trim();
      if (!email) {
        skipped += 1;
        continue;
      }
      const planId = String(data.subscriptionPlan || "");
      const plan = planId ? await getPlanById(planId) : null;
      const planName = plan?.name || planId || "your plan";
      const expiryDate = data.subscriptionExpiry
        ? new Date(data.subscriptionExpiry).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "soon";
      const dayKey = start.toISOString().slice(0, 10);
      const result = await sendTransactional({
        templateId: "subscription_renewal_reminder",
        to: email,
        vars: {
          name: data.displayName || "Writer",
          planName,
          expiryDate,
          renewUrl,
        },
        dedupeKey: `renewal:${doc.id}:${dayKey}`,
      });
      if (result.ok && !result.skipped) sent += 1;
      else skipped += 1;
    }

    return res.json({
      success: true,
      matched: snap.size,
      sent,
      skipped,
      window: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (error: any) {
    console.error("subscription-reminders cron error:", error);
    return res.status(500).json({ error: error.message || "Cron failed" });
  }
}

router.post("/subscription-reminders", runSubscriptionReminders);
router.get("/subscription-reminders", runSubscriptionReminders);

const INACTIVITY_DAYS = 14;

/** Users with lastWriteDate older than 14 days */
async function runInactivityEmails(_req: Request, res: Response) {
  if (!assertCronSecret(_req, res)) return;
  try {
    const db = getFirestore();
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - INACTIVITY_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const snap = await db
      .collection("users")
      .where("lastWriteDate", "<=", cutoffIso)
      .limit(500)
      .get();

    let sent = 0;
    let skipped = 0;
    const dash = `${frontendUrl()}/dashboard`;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const email = String(data.email || "").trim();
      if (!email) {
        skipped += 1;
        continue;
      }
      if (data.inactivityEmailOptOut === true) {
        skipped += 1;
        continue;
      }

      const last = String(data.lastWriteDate || "").slice(0, 10);
      const daysInactive = last
        ? Math.max(
            INACTIVITY_DAYS,
            Math.round((Date.now() - new Date(last).getTime()) / (1000 * 3600 * 24))
          )
        : INACTIVITY_DAYS;

      const result = await sendTransactional({
        templateId: "inactivity_come_back",
        to: email,
        vars: {
          name: data.displayName || "Writer",
          dashboardUrl: dash,
          daysInactive: String(daysInactive),
        },
        dedupeKey: `inactivity:${doc.id}:${last || "none"}`,
      });
      if (result.ok && !result.skipped) sent += 1;
      else skipped += 1;
    }

    return res.json({
      success: true,
      matched: snap.size,
      sent,
      skipped,
      cutoff: cutoffIso,
    });
  } catch (error: any) {
    console.error("inactivity-emails cron error:", error);
    return res.status(500).json({ error: error.message || "Cron failed" });
  }
}

router.post("/inactivity-emails", runInactivityEmails);
router.get("/inactivity-emails", runInactivityEmails);

export default router;
