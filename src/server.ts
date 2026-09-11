import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import aiRoutes from "./routes/ai.routes";
import settingsRoutes from "./routes/settings.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import contentRoutes from "./routes/content.routes";
import catalogRoutes from "./routes/catalog.routes";
import stripeRoutes from "./routes/stripe.routes";
import feedbackRoutes from "./routes/feedback.routes";
import landingCoursesRoutes from "./routes/landingCourses.routes";
import coachPageRoutes from "./routes/coachPage.routes";
import worldCoursesRoutes from "./routes/worldCourses.routes";
import writerRoutes from "./routes/writer.routes";
import writingVaultRoutes from "./routes/writingVault.routes";
import bookCoverRoutes from "./routes/bookCover.routes";
import shortFilmRoutes from "./routes/shortFilm.routes";
import marketplaceRoutes from "./routes/marketplace.routes";
import communityRoutes from "./routes/community.routes";
import pitchBuilderRoutes from "./routes/pitchBuilder.routes";
import writeSomethingRoutes from "./routes/writeSomething.routes";
import rateCalculatorRoutes from "./routes/rateCalculator.routes";
import pitchTemplatesRoutes from "./routes/pitchTemplates.routes";
import flashPromptsRoutes from "./routes/flashPrompts.routes";
import oneShotFormatterRoutes from "./routes/oneShotFormatter.routes";
import sprintTimerRoutes from "./routes/sprintTimer.routes";
import microSerialRoutes from "./routes/microSerial.routes";
import selfInterviewRoutes from "./routes/selfInterview.routes";
import portfolioBuilderRoutes, {
  publicPortfolioRouter,
} from "./routes/portfolioBuilder.routes";
import pacingGuideRoutes from "./routes/pacingGuide.routes";
import publishingChecklistRoutes from "./routes/publishingChecklist.routes";
import clientHandoffRoutes from "./routes/clientHandoff.routes";
import web3ExplainerRoutes from "./routes/web3Explainer.routes";
import web3DocsRoutes from "./routes/web3Docs.routes";
import web3ThreadRoutes from "./routes/web3Thread.routes";
import web3CommunityRoutes from "./routes/web3Community.routes";
import nftMintRoutes from "./routes/nftMint.routes";
import tokenGateRoutes from "./routes/tokenGate.routes";
import daoVoteRoutes from "./routes/daoVote.routes";
import walletRoyaltiesRoutes from "./routes/walletRoyalties.routes";
import screenwriterPortfolioRoutes, {
  publicScreenwriterPortfolioRouter,
} from "./routes/screenwriterPortfolio.routes";
import studentRoutes from "./routes/student.routes";
import jambRoutes from "./routes/jamb.routes";
import universityPastRoutes from "./routes/universityPast.routes";
import nursingRoutes from "./routes/nursing.routes";
import mbbsRoutes from "./routes/mbbs.routes";
import professionalRoutes from "./routes/professional.routes";
import analyticsRoutes from "./routes/analytics.routes";
import courseEnrollmentRoutes from "./routes/courseEnrollment.routes";
import academyRoutes from "./routes/academy.routes";
import scriptAnalyzerRoutes from "./routes/scriptAnalyzer.routes";
import wealthRoutes from "./routes/wealth.routes";
import industryRoutes from "./routes/industry.routes";
import wealthToolsRoutes from "./routes/wealthTools.routes";
import { getUploadsDir } from "./utils/paths";
import { getAllowedCorsOrigins } from "./utils/envUrls";
import { verifyAdmin } from "./middleware/admin.middleware";

// Load environment variables
dotenv.config();

const app = express();
// Vercel / reverse proxies terminate TLS; honor X-Forwarded-Proto
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

function resolveStorageBucket(serviceAccount?: { project_id?: string; projectId?: string }) {
  const fromEnv = process.env.FIREBASE_STORAGE_BUCKET || process.env.GCLOUD_STORAGE_BUCKET;
  if (fromEnv) return fromEnv;
  const projectId =
    serviceAccount?.project_id ||
    serviceAccount?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    "";
  return projectId ? `${projectId}.appspot.com` : undefined;
}

