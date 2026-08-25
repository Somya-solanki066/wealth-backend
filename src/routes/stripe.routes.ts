import express from 'express';
import Stripe from 'stripe';
import { getFirestore } from "firebase-admin/firestore";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
   apiVersion: "2026-07-29.dahlia",
});

// Configure prices - In production, you would fetch these from DB or use Stripe Price IDs
const PLANS: Record<string, {name: string, amount: number, currency: string, durationDays: number}> = {
  'plan_premium': {
    name: 'Premium Plan (6 Months)',
    amount: 24900 * 100, // Amount in Kobo for NGN or Cents for USD
    currency: 'ngn',
    durationDays: 180,
  },
  'plan_1787656260037': {
    name: 'Yearly Plan',
    amount: 49000 * 100,
    currency: 'ngn',
    durationDays: 365,
  }
};

router.post('/create-checkout-session', async (req, res) => {
  try {
    console.log("Received request to /create-checkout-session:", req.body);
    const { planId, userId, email } = req.body;

    if (!userId || !planId || !PLANS[planId]) {
      console.error("Validation failed. userId:", userId, "planId:", planId, "validPlan:", !!PLANS[planId]);
      return res.status(400).json({ error: 'Invalid user ID or plan ID' });
    }

    const plan = PLANS[planId];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email, // Pre-fill email if available
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.name,
              description: 'Ink2Wealth Subscription',
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/pricing`,
      client_reference_id: userId,
      metadata: {
        planId: planId,
        userId: userId,
        durationDays: plan.durationDays,
      }
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint to handle successful payments
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!sig || !webhookSecret) throw new Error('Missing stripe signature or webhook secret');
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Fulfill the purchase...
    const userId = session.client_reference_id;
    const metadata = session.metadata;

    if (userId && metadata && metadata.planId) {
      try {
        const now = new Date();
        const durationDays = parseInt(metadata.durationDays || '30', 10);
        const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        
        const db = getFirestore();
        await db.collection('users').doc(userId).update({
          subscriptionPlan: metadata.planId,
          subscriptionDate: now.toISOString(),
          subscriptionExpiry: expiryDate.toISOString(),
        });
        console.log(`Successfully provisioned ${metadata.planId} for user ${userId}`);
      } catch (error) {
        console.error('Error updating user in Firestore after payment:', error);
      }
    }
  }

  res.send();
});

export default router;
