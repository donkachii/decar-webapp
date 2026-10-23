// SKU convention (CLAUDE.md section 5).
//
//     DCR-{MAKE}-{MODEL}-{GEN}{F|P}-{TYPE}-{POS}-{COND}[-U##]
//
// These tables are locked: never rename a code once a part has been sold under it.
// Add new codes, never edit old ones. Position "n/a" is XX so it can't be confused
// with condition NA. The -U## unit suffix is required for every Belgium unit and
// absent otherwise. The vehicle segment names the part's primary vehicle only; the
// fitment table is the source of truth for what a part fits.

import type { Condition, Make, PartType, Position } from "./catalog.js";

export const MAKE_CODES: Record<Make, string> = {
  toyota: "TOY",
  lexus: "LEX",
};

export const MODEL_CODES: Readonly<Record<string, string>> = {
  Camry: "CAM",
  Corolla: "COR",
  Highlander: "HLN",
  Sienna: "SIE",
  RAV4: "RAV",
  RX: "RX",
  ES: "ES",
  GX: "GX",
};

export const TYPE_CODES: Record<PartType, string> = {
  headlight: "HL",
  backlight: "BL",
  foglamp: "FG",
  "front-bumper": "FB",
  "back-bumper": "RB",
  "foglamp-cover": "FC",
  hood: "HD",
  fender: "FD",
  door: "DR",
  "front-grill": "GR",
  mirror: "MR",
};

export const POSITION_CODES: Record<Position, string> = {
  front: "F",
  rear: "R",
  "front-left": "FL",
  "front-right": "FR",
  "rear-left": "RL",
  "rear-right": "RR",
  left: "LH",
  right: "RH",
  "inner-left": "IL",
  "inner-right": "IR",
  "outer-left": "OL",
  "outer-right": "OR",
  "n/a": "XX",
};

export const CONDITION_CODES: Record<Condition, string> = {
  "belgium-a": "BA",
  "belgium-b": "BB",
  "belgium-c": "BC",
  "new-genuine": "NG",
  "new-aftermarket": "NA",
};

// Same expression as the parts_sku_format check constraint in prisma/migrations/0_init.
export const SKU_PATTERN =
  /^DCR-(TOY|LEX)-[A-Z0-9]+-[A-Z0-9]+[FP]-[A-Z]{2}-[A-Z]{1,2}-(BA|BB|BC|NG|NA)(-U[0-9]{2})?$/;
export const UNIT_SUFFIX = /-U([0-9]{2})$/;

export interface SkuParts {
  make: Make;
  model: string;
  generation: string;
  facelift: boolean;
  type: PartType;
  position: Position;
  condition: Condition;
  unit?: number | null;
}

export function buildSku({ make, model, generation, facelift, type, position, condition, unit }: SkuParts): string {
  const modelCode = MODEL_CODES[model];
  if (modelCode === undefined) throw new Error(`No SKU model code for ${model}`);
  const segments = [
    "DCR",
    MAKE_CODES[make],
    modelCode,
    `${generation.toUpperCase()}${facelift ? "F" : "P"}`,
    TYPE_CODES[type],
    POSITION_CODES[position],
    CONDITION_CODES[condition],
  ];
  if (unit !== undefined && unit !== null) segments.push(`U${String(unit).padStart(2, "0")}`);
  return segments.join("-");
}

export function isValidSku(sku: string): boolean {
  return SKU_PATTERN.test(sku);
}

/** Normalises a SKU from a URL or request body. Null when it cannot be a SKU. */
export function normaliseSku(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A stray % stays as it is, and the pattern turns it away.
  }
  const sku = decoded.trim().toUpperCase();
  return isValidSku(sku) ? sku : null;
}
