import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Fonts for next/og. Barlow has no ₦, so the one-glyph naira font is listed
// after it as a fallback, matching the site's font stack.
const fontDir = join(process.cwd(), "assets", "fonts");

export async function ogFonts() {
  const [display, body, nairaBold, nairaMedium] = await Promise.all([
    readFile(join(fontDir, "barlow-condensed-latin-700-normal.woff")),
    readFile(join(fontDir, "barlow-latin-500-normal.woff")),
    readFile(join(fontDir, "naira-700.woff")),
    readFile(join(fontDir, "naira-500.woff")),
  ]);
  return [
    { name: "Barlow Condensed", data: display, weight: 700 as const, style: "normal" as const },
    { name: "Barlow", data: body, weight: 500 as const, style: "normal" as const },
    { name: "Naira", data: nairaBold, weight: 700 as const, style: "normal" as const },
    { name: "Naira", data: nairaMedium, weight: 500 as const, style: "normal" as const },
  ];
}

/** The logo tile (white mark on its wine ground) as a data URI for satori. */
export async function ogLogoTile(): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public", "brand", "mark-tile.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

const CLOUDINARY_UPLOAD = "res.cloudinary.com/";
const UPLOAD_PATH = "/image/upload/";

/**
 * Placeholder drawings are local SVGs; inline them so satori needs no network.
 * Cloudinary photos are fetched already cropped to a `size` square, so the
 * image renders fast instead of pulling a 2000 px original.
 */
export async function ogImageSrc(src: string | undefined, size: number): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("/parts/") && src.endsWith(".svg")) {
    const svg = await readFile(join(process.cwd(), "public", src));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  }
  if (src.includes(CLOUDINARY_UPLOAD) && src.includes(UPLOAD_PATH)) {
    return src.replace(UPLOAD_PATH, `${UPLOAD_PATH}c_fill,w_${size},h_${size},q_auto/`);
  }
  return src.startsWith("http") ? src : null;
}

export const OG = {
  bay: "#ECEEF0",
  paper: "#FFFFFF",
  navy: "#051632",
  wine: "#4E1526",
  primer: "#8B9196",
} as const;
