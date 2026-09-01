import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  DEFAULT_SETTINGS,
  normalizePlan,
  type BillingPlan,
  type PlanWorld,
} from "../utils/plans";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function initFirebase(): boolean {
  if (getApps().length > 0) return true;

  const jsonFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (jsonFromEnv) {
    initializeApp({ credential: cert(JSON.parse(jsonFromEnv)) });
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    return true;
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "./firebase-service-account.json";
  const resolvedPath = path.resolve(serviceAccountPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Firebase service account not found at ${resolvedPath}`);
    return false;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  return true;
}

function defaultsForWorld(world: PlanWorld): BillingPlan[] {
  return DEFAULT_SETTINGS.plans.filter((p) => p.world === world);
}

async function seedPlans() {
  if (!initFirebase()) {
    process.exit(1);
  }

  const db = getFirestore();
  const docRef = db.collection("settings").doc("global");
  const existing = await docRef.get();
  const previous = existing.exists ? existing.data() || {} : {};

  const previousLimits = {
    aiAnalyzerFreeLimit:
      Number(previous.aiAnalyzerFreeLimit) || DEFAULT_SETTINGS.aiAnalyzerFreeLimit,
    smartEditFreeLimit:
      Number(previous.smartEditFreeLimit) || DEFAULT_SETTINGS.smartEditFreeLimit,
  };

  const existingPlans: BillingPlan[] = Array.isArray(previous.plans)
    ? previous.plans.map((p: any, i: number) => normalizePlan(p, i))
    : [];

  const existingWriter = existingPlans.filter((p) => p.world === "writer");
  const writerPlans = existingWriter.length > 0 ? existingWriter : defaultsForWorld("writer");

  // Always (re)seed Script + Student from image defaults
  const screenwriterPlans = defaultsForWorld("screenwriter");
  const studentPlans = defaultsForWorld("student");

  const plans = [...writerPlans, ...screenwriterPlans, ...studentPlans];

  const payload = {
    ...previousLimits,
    plans,
    updatedAt: new Date().toISOString(),
    seededBy: "seedPlans",
  };

  await docRef.set(payload, { merge: false });

  console.log("✔ Seeded settings/global plans by world:");
  (["writer", "screenwriter", "student"] as PlanWorld[]).forEach((world) => {
    const worldPlans = plans.filter((p) => p.world === world);
    console.log(`\n  [${world}] ${worldPlans.length} plans`);
    worldPlans.forEach((plan) => {
      console.log(
        `    - ${plan.id}: ${plan.name} (${plan.price} / ${plan.period}) badge="${plan.badge}"`
      );
    });
  });
}

seedPlans()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("✘ Failed to seed plans:", error);
    process.exit(1);
  });
