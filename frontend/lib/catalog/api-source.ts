import "server-only";

import { api, ApiError, apiOrNull } from "@/lib/api/client";

import type { CatalogSource } from "./source";
import type { CategoryPhotos, Fitment, Part, PartFilters, Vehicle } from "./types";

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

  // An API older than the website (404), or a database without the
  // category_photos migration yet (500), has no tile photos; the tiles fall
  // back to part photos rather than taking the home page down.
  async getCategoryPhotos() {
    try {
      return await api<CategoryPhotos>("/categories/photos");
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status !== 404) console.error("[catalog] category photos unavailable", error);
      return { lights: null, bumpers: null, body: null, mirrors: null };
    }
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

  async addPartPhoto(sku, photo) {
    const res = await api<{ images: string[] }>(`/admin/parts/${encodeURIComponent(sku)}/photos`, {
      method: "POST",
      file: photo,
      session: true,
    });
    return res.images;
  },

  async setPartPhotos(sku, images) {
    const res = await api<{ images: string[] }>(`/admin/parts/${encodeURIComponent(sku)}/photos`, {
      method: "PUT",
      body: { images },
      session: true,
    });
    return res.images;
  },

  async setCategoryPhoto(category, photo) {
    await api(`/admin/categories/${category}/photo`, { method: "POST", file: photo, session: true });
  },

  async clearCategoryPhoto(category) {
    await api(`/admin/categories/${category}/photo`, { method: "DELETE", session: true });
  },
};
