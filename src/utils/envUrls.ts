/** Split comma/semicolon/newline-separated env URL lists into clean entries. */
export function parseEnvUrls(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]+/)
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Unique list preserving order. */
export function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = url.replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Primary frontend origin for Stripe redirects / emails.
 * Prefer the request Origin when it is in FRONTEND_URL list.
 */
export function getPrimaryFrontendUrl(requestOrigin?: string | null): string {
  const urls = uniqueUrls(parseEnvUrls(process.env.FRONTEND_URL));
  const fallback = "http://localhost:3000";
  if (requestOrigin) {
    const cleaned = requestOrigin.replace(/\/+$/, "");
    if (urls.includes(cleaned)) return cleaned;
  }
  return urls[0] || fallback;
}

/** All CORS-allowed browser origins from FRONTEND_URL, ADMIN_URL, CORS_ORIGINS. */
export function getAllowedCorsOrigins(): string[] {
  return uniqueUrls([
    ...parseEnvUrls(process.env.FRONTEND_URL),
    ...parseEnvUrls(process.env.ADMIN_URL),
    ...parseEnvUrls(process.env.CORS_ORIGINS),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ]);
}
