import { Request, Response, NextFunction } from "express";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

    // Check if user is soft-deleted in Firestore
    try {
      const userDoc = await getFirestore().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data?.isDeleted === true || data?.status === "deleted") {
          res.status(403).json({
            error: "Your account has been deleted. Please contact support@ink2wealth.co to restore your account.",
            code: "ACCOUNT_DELETED",
            isDeleted: true,
          });
          return;
        }
      }
    } catch (dbErr) {
      console.warn("auth middleware: error checking user deleted status:", dbErr);
    }

    next();
  } catch (error: any) {
    if (error?.code === "auth/user-disabled" || error?.code === "auth/id-token-revoked") {
      res.status(403).json({
        error: "Your account has been deactivated. Please contact support@ink2wealth.co.",
        code: "ACCOUNT_DELETED",
        isDeleted: true,
      });
      return;
    }
    res.status(401).json({ error: "Unauthorized: Invalid or expired access token" });
  }
};
