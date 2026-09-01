import { Request, Response, NextFunction } from "express";
import { SignJWT, jwtVerify, JWTPayload } from "jose";

export interface AdminRequest extends Request {
  admin?: JWTPayload;
}

function getAdminSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(payload: { email: string; name: string }) {
  return new SignJWT({ ...payload, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getAdminSecret());
}

export const verifyAdmin = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Admin authorization required" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const { payload } = await jwtVerify(token, getAdminSecret());
    if (payload.role !== "admin") {
      res.status(403).json({ error: "Admin role required" });
      return;
    }

    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin session. Please log in again." });
  }
};
