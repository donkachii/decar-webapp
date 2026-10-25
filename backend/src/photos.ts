// Part photos: upload the photos/ folder to Cloudinary and link each part to its own photos.
//
//     pnpm photos --check     check the folder and SKUs, upload nothing
//     pnpm photos             upload new photos, then link parts to them
//     pnpm photos --replace   upload every photo again (after editing one)
//
// The folder sits at the repo root, beside backend/ and frontend/:
//
//     photos/parts/<SKU>/01.jpg, 02.jpg …   one folder per part, named by its SKU.
//                                            Sorted by name; the first is the card photo.
//     photos/library/…                       everything else. Uploaded, never linked.
//
// Each photo goes to Cloudinary as decar/<its path without the extension>, so the
// Media Library mirrors this folder. Linking sets a part's images to its folder's
// photos; parts without a folder keep theirs, and so do parts with photos added
// in /admin, which only Cloudinary has. Folders for draft parts (in seed/
// without a price or stock count yet) are skipped until the part is live. Files
// that aren't photos (notes, videos) are ignored. Needs CLOUDINARY_URL, except
// for --check.

import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { getSettings } from "./config.js";
import { prisma } from "./db.js";
import { isAdminPhoto } from "./domain/photos.js";
import { isValidSku } from "./domain/sku.js";
import { drafts, loadSeed } from "./seed.js";
import * as cloudinary from "./services/cloudinary.js";

const PHOTOS_DIR = fileURLToPath(new URL("../../photos/", import.meta.url));
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
// Names become URL paths: keep them plain so links paste cleanly into WhatsApp.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const PARALLEL_UPLOADS = 4;

interface Photo {
  path: string;
  publicId: string;
}

interface Plan {
  photos: Photo[];
  links: Map<string, string[]>; // SKU → public ids, card photo first
  errors: string[];
}

/** Every file under root, as path segments relative to it, sorted like Python's sorted(Path.rglob()). */
function walk(root: string): string[][] {
  const files: string[][] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() || (entry.isSymbolicLink() && statSync(full).isFile())) {
        files.push(relative(root, full).split(sep));
      }
    }
  };
  visit(root);
  return files.sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const [x, y] = [a[i] as string, b[i] as string];
      if (x !== y) return x < y ? -1 : 1;
    }
    return a.length - b.length;
  });
}

/** Every photo under root with its Cloudinary public id, and the part it belongs to. */
export function planPhotos(root: string): Plan {
  const plan: Plan = { photos: [], links: new Map(), errors: [] };
  for (const parts of walk(root)) {
    const rel = parts.join("/");
    const name = parts.at(-1) as string;
    const ext = extname(name);
    if (!EXTENSIONS.has(ext.toLowerCase())) continue;
    if (parts.some((part) => part.startsWith("."))) continue;
    const segments = [...parts.slice(0, -1), basename(name, ext)];
    const bad = segments.find((s) => !SAFE_NAME.test(s));
    if (bad !== undefined) {
      plan.errors.push(`${rel}: rename '${bad}' (letters, digits, - and _ only)`);
      continue;
    }
    const publicId = [cloudinary.ROOT, ...segments].join("/");
    if (parts[0] === "parts") {
      if (parts.length !== 3) {
        plan.errors.push(`${rel}: part photos go directly in parts/<SKU>/`);
        continue;
      }
      const sku = parts[1] as string;
      if (!isValidSku(sku)) {
        plan.errors.push(`${rel}: ${sku} is not a valid SKU`);
        continue;
      }
      plan.links.set(sku, [...(plan.links.get(sku) ?? []), publicId]);
    }
    plan.photos.push({ path: join(root, ...parts), publicId });
  }

  const counts = new Map<string, number>();
  for (const photo of plan.photos) counts.set(photo.publicId, (counts.get(photo.publicId) ?? 0) + 1);
  for (const [publicId, n] of counts) {
    if (n > 1) plan.errors.push(`${publicId}: two files share this name with different extensions`);
  }
  return plan;
}

/** Leaves these parts' folders out of the upload and the linking. */
function skipFolders(plan: Plan, skus: readonly string[]): void {
  const skipped = new Set(skus.flatMap((sku) => plan.links.get(sku) ?? []));
  for (const sku of skus) plan.links.delete(sku);
  plan.photos = plan.photos.filter((p) => !skipped.has(p.publicId));
}

async function knownSkus(skus: string[]): Promise<Set<string>> {
  const parts = await prisma.part.findMany({ where: { sku: { in: skus } }, select: { sku: true } });
  return new Set(parts.map((p) => p.sku));
}

