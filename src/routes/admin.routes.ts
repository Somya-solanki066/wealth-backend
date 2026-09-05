import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getPlanById, isFreePlan, isUserPremium, revokeSubscriptionFields, subscriptionFieldsForPlan } from "../utils/plans";
import {
  DEFAULT_AI_CONFIG,
  getAiConfig,
  getAnalyzerPrompt,
  getSmartEditPrompt,
  listAnalyzerPromptPlatforms,
  normalizeAiConfig,
} from "../utils/catalog";
import { DEFAULT_ANALYZER_PROMPTS } from "../utils/analyzerPrompts";
import { DEFAULT_SMART_EDIT_PROMPT } from "../utils/smartEditPrompt";

const router = Router();

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  if (value._seconds) return value._seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toIso(value: any): string | null {
  const ms = toMillis(value);
  return ms ? new Date(ms).toISOString() : null;
}

function countWordsFromHtml(html: string): number {
  if (!html) return 0;
  return html
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function mapUser(id: string, data: Record<string, any> = {}) {
  return {
    id,
    name: data.displayName || data.name || "N/A",
    email: data.email || "N/A",
    role: data.role || "user",
    photoURL: data.photoURL || null,
    phone: data.phone || null,
    createdAt: toIso(data.createdAt),
    isActive: data.isActive !== false,
    isPremium: isUserPremium(data),
    subscriptionPlan: data.subscriptionPlan || "None",
    subscriptionDate: toIso(data.subscriptionDate),
    subscriptionExpiry: toIso(data.subscriptionExpiry),
    subscriptionSource: data.subscriptionSource || null,
    writingStreak: data.writingStreak || 0,
    lastWriteDate: toIso(data.lastWriteDate),
    totalWordsWritten: data.totalWordsWritten || 0,
  };
}

// Retrieve all users (paginated)
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const db = getFirestore();

    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => mapUser(doc.id, doc.data()));

    // Simple in-memory pagination
    const startIndex = (page - 1) * limit;
    const paginatedUsers = users.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      data: paginatedUsers,
      total: users.length,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("Error retrieving users:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Retrieve details for a single user
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("users").doc(req.params.id as string);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = mapUser(docSnap.id, docSnap.data() || {});
    const usageSnap = await db.collection("ai_usage").doc(docSnap.id).get();
    const usage = usageSnap.data() || {};
    const projectsSnap = await db.collection("projects").where("userId", "==", docSnap.id).get();
    const projects = projectsSnap.docs.map((projectDoc) => {
      const project = projectDoc.data();
      return {
        id: projectDoc.id,
        name: project.name || "Untitled",
        type: project.type || "novel",
        status: project.status || null,
        wordCount: project.wordCount || 0,
        chapterCount: project.chapterCount || 0,
        updatedAt: toIso(project.updatedAt),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        ...userData,
        aiUsage: {
          aiAnalyzerCount: usage.aiAnalyzerCount || 0,
          smartEditCount: usage.smartEditCount || 0,
          lastUsed: toIso(usage.lastUsed),
        },
        projects,
      },
    });
  } catch (error: any) {
    console.error("Error retrieving user detail:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Update details for a user
router.put("/users/:id", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("users").doc(req.params.id as string);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const { name, displayName, role, phone, isActive } = req.body;
    const updates: any = {};
    if (name) updates.name = name;
    if (displayName) updates.displayName = displayName;
    if (role) updates.role = role;
    if (phone) updates.phone = phone;
    if (isActive !== undefined) updates.isActive = isActive;

    await docRef.update(updates);

    if (isActive !== undefined) {
      await getAuth().updateUser(req.params.id as string, { disabled: !isActive });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Delete a user
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("users").doc(req.params.id as string);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    await docRef.delete();

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/users/:id/subscription", async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { action, planId, subscriptionExpiry, isPremium } = req.body as {
      action?: string;
      planId?: string;
      subscriptionExpiry?: string | null;
      isPremium?: boolean;
    };
    const db = getFirestore();
    const docRef = db.collection("users").doc(userId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    if (action === "update") {
      const updates: Record<string, any> = { subscriptionSource: "admin" };
      if (planId) {
        const plan = await getPlanById(String(planId));
        if (!plan) {
          return res.status(400).json({ error: "Unknown planId" });
        }
        Object.assign(updates, subscriptionFieldsForPlan(plan, "admin"));
      }
      if (subscriptionExpiry !== undefined) {
        updates.subscriptionExpiry = subscriptionExpiry || null;
      }
      if (typeof isPremium === "boolean") {
        updates.isPremium = isPremium;
        if (!isPremium && !planId) {
          updates.subscriptionPlan = "free";
        }
      }
      await docRef.set(updates, { merge: true });
      const updated = await docRef.get();
      return res.status(200).json({
        success: true,
        message: "Subscription updated",
        data: mapUser(updated.id, updated.data() || {}),
      });
    }

    if (action === "revoke") {
      await docRef.set(revokeSubscriptionFields(), { merge: true });
      const updated = await docRef.get();
      return res.status(200).json({
        success: true,
        message: "Premium access revoked",
        data: mapUser(updated.id, updated.data() || {}),
      });
    }

    if (action !== "grant") {
      return res.status(400).json({ error: "action must be grant, revoke, or update" });
    }

    const plan = await getPlanById(String(planId || ""));
    if (!plan || isFreePlan(plan)) {
      return res.status(400).json({ error: "A valid paid planId is required to grant premium" });
    }

    await docRef.set(subscriptionFieldsForPlan(plan, "admin"), { merge: true });
    const updated = await docRef.get();
    return res.status(200).json({
      success: true,
      message: `Granted ${plan.name}`,
      data: mapUser(updated.id, updated.data() || {}),
    });
  } catch (error: any) {
    console.error("Error updating subscription:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Search users
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || "").toLowerCase();
    const db = getFirestore();

    const snapshot = await db.collection("users").get();
    const matchedUsers = snapshot.docs
      .map((doc) => mapUser(doc.id, doc.data()))
      .filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.id.toLowerCase().includes(query)
      );

    return res.status(200).json({
      success: true,
      data: matchedUsers,
    });
  } catch (error: any) {
    console.error("Error searching users:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Admin stats
router.get("/admin", async (_req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const [usersSnap, projectsSnap, usageSnap, paymentsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("projects").get(),
      db.collection("ai_usage").get(),
      db.collection("payments").get(),
    ]);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const inLast = (value: any, days: number) => {
      if (!value) return false;
      const date = value.toDate ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return now - date.getTime() <= days * day;
    };

    const usageByUser = new Map<string, any>();
    usageSnap.docs.forEach((doc) => usageByUser.set(doc.id, doc.data()));

    let newSignups7d = 0;
    let newSignups30d = 0;
    let activeWriters7d = 0;
    let premiumUsers = 0;
    let aiAnalyzerCalls = 0;
    let smartEditCalls = 0;

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (inLast(data.createdAt, 7)) newSignups7d += 1;
      if (inLast(data.createdAt, 30)) newSignups30d += 1;
      if (isUserPremium(data)) premiumUsers += 1;
      const usage = usageByUser.get(doc.id) || {};
      if (inLast(data.lastWriteDate, 7) || inLast(usage.lastUsed, 7)) {
        activeWriters7d += 1;
      }
    });

    usageSnap.docs.forEach((doc) => {
      const data = doc.data();
      aiAnalyzerCalls += Number(data.aiAnalyzerCount || 0);
      smartEditCalls += Number(data.smartEditCount || 0);
    });

    const recentSignups = [...usersSnap.docs]
      .sort((a, b) => toMillis(b.data().createdAt) - toMillis(a.data().createdAt))
      .slice(0, 8)
      .map((doc) => mapUser(doc.id, doc.data()));

    const recentPayments = [...paymentsSnap.docs]
      .sort((a, b) => toMillis(b.data().createdAt) - toMillis(a.data().createdAt))
      .slice(0, 8)
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: toIso(data.createdAt),
        };
      });

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: usersSnap.size,
        totalProjects: projectsSnap.size,
        activeWriters: activeWriters7d,
        activeWriters7d,
        newSignups7d,
        newSignups30d,
        premiumUsers,
        aiAnalyzerCalls,
        smartEditCalls,
        recentSignups,
        recentPayments,
        recentRegistrations: recentSignups.slice(0, 5),
      },
    });
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/data/editorial-trends/:platform - Fetch editorial trends for a platform
router.get("/editorial-trends/:platform", async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const db = getFirestore();
    const docRef = db.collection("editorial_trends").doc(platform as string);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(200).json({
        success: true,
        data: {
          hotTropes: "",
          acquiringNow: "",
          avoid: "",
          policyChanges: ""
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: docSnap.data()
    });
  } catch (error: any) {
    console.error("Error retrieving editorial trends:", error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/data/editorial-trends/:platform - Update editorial trends for a platform
router.put("/editorial-trends/:platform", async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const { hotTropes, acquiringNow, avoid, policyChanges } = req.body;
    const db = getFirestore();
    const docRef = db.collection("editorial_trends").doc(platform as string);

    const trendsData = {
      hotTropes: hotTropes || "",
      acquiringNow: acquiringNow || "",
      avoid: avoid || "",
      policyChanges: policyChanges || "",
      updatedAt: new Date().toISOString()
    };

    await docRef.set(trendsData, { merge: true });

    return res.status(200).json({
      success: true,
      message: `${platform} editorial trends updated successfully.`,
      data: trendsData
    });
  } catch (error: any) {
    console.error("Error updating editorial trends:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/ai-config", async (_req: Request, res: Response) => {
  try {
    const data = await getAiConfig();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/ai-config", async (req: Request, res: Response) => {
  try {
    const normalized = normalizeAiConfig({ ...DEFAULT_AI_CONFIG, ...req.body });
    const db = getFirestore();
    await db.collection("settings").doc("ai_config").set(normalized);
    return res.status(200).json({ success: true, data: normalized });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/smart-edit-prompt", async (_req: Request, res: Response) => {
  try {
    const prompt = await getSmartEditPrompt();
    return res.status(200).json({ success: true, data: { prompt } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/smart-edit-prompt", async (req: Request, res: Response) => {
  try {
    const prompt = String(req.body?.prompt || "").trim() || DEFAULT_SMART_EDIT_PROMPT;
    const db = getFirestore();
    await db.collection("settings").doc("smart_edit").set({
      prompt,
      updatedAt: new Date().toISOString(),
    });
    return res.status(200).json({ success: true, data: { prompt } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/analyzer-prompts/:platform", async (req: Request, res: Response) => {
  try {
    const platform = String(req.params.platform);
    const platforms = await listAnalyzerPromptPlatforms();
    const prompt = await getAnalyzerPrompt(platform);
    return res.status(200).json({
      success: true,
      data: {
        platform,
        prompt,
        platforms,
        isDefault: !DEFAULT_ANALYZER_PROMPTS[platform] ? false : prompt === DEFAULT_ANALYZER_PROMPTS[platform],
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/analyzer-prompts/:platform", async (req: Request, res: Response) => {
  try {
    const platform = String(req.params.platform);
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const db = getFirestore();
    await db.collection("analyzer_prompts").doc(platform).set({
      prompt,
      updatedAt: new Date().toISOString(),
    });
    return res.status(200).json({ success: true, data: { platform, prompt } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/payments", async (_req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const snap = await db.collection("payments").get();
    const payments = snap.docs
      .map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: toIso(data.createdAt) };
      })
      .sort((a: any, b: any) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return res.status(200).json({ success: true, data: payments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/feedback", async (req: Request, res: Response) => {
  try {
    const tool = String(req.query.tool || "").trim();
    const validTools = ["chapter-analyzer", "smart-edit"];
    const db = getFirestore();

    const snapshot = await db.collection("ai_tool_feedback").get();
    let feedback = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId || null,
          userEmail: data.userEmail || null,
          tool: data.tool || "unknown",
          rating: data.rating || "unknown",
          message: data.message || "",
          context: data.context || {},
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    if (tool && validTools.includes(tool)) {
      feedback = feedback.filter((item) => item.tool === tool);
    }

    const summary = {
      total: feedback.length,
      yes: feedback.filter((item) => item.rating === "yes").length,
      partial: feedback.filter((item) => item.rating === "partial").length,
      no: feedback.filter((item) => item.rating === "no").length,
    };

    return res.status(200).json({ success: true, data: feedback, summary });
  } catch (error: any) {
    console.error("Error fetching AI tool feedback:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/data/projects - All user projects for admin
router.get("/projects", async (_req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const [projectsSnap, usersSnap] = await Promise.all([
      db.collection("projects").get(),
      db.collection("users").get(),
    ]);

    const usersById = new Map<string, any>();
    usersSnap.docs.forEach((doc) => usersById.set(doc.id, doc.data()));

    const projects = projectsSnap.docs
      .map((doc) => {
        const data = doc.data();
        const owner = usersById.get(data.userId) || {};
        return {
          id: doc.id,
          name: data.name || "Untitled",
          type: data.type || "novel",
          status: data.status || "Draft",
          wordCount: data.wordCount || 0,
          chapterCount: data.chapterCount || 0,
          userId: data.userId || null,
          ownerName: owner.displayName || owner.name || "N/A",
          ownerEmail: owner.email || "N/A",
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      })
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));

    return res.status(200).json({ success: true, data: projects, total: projects.length });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/data/projects/:id - Project detail + chapters for admin
router.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const projectRef = db.collection("projects").doc(String(req.params.id));
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const data = projectSnap.data() || {};
    const userSnap = data.userId ? await db.collection("users").doc(data.userId).get() : null;
    const owner = userSnap?.exists ? userSnap.data() : {};
    const chaptersSnap = await projectRef.collection("chapters").get();
    const chapters = chaptersSnap.docs
      .map((doc) => {
        const chap = doc.data();
        return {
          id: doc.id,
          title: chap.title || "Untitled",
          wordCount: chap.wordCount || countWordsFromHtml(chap.content || ""),
          lastSavedAt: toIso(chap.lastSavedAt),
          preview: String(chap.content || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 220),
        };
      })
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));

    return res.status(200).json({
      success: true,
      data: {
        id: projectSnap.id,
        name: data.name || "Untitled",
        type: data.type || "novel",
        status: data.status || "Draft",
        wordCount: data.wordCount || 0,
        chapterCount: data.chapterCount || chapters.length,
        userId: data.userId || null,
        ownerName: owner?.displayName || owner?.name || "N/A",
        ownerEmail: owner?.email || "N/A",
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        chapters,
      },
    });
  } catch (error: any) {
    console.error("Error fetching project detail:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/data/active-writers - Writers active in last 7 days + what they write
router.get("/active-writers", async (_req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const [usersSnap, usageSnap, projectsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("ai_usage").get(),
      db.collection("projects").get(),
    ]);

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const inLast7d = (value: any) => {
      const ms = toMillis(value);
      return ms > 0 && now - ms <= weekMs;
    };

    const usageByUser = new Map<string, any>();
    usageSnap.docs.forEach((doc) => usageByUser.set(doc.id, doc.data()));

    const projectsByUser = new Map<string, any[]>();
    projectsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const uid = data.userId;
      if (!uid) return;
      const list = projectsByUser.get(uid) || [];
      list.push({
        id: doc.id,
        name: data.name || "Untitled",
        type: data.type || "novel",
        wordCount: data.wordCount || 0,
        chapterCount: data.chapterCount || 0,
        updatedAt: toIso(data.updatedAt),
        status: data.status || "Draft",
      });
      projectsByUser.set(uid, list);
    });

    const writers = usersSnap.docs
      .map((doc) => {
        const data = doc.data();
        const usage = usageByUser.get(doc.id) || {};
        const wroteRecently = inLast7d(data.lastWriteDate);
        const usedAiRecently = inLast7d(usage.lastUsed);
        if (!wroteRecently && !usedAiRecently) return null;

        const projects = (projectsByUser.get(doc.id) || []).sort(
          (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)
        );

        return {
          id: doc.id,
          name: data.displayName || data.name || "N/A",
          email: data.email || "N/A",
          isPremium: isUserPremium(data),
          writingStreak: data.writingStreak || 0,
          totalWordsWritten: data.totalWordsWritten || 0,
          lastWriteDate: toIso(data.lastWriteDate),
          lastAiUsed: toIso(usage.lastUsed),
          aiAnalyzerCount: usage.aiAnalyzerCount || 0,
          smartEditCount: usage.smartEditCount || 0,
          activityType: wroteRecently && usedAiRecently ? "writing-ai" : wroteRecently ? "writing" : "ai",
          projects,
          currentProject: projects[0] || null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const aMs = Math.max(toMillis(a.lastWriteDate), toMillis(a.lastAiUsed));
        const bMs = Math.max(toMillis(b.lastWriteDate), toMillis(b.lastAiUsed));
        return bMs - aMs;
      });

    return res.status(200).json({ success: true, data: writers, total: writers.length });
  } catch (error: any) {
    console.error("Error fetching active writers:", error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/data/ai-usage - Per-user totals + recent call logs
router.get("/ai-usage", async (req: Request, res: Response) => {
  try {
    const tool = String(req.query.tool || "").trim();
    const db = getFirestore();
    const [usageSnap, logsSnap, usersSnap] = await Promise.all([
      db.collection("ai_usage").get(),
      db.collection("ai_usage_logs").get(),
      db.collection("users").get(),
    ]);

    const usersById = new Map<string, any>();
    usersSnap.docs.forEach((doc) => usersById.set(doc.id, doc.data()));

    const users = usageSnap.docs
      .map((doc) => {
        const data = doc.data();
        const user = usersById.get(doc.id) || {};
        return {
          userId: doc.id,
          userEmail: user.email || data.userEmail || "N/A",
          userName: user.displayName || user.name || "N/A",
          aiAnalyzerCount: Number(data.aiAnalyzerCount || 0),
          smartEditCount: Number(data.smartEditCount || 0),
          totalCalls: Number(data.aiAnalyzerCount || 0) + Number(data.smartEditCount || 0),
          totalTokensUsed: Number(data.totalTokensUsed || 0),
          totalWordsAnalyzed: Number(data.totalWordsAnalyzed || 0),
          lastTool: data.lastTool || null,
          lastUsed: toIso(data.lastUsed),
        };
      })
      .filter((u) => u.totalCalls > 0)
      .sort((a, b) => b.totalCalls - a.totalCalls);

    let logs = logsSnap.docs
      .map((doc) => {
        const data = doc.data();
        const user = usersById.get(data.userId) || {};
        return {
          id: doc.id,
          userId: data.userId || null,
          userEmail: data.userEmail || user.email || "N/A",
          userName: user.displayName || user.name || "N/A",
          tool: data.tool || "unknown",
          wordsAnalyzed: Number(data.wordsAnalyzed || 0),
          tokensUsed: Number(data.tokensUsed || 0),
          promptTokens: Number(data.promptTokens || 0),
          completionTokens: Number(data.completionTokens || 0),
          model: data.model || null,
          projectId: data.projectId || null,
          projectName: data.projectName || null,
          chapterId: data.chapterId || null,
          chapterTitle: data.chapterTitle || null,
          platform: data.platform || null,
          genre: data.genre || null,
          fileName: data.fileName || null,
          score: data.score ?? null,
          inputPreview: data.inputPreview || "",
          createdAt: toIso(data.createdAt),
        };
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    if (tool === "chapter-analyzer" || tool === "smart-edit") {
      logs = logs.filter((item) => item.tool === tool);
    }

    const summary = {
      totalUsers: users.length,
      analyzerCalls: users.reduce((sum, u) => sum + u.aiAnalyzerCount, 0),
      smartEditCalls: users.reduce((sum, u) => sum + u.smartEditCount, 0),
      totalTokens: users.reduce((sum, u) => sum + u.totalTokensUsed, 0),
      totalWords: users.reduce((sum, u) => sum + u.totalWordsAnalyzed, 0),
      loggedCalls: logs.length,
    };

    return res.status(200).json({ success: true, data: { users, logs }, summary });
  } catch (error: any) {
    console.error("Error fetching AI usage:", error);
    return res.status(500).json({ error: error.message });
  }
});

function mapWealthJob(id: string, data: Record<string, any> = {}) {
  return {
    id,
    posterId: data.posterId || "",
    posterName: data.posterName || "Poster",
    title: data.title || "",
    category: data.category || "",
    description: data.description || "",
    budget: data.budget ?? null,
    budgetDisplay: data.budgetDisplay || "",
    budgetType: data.budgetType || "fixed",
    deadline: data.deadline || null,
    jobType: data.jobType || "contract",
    locationType: data.locationType || "remote",
    urgent: Boolean(data.urgent),
    status: data.status || "pending_review",
    rejectReason: data.rejectReason || null,
    applicationCount: data.applicationCount || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

/** GET /api/data/wealth-jobs */
router.get("/wealth-jobs", async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || "").trim();
    const db = getFirestore();
    let snap;
    if (status) {
      snap = await db.collection("jobs").where("status", "==", status).get();
    } else {
      snap = await db.collection("jobs").get();
    }
    const jobs = snap.docs
      .map((d) => mapWealthJob(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ success: true, data: jobs, total: jobs.length });
  } catch (error: any) {
    console.error("Admin wealth-jobs list error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/data/wealth-jobs/:id/approve */
router.post("/wealth-jobs/:id/approve", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const ref = db.collection("jobs").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Job not found." });
    const now = new Date().toISOString();
    await ref.update({
      status: "active",
      rejectReason: null,
      updatedAt: now,
      approvedAt: now,
    });
    const next = await ref.get();
    return res.json({ success: true, data: mapWealthJob(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Approve job error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/data/wealth-jobs/:id/reject */
router.post("/wealth-jobs/:id/reject", async (req: Request, res: Response) => {
  try {
    const reason = String(req.body?.reason || "Does not meet marketplace guidelines.").trim();
    const db = getFirestore();
    const ref = db.collection("jobs").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Job not found." });
    const now = new Date().toISOString();
    await ref.update({
      status: "rejected",
      rejectReason: reason,
      updatedAt: now,
      rejectedAt: now,
    });
    const next = await ref.get();
    return res.json({ success: true, data: mapWealthJob(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Reject job error:", error);
    return res.status(500).json({ error: error.message });
  }
});

function mapOpenCall(id: string, data: Record<string, any>) {
  return {
    id,
    posterId: data.posterId || "",
    posterName: data.posterName || "Poster",
    title: data.title || "",
    organization: data.organization || "",
    callType: data.callType || "",
    genre: data.genre || "",
    targetMarket: data.targetMarket || "",
    description: data.description || "",
    requirements: data.requirements || "",
    deadline: data.deadline || null,
    prize: data.prize || "",
    fee: data.fee || "",
    locationType: data.locationType || "remote",
    status: data.status || "pending_review",
    rejectReason: data.rejectReason || null,
    pitchCount: data.pitchCount || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

/** GET /api/data/wealth-open-calls */
router.get("/wealth-open-calls", async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || "").trim();
    const db = getFirestore();
    let snap;
    if (status) {
      snap = await db.collection("openCalls").where("status", "==", status).get();
    } else {
      snap = await db.collection("openCalls").get();
    }
    const calls = snap.docs
      .map((d) => mapOpenCall(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.json({ success: true, data: calls, total: calls.length });
  } catch (error: any) {
    console.error("Admin wealth-open-calls list error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/data/wealth-open-calls/:id/approve */
router.post("/wealth-open-calls/:id/approve", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const ref = db.collection("openCalls").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Open call not found." });
    const now = new Date().toISOString();
    await ref.update({
      status: "active",
      rejectReason: null,
      updatedAt: now,
      approvedAt: now,
    });
    const next = await ref.get();
    return res.json({ success: true, data: mapOpenCall(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Approve open call error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/** POST /api/data/wealth-open-calls/:id/reject */
router.post("/wealth-open-calls/:id/reject", async (req: Request, res: Response) => {
  try {
    const reason = String(req.body?.reason || "Does not meet marketplace guidelines.").trim();
    const db = getFirestore();
    const ref = db.collection("openCalls").doc(String(req.params.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Open call not found." });
    const now = new Date().toISOString();
    await ref.update({
      status: "rejected",
      rejectReason: reason,
      updatedAt: now,
      rejectedAt: now,
    });
    const next = await ref.get();
    return res.json({ success: true, data: mapOpenCall(next.id, next.data()!) });
  } catch (error: any) {
    console.error("Reject open call error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/course-enrollments", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const courseId = String(req.query.courseId || "").trim();
    const status = String(req.query.status || "").trim();

    const snap = await db.collection("courseEnrollments").get();
    let enrollments = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        enrollmentId: d.enrollmentId || null,
        userId: d.userId || null,
        userEmail: d.userEmail || null,
        userName: d.userName || null,
        courseId: d.courseId || null,
        courseName: d.courseName || null,
        amountPaid: d.amountPaid || 0,
        currency: (d.currency || "ngn").toUpperCase(),
        status: d.status || "pending",
        validFrom: toIso(d.validFrom) || toIso(d.createdAt),
        validUntil: toIso(d.validUntil),
        accessType: d.accessType || (d.validUntil ? "limited" : "lifetime"),
        stripeSessionId: d.stripeSessionId || null,
        paymentProvider: d.paymentProvider || "stripe",
        createdAt: toIso(d.createdAt),
        confirmedAt: toIso(d.confirmedAt),
      };
    });

    if (courseId) {
      enrollments = enrollments.filter((e) => e.courseId === courseId);
    }
    if (status) {
      enrollments = enrollments.filter((e) => e.status === status);
    }

    enrollments.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return res.status(200).json({ success: true, data: enrollments, total: enrollments.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
