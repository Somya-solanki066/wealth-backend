export const FILM_GENRES = [
  "Drama",
  "Thriller",
  "Comedy",
  "Romance",
  "Horror",
  "Action",
  "Documentary",
  "Animation",
] as const;

export const FILM_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "removed",
] as const;

export const CONTENT_RATINGS = ["General", "Mature"] as const;

export const REPORT_REASONS = [
  "Inappropriate content",
  "Copyright concern",
  "Spam",
  "Violence",
  "Other",
] as const;

export type FilmStatus = (typeof FILM_STATUSES)[number];

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  if (r === 0) return `${m} min`;
  return `${m}m ${r}s`;
}
