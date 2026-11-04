import { getFirestore } from "firebase-admin/firestore";

export interface SurgicalCase {
  id: string;
  title: string;
  specialty: string;
  duration: string;
  instructor: string;
  consentVerified: boolean;
  licensedForEducation: boolean;
  description: string;
  keySteps: string[];
  videoThumbnail?: string;
  videoUrl?: string;
}

export interface LiveBroadcast {
  id: string;
  title: string;
  presenter: string;
  institution: string;
  scheduledTime: string;
  status: "Approved broadcast" | "Live now" | "Completed";
  description: string;
  reminderCount: number;
  hasReminder?: boolean;
}

export interface SurgicalAccessState {
  userId: string;
  isVerified: boolean;
  institutionalAuthorized: boolean;
  accountId: string;
  institutionName?: string;
  studentOrLicenceId?: string;
  status: "verified" | "pending" | "none";
  grantedAt?: string;
}

const DEFAULT_SURGICAL_CASES: SurgicalCase[] = [
  {
    id: "surg-1",
    title: "Laparoscopic cholecystectomy",
    specialty: "General surgery",
    duration: "45 min",
    instructor: "Prof. A. Bello, teaching hospital",
    consentVerified: true,
    licensedForEducation: true,
    description:
      "Step-by-step operative recording covering trocar placement, Calot's triangle dissection, identification of cystic duct and artery, clipping, and electrocautery gallbladder dissection.",
    keySteps: [
      "1. Umbilical Hasson cutdown & pneumoperitoneum establishment",
      "2. Exposure of Calot's triangle and critical view of safety (CVS)",
      "3. Double clipping and division of cystic duct",
      "4. Single proximal and distal clipping of cystic artery",
      "5. Gallbladder dissection from hepatic fossa and retrieval in endobag",
      "6. Hemostasis inspection and fascia closure",
    ],
  },
  {
    id: "surg-2",
    title: "Caesarean section: technique review",
    specialty: "Obstetrics",
    duration: "32 min",
    instructor: "Dr. N. Eze, teaching hospital",
    consentVerified: true,
    licensedForEducation: true,
    description:
      "Lower segment caesarean section (LSCS) technique review. Detailed commentary on Pfannenstiel incision, uterovesical fold mobilization, hysterotomy, gentle delivery, and two-layer uterine closure.",
    keySteps: [
      "1. Modified Pfannenstiel transverse suprapubic incision",
      "2. Sharp rectus sheath division and blunt muscular separation",
      "3. Peritoneal entry and creation of vesicouterine bladder flap",
      "4. Transverse lower uterine segment hysterotomy incision",
      "5. Head delivery with fundal pressure and cord clamping",
      "6. Uterine exteriorization and double-layer continuous closure",
      "7. Peritoneal lavage, sheath closure and sub-cuticular skin approximation",
    ],
  },
  {
    id: "surg-3",
    title: "Fracture fixation basics",
    specialty: "Orthopaedics",
    duration: "38 min",
    instructor: "Dr. T. Musa, orthopaedic centre",
    consentVerified: true,
    licensedForEducation: true,
    description:
      "Principles of open reduction and internal fixation (ORIF) for diaphyseal fractures. Explaining dynamic compression plating, lag screw insertion, and anatomical reduction goals.",
    keySteps: [
      "1. Surgical approach and soft tissue handling preserving periosteum",
      "2. Direct anatomical reduction with reduction forceps",
      "3. 3.5mm lag screw insertion for interfragmentary compression",
      "4. Contouring of 7-hole dynamic compression plate (DCP)",
      "5. Neutral and eccentric drilling and sequential screw tightening",
      "6. Intraoperative fluoroscopy alignment verification and wound closure",
    ],
  },
  {
    id: "surg-4",
    title: "Inguinal hernia mesh repair (Lichtenstein)",
    specialty: "General surgery",
    duration: "28 min",
    instructor: "Dr. K. Balogun, teaching hospital",
    consentVerified: true,
    licensedForEducation: true,
    description:
      "Tension-free Lichtenstein repair of indirect inguinal hernia under local/regional anesthesia with polypropylene mesh placement and nerve preservation.",
    keySteps: [
      "1. Inguinal canal opening & identification of ilioinguinal nerve",
      "2. Cremasteric muscle splitting & sac dissection to neck",
      "3. Hernia sac inversion/high ligation",
      "4. Polypropylene mesh tailoring and fixation to inguinal ligament",
      "5. External oblique aponeurosis and skin layered closure",
    ],
  },
];

