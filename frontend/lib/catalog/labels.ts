import { isBelgium, type Category, type Condition, type Part, type PartType, type Position, type ShippingClass, type Vehicle } from "./types";

export const CONDITION_INFO: Record<
  Condition,
  { label: string; grade: string; meaning: string }
> = {
  "belgium-a": {
    label: "Belgium · Grade A",
    grade: "A",
    meaning: "Genuine, foreign-used, no visible defects.",
  },
  "belgium-b": {
    label: "Belgium · Grade B",
    grade: "B",
    meaning: "Genuine, foreign-used, minor cosmetic marks, fully functional.",
  },
  "belgium-c": {
    label: "Belgium · Grade C",
    grade: "C",
    meaning: "Genuine, foreign-used, visible wear or repair, priced accordingly.",
  },
  "new-genuine": {
    label: "New · Genuine",
    grade: "N",
    meaning: "New Toyota or Lexus original part.",
  },
  "new-aftermarket": {
    label: "New · Aftermarket",
    grade: "N",
    meaning: "New, made by a third-party manufacturer.",
  },
};

export const CATEGORY_INFO: Record<Category, { label: string; blurb: string }> = {
  lights: { label: "Lights", blurb: "Headlights, backlights and foglamps" },
  bumpers: { label: "Bumpers", blurb: "Front and back bumpers, foglamp covers" },
  body: { label: "Body", blurb: "Hoods, fenders, doors and front grills" },
  mirrors: { label: "Mirrors", blurb: "Side mirrors" },
};

export const TYPE_INFO: Record<PartType, { label: string; plural: string }> = {
  headlight: { label: "Headlight", plural: "Headlights" },
  backlight: { label: "Backlight", plural: "Backlights" },
  foglamp: { label: "Foglamp", plural: "Foglamps" },
  "front-bumper": { label: "Front bumper", plural: "Front bumpers" },
  "back-bumper": { label: "Back bumper", plural: "Back bumpers" },
  "foglamp-cover": { label: "Foglamp cover", plural: "Foglamp covers" },
  hood: { label: "Hood", plural: "Hoods" },
  fender: { label: "Fender", plural: "Fenders" },
  door: { label: "Door", plural: "Doors" },
  "front-grill": { label: "Front grill", plural: "Front grills" },
  mirror: { label: "Side mirror", plural: "Side mirrors" },
};

// Nigeria drives left-hand-drive cars, so left is the driver's side.
export const POSITION_INFO: Record<Position, { label: string; hint?: string }> = {
  front: { label: "Front" },
  rear: { label: "Rear" },
  "front-left": { label: "Front-left", hint: "Driver's side" },
  "front-right": { label: "Front-right", hint: "Passenger side" },
  "rear-left": { label: "Rear-left", hint: "Driver's side" },
  "rear-right": { label: "Rear-right", hint: "Passenger side" },
  left: { label: "Left", hint: "Driver's side" },
  right: { label: "Right", hint: "Passenger side" },
  "inner-left": { label: "Inner left", hint: "On the boot lid, driver's side" },
  "inner-right": { label: "Inner right", hint: "On the boot lid, passenger side" },
  "outer-left": { label: "Outer left", hint: "On the body, driver's side" },
  "outer-right": { label: "Outer right", hint: "On the body, passenger side" },
  "n/a": { label: "Not applicable" },
};

export const SHIPPING_CLASS_INFO: Record<ShippingClass, { label: string }> = {
  small: { label: "Small parcel" },
  medium: { label: "Medium parcel" },
  bulky: { label: "Bulky item" },
  oversized: { label: "Oversized item" },
};

const VARIANT_LABELS: Record<string, string> = {
  lamp: "Lamp type",
  drl: "Daytime running light",
  beams: "Beam layout",
  autoLevel: "Auto-levelling",
  powerFold: "Power fold",
  heated: "Heated glass",
  indicator: "Indicator",
  camera: "Camera",
  blindSpot: "Blind-spot light",
  fogLampHoles: "Foglamp holes",
  parkingSensorHoles: "Parking sensor holes",
  headlampWasherHoles: "Headlamp washer holes",
  fogLampHole: "Foglamp hole",
  chromeTrim: "Chrome trim",
  glass: "Glass included",
  regulator: "Window regulator included",
  trim: "Inner trim included",
  finish: "Finish",
  cameraMount: "Front camera mount",
  insulation: "Insulation pad",
  indicatorHole: "Indicator lamp hole",
  connector: "Plug",
  section: "Grill section",
};

export function variantLabel(key: string): string {
  return VARIANT_LABELS[key] ?? key;
}

export function variantValue(value: string | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

export function makeLabel(vehicle: Pick<Vehicle, "make">): string {
  return vehicle.make === "toyota" ? "Toyota" : "Lexus";
}

// U+2060 word joiners keep "2015–2017" on one line.
const JOIN = "\u2060";

export function yearRange(vehicle: Pick<Vehicle, "yearFrom" | "yearTo">): string {
  return `${vehicle.yearFrom}${JOIN}–${JOIN}${vehicle.yearTo}`;
}

function keepYearsTogether(text: string): string {
  return text.replace(/(\d{4})–(\d{4})/g, `$1${JOIN}–${JOIN}$2`);
}

/** Strips the invisible joiners for plain-text channels (OG images, messages). */
export function plainText(text: string): string {
  return text.replaceAll(JOIN, "");
}

/** "Camry 2015–2017" */
export function vehicleShortLabel(vehicle: Vehicle): string {
  return `${vehicle.model} ${yearRange(vehicle)}`;
}

/** "Toyota Camry 2015–2017" */
export function vehicleLabel(vehicle: Vehicle): string {
  return `${makeLabel(vehicle)} ${vehicleShortLabel(vehicle)}`;
}

/** "XV50, facelift" */
export function vehicleGenerationLabel(vehicle: Vehicle): string {
  return `${vehicle.generation}, ${vehicle.facelift ? "facelift" : "pre-facelift"}`;
}

/** "Camry 2015–2017 headlight, front-right" */
export function partTitle(part: { name: string; position: Position }): string {
  const name = keepYearsTogether(part.name);
  if (part.position === "n/a" || part.position === "front" || part.position === "rear") {
    return name;
  }
  return `${name}, ${POSITION_INFO[part.position].label.toLowerCase()}`;
}

export function stockLine(part: Pick<Part, "status" | "condition" | "stockQty">): string {
  if (part.status === "sold") return "Sold";
  if (part.status === "reserved") return "Reserved for another buyer";
  if (isBelgium(part.condition)) return "One unit available";
  return `${part.stockQty} in stock`;
}
