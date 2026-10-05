import { ImageResponse } from "next/og";
import sharp from "sharp";

import { getPart } from "@/lib/catalog";
import { isDrawing } from "@/lib/catalog/images";
import { CONDITION_INFO, partTitle, plainText, stockLine } from "@/lib/catalog/labels";
import { normaliseSku } from "@/lib/catalog/sku";
import { isBelgium } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { formatNGN } from "@/lib/format";
import { OG, ogFonts, ogImageSrc, ogLogoTile } from "@/lib/og";

export const alt = "Part photo with price and condition";
export const size = { width: 1200, height: 630 };
// JPEG: with a photo in it the card is ~700 KB as PNG and ~70 KB as JPEG, and
// WhatsApp drops link previews whose image is much over 300 KB.
export const contentType = "image/jpeg";
const WELL = 534; // the square photo well, px

// What WhatsApp, Facebook and Instagram show when a part link is pasted.
export default async function Image({ params }: { params: Promise<{ sku: string }> }) {
  const sku = normaliseSku((await params).sku);
  const part = sku ? await getPart(sku) : null;
  const fonts = await ogFonts();

  if (!part) {
    return asJpeg(new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: OG.bay, alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed", fontSize: 72, color: OG.navy }}>
          {SITE.name}
        </div>
      ),
      { ...size, fonts },
    ));
  }

  const drawing = isDrawing(part.images[0]);
  const [image, logo] = await Promise.all([ogImageSrc(part.images[0], WELL), ogLogoTile()]);
  const flip = drawing && part.position.endsWith("left");
  const info = CONDITION_INFO[part.condition];

  return asJpeg(new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: OG.bay,
          padding: 48,
          gap: 48,
          color: OG.navy,
          fontFamily: "Barlow, Naira",
        }}
      >
        <div
          style={{
            display: "flex",
            width: WELL,
            height: WELL,
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
              width={drawing ? 400 : WELL}
              height={drawing ? 400 : WELL}
              style={{ objectFit: drawing ? "contain" : "cover", ...(flip ? { transform: "scaleX(-1)" } : {}) }}
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
                  background: isBelgium(part.condition) ? OG.wine : OG.paper,
                  color: isBelgium(part.condition) ? OG.paper : OG.navy,
                  border: `3px solid ${isBelgium(part.condition) ? OG.wine : OG.navy}`,
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
                alignItems: "center",
                gap: 14,
                marginTop: 28,
                paddingTop: 20,
                borderTop: `2px solid ${OG.primer}`,
                fontSize: 26,
              }}
            >
              <img src={logo} alt="" width={44} height={44} />
              {SITE.name}, Zuba Market, Abuja
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  ));
}

async function asJpeg(png: ImageResponse): Promise<Response> {
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const headers = new Headers(png.headers);
  headers.set("content-type", contentType);
  headers.delete("content-length");
  return new Response(new Uint8Array(jpeg), { status: png.status, headers });
}