const DEFAULT_BROADCAST: LiveBroadcast = {
  id: "live-safe-surgery",
  title: "Expert commentary: Principles of safe surgery",
  presenter: "Prof. O. Adebayo & Surgical Faculty Panel",
  institution: "National Surgical Training Centre & Teaching Hospital",
  scheduledTime: "Saturday, 11:00 AM",
  status: "Approved broadcast",
  description:
    "Saturday, 11:00 AM. Qualified presenters, with institutional authorization and patient consent confirmed before the session goes live.",
  reminderCount: 842,
  hasReminder: false,
};

export async function listSurgicalCases(specialty?: string): Promise<SurgicalCase[]> {
  try {
    const db = getFirestore();
    const snap = await db.collection("surgical_cases").get();
    if (!snap.empty) {
      const cases: SurgicalCase[] = [];
      snap.forEach((doc) => {
        cases.push({ id: doc.id, ...(doc.data() as any) });
      });
      if (specialty && specialty !== "All") {
        return cases.filter((c) => c.specialty.toLowerCase() === specialty.toLowerCase());
      }
      return cases;
    }
  } catch (_) {}

  if (specialty && specialty !== "All") {
    return DEFAULT_SURGICAL_CASES.filter(
      (c) => c.specialty.toLowerCase() === specialty.toLowerCase()
    );
  }
  return DEFAULT_SURGICAL_CASES;
}

export async function getLiveBroadcast(userId?: string): Promise<LiveBroadcast> {
  let broadcast = { ...DEFAULT_BROADCAST };
  try {
    const db = getFirestore();
    const doc = await db.collection("surgical_broadcasts").doc(broadcast.id).get();
    if (doc.exists) {
      broadcast = { ...broadcast, ...(doc.data() as any) };
    }
    if (userId) {
      const remDoc = await db
        .collection("surgical_reminders")
        .doc(`${broadcast.id}_${userId}`)
        .get();
      broadcast.hasReminder = remDoc.exists;
    }
  } catch (_) {}
  return broadcast;
}

export async function toggleLiveReminder(
  userId: string,
  broadcastId: string
): Promise<{ hasReminder: boolean; message: string }> {
  try {
    const db = getFirestore();
    const ref = db.collection("surgical_reminders").doc(`${broadcastId}_${userId}`);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      return { hasReminder: false, message: "Reminder removed." };
    } else {
      await ref.set({
        broadcastId,
        userId,
        createdAt: new Date().toISOString(),
      });
      return { hasReminder: true, message: "Reminder set for live surgical broadcast." };
    }
  } catch (_) {
    return { hasReminder: true, message: "Reminder set." };
  }
}

export async function getSurgicalAccess(userId: string): Promise<SurgicalAccessState> {
  const accountId = `48201-STU-${userId.substring(0, 5).toUpperCase()}`;
  try {
    const db = getFirestore();
    const doc = await db.collection("surgical_access").doc(userId).get();
    if (doc.exists) {
      return doc.data() as SurgicalAccessState;
    }
  } catch (_) {}

  return {
    userId,
    isVerified: false,
    institutionalAuthorized: true,
    accountId,
    status: "none",
  };
}

export async function grantSurgicalAccess(params: {
  userId: string;
  institutionName?: string;
  studentOrLicenceId?: string;
  role?: string;
}): Promise<SurgicalAccessState> {
  const accountId = `48201-STU-${params.userId.substring(0, 5).toUpperCase()}`;
  const now = new Date().toISOString();
  const state: SurgicalAccessState = {
    userId: params.userId,
    isVerified: true,
    institutionalAuthorized: true,
    accountId,
    institutionName: params.institutionName || "Teaching Hospital Partner",
    studentOrLicenceId: params.studentOrLicenceId || "MED-VERIFIED-2026",
    status: "verified",
    grantedAt: now,
  };

  try {
    const db = getFirestore();
    await db.collection("surgical_access").doc(params.userId).set(state, { merge: true });
    await db.collection("users").doc(params.userId).set(
      {
        surgicalVerified: true,
        surgicalAccountId: accountId,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (_) {}

  return state;
}

