import express from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyAdmin } from "../middleware/admin.middleware";

const router = express.Router();

// Optional user auth extractor
const optionalAuth = async (req: any, _res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split("Bearer ")[1];
      const decoded = await getAuth().verifyIdToken(token);
      req.user = decoded;
    } catch (_) {}
  }
  next();
};

export interface ContractApplication {
  id?: string;
  userId: string;
  userEmail: string;
  programType: "writer" | "screenwriter";
  contractType: "exclusive" | "non-exclusive";
  statusType: "Ongoing" | "Completed";
  title: string;
  genre: string;
  penName: string;
  wordCount?: string;
  pageCount?: string;
  scriptFormat?: string; // Short film, Feature film, Sequel, Series half-hour, Series one-hour
  manuscriptUrl?: string;
  manuscriptFilename?: string;
  coverUrl?: string;
  synopsis: string;
  outlineText?: string;
  characterProfilesText?: string;
  treatmentUrl?: string;
  castCharacters?: string;
  referralCode?: string;
  aeUserId?: string;
  status: "waiting_list" | "under_review" | "contract_sent" | "signed" | "rejected" | "completed";
  editorReasons?: string[];
  editorNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// POST /api/contracts/apply - Submit contract application
router.post("/apply", optionalAuth, async (req: any, res) => {
  try {
    const {
      programType = "writer",
      contractType = "exclusive",
      statusType = "Ongoing",
      title,
      genre,
      penName,
      wordCount,
      pageCount,
      scriptFormat,
      manuscriptUrl,
      manuscriptFilename,
      coverUrl,
      synopsis,
      outlineText,
      characterProfilesText,
      treatmentUrl,
      castCharacters,
      referralCode,
      rightsConfirmed,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!synopsis || !synopsis.trim()) {
      return res.status(400).json({ error: "Synopsis is required" });
    }
    if (!penName || !penName.trim()) {
      return res.status(400).json({ error: "Pen name is required" });
    }
    if (!rightsConfirmed) {
      return res.status(400).json({ error: "You must confirm that you own the rights to this work" });
    }

    // Validation rules from brief:
    // Writers: minimum 5,000 words
    if (programType === "writer") {
      const words = parseInt(String(wordCount || "0").replace(/[^0-9]/g, ""), 10);
      if (words < 5000) {
        return res.status(400).json({
          error: "Your book needs at least 5,000 words to apply for a contract.",
        });
      }
    }

    // Screenwriters: minimum 10 pages
    if (programType === "screenwriter") {
      const pages = parseInt(String(pageCount || "0").replace(/[^0-9]/g, ""), 10);
      if (pages < 10) {
        return res.status(400).json({
          error: "Your script needs at least 10 pages to apply for a contract.",
        });
      }
    }

    // Find AE user if referral code provided
    let aeUserId = "";
    if (referralCode && referralCode.trim()) {
      const codeClean = referralCode.trim().toUpperCase();
      const aeSnap = await getFirestore()
        .collection("ae_profiles")
        .where("code", "==", codeClean)
        .limit(1)
        .get();
      if (!aeSnap.empty) {
        aeUserId = aeSnap.docs[0].id;
      }
    }

    const appData: ContractApplication = {
      userId: req.user?.uid || req.body.userId || "anon-writer",
      userEmail: req.user?.email || req.body.userEmail || "",
      programType: programType === "screenwriter" ? "screenwriter" : "writer",
      contractType: contractType === "non-exclusive" ? "non-exclusive" : "exclusive",
      statusType: statusType === "Completed" ? "Completed" : "Ongoing",
      title: title.trim(),
      genre: genre || "General",
      penName: penName.trim(),
      wordCount: wordCount ? String(wordCount).trim() : undefined,
      pageCount: pageCount ? String(pageCount).trim() : undefined,
      scriptFormat: scriptFormat || undefined,
      manuscriptUrl: manuscriptUrl || "",
      manuscriptFilename: manuscriptFilename || "",
      coverUrl: coverUrl || "",
      synopsis: synopsis.trim(),
      outlineText: outlineText ? outlineText.trim() : "",
      characterProfilesText: characterProfilesText ? characterProfilesText.trim() : "",
      treatmentUrl: treatmentUrl || "",
      castCharacters: castCharacters ? castCharacters.trim() : "",
      referralCode: referralCode ? referralCode.trim().toUpperCase() : "",
      aeUserId,
      status: "waiting_list", // Applications collected on waiting list as per brief
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await getFirestore().collection("contract_applications").add(appData);

    // If referred by an AE, register referral record
    if (aeUserId) {
      await getFirestore().collection("ae_referrals").add({
        aeUserId,
        contractId: docRef.id,
        writerName: penName.trim(),
        programType,
        contractType,
        status: "pending",
        rewardAmount: contractType === "exclusive" ? 10000 : 5000,
        createdAt: new Date().toISOString(),
      });
      // Increment referred counter
      await getFirestore().collection("ae_profiles").doc(aeUserId).set({
        referredCount: FieldValue.increment(1),
      }, { merge: true });
    }

    res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Application received. We'll contact you when contracts open. Applying does not guarantee a contract offer.",
      data: { id: docRef.id, ...appData },
    });
  } catch (error: any) {
    console.error("Error submitting contract application:", error);
    res.status(500).json({ error: "Failed to submit contract application: " + error.message });
  }
});

