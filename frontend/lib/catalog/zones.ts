import type { PartType, Position } from "./types";

// Which positions each part type may use, so a door can never be "front" and a
// hood never "front-left". Drives the listing's position filter; the backend's
// copy (backend/app/domain/catalog.py) checks the seed data. Change both.
export const TYPE_POSITIONS: Record<PartType, readonly Position[]> = {
  headlight: ["front-left", "front-right"],
  // Outer = body-mounted, inner = boot-lid-mounted. One-piece lamps use rear-left/right.
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

export type Zone =
  | "front-left"
  | "front"
  | "front-right"
  | "left"
  | "right"
  | "rear-left"
  | "rear"
  | "rear-right";

export const ZONES: readonly Zone[] = [
  "front-left",
  "front",
  "front-right",
  "left",
  "right",
  "rear-left",
  "rear",
  "rear-right",
];

export const ZONE_LABELS: Record<Zone, string> = {
  "front-left": "Front-left",
  front: "Front",
  "front-right": "Front-right",
  left: "Left side",
  right: "Right side",
  "rear-left": "Rear-left",
  rear: "Rear",
  "rear-right": "Rear-right",
};

/**
 * Damage-selector zone for a part. Doors and mirrors belong to the side zones;
 * everything else follows its position.
 */
export function zoneFor(type: PartType, position: Position): Zone | null {
  if (type === "door" || type === "mirror") {
    if (position.endsWith("left")) return "left";
    if (position.endsWith("right")) return "right";
    return null;
  }
  switch (position) {
    case "front":
    case "front-left":
    case "front-right":
    case "rear":
      return position;
    case "rear-left":
    case "inner-left":
    case "outer-left":
      return "rear-left";
    case "rear-right":
    case "inner-right":
    case "outer-right":
      return "rear-right";
    default:
      return null;
  }
}

export function isZone(value: string): value is Zone {
  return (ZONES as readonly string[]).includes(value);
}
