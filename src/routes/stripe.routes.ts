import express from "express";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { getPlanById, isFreePlan, subscriptionFieldsForPlan, toStripeUnitAmount } from "../utils/plans";
import { handleCourseCheckoutWebhook } from "./courseEnrollment.routes";

const router = express.Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

router.post("/create-checkout-session", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { planId, email, cancelPath } = req.body;
    const userId = req.user.uid;
    const plan = await getPlanById(planId);

    if (!plan || isFreePlan(plan)) {
      return res.status(400).json({ error: "Invalid paid plan ID" });
    }

    if (!plan.stripePriceId && (!plan.priceAmount || plan.priceAmount <= 0)) {
      return res.status(400).json({ error: "Plan is missing Stripe price or amount" });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const safeCancel =
      typeof cancelPath === "string" && cancelPath.startsWith("/") && !cancelPath.startsWith("//")
        ? cancelPath
        : "/pricing";
    const lineItem = plan.stripePriceId
      ? { price: plan.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: plan.currency || "ngn",
            product_data: {
              name: plan.name,
              description: `Ink2Wealth ${plan.world} plan`,
            },
            unit_amount: toStripeUnitAmount(plan.priceAmount),
          },
          quantity: 1,
        };

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email || req.user.email || undefined,
      line_items: [lineItem],
      mode: "payment",
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}${safeCancel}`,
      client_reference_id: userId,
      metadata: {
        planId: plan.id,
        userId,
        durationDays: String(plan.durationDays || 0),
        world: plan.world,
      },
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/verify-session", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        error: "Payment not completed yet",
        paymentStatus: session.payment_status,
      });
    }

    const userId = session.client_reference_id || session.metadata?.userId;
    const planId = session.metadata?.planId;
    if (!userId || userId !== req.user.uid) {
      return res.status(403).json({ error: "Session does not belong to this user" });
    }
    if (!planId) {
      return res.status(400).json({ error: "Missing planId on checkout session" });
    }

    const plan = await getPlanById(planId);
    if (!plan || isFreePlan(plan)) {
      return res.status(400).json({ error: "Invalid plan on checkout session" });
    }

    const db = getFirestore();
    const subscription = subscriptionFieldsForPlan(plan, "stripe");
    await db.collection("users").doc(userId).set(subscription, { merge: true });
    await db.collection("payments").doc(session.id).set(
      {
        userId,
        email: session.customer_email || session.customer_details?.email || null,
        planId,
        amountTotal: session.amount_total || 0,
        currency: session.currency || plan.currency,
        status: session.payment_status || "paid",
        createdAt: new Date().toISOString(),
        source: "verify-session",
      },
      { merge: true }
    );

    return res.json({
      success: true,
      planId: plan.id,
      planName: plan.name,
      subscriptionExpiry: subscription.subscriptionExpiry,
    });
  } catch (error: any) {
    console.error("Error verifying checkout session:", error);
    return res.status(500).json({ error: error.message || "Failed to verify payment" });
  }
});

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (!sig || !webhookSecret) throw new Error("Missing stripe signature or webhook secret");
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.metadata?.type === "course") {
      try {
        const enrollment = await handleCourseCheckoutWebhook(session);
        if (enrollment) {
          console.log(`Course enrollment ${enrollment.enrollmentId} for user ${enrollment.userId}`);
        }
      } catch (error) {
        console.error("Error fulfilling course enrollment:", error);
      }
      return res.send();
    }

    const userId = session.client_reference_id;
    const planId = session.metadata?.planId;

    if (userId && planId) {
      try {
        const plan = await getPlanById(planId);
        if (!plan) {
          console.error("Stripe webhook: unknown planId", planId);
        } else {
          const db = getFirestore();
          await db.collection("users").doc(userId).set(
            subscriptionFieldsForPlan(plan, "stripe"),
            { merge: true }
          );
          await db.collection("payments").doc(session.id).set({
            userId,
            email: session.customer_email || session.customer_details?.email || null,
            planId,
            amountTotal: session.amount_total || 0,
            currency: session.currency || plan.currency,
            status: session.payment_status || "paid",
            createdAt: new Date().toISOString(),
          });
          console.log(`Provisioned ${plan.id} for user ${userId}`);
        }
      } catch (error) {
        console.error("Error updating user after Stripe payment:", error);
      }
    }
  }

  return res.send();
});

export default router;
