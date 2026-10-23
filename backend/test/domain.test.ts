// SKUs, checkout validation, delivery fees, photo rules and Cloudinary signing. No database needed.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { cleanLines, normalisePhone, validateCheckout } from "../src/domain/checkout.js";
import { deliveryFee } from "../src/domain/delivery.js";
import { formatNgn, partTitle } from "../src/domain/labels.js";
import { adminPhotoName, isAdminPhoto, keptPhotos, MAX_PART_PHOTOS, withPhoto } from "../src/domain/photos.js";
import { buildSku, isValidSku, normaliseSku } from "../src/domain/sku.js";
import { planPhotos } from "../src/photos.js";
import { CheckoutIn } from "../src/schemas.js";
import { parseCloudinaryUrl, sign } from "../src/services/cloudinary.js";

test("SKUs follow the locked convention", () => {
  const sku = buildSku({
    make: "toyota",
    model: "Camry",
    generation: "xv50",
    facelift: true,
    type: "headlight",
    position: "front-right",
    condition: "belgium-a",
    unit: 1,
  });
  assert.equal(sku, "DCR-TOY-CAM-XV50F-HL-FR-BA-U01");
  assert.equal(isValidSku("DCR-LEX-RX-AL20P-FB-F-NA"), true);
  // Position n/a is XX, so it can't be confused with condition NA.
  assert.equal(isValidSku("DCR-LEX-RX-AL20P-FB-XX-NA"), true);
  assert.equal(normaliseSku(" dcr-toy-cam-xv50f-hl-fr-ba-u01 "), "DCR-TOY-CAM-XV50F-HL-FR-BA-U01");
  assert.equal(normaliseSku("DCR-TOY-CAM-XV50F-HL-FR-BA%2DU01"), "DCR-TOY-CAM-XV50F-HL-FR-BA-U01");
  assert.equal(normaliseSku("100%"), null);
});

