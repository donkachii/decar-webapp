import { ImageResponse } from "next/og";

import { getPart } from "@/lib/catalog";
import { CONDITION_INFO, partTitle, plainText, stockLine } from "@/lib/catalog/labels";
import { normaliseSku } from "@/lib/catalog/sku";
import { isBelgium } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { formatNGN } from "@/lib/format";
import { OG, ogFonts, ogImageSrc } from "@/lib/og";

export const alt = "Part photo with price and condition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// What WhatsApp, Facebook and Instagram show when a part link is pasted.
export default async function Image({ params }: { params: Promise<{ sku: string }> }) {
  const sku = normaliseSku((await params).sku);
  const part = sku ? await getPart(sku) : null;
  const fonts = await ogFonts();

  if (!part) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: OG.bay, alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed", fontSize: 72, color: OG.graphite }}>
          {SITE.name}
        </div>
      ),
      { ...size, fonts },
    );
  }

  const image = await ogImageSrc(part.images[0]);
  const drawing = part.images[0]?.startsWith("/parts/") ?? false;
  const flip = drawing && part.position.endsWith("left");
  const info = CONDITION_INFO[part.condition];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: OG.bay,
          padding: 48,
          gap: 48,
          color: OG.graphite,
          fontFamily: "Barlow, Naira",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 534,
            height: 534,
            flexShrink: 0,
            background: OG.paper,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {image ? (
            <img
              src={image}
              alt=""
              width={drawing ? 400 : 534}
              height={drawing ? 400 : 534}
              style={{ objectFit: "contain", ...(flip ? { transform: "scaleX(-1)" } : {}) }}
            />
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
              <div
                style={{
                  display: "flex",
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Barlow Condensed",
                  fontSize: 28,
                  background: isBelgium(part.condition) ? OG.graphite : OG.paper,
                  color: isBelgium(part.condition) ? OG.paper : OG.graphite,
                  border: `3px solid ${OG.graphite}`,
                }}
              >
                {info.grade}
              </div>
              {info.label}
            </div>
            <div style={{ display: "flex", marginTop: 28, fontFamily: "Barlow Condensed", fontSize: 68, lineHeight: 1 }}>
              {plainText(partTitle(part))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Barlow Condensed, Naira", fontSize: 104, lineHeight: 1 }}>
              {formatNGN(part.priceNGN)}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 28 }}>{stockLine(part)}</div>
            <div
              style={{
                display: "flex",
                marginTop: 28,
                paddingTop: 20,
                borderTop: `2px solid ${OG.primer}`,
                fontSize: 26,
              }}
            >
              {SITE.name}, Zuba Market, Abuja
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
