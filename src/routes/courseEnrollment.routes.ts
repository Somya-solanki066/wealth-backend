import express from "express";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { verifyFirebaseToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { COURSE_PRODUCTS, getCourseProduct, isValidCourseProductId } from "../data/courseProducts";
import { fulfillCourseEnrollment } from "../services/courseEnrollment.service";

const router = express.Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

/** GET /api/courses/catalog — public course products for enroll UI */
router.get("/catalog", async (_req, res) => {
  try {
    const courses = Object.values(COURSE_PRODUCTS).map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      priceNGN: c.priceNGN,
      validityDays: c.validityDays,
      description: c.description,
      enrollmentPrefixExample: `${c.enrollmentPrefix}-0001`,
    }));
    return res.json({ courses });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load courses." });
  }
});

/** POST /api/courses/checkout */
router.post("/checkout", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const courseId = String(req.body?.courseId || "").trim();
    if (!isValidCourseProductId(courseId)) {
      return res.status(400).json({ error: "Invalid course ID." });
    }

    const product = getCourseProduct(courseId)!;
    const userId = req.user.uid;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const cancelPath =
      typeof req.body?.cancelPath === "string" &&
      req.body.cancelPath.startsWith("/") &&
      !req.body.cancelPath.startsWith("//")
        ? req.body.cancelPath
        : "/courses";

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: req.user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "ngn",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.priceNGN * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=course`,
      cancel_url: `${frontendUrl}${cancelPath}`,
      client_reference_id: userId,
      metadata: {
        type: "course",
        courseId: product.id,
        userId,
      },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error("Course checkout error:", error);
    return res.status(500).json({ error: error.message || "Failed to create checkout." });
  }
});

/** POST /api/courses/verify-session */
router.post("/verify-session", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        error: "Payment not completed yet",
        paymentStatus: session.payment_status,
      });
    }

    const userId = session.client_reference_id || session.metadata?.userId;
    const courseId = session.metadata?.courseId;
    if (!userId || userId !== req.user.uid) {
      return res.status(403).json({ error: "Session does not belong to this user" });
    }
    if (!courseId || session.metadata?.type !== "course") {
      return res.status(400).json({ error: "Not a course checkout session" });
    }

    const enrollment = await fulfillCourseEnrollment({
      userId,
      email: session.customer_email || session.customer_details?.email || req.user.email || null,
      courseId,
      stripeSessionId: session.id,
      amountTotal: session.amount_total || 0,
      currency: session.currency || "ngn",
      source: "verify-session",
    });

    return res.json({
      success: true,
      type: "course",
      enrollmentId: enrollment.enrollmentId,
      courseId: enrollment.courseId,
      courseName: enrollment.courseName,
      validFrom: enrollment.validFrom,
      validUntil: enrollment.validUntil,
      accessType: enrollment.accessType,
    });
  } catch (error: any) {
    console.error("Course verify error:", error);
    return res.status(500).json({ error: error.message || "Failed to verify course payment." });
  }
});

/** GET /api/courses/my-enrollments */
router.get("/my-enrollments", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const db = getFirestore();
    const snap = await db
      .collection("courseEnrollments")
      .where("userId", "==", req.user.uid)
      .get();

    const enrollments = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return res.json({ enrollments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load enrollments." });
  }
});

export async function handleCourseCheckoutWebhook(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const courseId = session.metadata?.courseId;
  if (!userId || !courseId || session.metadata?.type !== "course") return null;

  return fulfillCourseEnrollment({
    userId,
    email: session.customer_email || session.customer_details?.email || null,
    courseId,
    stripeSessionId: session.id,
    amountTotal: session.amount_total || 0,
    currency: session.currency || "ngn",
    source: "webhook",
  });
}

export default router;