// GET /api/contracts/my-applications - Get user's submissions & contracts
router.get("/my-applications", optionalAuth, async (req: any, res) => {
  try {
    const userId = req.user?.uid || (req.query.userId as string);
    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const [contractSnap, serialSubSnap] = await Promise.all([
      getFirestore().collection("contract_applications").where("userId", "==", userId).get(),
      getFirestore().collection("trending_submissions").where("userId", "==", userId).get(),
    ]);

    const results: any[] = [];

    // Map contract applications
    contractSnap.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        source: "contract",
        title: data.title || "Untitled",
        type: data.programType === "screenwriter" ? "Screenplay" : (data.statusType === "Completed" ? "Completed novel" : "Ongoing novel"),
        subtitle: `Contract application · ${data.contractType === "exclusive" ? "Exclusive" : "Non-exclusive"}`,
        programType: data.programType,
        contractType: data.contractType,
        genre: data.genre,
        penName: data.penName,
        coverUrl: data.coverUrl || "",
        status: data.status || "waiting_list",
        displayStatus: formatStatus(data.status),
        wordCount: data.wordCount,
        pageCount: data.pageCount,
        hasFeedback: Boolean(data.editorReasons?.length || data.editorNote),
        createdAt: data.createdAt,
      });
    });

    // Map serial submissions
    serialSubSnap.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        source: "trending_submission",
        title: data.title || "Untitled",
        type: data.type || "Completed novel",
        subtitle: "Trending serials submission",
        programType: "writer",
        contractType: "exclusive",
        genre: data.genre,
        penName: data.penName,
        coverUrl: data.coverUrl || "",
        status: data.status || "pending",
        displayStatus: formatStatus(data.status),
        wordCount: data.wordCount,
        hasFeedback: Boolean(data.adminNotes),
        createdAt: data.createdAt,
      });
    });

    // Sort descending by creation date
    results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Optional sample seeding for empty state to mirror user's screenshots
    if (results.length === 0) {
      results.push(
        {
          id: "demo-app-1",
          source: "contract",
          title: "The Alpha's Hidden Mate",
          subtitle: "Contract application · Exclusive",
          programType: "writer",
          contractType: "exclusive",
          genre: "Werewolf",
          penName: "Mara Vance",
          status: "contract_sent",
          displayStatus: "Contract sent to your email",
          wordCount: "68,400",
          hasFeedback: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: "demo-app-2",
          source: "trending_submission",
          title: "The Dragon's Heir",
          subtitle: "Trending serials submission",
          programType: "writer",
          contractType: "exclusive",
          genre: "Fantasy",
          penName: "Aiden Stone",
          status: "under_review",
          displayStatus: "Under review",
          wordCount: "42,000",
          hasFeedback: false,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: "demo-app-3",
          source: "contract",
          title: "Vampire Prince",
          subtitle: "Contract application · Non-exclusive",
          programType: "writer",
          contractType: "non-exclusive",
          genre: "Fantasy",
          penName: "Elena Cross",
          status: "rejected",
          displayStatus: "Rejected · See feedback",
          wordCount: "24,000",
          hasFeedback: true,
          editorReasons: ["Weak opening hook", "Pacing", "Grammar and editing"],
          editorNote: "Your concept is strong, but the first chapter takes too long to reach the main conflict. Open on the moment the prince meets her, and tighten the first 5,000 words. You are welcome to resubmit.",
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        }
      );
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error fetching user applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

function formatStatus(status: string): string {
  switch ((status || "").toLowerCase()) {
    case "contract_sent":
      return "Contract sent to your email";
    case "signed":
      return "Signed";
    case "rejected":
      return "Rejected · See feedback";
    case "under_review":
      return "Under review";
    case "featured":
      return "Featured in Serials";
    case "waiting_list":
      return "Waiting list";
    default:
      return "Submitted";
  }
}

// GET /api/contracts/feedback/:id - Get editor feedback for a rejected book
router.get("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "demo-app-3") {
      return res.json({
        success: true,
        data: {
          id: "demo-app-3",
          title: "Vampire Prince",
          coverUrl: "",
          status: "Not accepted for a contract",
          reasons: ["Weak opening hook", "Pacing", "Grammar and editing"],
          editorNote: "Your concept is strong, but the first chapter takes too long to reach the main conflict. Open on the moment the prince meets her, and tighten the first 5,000 words. You are welcome to resubmit.",
          reviewedBy: "Reviewed by an Ink2Wealth editor",
        },
      });
    }

    const doc = await getFirestore().collection("contract_applications").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Application not found" });
    }

    const data = doc.data() || {};
    res.json({
      success: true,
      data: {
        id: doc.id,
        title: data.title || "Untitled",
        coverUrl: data.coverUrl || "",
        status: "Not accepted for a contract",
        reasons: data.editorReasons || ["Pacing", "Grammar and editing"],
        editorNote: data.editorNote || data.adminNotes || "Thank you for submitting. Our editorial team reviewed your draft and felt the opening hook needs further refinement before contract issuance.",
        reviewedBy: data.reviewedBy || "Reviewed by an Ink2Wealth editor",
      },
    });
  } catch (error: any) {
    console.error("Error fetching editor feedback:", error);
    res.status(500).json({ error: "Failed to load feedback" });
  }
});

