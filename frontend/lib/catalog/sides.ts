import { isBelgium, type Part } from "./types";
import { TYPE_POSITIONS } from "./zones";

/**
 * New stock sold by side (a left and a right fender) shows as one card with a
 * side picker. Each side keeps its own SKU, price and stock; only the card is
 * shared. Belgium units never group: each is a one-off with its own grade and
 * photos. Groups keep the position of their first part in the list.
 */
export function groupSides(parts: Part[]): Part[][] {
  const open = new Map<string, Part[]>();
  const groups: Part[][] = [];
  for (const part of parts) {
    const key = isBelgium(part.condition)
      ? null
      : JSON.stringify([part.name, part.type, part.condition, part.variants]);
    const group = key === null ? undefined : open.get(key);
    if (group && !group.some((p) => p.position === part.position)) {
      group.push(part);
      continue;
    }
    const fresh = [part];
    if (key !== null && !group) open.set(key, fresh);
    groups.push(fresh);
  }
  const order = (p: Part) => TYPE_POSITIONS[p.type].indexOf(p.position);
  return groups.map((g) => g.sort((a, b) => order(a) - order(b)));
}
