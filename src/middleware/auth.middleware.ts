import { Request, Response, NextFunction } from "express";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

export const verifyFirebaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Access token is missing or invalid format" });
    return;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired access token" });
  }
};
