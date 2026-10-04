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

/** Placeholder drawings are local SVGs; inline them so satori needs no network. */
export async function ogImageSrc(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("/parts/") && src.endsWith(".svg")) {
    const svg = await readFile(join(process.cwd(), "public", src));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  }
  return src.startsWith("http") ? src : null;
}

export const OG = {
  bay: "#ECEEF0",
  paper: "#FFFFFF",
  graphite: "#23272B",
  primer: "#8B9196",
} as const;
