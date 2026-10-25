// Plain-text labels for text that leaves the API: order item names and emails.
//
// The frontend has richer display labels (word joiners, hints) in
// frontend/lib/catalog/labels.ts. Text produced here is already plain.

import type { Make, Position } from "./catalog.js";

export const POSITION_LABELS: Record<Position, string> = {
  front: "Front",
  rear: "Rear",
  "front-left": "Front-left",
  "front-right": "Front-right",
  "rear-left": "Rear-left",
  "rear-right": "Rear-right",
  left: "Left",
  right: "Right",
  "inner-left": "Inner left",
  "inner-right": "Inner right",
  "outer-left": "Outer left",
  "outer-right": "Outer right",
  "n/a": "Not applicable",
};

export const MAKE_LABELS: Record<Make, string> = {
  toyota: "Toyota",
  lexus: "Lexus",
  honda: "Honda",
  acura: "Acura",
  nissan: "Nissan",
  infiniti: "Infiniti",
  mazda: "Mazda",
  mitsubishi: "Mitsubishi",
  subaru: "Subaru",
  suzuki: "Suzuki",
  isuzu: "Isuzu",
  daihatsu: "Daihatsu",
};

/** 'Camry 2015–2017 headlight, front-right'. Front, rear and n/a are implied by the name. */
export function partTitle(name: string, position: Position): string {
  if (position === "n/a" || position === "front" || position === "rear") return name;
  return `${name}, ${POSITION_LABELS[position].toLowerCase()}`;
}

/** 'Toyota Camry 2015–2017' */
export function vehicleLabel(make: Make, model: string, yearFrom: number, yearTo: number): string {
  return `${MAKE_LABELS[make]} ${model} ${yearFrom}–${yearTo}`;
}

/** ₦185,000 */
export function formatNgn(amount: number): string {
  return `₦${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
