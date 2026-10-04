import "server-only";

import { getFittingSkus, getPartsBySku } from "@/lib/catalog";
import { partTitle, vehicleLabel, vehicleShortLabel } from "@/lib/catalog/labels";
import { normaliseSku } from "@/lib/catalog/sku";
import { isBelgium, type Vehicle } from "@/lib/catalog/types";

import type { CartDetailsResponse } from "./types";

export function parseSkuList(input: unknown, limit = 50): string[] {
  if (!Array.isArray(input)) return [];
  const skus = input
    .filter((v): v is string => typeof v === "string")
    .map((v) => normaliseSku(v))
    .filter((v): v is string => v !== null);
  return [...new Set(skus)].slice(0, limit);
}

/** Fresh status, price and fitment for cart lines (CLAUDE.md section 7). */
export async function getCartDetails(skus: string[], vehicle: Vehicle | null): Promise<CartDetailsResponse> {
  const [parts, fitting] = await Promise.all([
    getPartsBySku(skus),
    vehicle ? getFittingSkus(skus, vehicle.id) : Promise.resolve(null),
  ]);

  return {
    vehicle: vehicle
      ? { id: vehicle.id, label: vehicleLabel(vehicle), shortLabel: vehicleShortLabel(vehicle) }
      : null,
    parts: parts.map((p) => ({
      sku: p.sku,
      title: partTitle(p),
      type: p.type,
      position: p.position,
      condition: p.condition,
      priceNGN: p.priceNGN,
      status: p.status,
      stockQty: p.stockQty,
      belgium: isBelgium(p.condition),
      image: p.images[0] ?? null,
      shippingClass: p.shippingClass,
      fits: fitting ? fitting.has(p.sku) : null,
    })),
  };
}
