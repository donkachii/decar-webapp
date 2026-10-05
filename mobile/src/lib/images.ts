import { SITE_URL } from "./config";
import { isDrawing } from "./domain";

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)/;

/**
 * Where to load a part image from. Placeholder drawings (/parts/*.svg) are
 * served by the website. Cloudinary photos are stored at full size, so the
 * app asks Cloudinary for one sized to the well (the website's next/image
 * does the same job).
 */
export function imageUri(src: string | null | undefined, width: number): string | null {
  if (!src) return null;
  if (isDrawing(src)) return `${SITE_URL}${src}`;
  const px = Math.round(Math.min(1600, width) / 50) * 50 || 50;
  return src.replace(CLOUDINARY_UPLOAD, `$1f_auto,q_auto,c_limit,w_${px}/$2`);
}
