import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { AuthenticatedRequest, verifyFirebaseToken } from "../middleware/auth.middleware";
import { getPrimaryFrontendUrl } from "../utils/envUrls";
import { getUploadsDir } from "../utils/paths";
import { isUserPremium } from "../utils/plans";
import {
  attachScriptFile,
  createOrUpdateListing,
  fulfillMarketplacePurchase,
  getFullScript,
  getListing,
  getMarketplaceCommissionRate,
  getMarketplaceMeta,
  getPreview,
  getWriterEarnings,
  listBuyerPurchases,
  listOptionsForUser,
  listPublishedListings,
  listWriterListings,
  requestOption,
  respondOption,
  seedDemoListings,
  submitListing,
} from "../services/marketplace.service";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes("pdf") ||
      file.mimetype.includes("text") ||
      [".pdf", ".txt", ".fountain"].includes(path.extname(file.originalname || "").toLowerCase());
    if (ok) cb(null, true);
    else cb(new Error("Upload PDF or TXT script only."));
  },
});

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

async function displayName(uid: string) {
  const snap = await getFirestore().collection("users").doc(uid).get();
  const d = snap.data() || {};
  return d.displayName || d.name || d.email || "User";
}

router.get("/meta", (_req, res) => {
  return res.json(getMarketplaceMeta());
});

router.get("/listings", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    let listings = await listPublishedListings({
      search: req.query.search ? String(req.query.search) : undefined,
      scriptType: req.query.scriptType ? String(req.query.scriptType) : undefined,
      genre: req.query.genre ? String(req.query.genre) : undefined,
      dealType: req.query.dealType ? String(req.query.dealType) : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    });
    if (
      !listings.length &&
      !req.query.search &&
      !req.query.scriptType &&
      !req.query.genre &&
      !req.query.dealType
    ) {
      const seeded = await seedDemoListings();
      listings = seeded.listings;
    }
    const commissionRate = await getMarketplaceCommissionRate();
    return res.json({ listings, commissionRate });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load listings." });
  }
});

router.post("/seed-demo", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json(await seedDemoListings());
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Seed failed." });
  }
});

router.get("/listings/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const listing = await getListing(String(req.params.id), req.user.uid);
    return res.json({ listing });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to load listing." });
  }
});

router.get("/listings/:id/preview", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const preview = await getPreview(String(req.params.id));
    return res.json(preview);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to load preview." });
  }
});

router.get("/listings/:id/full", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const full = await getFullScript(req.user.uid, String(req.params.id));
    return res.json(full);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Access denied." });
  }
});

router.post("/listings", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const userSnap = await getFirestore().collection("users").doc(req.user.uid).get();
    if (!isUserPremium(userSnap.data())) {
      return res.status(403).json({
        error: "Listing scripts on the Marketplace requires a premium plan.",
        premiumRequired: true,
      });
    }
    const name = await displayName(req.user.uid);
    const listing = await createOrUpdateListing(req.user.uid, name, req.body || {});
    return res.status(201).json({ listing });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to create listing." });
  }
});

router.put("/listings/:id", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const listing = await createOrUpdateListing(req.user.uid, "", req.body || {}, String(req.params.id));
    return res.json({ listing });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to update listing." });
  }
});

router.post(
  "/listings/:id/upload",
  verifyFirebaseToken,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized." });
      if (!req.file?.buffer) return res.status(400).json({ error: "Script file is required." });
      const safeName = `${Date.now()}${path.extname(req.file.originalname || ".pdf")}`;
      const listing = await attachScriptFile({
        writerId: req.user.uid,
        listingId: String(req.params.id),
        filename: safeName,
        buffer: req.file.buffer,
        mime: req.file.mimetype || "",
      });
      return res.json({ listing });
    } catch (error: any) {
      const status = error?.status || 500;
      return res.status(status).json({ error: error.message || "Upload failed." });
    }
  }
);

router.post("/listings/:id/submit", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const listing = await submitListing(req.user.uid, String(req.params.id));
    return res.json({ listing, message: "Submitted for admin review." });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Submit failed." });
  }
});

router.get("/mine/listings", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({ listings: await listWriterListings(req.user.uid) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load listings." });
  }
});

router.get("/mine/purchases", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json({ purchases: await listBuyerPurchases(req.user.uid) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load purchases." });
  }
});

router.get("/mine/earnings", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    return res.json(await getWriterEarnings(req.user.uid));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load earnings." });
  }
});

router.get("/mine/options", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const role = req.query.role === "writer" ? "writer" : "buyer";
    return res.json({ options: await listOptionsForUser(req.user.uid, role) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load options." });
  }
});

