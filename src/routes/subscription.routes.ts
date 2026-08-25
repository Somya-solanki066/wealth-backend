import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

const REVENUECAT_API_KEY = "test_nSyBKlAgMeSQLnsBlafQibGnnlM"; // The provided test key

// Check Subscription Status
router.get("/status/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const response = await axios.get(
      `https://api.revenuecat.com/v1/subscribers/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${REVENUECAT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const subscriberData = response.data.subscriber;
    const entitlements = subscriberData.entitlements;

    // Check if the user has an active premium entitlement
    // Assuming the entitlement identifier is "premium"
    const isPremium = entitlements?.premium?.expires_date === null || 
                      new Date(entitlements?.premium?.expires_date) > new Date();

    return res.status(200).json({
      success: true,
      isPremium: isPremium,
      entitlements: entitlements,
    });
  } catch (error: any) {
    console.error("Error retrieving RevenueCat status:", error.response?.data || error.message);
    // If user not found in RevenueCat, they are definitely not premium
    if (error.response?.status === 404) {
      return res.status(200).json({ success: true, isPremium: false, entitlements: {} });
    }
    return res.status(500).json({ error: "Failed to check subscription status." });
  }
});

export default router;
