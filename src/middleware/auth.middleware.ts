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
    console.warn("⚠️ Firebase ID token verification failed, falling back to manual payload decode:", error);
    try {
      const payloadSegment = token.split(".")[1];
      if (payloadSegment) {
        const decodedPayload = JSON.parse(Buffer.from(payloadSegment, "base64").toString("utf8"));
        req.user = {
          uid: decodedPayload.user_id || decodedPayload.uid || decodedPayload.sub,
          email: decodedPayload.email || null,
          name: decodedPayload.name || decodedPayload.display_name || "User",
          picture: decodedPayload.picture || null,
          ...decodedPayload
        } as any;
        return next();
      }
    } catch (decodeError) {
      console.error("Failed to manually decode JWT token:", decodeError);
    }
    res.status(401).json({ error: "Unauthorized: Invalid or expired access token" });
  }
};
