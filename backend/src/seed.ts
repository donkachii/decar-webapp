// The shop's catalog: vehicles, parts and their fitment, in seed/*.json.
//
//     pnpm seed --check   validate against CLAUDE.md section 3
//     pnpm seed           validate, then insert what's missing
//     pnpm seed --prune   also delete parts and vehicles no longer in seed/*.json
//
// A part with a null priceNGN or stockQty is a draft: checked, but kept off the
// site until the owner fills both in. Only vehicles that a live part fits are
// inserted, so the car picker never offers a car with nothing on the shelf.
// Inserts skip rows that already exist, so re-running never overwrites live stock
// status or prices. Parts on an order are never pruned.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { z } from "zod";

import { prisma } from "./db.js";
import {
  CATEGORIES,
  CATEGORY_TYPES,
  CONDITIONS,
  isBelgium,
  MAKES,
  PART_STATUSES,
  PART_TYPES,
  POSITIONS,
  SHIPPING_CLASSES,
  TYPE_POSITIONS,
} from "./domain/catalog.js";
import { buildSku, isValidSku, MODEL_CODES, UNIT_SUFFIX } from "./domain/sku.js";

export const SEED_DIR = fileURLToPath(new URL("../seed/", import.meta.url));

const SeedVehicle = z.strictObject({
  id: z.string(),
  make: z.enum(MAKES),
  model: z.string(),
  generation: z.string(),
  yearFrom: z.number().int(),
  yearTo: z.number().int(),
  facelift: z.boolean(),
});

const SeedPart = z.strictObject({
  sku: z.string(),
  name: z.string(),
  category: z.enum(CATEGORIES),
  type: z.enum(PART_TYPES),
  position: z.enum(POSITIONS),
  condition: z.enum(CONDITIONS),
  defects: z.array(z.string()).default([]),
  oemNumber: z.string().nullable().default(null),
  variants: z.record(z.string(), z.union([z.string(), z.boolean()])),
  // Null in a draft: the owner hasn't priced or counted it yet.
  priceNGN: z.number().int().nullable(),
  stockQty: z.number().int().nullable(),
  status: z.enum(PART_STATUSES),
  // Null means "when it goes live": filling in price and count is the stock check.
  stockCheckedAt: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).nullable().default(null),
  shippingClass: z.enum(SHIPPING_CLASSES),
  images: z.array(z.string()),
});

const SeedFitment = z.strictObject({
  partSku: z.string(),
  vehicleId: z.string(),
  notes: z.string().nullable().default(null),
});

export type SeedVehicle = z.output<typeof SeedVehicle>;
export type SeedPart = z.output<typeof SeedPart>;
export type SeedFitment = z.output<typeof SeedFitment>;

export interface Seed {
  vehicles: SeedVehicle[];
  parts: SeedPart[];
  fitment: SeedFitment[];
}

/** A priced and counted part, ready for the site. */
export type LivePart = SeedPart & { priceNGN: number; stockQty: number };

export function isLive(part: SeedPart): part is LivePart {
  return part.priceNGN !== null && part.stockQty !== null;
}

/** Parts the owner hasn't priced or counted yet. */
export function drafts(seed: Seed): SeedPart[] {
  return seed.parts.filter((p) => !isLive(p));
}

export class SeedFormatError extends Error {}

export function loadSeed(directory: string = SEED_DIR): Seed {
  const read = <S extends z.ZodType>(name: string, schema: S): z.output<S>[] => {
    const result = z.array(schema).safeParse(JSON.parse(readFileSync(join(directory, name), "utf8")));
    if (!result.success) {
      const problems = result.error.issues.map((i) => `${name} ${i.path.join(".")}: ${i.message}`);
      throw new SeedFormatError(problems.join("\n  "));
    }
    return result.data;
  };
  return {
    vehicles: read("vehicles.json", SeedVehicle),
    parts: read("parts.json", SeedPart),
    fitment: read("fitment.json", SeedFitment),
  };
}