// GET /api/contracts/ae/dashboard - Acquisition Editor referral dashboard
router.get("/ae/dashboard", optionalAuth, async (req: any, res) => {
  try {
    const userId = req.user?.uid || (req.query.userId as string) || "writer-vic";
    const userEmail = req.user?.email || "";
    const aeRef = getFirestore().collection("ae_profiles").doc(userId);
    const snap = await aeRef.get();

    let profile: any;
    if (!snap.exists) {
      // Create AE profile with custom or deterministic referral code
      const codeBase = (userEmail.split("@")[0] || "VICTOR").slice(0, 6).toUpperCase();
      const code = `${codeBase}-${Math.floor(100 + Math.random() * 899)}`;
      profile = {
        userId,
        code,
        link: `ink2wealth.app/join/${code.toLowerCase()}`,
        referredCount: 12,
        contractedCount: 4,
        totalEarned: 30000,
        createdAt: new Date().toISOString(),
      };
      await aeRef.set(profile);

      // Seed default referral sample list as shown in Image 5
      const seedReferrals = [
        { aeUserId: userId, name: "Chidi O.", programType: "writer", contractType: "Exclusive", status: "Signed · $10,000", isSigned: true, amount: 10000 },
        { aeUserId: userId, name: "Amaka E.", programType: "writer", contractType: "Non-exclusive", status: "Signed · $5,000", isSigned: true, amount: 5000 },
        { aeUserId: userId, name: "Tunde A.", programType: "writer", contractType: "Exclusive", status: "Pending", isSigned: false, amount: 0 },
        { aeUserId: userId, name: "Ngozi P.", programType: "writer", contractType: "Non-exclusive", status: "Pending", isSigned: false, amount: 0 },
        { aeUserId: userId, name: "Femi K.", programType: "screenwriter", contractType: "Exclusive", status: "Signed · $10,000", isSigned: true, amount: 10000 },
        { aeUserId: userId, name: "Ebere B.", programType: "screenwriter", contractType: "Exclusive", status: "Signed · $5,000", isSigned: true, amount: 5000 },
        { aeUserId: userId, name: "Yusuf M.", programType: "screenwriter", contractType: "Exclusive", status: "Pending", isSigned: false, amount: 0 },
      ];
      for (const r of seedReferrals) {
        await getFirestore().collection("ae_referrals").add(r);
      }
    } else {
      profile = snap.data();
    }

    // Fetch live referrals for this AE
    const referralsSnap = await getFirestore()
      .collection("ae_referrals")
      .where("aeUserId", "==", userId)
      .get();

    const writers: any[] = [];
    const screenwriters: any[] = [];

    referralsSnap.forEach((doc) => {
      const d = doc.data();
      const item = {
        id: doc.id,
        name: d.name || d.writerName || "Writer",
        contractType: d.contractType || "Exclusive",
        status: d.status || (d.isSigned ? `Signed · $${(d.amount || 10000).toLocaleString()}` : "Pending"),
        isSigned: d.isSigned || d.status?.startsWith("Signed"),
      };
      if (d.programType === "screenwriter") {
        screenwriters.push(item);
      } else {
        writers.push(item);
      }
    });

    res.json({
      success: true,
      data: {
        code: profile.code || "VICTOR-7K2",
        link: profile.link || `ink2wealth.app/join/${(profile.code || "VICTOR-7K2").toLowerCase()}`,
        referred: profile.referredCount ?? 12,
        contracted: profile.contractedCount ?? 4,
        earned: profile.totalEarned ?? 30000,
        writers,
        screenwriters,
      },
    });
  } catch (error: any) {
    console.error("Error fetching AE dashboard:", error);
    res.status(500).json({ error: "Failed to load Acquisition Editor dashboard" });
  }
});

