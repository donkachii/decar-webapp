import type { Part, PartType, Position } from "./types";

// "Usually replaced together": what a panel beater fits in the same job.
// Order matters; earlier types are shown first.
const REPLACED_WITH: Record<PartType, readonly PartType[]> = {
  "front-bumper": ["foglamp-cover", "foglamp", "front-grill", "headlight"],
  "foglamp-cover": ["foglamp", "front-bumper"],
  foglamp: ["foglamp-cover", "front-bumper"],
  headlight: ["headlight", "front-grill", "fender"],
  backlight: ["backlight", "back-bumper"],
  "back-bumper": ["backlight"],
  hood: ["front-grill", "headlight", "front-bumper"],
  fender: ["headlight", "front-bumper", "door"],
  door: ["mirror", "door", "fender"],
  "front-grill": ["front-bumper", "hood", "headlight"],
  mirror: ["mirror", "door"],
};

function side(position: Position): "left" | "right" | null {
  if (position.endsWith("left")) return "left";
  if (position.endsWith("right")) return "right";
  return null;
}

/**
 * Picks companions for `part` from `candidates`, which must already be limited
 * to parts that share a vehicle with it. Same-type matches are the opposite
 * side (the other headlight); cross-type matches stay on the same side.
 */
export function pickReplacedTogether(part: Part, candidates: Part[], limit = 4): Part[] {
  const order = REPLACED_WITH[part.type];
  const partSide = side(part.position);

  return candidates
    .filter((c) => {
      if (c.sku === part.sku || c.status !== "available") return false;
      if (!order.includes(c.type)) return false;
      const cSide = side(c.position);
      if (c.type === part.type) return c.position !== part.position;
      if (partSide && cSide) return partSide === cSide;
      return true;
    })
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .filter((c, i, list) => list.findIndex((o) => o.type === c.type && o.position === c.position) === i)
    .slice(0, limit);
}
