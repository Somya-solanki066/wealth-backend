import { Router, Request, Response } from "express";
import { signAdminToken, verifyAdmin, AdminRequest } from "../middleware/admin.middleware";

const router = Router();

router.get("/test-cookie", (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, message: "Connected to Ink2Wealth Auth API" });
});

router.post("/email-login", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!adminEmail || !adminPassword) {
    return res.status(500).json({
      success: false,
      message: "Admin credentials are not configured on the server.",
    });
  }

  if (!email || !password || email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  try {
    const token = await signAdminToken({
      email: adminEmail,
      name: process.env.ADMIN_NAME || "Ink2Wealth Admin",
    });

    return res.status(200).json({
      success: true,
      token,
      user: {
        email: adminEmail,
        name: process.env.ADMIN_NAME || "Ink2Wealth Admin",
        role: "admin",
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create admin session.",
    });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, message: "Logged out successfully" });
});

router.get("/me", verifyAdmin, (req: AdminRequest, res: Response) => {
  return res.status(200).json({
    success: true,
    user: {
      email: req.admin?.email,
      name: req.admin?.name || process.env.ADMIN_NAME || "Ink2Wealth Admin",
      role: "admin",
    },
  });
});

export default router;
