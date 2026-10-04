import type { Fitment, Part, PartFilters, PartStatus, Vehicle } from "./types";

// The only contract UI code depends on. Today it is the FastAPI backend
// (api-source.ts); swapping backends means writing another CatalogSource.
export interface CatalogSource {
  getVehicles(): Promise<Vehicle[]>;
  getParts(filters?: PartFilters): Promise<Part[]>;
  getPart(sku: string): Promise<Part | null>;
  getPartsBySku(skus: string[]): Promise<Part[]>;
  getFitment(query: { partSkus?: string[]; vehicleId?: string }): Promise<Fitment[]>;

  // Admin-lite writes. Each one also stamps stockCheckedAt with now.
  setPartStatus(sku: string, status: PartStatus): Promise<void>;
  touchStockCheck(sku: string): Promise<void>;
}

