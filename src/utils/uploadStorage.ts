import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Request } from "express";
import { getStorage } from "firebase-admin/storage";
import { getUploadsDir } from "./paths";
import { buildUploadUrl } from "./publicUrl";

/** Use Firebase Storage on Vercel (ephemeral /tmp cannot keep files). */
export function shouldUseCloudStorage() {
  if (process.env.UPLOAD_DRIVER === "local") return false;
  if (process.env.UPLOAD_DRIVER === "firebase") return true;
  return Boolean(process.env.VERCEL) || process.env.USE_FIREBASE_STORAGE === "true";
}

export function makeUploadFilename(prefix: string, originalName: string) {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  return `${prefix}-${uniqueSuffix}${ext}`;
}

/**
 * Persist an uploaded image and return a durable public URL.
 * - Vercel / firebase driver → Firebase Storage (HTTPS URL)
 * - Local → disk under /uploads + relative/public URL
 */
export async function persistPublicUpload(
  req: Request,
  file: Express.Multer.File,
  filename: string
): Promise<string> {
  const buffer = file.buffer
    ? file.buffer
    : file.path
      ? await fs.promises.readFile(file.path)
      : null;

  if (!buffer?.length) {
    throw new Error("Upload file data missing.");
  }

  if (shouldUseCloudStorage()) {
    const bucket = getStorage().bucket();
    if (!bucket?.name) {
      throw new Error(
        "Firebase Storage bucket not configured. Set FIREBASE_STORAGE_BUCKET (e.g. your-project.appspot.com)."
      );
    }

    const objectPath = `uploads/${filename}`;
    const gcsFile = bucket.file(objectPath);
    const downloadToken = randomUUID();

    await gcsFile.save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.mimetype || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    let publicUrl = `https://firebasestorage.googleapis.com/v0/b/${
      bucket.name
    }/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;

    try {
      await gcsFile.makePublic();
      publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    } catch {
      // Uniform bucket-level access — keep token URL
    }

    if (file.path) {
      try {
        await fs.promises.unlink(file.path);
      } catch {
        /* ignore */
      }
    }

    return publicUrl;
  }

  const dest = path.join(getUploadsDir(), filename);
  if (!file.path || path.resolve(file.path) !== path.resolve(dest)) {
    await fs.promises.writeFile(dest, buffer);
  }
  if (file.path && path.resolve(file.path) !== path.resolve(dest)) {
    try {
      await fs.promises.unlink(file.path);
    } catch {
      /* ignore */
    }
  }

  return buildUploadUrl(req, filename);
}