/** Every problem found, in plain words. Empty when the seed follows the rules. */
export function checkSeed(seed: Seed): string[] {
  const errors: string[] = [];
  const vehicleIds = new Set(seed.vehicles.map((v) => v.id));
  const skus = new Set<string>();

  for (const v of seed.vehicles) {
    const expected = `${v.make}-${v.model.toLowerCase()}-${v.generation.toLowerCase()}-${v.facelift ? "f" : "p"}`;
    if (v.id !== expected) errors.push(`Vehicle ${v.id}: id should be ${expected}`);
    if (!(v.model in MODEL_CODES)) errors.push(`Vehicle ${v.id}: no SKU model code for ${v.model}`);
    if (v.yearFrom > v.yearTo) errors.push(`Vehicle ${v.id}: yearFrom after yearTo`);
  }

  const fits = new Set(seed.fitment.map((f) => `${f.partSku}|${f.vehicleId}`));

  for (const p of seed.parts) {
    if (skus.has(p.sku)) errors.push(`${p.sku}: duplicate SKU`);
    skus.add(p.sku);

    if (!isValidSku(p.sku)) errors.push(`${p.sku}: does not match the SKU pattern`);
    if (!CATEGORY_TYPES[p.category].includes(p.type)) errors.push(`${p.sku}: ${p.type} is not in ${p.category}`);
    if (!TYPE_POSITIONS[p.type].includes(p.position)) errors.push(`${p.sku}: ${p.type} cannot be ${p.position}`);

    const belgium = isBelgium(p.condition);
    const unit = UNIT_SUFFIX.exec(p.sku);
    if (belgium && !unit) errors.push(`${p.sku}: Belgium units need a -U## suffix`);
    if (!belgium && unit) errors.push(`${p.sku}: only Belgium units take a -U## suffix`);
    if (belgium && p.stockQty !== null && p.stockQty > 1) errors.push(`${p.sku}: Belgium units are one-offs (stockQty ≤ 1)`);
    if ((p.condition === "belgium-b" || p.condition === "belgium-c") && p.defects.length === 0) {
      errors.push(`${p.sku}: grade B and C units must list defects`);
    }
    if (p.stockQty !== null) {
      if (p.status === "sold" && p.stockQty !== 0) errors.push(`${p.sku}: sold units have stockQty 0`);
      if (p.status === "available" && p.stockQty < 1) errors.push(`${p.sku}: available units need stock`);
    }
    if (p.priceNGN !== null && p.priceNGN <= 0) errors.push(`${p.sku}: price must be above zero`);
    if (p.images.length === 0) errors.push(`${p.sku}: needs at least one image`);

    // The SKU's vehicle segment must name a real vehicle, and the part must fit it.
    const primary = seed.vehicles.find(
      (v) =>
        v.model in MODEL_CODES &&
        buildSku({
          make: v.make,
          model: v.model,
          generation: v.generation,
          facelift: v.facelift,
          type: p.type,
          position: p.position,
          condition: p.condition,
          unit: unit?.[1] ? Number(unit[1]) : null,
        }) === p.sku,
    );
    if (primary === undefined) {
      errors.push(`${p.sku}: no vehicle produces this SKU from its type, position and condition`);
    } else if (!fits.has(`${p.sku}|${primary.id}`)) {
      errors.push(`${p.sku}: has no fitment row for its own vehicle ${primary.id}`);
    }
  }

  const seen = new Set<string>();
  for (const f of seed.fitment) {
    if (!skus.has(f.partSku)) errors.push(`Fitment ${f.partSku}: unknown part`);
    if (!vehicleIds.has(f.vehicleId)) errors.push(`Fitment ${f.partSku}: unknown vehicle ${f.vehicleId}`);
    const key = `${f.partSku}|${f.vehicleId}`;
    if (seen.has(key)) errors.push(`Fitment ${key}: duplicate row`);
    seen.add(key);
  }

  return errors;
}

/** What goes in the database: priced parts, their fitment, and the vehicles they fit. */
export function liveRows(seed: Seed): { vehicles: SeedVehicle[]; parts: LivePart[]; fitment: SeedFitment[] } {
  const parts = seed.parts.filter(isLive);
  const skus = new Set(parts.map((p) => p.sku));
  const fitment = seed.fitment.filter((f) => skus.has(f.partSku));
  const fitted = new Set(fitment.map((f) => f.vehicleId));
  return { vehicles: seed.vehicles.filter((v) => fitted.has(v.id)), parts, fitment };
}

