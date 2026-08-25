import { Router, Request, Response } from "express";

const router = Router();

// Test connection endpoint
router.get("/test-cookie", (req: Request, res: Response) => {
  return res.status(200).json({ success: true, message: "Connected to Ink2Wealth Auth API" });
});

// Admin Email Login endpoint
router.post("/email-login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Support both ink2wealth and old credentials for ease of test
  if (
    (email === "admin@ink2wealth.com" || email === "admin@fyies.com") &&
    password === "Admin@123"
  ) {
    return res.status(200).json({
      success: true,
      token: "ink2wealth-admin-token-session-jwt-mock",
      user: {
        email,
        name: "Ink2Wealth Admin",
        role: "admin",
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid email or password. Please use Admin credentials.",
  });
});

// Admin Logout endpoint
router.post("/logout", (req: Request, res: Response) => {
  return res.status(200).json({ success: true, message: "Logged out successfully" });
});

// Get current admin details
router.get("/me", (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    user: {
      email: "admin@ink2wealth.com",
      name: "Ink2Wealth Admin",
      role: "admin",
    },
  });
});

// Get profile details
router.get("/profile", (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    user: {
      email: "admin@ink2wealth.com",
      name: "Ink2Wealth Admin",
      role: "admin",
    },
  });
});

export default router;