router.post("/listings/:id/option-request", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const option = await requestOption({
      buyerId: req.user.uid,
      buyerName: await displayName(req.user.uid),
      buyerEmail: req.user.email,
      listingId: String(req.params.id),
      message: req.body?.message,
    });
    return res.status(201).json({ option });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to request option." });
  }
});

router.post("/options/:id/respond", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const action = req.body?.action === "reject" ? "reject" : "accept";
    const option = await respondOption(req.user.uid, String(req.params.id), action);
    return res.json({ option });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Failed to respond." });
  }
});

router.post("/checkout", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const listingId = String(req.body?.listingId || "").trim();
    const dealType = req.body?.dealType === "option" ? "option" : "purchase";
    const optionRequestId = req.body?.optionRequestId ? String(req.body.optionRequestId) : null;

    const listing = await getListing(listingId, req.user.uid);
    if ((listing as any).isOwner) {
      return res.status(400).json({ error: "You cannot buy your own script." });
    }
    if ((listing as any).hasPurchased) {
      return res.status(400).json({ error: "You already own access to this script." });
    }

    const amountNGN =
      dealType === "option" ? Number(listing.optionPriceNGN || 0) : Number(listing.priceNGN || 0);
    if (amountNGN <= 0) {
      return res.status(400).json({ error: "Invalid price for this deal type." });
    }

    if (dealType === "option") {
      if (!optionRequestId) {
        return res.status(400).json({ error: "Accepted option request required before payment." });
      }
      const opt = await getFirestore().collection("marketplaceOptionRequests").doc(optionRequestId).get();
      if (!opt.exists || opt.data()?.buyerId !== req.user.uid || opt.data()?.status !== "accepted") {
        return res.status(400).json({ error: "Option must be accepted by the writer before checkout." });
      }
    }

    const frontendUrl = getPrimaryFrontendUrl(
      typeof req.headers.origin === "string" ? req.headers.origin : null
    );
    const commissionRate = await getMarketplaceCommissionRate();

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: req.user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "ngn",
            product_data: {
              name: `${listing.title} (${dealType})`,
              description: `Script Marketplace ${dealType} · platform fee ${Math.round(commissionRate * 100)}%`,
            },
            unit_amount: amountNGN * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&type=marketplace`,
      cancel_url: `${frontendUrl}/dashboard?tab=script-marketplace`,
      client_reference_id: req.user.uid,
      metadata: {
        type: "marketplace",
        listingId,
        dealType,
        buyerId: req.user.uid,
        writerId: listing.writerId,
        optionRequestId: optionRequestId || "",
        commissionRate: String(commissionRate),
      },
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error("Marketplace checkout error:", error);
    return res.status(500).json({ error: error.message || "Checkout failed." });
  }
});

router.post("/verify-session", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ success: false, error: "Payment not completed yet" });
    }
    if (session.metadata?.type !== "marketplace") {
      return res.status(400).json({ error: "Not a marketplace session" });
    }
    const buyerId = session.client_reference_id || session.metadata?.buyerId;
    if (!buyerId || buyerId !== req.user.uid) {
      return res.status(403).json({ error: "Session does not belong to this user" });
    }

    const result = await fulfillMarketplacePurchase({
      buyerId,
      listingId: String(session.metadata.listingId),
      dealType: session.metadata.dealType === "option" ? "option" : "purchase",
      stripeSessionId: session.id,
      amountTotalKobo: Number(session.amount_total || 0),
      optionRequestId: session.metadata.optionRequestId || null,
    });

    return res.json({
      success: true,
      type: "marketplace",
      ...result,
    });
  } catch (error: any) {
    console.error("Marketplace verify error:", error);
    return res.status(500).json({ error: error.message || "Verification failed." });
  }
});

/** Authenticated download of original PDF for owners/buyers only */
router.get("/listings/:id/download", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized." });
    const full = await getFullScript(req.user.uid, String(req.params.id));
    if (!full.originalFilePath) {
      // fallback: send text file
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${full.title || "script"}.txt"`);
      return res.send(full.fullText || "");
    }
    const abs = path.join(getUploadsDir(), full.originalFilePath.replace(/^\/uploads\//, ""));
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: "File missing." });
    }
    return res.download(abs);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error.message || "Download failed." });
  }
});

export async function handleMarketplaceCheckoutWebhook(session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== "marketplace") return null;
  const buyerId = session.client_reference_id || session.metadata?.buyerId;
  const listingId = session.metadata?.listingId;
  if (!buyerId || !listingId) return null;
  return fulfillMarketplacePurchase({
    buyerId,
    listingId,
    dealType: session.metadata.dealType === "option" ? "option" : "purchase",
    stripeSessionId: session.id,
    amountTotalKobo: Number(session.amount_total || 0),
    optionRequestId: session.metadata.optionRequestId || null,
  });
}

export default router;