test("Nigerian phone numbers normalise like the Python backend did", () => {
  const cases: [string, string | null][] = [
    ["0803 123 4567", "+2348031234567"],
    ["803 123 4567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["234-803-123-4567", "+2348031234567"],
    ["(0803) 123-4567", "+2348031234567"],
    ["0803123456", null],
    ["12345", null],
  ];
  for (const [raw, expected] of cases) assert.equal(normalisePhone(raw), expected, raw);
});

test("checkout keeps one line per valid SKU, last one wins, at most 20 each", () => {
  const lines = cleanLines([
    { sku: "DCR-TOY-CAM-XV50F-HL-FR-BA-U01", qty: 1 },
    { sku: "junk", qty: 1 },
    { sku: "DCR-LEX-RX-AL20P-FB-F-NA", qty: 21 },
    { sku: "dcr-toy-cam-xv50f-hl-fr-ba-u01", qty: 2 },
  ]);
  assert.deepEqual(lines, [{ sku: "DCR-TOY-CAM-XV50F-HL-FR-BA-U01", qty: 2 }]);
});

test("checkout errors map to form fields in the form's words", () => {
  const form = CheckoutIn.parse({
    name: "A",
    phone: "123",
    delivery: "waybill",
    payment: "paystack",
    lines: [{ sku: "DCR-LEX-RX-AL20P-FB-F-NA", qty: 1 }],
  });
  assert.deepEqual(validateCheckout(form, { paystackEnabled: false }), {
    message: "Check the highlighted fields.",
    fieldErrors: {
      name: "Enter your name.",
      phone: "Enter a Nigerian phone number, like 0803 123 4567.",
      state: "Enter the destination state.",
      park: "Enter the park where you'll collect it.",
      payment: "Card payment isn't available yet. Choose to pay later.",
      email: "Paystack needs an email address for your receipt.",
    },
  });
  assert.deepEqual(validateCheckout(CheckoutIn.parse({}), { paystackEnabled: false }), {
    message: "Your cart is empty.",
    fieldErrors: {},
  });
});

test("one delivery fee per order, set by the largest item", () => {
  assert.equal(deliveryFee("abuja", ["small", "bulky", "medium"]), 8000);
  assert.equal(deliveryFee("pickup", ["oversized"]), 0);
  assert.equal(deliveryFee("waybill", []), 0);
});

test("labels are plain text", () => {
  assert.equal(formatNgn(185000), "₦185,000");
  assert.equal(formatNgn(1234567), "₦1,234,567");
  assert.equal(partTitle("Camry 2015–2017 headlight", "front-right"), "Camry 2015–2017 headlight, front-right");
  assert.equal(partTitle("Camry 2015–2017 hood", "front"), "Camry 2015–2017 hood");
});

test("Cloudinary signatures match the Python backend's", () => {
  const params = { public_id: "decar/parts/X/01", timestamp: "1700000000", overwrite: "true", format: "jpg" };
  assert.equal(sign(params, "abcd1234secret"), "12b3124986de733f8de0cd77c06531b7a2cf31bf");
  assert.deepEqual(parseCloudinaryUrl("CLOUDINARY_URL=cloudinary://12345:s%2Fecret@my-cloud"), {
    cloudName: "my-cloud",
    apiKey: "12345",
    apiSecret: "s/ecret",
  });
  assert.throws(() => parseCloudinaryUrl("cloudinary://<api_key>:<api_secret>@demo"), /placeholder/);
  assert.throws(() => parseCloudinaryUrl("https://example.com"), /should look like/);
});

test("photo folders map to Cloudinary ids and parts", () => {
  const root = mkdtempSync(join(tmpdir(), "dcr-photos-"));
  mkdirSync(join(root, "parts", "DCR-TOY-CAM-XV50F-HL-FR-BA-U01"), { recursive: true });
  mkdirSync(join(root, "library", "new stock"), { recursive: true });
  writeFileSync(join(root, "parts", "DCR-TOY-CAM-XV50F-HL-FR-BA-U01", "02.jpg"), "");
  writeFileSync(join(root, "parts", "DCR-TOY-CAM-XV50F-HL-FR-BA-U01", "01.HEIC"), "");
  writeFileSync(join(root, "parts", "DCR-TOY-CAM-XV50F-HL-FR-BA-U01", "notes.txt"), "");
  writeFileSync(join(root, "library", "new stock", "a.jpg"), "");
  const plan = planPhotos(root);
  assert.deepEqual(plan.links.get("DCR-TOY-CAM-XV50F-HL-FR-BA-U01"), [
    "decar/parts/DCR-TOY-CAM-XV50F-HL-FR-BA-U01/01",
    "decar/parts/DCR-TOY-CAM-XV50F-HL-FR-BA-U01/02",
  ]);
  assert.deepEqual(plan.errors, ["library/new stock/a.jpg: rename 'new stock' (letters, digits, - and _ only)"]);
});

test("the first photo added in /admin replaces the drawing", () => {
  const src = "https://res.cloudinary.com/demo/image/upload/v1/decar/parts/X/admin-mh3k2x9a3f1c2b.jpg";
  assert.deepEqual(withPhoto(["/parts/hood.svg"], src), [src]);
  assert.deepEqual(withPhoto(["a.jpg"], src), ["a.jpg", src]);
  assert.equal(withPhoto(Array.from({ length: MAX_PART_PHOTOS }, (_, i) => `${i}.jpg`), src), null);
});

test("a part's photos can be reordered and removed, never swapped for others", () => {
  assert.deepEqual(keptPhotos(["a.jpg", "b.jpg", "c.jpg"], ["c.jpg", "a.jpg"], "hood"), ["c.jpg", "a.jpg"]);
  // None left: the drawing comes back.
  assert.deepEqual(keptPhotos(["a.jpg"], [], "fender"), ["/parts/fender.svg"]);
  assert.equal(keptPhotos(["a.jpg"], ["https://elsewhere.example/x.jpg"], "hood"), null);
  assert.equal(keptPhotos(["a.jpg", "b.jpg"], ["a.jpg", "a.jpg"], "hood"), null);
  assert.equal(keptPhotos(["/parts/hood.svg"], ["/parts/hood.svg"], "hood"), null);
});

test("pnpm photos can tell /admin photos from its own", () => {
  const name = adminPhotoName(1_761_000_000_000, "3f1c2b");
  assert.match(name, /^admin-[a-z0-9]+$/);
  assert.equal(isAdminPhoto(`https://res.cloudinary.com/demo/image/upload/v2/decar/parts/X/${name}.jpg`), true);
  assert.equal(isAdminPhoto("https://res.cloudinary.com/demo/image/upload/v2/decar/parts/X/01.jpg"), false);
  assert.equal(isAdminPhoto("/parts/hood.svg"), false);
});