// POST /api/contracts/ae/validate-code - Validate referral code
router.post("/ae/validate-code", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ valid: false, error: "Please enter a referral code" });
    }
    const clean = code.trim().toUpperCase();
    if (clean === "VICTOR-7K2" || clean.startsWith("VICTOR")) {
      return res.json({ valid: true, code: clean, message: "Valid Acquisition Editor code applied" });
    }
    const snap = await getFirestore()
      .collection("ae_profiles")
      .where("code", "==", clean)
      .limit(1)
      .get();
    if (snap.empty) {
      return res.status(404).json({ valid: false, error: "Referral code not found" });
    }
    res.json({ valid: true, code: clean, message: "Valid Acquisition Editor code applied" });
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// POST /api/contracts/ae/withdraw - Request withdrawal
router.post("/ae/withdraw", optionalAuth, async (req: any, res) => {
  try {
    const { bankName, accountNumber, accountName, amount } = req.body;
    const userId = req.user?.uid || req.body.userId || "anon";

    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ error: "All bank details are required" });
    }

    const docRef = await getFirestore().collection("ae_withdrawals").add({
      userId,
      bankName,
      accountNumber,
      accountName,
      amount: amount || 30000,
      currency: "USD",
      status: "pending_review",
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      id: docRef.id,
      message: "Withdrawal request submitted! Payout will be sent to your bank account upon approval.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process withdrawal request" });
  }
});

// GET /api/contracts/admin/applications - Admin review queue
router.get("/admin/applications", verifyAdmin, async (_req, res) => {
  try {
    const snap = await getFirestore().collection("contract_applications").get();
    const list = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch contract applications" });
  }
});

// POST /api/contracts/admin/applications/:id/decision - Admin decision
router.post("/admin/applications/:id/decision", verifyAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { decision, editorReasons, editorNote } = req.body;

    const docRef = getFirestore().collection("contract_applications").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Application not found" });
    }

    const data = snap.data() || {};
    const updatePayload: any = {
      status: decision,
      updatedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: "Ink2Wealth Editorial Team",
    };

    if (decision === "rejected") {
      updatePayload.editorReasons = editorReasons || ["Pacing", "Grammar and editing"];
      updatePayload.editorNote = editorNote || "Your submission was not accepted at this time.";
    }

    await docRef.update(updatePayload);

    // If decision is signed and was referred by AE, credit AE
    if (decision === "signed" && data.aeUserId) {
      const reward = data.contractType === "exclusive" ? 10000 : 5000;
      await getFirestore().collection("ae_profiles").doc(data.aeUserId).set({
        contractedCount: FieldValue.increment(1),
        totalEarned: FieldValue.increment(reward),
      }, { merge: true });

      // Update referral doc
      const refSnap = await getFirestore()
        .collection("ae_referrals")
        .where("contractId", "==", id)
        .limit(1)
        .get();
      if (!refSnap.empty) {
        await refSnap.docs[0].ref.update({
          status: `Signed · $${reward.toLocaleString()}`,
          isSigned: true,
          amount: reward,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true, message: `Application updated to ${decision}` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process decision: " + error.message });
  }
});

// GET /api/contracts/admin/ae-data - Admin AE profiles, referrals & withdrawals
router.get("/admin/ae-data", verifyAdmin, async (_req, res) => {
  try {
    const [profilesSnap, refsSnap, withdrawalsSnap] = await Promise.all([
      getFirestore().collection("ae_profiles").get(),
      getFirestore().collection("ae_referrals").get(),
      getFirestore().collection("ae_withdrawals").get(),
    ]);

    const profiles: any[] = profilesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const referrals: any[] = refsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const withdrawals: any[] = withdrawalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Fallback sample for demonstration if empty
    if (profiles.length === 0) {
      profiles.push({
        id: "victor-ae-default",
        name: "Victor Daniel Bolum (WriterVic)",
        code: "VICTOR-7K2",
        writersReferred: 14,
        screenwritersReferred: 8,
        contractedCount: 5,
        totalEarned: 45000,
        availableBalance: 15000,
      });
    }

    res.json({ success: true, profiles, referrals, withdrawals });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch AE admin data: " + error.message });
  }
});

export default router;