/** Uploads photos not on Cloudinary yet (all of them with replace). Returns publicId → version for every photo. */
async function uploadMissing(account: cloudinary.Account, photos: Photo[], replace: boolean): Promise<Map<string, number>> {
  const versions = await cloudinary.uploadedVersions(account);
  const todo = photos.filter((p) => replace || !versions.has(p.publicId));
  const queue = [...todo];
  const failures: unknown[] = [];
  // Four at a time. After a failure the rest stay queued for the next run.
  const worker = async (): Promise<void> => {
    for (let photo = queue.shift(); photo && failures.length === 0; photo = queue.shift()) {
      try {
        const data = await readFile(photo.path);
        versions.set(photo.publicId, await cloudinary.upload(account, { publicId: photo.publicId, filename: basename(photo.path), data }));
        console.log(`  ↑ ${photo.publicId}`);
      } catch (error) {
        failures.push(error);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_UPLOADS }, worker));
  if (failures.length > 0) throw new AggregateError(failures);
  console.log(`✓ ${todo.length} uploaded, ${photos.length - todo.length} already on Cloudinary`);
  return versions;
}

/** Sets each linked part's images to its folder's photos. Returns the SKUs that changed. */
async function linkParts(
  account: cloudinary.Account,
  links: Map<string, string[]>,
  versions: Map<string, number>,
): Promise<string[]> {
  const changed: string[] = [];
  const kept: string[] = [];
  const parts = await prisma.part.findMany({ where: { sku: { in: [...links.keys()] } }, select: { sku: true, images: true } });
  for (const part of parts) {
    // Relinking would drop photos the owner added in /admin; that part is managed there now.
    if (part.images.some(isAdminPhoto)) {
      kept.push(part.sku);
      continue;
    }
    const images = (links.get(part.sku) ?? []).map((id) => cloudinary.deliveryUrl(account, id, versions.get(id) ?? 0));
    if (JSON.stringify(part.images) !== JSON.stringify(images)) {
      await prisma.part.update({ where: { sku: part.sku }, data: { images } });
      changed.push(part.sku);
    }
  }
  if (kept.length > 0) {
    console.log(`… ${kept.length} part(s) left as they are: their photos are managed in /admin${kept.sort().map((sku) => `\n  ${sku}`).join("")}`);
  }
  return changed.sort();
}

class Stop extends Error {}

/** A failure worth one line instead of a stack trace: a stop, Cloudinary refusing, or the network. */
function isExpected(error: unknown): error is Error {
  return (
    error instanceof Stop ||
    error instanceof cloudinary.CloudinaryError ||
    (error instanceof TypeError && error.message === "fetch failed") ||
    (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))
  );
}

async function run(root: string, { check, replace }: { check: boolean; replace: boolean }): Promise<void> {
  const plan = planPhotos(root);
  // Every SKU folder must name a real part before anything uploads, so a typo
  // never leaves photos on Cloudinary that nothing links to. Folders for draft
  // parts (in seed/ but not priced yet) wait until the part goes live.
  if (plan.links.size > 0) {
    const known = await knownSkus([...plan.links.keys()]);
    const missing = [...plan.links.keys()].filter((sku) => !known.has(sku));
    const draftSkus = new Set(drafts(loadSeed()).map((p) => p.sku));
    const waiting = missing.filter((sku) => draftSkus.has(sku)).sort();
    for (const sku of missing.filter((sku) => !draftSkus.has(sku)).sort()) {
      plan.errors.push(`parts/${sku}: no part with this SKU in the database; add the part first`);
    }
    if (waiting.length > 0) {
      skipFolders(plan, waiting);
      console.log(`… ${waiting.length} draft part folder(s) skipped until the part has a price and stock count`);
    }
  }
  if (plan.errors.length > 0) throw new Stop(`✗ ${plan.errors.length} problem(s):\n  ${plan.errors.join("\n  ")}`);

  const linked = [...plan.links.values()].reduce((n, ids) => n + ids.length, 0);
  const summary = `${plan.photos.length} photos, ${linked} of them for ${plan.links.size} parts`;
  if (check) {
    console.log(`✓ ${summary}. Nothing uploaded.`);
    return;
  }

  const settings = getSettings();
  if (!settings.cloudinaryEnabled) throw new Stop("✗ Set CLOUDINARY_URL in backend/.env first (see .env.example).");
  const account = cloudinary.parseCloudinaryUrl(settings.cloudinaryUrl);
  console.log(`${summary} → Cloudinary account ${account.cloudName}`);
  const versions = await uploadMissing(account, plan.photos, replace);
  const changed = await linkParts(account, plan.links, versions);
  console.log(`✓ Linked ${changed.length} part(s)${changed.map((sku) => `\n  ${sku}`).join("")}`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean", default: false },
      replace: { type: "boolean", default: false },
      dir: { type: "string", default: PHOTOS_DIR },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(`pnpm photos [--check] [--replace] [--dir <photos folder, default ${PHOTOS_DIR}>]`);
    return;
  }
  let isDir = false;
  try {
    isDir = statSync(values.dir).isDirectory();
  } catch {
    // Missing: reported below.
  }
  if (!isDir) {
    console.error(`✗ No photos folder at ${values.dir}`);
    process.exit(1);
  }
  try {
    await run(values.dir, { check: values.check, replace: values.replace });
  } catch (error) {
    // Photos that made it are skipped next time, so just run it again.
    const errors: unknown[] = error instanceof AggregateError ? error.errors : [error];
    if (!errors.every(isExpected)) throw error;
    console.error(errors.map((e) => (e instanceof Stop ? e.message : `✗ ${e.message}`)).join("\n"));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
