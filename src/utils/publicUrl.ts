import type { Request } from "express";

/**
 * Public URL for a file under /uploads.
 * Prefers a relative path so clients resolve via their HTTPS API origin
 * (avoids mixed-content when Express sees http behind a proxy).
 */
export function buildUploadUrl(req: Request, filename: string): string {
  const cleanName = String(filename || "").replace(/^\/+/, "");
  const relative = `/uploads/${cleanName}`;

  const configured = (
    process.env.PUBLIC_API_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

  if (configured) {
    const base = configured.replace(/^http:\/\//i, "https://");
    return `${base}${relative}`;
  }

  // Relative is safest for browsers on HTTPS admin/frontend
  if (process.env.UPLOAD_URL_MODE === "absolute") {
    const forwardedProto = String(req.get("x-forwarded-proto") || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const host = String(req.get("x-forwarded-host") || req.get("host") || "localhost")
      .split(",")[0]
      .trim();
    let protocol = forwardedProto || req.protocol || "http";
    const isLocal =
      /localhost|127\.0\.0\.1/i.test(host) ||
      host.startsWith("192.168.") ||
      host.startsWith("10.");
    if (!isLocal) protocol = "https";
    return `${protocol}://${host}${relative}`;
  }

  return relative;
}

/** Upgrade stored http:// upload URLs to https:// (for already-saved docs). */
export function ensureHttpsUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("http://")) return `https://${raw.slice("http://".length)}`;
  return raw;
}