async function insertSeed(seed: Seed): Promise<void> {
  const { vehicles, parts, fitment } = liveRows(seed);
  if (parts.length === 0) return;
  // skipDuplicates is INSERT … ON CONFLICT DO NOTHING: rows already there keep
  // their stock status and price.
  await prisma.$transaction([
    prisma.vehicle.createMany({ data: vehicles, skipDuplicates: true }),
    prisma.part.createMany({
      data: parts.map(({ stockCheckedAt, oemNumber, ...part }) => ({
        ...part,
        ...(oemNumber === null ? {} : { oemNumber }),
        // Null takes the column default, now().
        ...(stockCheckedAt === null ? {} : { stockCheckedAt: new Date(stockCheckedAt) }),
      })),
      skipDuplicates: true,
    }),
    prisma.fitment.createMany({ data: fitment, skipDuplicates: true }),
  ]);
}

/**
 * Deletes parts and vehicles that seed/*.json no longer lists (fitment goes with
 * them). Parts on an order stay, so order history keeps its links; mark those
 * sold in /admin.
 */
async function prune(seed: Seed): Promise<{ deleted: string[]; kept: string[]; vehiclesGone: string[] }> {
  const skus = seed.parts.map((p) => p.sku);
  const vehicleIds = seed.vehicles.map((v) => v.id);
  return prisma.$transaction(async (tx) => {
    const stale = (await tx.part.findMany({ where: { sku: { notIn: skus } }, select: { sku: true } })).map((p) => p.sku);
    const ordered = new Set(
      (await tx.orderItem.findMany({ where: { sku: { in: stale } }, select: { sku: true }, distinct: ["sku"] })).map((i) => i.sku),
    );
    const deleted = stale.filter((sku) => !ordered.has(sku)).sort();
    if (deleted.length > 0) await tx.part.deleteMany({ where: { sku: { in: deleted } } });
    const vehiclesGone = (await tx.vehicle.findMany({ where: { id: { notIn: vehicleIds } }, select: { id: true } })).map((v) => v.id).sort();
    if (vehiclesGone.length > 0) await tx.vehicle.deleteMany({ where: { id: { in: vehiclesGone } } });
    return { deleted, kept: [...ordered].sort(), vehiclesGone };
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean", default: false },
      prune: { type: "boolean", default: false },
      dir: { type: "string", default: SEED_DIR },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(`pnpm seed [--check] [--prune] [--dir <catalog folder, default ${SEED_DIR}>]`);
    return;
  }

  let seed: Seed;
  try {
    seed = loadSeed(values.dir);
  } catch (error) {
    if (error instanceof SeedFormatError) {
      console.error(`✗ seed/*.json doesn't match the catalog format:\n  ${error.message}`);
      process.exit(1);
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.error(`✗ No catalog in ${values.dir} (vehicles.json, parts.json, fitment.json)`);
      process.exit(1);
    }
    throw error;
  }
  const errors = checkSeed(seed);
  if (errors.length > 0) {
    console.error(`✗ ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  const { vehicles, parts, fitment } = liveRows(seed);
  const summary = `${vehicles.length} vehicles, ${parts.length} parts, ${fitment.length} fitment rows`;
  const waiting = drafts(seed);
  if (waiting.length > 0) {
    console.log(`… ${waiting.length} draft part(s) stay off the site until priceNGN and stockQty are set:`);
    console.log(`  ${waiting.map((p) => p.sku).join("\n  ")}`);
  }
  if (values.check) {
    console.log(`✓ ${summary} ready to go live`);
    return;
  }

  try {
    if (values.prune) {
      const { deleted, kept, vehiclesGone } = await prune(seed);
      console.log(`✓ Pruned ${deleted.length} part(s) and ${vehiclesGone.length} vehicle(s) no longer in seed/`);
      if (kept.length > 0) {
        console.log(`  Kept because they are on an order (mark them sold in /admin):\n  ${kept.join("\n  ")}`);
      }
    }
    await insertSeed(seed);
  } finally {
    await prisma.$disconnect();
  }
  console.log(`✓ Seeded ${summary} (existing rows left as they are)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
