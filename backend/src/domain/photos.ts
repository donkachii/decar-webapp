// Photo rules with no I/O: what /admin may upload and how a part's photo list
// may change. The upload itself is services/cloudinary.ts.

import type { PartType } from "./catalog.js";

/** What an upload may be. The website shrinks photos to JPEG first; the rest are fallbacks. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
/** The website sends at most 4 MB (Vercel's request limit); this leaves room for other callers. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PART_PHOTOS = 20;

// Photos added in /admin are named admin-…; `pnpm photos` names its own 01, 02 …
const ADMIN_PHOTO = /\/admin-[a-z0-9]+\.jpg$/;

/** The line drawing a part shows until it has a photo. */
export function drawingFor(type: PartType): string {
  return `/parts/${type}.svg`;
}

export function isDrawing(src: string): boolean {
  return src.startsWith("/parts/");
}

/** A photo added in /admin. It exists only on Cloudinary, never in the photos/ folder. */
export function isAdminPhoto(src: string): boolean {
  return ADMIN_PHOTO.test(src);
}

/** The last segment of a new /admin photo's Cloudinary id. Never reused, so its URL never changes. */
export function adminPhotoName(now: number, random: string): string {
  return `admin-${now.toString(36)}${random}`;
}

/** A part's photos with one more at the end, or null if it has the most it may. The drawing goes. */
export function withPhoto(current: readonly string[], src: string): string[] | null {
  const photos = current.filter((s) => !isDrawing(s));
  return photos.length < MAX_PART_PHOTOS ? [...photos, src] : null;
}

/**
 * A part's photos after the admin reorders or removes some. Only photos already
 * on the part may stay, each once; null otherwise. With none left the part
 * shows its drawing again.
 */
export function keptPhotos(current: readonly string[], wanted: readonly string[], type: PartType): string[] | null {
  const photos = new Set(current.filter((s) => !isDrawing(s)));
  if (new Set(wanted).size !== wanted.length || wanted.some((s) => !photos.has(s))) return null;
  return wanted.length > 0 ? [...wanted] : [drawingFor(type)];
}
