import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEED_MEMBER_STORIES } from "../routes/memberStories.routes";

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

  try {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    const parsed = JSON.parse(raw);
    initializeApp({ credential: cert(parsed) });
    return true;
  } catch (err) {
    console.error("Failed to parse firebase service account:", err);
    return false;
  }
}

async function run() {
  const ok = initFirebase();
  if (!ok) {
    console.error("Cannot seed member stories without Firebase credentials.");
    process.exit(1);
  }

  const db = getFirestore();
  const batch = db.batch();
  const now = new Date().toISOString();

  console.log(`Seeding ${SEED_MEMBER_STORIES.length} member stories...`);

  for (let i = 0; i < SEED_MEMBER_STORIES.length; i++) {
    const data = SEED_MEMBER_STORIES[i];
    const id = `story-${i + 1}`;
    const docRef = db.collection("member_stories").doc(id);
    batch.set(docRef, {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Prepared story: ${id} - "${data.title}" (${data.world})`);
  }

  await batch.commit();
  console.log("Successfully seeded member_stories in Firestore!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed member stories failed:", err);
  process.exit(1);
});
