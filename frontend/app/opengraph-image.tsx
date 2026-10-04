import { ImageResponse } from "next/og";

import { SITE } from "@/lib/config/site";
import { OG, ogFonts } from "@/lib/og";

export const alt = "The right part for your Toyota or Lexus. First time.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: OG.bay,
          padding: 64,
          color: OG.graphite,
          fontFamily: "Barlow",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "Barlow Condensed", fontSize: 36 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 8,
              background: OG.graphite,
              color: OG.paper,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            DC
          </div>
          {SITE.name}
        </div>
        <div style={{ display: "flex", fontFamily: "Barlow Condensed", fontSize: 112, lineHeight: 0.95, maxWidth: 1000 }}>
          The right part for your Toyota or Lexus. First time.
        </div>
        <div style={{ display: "flex", fontSize: 30, borderTop: `2px solid ${OG.primer}`, paddingTop: 24 }}>
          Genuine Belgium and new body parts from Zuba Market, Abuja
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