function initFirebaseAdmin(): boolean {
  const jsonFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonFromEnv) {
    try {
      const serviceAccount = JSON.parse(jsonFromEnv);
      initializeApp({
        credential: cert(serviceAccount),
        storageBucket: resolveStorageBucket(serviceAccount),
      });
      console.log("✔ Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT.");
      return true;
    } catch (error) {
      console.error("✘ Invalid FIREBASE_SERVICE_ACCOUNT JSON:", error);
      return false;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: resolveStorageBucket({ projectId }),
      });
      console.log("✔ Firebase Admin SDK initialized from FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.");
      return true;
    } catch (error) {
      console.error("✘ Error initializing Firebase Admin from split env vars:", error);
      return false;
    }
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "./firebase-service-account.json";
  const resolvedPath = path.resolve(serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Firebase Service Account Key Not Found              │
├──────────────────────────────────────────────────────────┤
│ Path: ${resolvedPath}
│                                                          │
│ Local: save the key as firebase-service-account.json     │
│ Vercel: set FIREBASE_SERVICE_ACCOUNT env to the JSON.    │
└──────────────────────────────────────────────────────────┘
    `);
    return false;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: resolveStorageBucket(serviceAccount),
    });
    console.log("✔ Firebase Admin SDK initialized successfully.");
    return true;
  } catch (error) {
    console.error("✘ Error initializing Firebase Admin SDK:", error);
    return false;
  }
}

const firebaseAdminInitialized = initFirebaseAdmin();

const allowedOrigins = getAllowedCorsOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin.replace(/\/+$/, ""))) return callback(null, true);
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

// Middleware to parse body content
// Note: Stripe Webhook needs the raw body, so we skip express.json() for that route
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

const uploadsDir = getUploadsDir();
app.use("/uploads", express.static(uploadsDir));

// Clients sometimes call /projects instead of /api/projects
app.use((req, res, next) => {
  const requestPath = req.path;
  if (
    requestPath !== "/" &&
    !requestPath.startsWith("/api") &&
    !requestPath.startsWith("/uploads")
  ) {
    req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
  }
  next();
});

// Routes
app.use("/api/user", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/data", verifyAdmin, adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/writer", writerRoutes);
app.use("/api/writer", writingVaultRoutes);
app.use("/api/writer", bookCoverRoutes);
app.use("/api/writer/write-something", writeSomethingRoutes);
app.use("/api/writer/rate-calculator", rateCalculatorRoutes);
app.use("/api/writer/pitch-templates", pitchTemplatesRoutes);
app.use("/api/writer/flash-prompts", flashPromptsRoutes);
app.use("/api/writer/one-shot-formatter", oneShotFormatterRoutes);
app.use("/api/writer/sprint-timer", sprintTimerRoutes);
app.use("/api/writer/micro-serial", microSerialRoutes);
app.use("/api/writer/self-interview", selfInterviewRoutes);
app.use("/api/writer/portfolio", portfolioBuilderRoutes);
app.use("/api/public/portfolio", publicPortfolioRouter);
app.use("/api/writer/pacing-guide", pacingGuideRoutes);
app.use("/api/writer/publishing-checklist", publishingChecklistRoutes);
app.use("/api/writer/client-handoff", clientHandoffRoutes);
app.use("/api/writer/web3-explainer", web3ExplainerRoutes);
app.use("/api/writer/web3-docs", web3DocsRoutes);
app.use("/api/writer/web3-thread", web3ThreadRoutes);
app.use("/api/writer/web3-community", web3CommunityRoutes);
app.use("/api/writer/nft-mint", nftMintRoutes);
app.use("/api/writer/token-gate", tokenGateRoutes);
app.use("/api/writer/dao-vote", daoVoteRoutes);
app.use("/api/writer/wallet-royalties", walletRoyaltiesRoutes);
app.use("/api/screenwriter/portfolio", screenwriterPortfolioRoutes);
app.use("/api/public/screenwriter-portfolio", publicScreenwriterPortfolioRouter);
app.use("/api/showcase", shortFilmRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/pitch-builder", pitchBuilderRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/student/jamb", jambRoutes);
app.use("/api/student/university-past", universityPastRoutes);
app.use("/api/student/nursing", nursingRoutes);
app.use("/api/student/mbbs", mbbsRoutes);
app.use("/api/student/professional", professionalRoutes);
app.use("/api/student/analytics", analyticsRoutes);
app.use("/api/courses", courseEnrollmentRoutes);
app.use("/api/academy", academyRoutes);
app.use("/api/script", scriptAnalyzerRoutes);
app.use("/api/wealth", wealthRoutes);
app.use("/api/wealth", industryRoutes);
app.use("/api/wealth", wealthToolsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/landing-courses", landingCoursesRoutes);
app.use("/api/coach-page", coachPageRoutes);
app.use("/api/world-courses", worldCoursesRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/feedback", feedbackRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "INK2WEALTH Auth Backend API is running.",
    firebaseInitialized: firebaseAdminInitialized,
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

export { firebaseAdminInitialized };
export default app;
