// Renders every logo file (favicon, header tile, app icons, splash) from the
// two masters in assets/brand/: white artwork on transparent. mark.svg is the
// swoosh, car and gear; logo.svg adds the words. The wine ground (the wine
// design token) is added here. After changing a master, run `pnpm brand` and
// commit what it writes.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const WINE = "#4E1526";
// Android masks the adaptive icon foreground to a circle 66 of its 108 dp wide.
const ANDROID_SAFE = 66 / 108;

const path = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const mark = await master("assets/brand/mark.svg");
const logo = await master("assets/brand/logo.svg");

const tile = (side) => square(mark, { side, width: side * 0.875, radius: side * 0.16 });
const appIcon = (side) => square(logo, { side, width: side * 0.62 });
// The whole logo, diagonal included, inside the safe circle.
const androidWidth = ((1024 * ANDROID_SAFE * logo.w) / Math.hypot(logo.w, logo.h)) * 0.96;
const android = square(logo, { side: 1024, width: androidWidth, clear: true });

const files = {
  "app/icon.svg": tile(64),
  "public/brand/mark-tile.svg": tile(64),
  "app/favicon.ico": ico(await Promise.all([16, 32, 48].map(async (n) => ({ size: n, data: await png(tile(n)) })))),
  "app/apple-icon.png": await png(appIcon(180), true),
  "../mobile/assets/images/icon.png": await png(appIcon(1024), true),
  "../mobile/assets/images/android-icon-foreground.png": await png(android),
  "../mobile/assets/images/android-icon-monochrome.png": await png(android),
  "../mobile/assets/images/splash-icon.png": await png(square(logo, { side: 1024, width: 1024 * 0.7, clear: true })),
  "../mobile/assets/images/mark-tile.png": await png(tile(132)),
};
for (const [file, data] of Object.entries(files)) {
  await writeFile(path(file), data);
  console.log(file);
}

async function master(file) {
  const svg = await readFile(path(file), "utf8");
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return { svg: svg.trim(), w, h };
}

function n(value) {
  return +value.toFixed(2);
}

/** The artwork `width` wide, centred on a `side` square: on wine, or on nothing when `clear`. */
function square(art, { side, width, radius = 0, clear = false }) {
  const height = (width * art.h) / art.w;
  const placed = art.svg.replace(
    "<svg ",
    `<svg x="${n((side - width) / 2)}" y="${n((side - height) / 2)}" width="${n(width)}" height="${n(height)}" `,
  );
  const ground = clear ? "" : `<rect width="${side}" height="${side}" rx="${n(radius)}" fill="${WINE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">${ground}${placed}</svg>\n`;
}

/** App stores reject icons with an alpha channel, so `opaque` drops it. */
async function png(svg, opaque = false) {
  const image = sharp(Buffer.from(svg));
  return (opaque ? image.flatten({ background: WINE }) : image).png({ compressionLevel: 9 }).toBuffer();
}

/** A .ico holding PNG images, which every current browser reads. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}
