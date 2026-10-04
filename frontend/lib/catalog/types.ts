// Domain model. Mirrors CLAUDE.md section 5; change both together.

export type Make = "toyota" | "lexus";

export interface Vehicle {
  id: string; // 'toyota-camry-xv50-f'
  make: Make;
  model: string; // 'Camry'
  generation: string; // 'XV50'
  yearFrom: number;
  yearTo: number;
  facelift: boolean;
}

export type Category = "lights" | "bumpers" | "body" | "mirrors";

export type PartType =
  | "headlight"
  | "backlight"
  | "foglamp"
  | "front-bumper"
  | "back-bumper"
  | "foglamp-cover"
  | "hood"
  | "fender"
  | "door"
  | "front-grill"
  | "mirror";

export type Position =
  | "front"
  | "rear"
  | "front-left"
  | "front-right"
  | "rear-left"
  | "rear-right"
  | "left"
  | "right"
  | "inner-left"
  | "inner-right"
  | "outer-left"
  | "outer-right"
  | "n/a";

export type Condition =
  | "belgium-a"
  | "belgium-b"
  | "belgium-c"
  | "new-genuine"
  | "new-aftermarket";

export type ShippingClass = "small" | "medium" | "bulky" | "oversized";

export type PartStatus = "available" | "reserved" | "sold";

export interface Part {
  sku: string;
  name: string;
  category: Category;
  type: PartType;
  position: Position;
  condition: Condition;
  defects?: string[]; // required for belgium-b and belgium-c
  oemNumber?: string;
  variants: Record<string, string | boolean>;
  priceNGN: number;
  stockQty: number; // 1 for Belgium units
  status: PartStatus;
  stockCheckedAt: string; // ISO date
  shippingClass: ShippingClass;
  images: string[];
}

export interface Fitment {
  partSku: string;
  vehicleId: string;
  notes?: string;
}

export interface PartFilters {
  category?: Category;
  types?: PartType[];
  positions?: Position[];
  conditions?: Condition[];
  vehicleId?: string;
  includeSold?: boolean;
}

export const MAKES: readonly Make[] = ["toyota", "lexus"];
export const CATEGORIES: readonly Category[] = ["lights", "bumpers", "body", "mirrors"];
export const CONDITIONS: readonly Condition[] = [
  "belgium-a",
  "belgium-b",
  "belgium-c",
  "new-genuine",
  "new-aftermarket",
];
export const SHIPPING_CLASSES: readonly ShippingClass[] = ["small", "medium", "bulky", "oversized"];

export const CATEGORY_TYPES: Record<Category, readonly PartType[]> = {
  lights: ["headlight", "backlight", "foglamp"],
  bumpers: ["front-bumper", "back-bumper", "foglamp-cover"],
  body: ["hood", "fender", "door", "front-grill"],
  mirrors: ["mirror"],
};

export function isBelgium(condition: Condition): boolean {
  return condition.startsWith("belgium-");
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
