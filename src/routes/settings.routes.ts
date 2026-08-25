import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";

const router = Router();

// Get Global Settings
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("settings").doc("global");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      // Default settings
      const defaultSettings = {
        aiAnalyzerFreeLimit: 3,
        smartEditFreeLimit: 3,
        plans: [
          {
            id: "free",
            name: "FREE",
            price: "₦0",
            period: "Forever free",
            badge: "",
            discount: "",
            revenueCatId: "",
            features: [
              { name: "3 chapter analyses per month", included: true },
              { name: "Novel and Script Editor", included: true },
              { name: "3 Smart Edit checks", included: true },
              { name: "Study Planner, Flashcards, Citations", included: true },
              { name: "Exam Techniques Hub", included: true },
              { name: "No AI Ghost Writer", included: false },
              { name: "No Essay Writer", included: false }
            ]
          },
          {
            id: "6-month",
            name: "6-MONTH PLAN",
            price: "₦24,900",
            period: "every 6 months",
            badge: "BEST VALUE",
            discount: "Save 40% vs monthly",
            revenueCatId: "six_month_sub",
            features: [
              { name: "Unlimited chapter analysis", included: true },
              { name: "AI Ghost Writer — unlimited", included: true },
              { name: "All 8 Smart Edit checks unlimited", included: true },
              { name: "Essay & Project Writer", included: true },
              { name: "All WEALTH Engine tools", included: true },
              { name: "Book promotion guides", included: true },
              { name: "Priority support", included: true }
            ]
          },
          {
            id: "yearly",
            name: "YEARLY PLAN",
            price: "₦49,900",
            period: "per year",
            badge: "",
            discount: "Save 60% — maximum value",
            revenueCatId: "yearly_sub",
            features: [
              { name: "Everything in 6-Month plan", included: true },
              { name: "Early access to new features", included: true },
              { name: "Course discount access", included: true },
              { name: "Community founding member badge", included: true },
              { name: "One free coaching session with Victor", included: true }
            ]
          }
        ]
      };
      await docRef.set(defaultSettings);
      return res.status(200).json({ success: true, data: defaultSettings });
    }

    return res.status(200).json({ success: true, data: docSnap.data() });
  } catch (error: any) {
    console.error("Error retrieving settings:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Update Global Settings (Admin)
router.put("/", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();
    const docRef = db.collection("settings").doc("global");
    
    // In a real app, verify admin role here
    const updateData = req.body;
    
    await docRef.set(updateData, { merge: true });
    
    const updatedSnap = await docRef.get();
    return res.status(200).json({ success: true, data: updatedSnap.data() });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
