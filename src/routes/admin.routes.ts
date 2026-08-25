import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const router = Router();

// Retrieve all users (paginated)
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const db = getFirestore();

    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.displayName || data.name || "N/A",
        email: data.email || "N/A",
        role: data.role || "user",
        photoURL: data.photoURL || null,
        phone: data.phone || null,
        createdAt: data.createdAt || null,
        isActive: data.isActive !== false,
        subscriptionPlan: data.subscriptionPlan || "None",
        subscriptionDate: data.subscriptionDate || null,
        subscriptionExpiry: data.subscriptionExpiry || null,
      };
    });

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

    const data = docSnap.data() || {};
    return res.status(200).json({
      success: true,
      data: {
        id: docSnap.id,
        name: data.displayName || data.name || "N/A",
        email: data.email || "N/A",
        role: data.role || "user",
        photoURL: data.photoURL || null,
        phone: data.phone || null,
        createdAt: data.createdAt || null,
        isActive: data.isActive !== false,
        subscriptionPlan: data.subscriptionPlan || "None",
        subscriptionDate: data.subscriptionDate || null,
        subscriptionExpiry: data.subscriptionExpiry || null,
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

// Search users
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || "").toLowerCase();
    const db = getFirestore();

    const snapshot = await db.collection("users").get();
    const matchedUsers = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.displayName || data.name || "N/A",
          email: data.email || "N/A",
          role: data.role || "user",
          photoURL: data.photoURL || null,
          phone: data.phone || null,
          createdAt: data.createdAt || null,
        };
      })
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
router.get("/admin", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const usersSnap = await db.collection("users").get();
    const projectsSnap = await db.collection("projects").get();

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: usersSnap.size,
        totalProjects: projectsSnap.size,
        activeWriters: usersSnap.size, // mock statistics mapping
        recentRegistrations: usersSnap.docs.slice(0, 5).map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.displayName || data.name || "N/A",
            email: data.email || "N/A",
            role: data.role || "user",
          };
        }),
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

export default router;
