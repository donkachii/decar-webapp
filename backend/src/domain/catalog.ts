// Domain vocabulary. Mirrors CLAUDE.md section 5; change both together.
//
// The frontend keeps the same unions in frontend/lib/catalog/types.ts. The API is
// the authority: anything priced, reserved or validated is decided here.

export const MAKES = [
  "toyota",
  "lexus",
  "honda",
  "acura",
  "nissan",
  "infiniti",
  "mazda",
  "mitsubishi",
  "subaru",
  "suzuki",
  "isuzu",
  "daihatsu",
] as const;
export const CATEGORIES = ["lights", "bumpers", "body", "mirrors"] as const;
export const PART_TYPES = [
  "headlight",
  "backlight",
  "foglamp",
  "front-bumper",
  "back-bumper",
  "foglamp-cover",
  "hood",
  "fender",
  "door",
  "front-grill",
  "mirror",
] as const;
export const POSITIONS = [
  "front",
  "rear",
  "front-left",
  "front-right",
  "rear-left",
  "rear-right",
  "left",
  "right",
  "inner-left",
  "inner-right",
  "outer-left",
  "outer-right",
  "n/a",
] as const;
export const CONDITIONS = ["belgium-a", "belgium-b", "belgium-c", "new-genuine", "new-aftermarket"] as const;
export const SHIPPING_CLASSES = ["small", "medium", "bulky", "oversized"] as const;
export const PART_STATUSES = ["available", "reserved", "sold"] as const;

export type Make = (typeof MAKES)[number];
export type Category = (typeof CATEGORIES)[number];
export type PartType = (typeof PART_TYPES)[number];
export type Position = (typeof POSITIONS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type ShippingClass = (typeof SHIPPING_CLASSES)[number];
export type PartStatus = (typeof PART_STATUSES)[number];

export const CATEGORY_TYPES: Record<Category, readonly PartType[]> = {
  lights: ["headlight", "backlight", "foglamp"],
  bumpers: ["front-bumper", "back-bumper", "foglamp-cover"],
  body: ["hood", "fender", "door", "front-grill"],
  mirrors: ["mirror"],
};

// Rule 2: position is its own field. Which positions each part type may use, so
// a door can never be "front" and a hood never "front-left". Outer = body-mounted,
// inner = boot-lid-mounted; one-piece backlights use rear-left/right.
export const TYPE_POSITIONS: Record<PartType, readonly Position[]> = {
  headlight: ["front-left", "front-right"],
  backlight: ["outer-left", "outer-right", "inner-left", "inner-right", "rear-left", "rear-right"],
  foglamp: ["front-left", "front-right"],
  "front-bumper": ["front"],
  "back-bumper": ["rear"],
  "foglamp-cover": ["front-left", "front-right"],
  hood: ["front"],
  fender: ["front-left", "front-right"],
  door: ["front-left", "front-right", "rear-left", "rear-right"],
  "front-grill": ["front"],
  mirror: ["left", "right"],
};

/** Rule 4: Belgium units are one-offs with their own photos, grade and SKU suffix. */
export function isBelgium(condition: string): boolean {
  return condition.startsWith("belgium-");
}

/** Narrows a database text column to its union. The check constraints keep other values out. */
export function oneOf<T extends string>(values: readonly T[], value: string): T {
  if (!(values as readonly string[]).includes(value)) throw new Error(`Unexpected value ${value}`);
  return value as T;
}
