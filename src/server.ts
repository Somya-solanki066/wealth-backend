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
import stripeRoutes from "./routes/stripe.routes";
import { getUploadsDir } from "./utils/paths";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

function initFirebaseAdmin(): boolean {
  const jsonFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonFromEnv) {
    try {
      const serviceAccount = JSON.parse(jsonFromEnv);
      initializeApp({ credential: cert(serviceAccount) });
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
    initializeApp({ credential: cert(serviceAccount) });
    console.log("✔ Firebase Admin SDK initialized successfully.");
    return true;
  } catch (error) {
    console.error("✘ Error initializing Firebase Admin SDK:", error);
    return false;
  }
}

const firebaseAdminInitialized = initFirebaseAdmin();

const extraOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  ...extraOrigins,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
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
app.use("/api/data", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/stripe", stripeRoutes);

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
