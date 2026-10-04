import "server-only";

import { api, apiOrNull } from "@/lib/api/client";

import type { CatalogSource } from "./source";
import type { Fitment, Part, PartFilters, Vehicle } from "./types";

// The API sends every key, with null or [] for "none"; the domain types use
// optional fields instead.
interface PartDto extends Omit<Part, "defects" | "oemNumber"> {
  defects: string[];
  oemNumber: string | null;
}

interface FitmentDto {
  partSku: string;
  vehicleId: string;
  notes: string | null;
}

function toPart({ defects, oemNumber, ...rest }: PartDto): Part {
  return { ...rest, defects: defects.length > 0 ? defects : undefined, oemNumber: oemNumber ?? undefined };
}

function toFitment(row: FitmentDto): Fitment {
  return { partSku: row.partSku, vehicleId: row.vehicleId, notes: row.notes ?? undefined };
}

export const apiSource: CatalogSource = {
  getVehicles() {
    return api<Vehicle[]>("/vehicles");
  },

  // Sorted by the API: available first, then most recently checked.
  async getParts(filters: PartFilters = {}) {
    const rows = await api<PartDto[]>("/parts", {
      query: {
        category: filters.category,
        type: filters.types,
        position: filters.positions,
        condition: filters.conditions,
        vehicleId: filters.vehicleId,
        includeSold: filters.includeSold || undefined,
      },
    });
    return rows.map(toPart);
  },

  async getPart(sku) {
    const row = await apiOrNull<PartDto>(`/parts/${encodeURIComponent(sku)}`);
    return row ? toPart(row) : null;
  },

  async getPartsBySku(skus) {
    if (skus.length === 0) return [];
    return (await api<PartDto[]>("/parts/by-sku", { query: { sku: skus } })).map(toPart);
  },

  async getFitment({ partSkus, vehicleId }) {
    if (partSkus && partSkus.length === 0) return [];
    const rows = await api<FitmentDto[]>("/fitment", { query: { partSku: partSkus, vehicleId } });
    return rows.map(toFitment);
  },

  async setPartStatus(sku, status) {
    await api(`/admin/parts/${encodeURIComponent(sku)}/status`, {
      method: "POST",
      body: { status },
      session: true,
    });
  },

  async touchStockCheck(sku) {
    await api(`/admin/parts/${encodeURIComponent(sku)}/checked`, { method: "POST", session: true });
  },
};
