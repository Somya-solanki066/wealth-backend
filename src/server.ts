import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { initializeApp, cert } from "firebase-admin";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import aiRoutes from "./routes/ai.routes";
import settingsRoutes from "./routes/settings.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import contentRoutes from "./routes/content.routes";
import stripeRoutes from "./routes/stripe.routes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "./firebase-service-account.json";
const resolvedPath = path.resolve(serviceAccountPath);

let firebaseAdminInitialized = false;

if (fs.existsSync(resolvedPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log("✔ Firebase Admin SDK initialized successfully.");
    firebaseAdminInitialized = true;
  } catch (error) {
    console.error("✘ Error initializing Firebase Admin SDK:", error);
  }
} else {
  console.warn(`
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Firebase Service Account Key Not Found              │
├──────────────────────────────────────────────────────────┤
│ Path: ${resolvedPath}
│                                                          │
│ Please:                                                  │
│ 1. Go to Firebase Console > Project Settings.            │
│ 2. Select Service Accounts > Generate New Private Key.   │
│ 3. Save it to 'backend/firebase-service-account.json'.  │
│                                                          │
│ Note: Auth endpoints will fail until this key is added.  │
└──────────────────────────────────────────────────────────┘
  `);
}

// Enable CORS
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads statically
app.use("/uploads", express.static(uploadsDir));

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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

export { firebaseAdminInitialized };
export default app;
