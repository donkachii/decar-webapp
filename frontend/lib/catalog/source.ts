import type { Category, CategoryPhotos, Fitment, Part, PartFilters, PartStatus, Vehicle } from "./types";

// The only contract UI code depends on. Today it is the Express backend
// (api-source.ts); swapping backends means writing another CatalogSource.
export interface CatalogSource {
  getVehicles(): Promise<Vehicle[]>;
  getParts(filters?: PartFilters): Promise<Part[]>;
  getPart(sku: string): Promise<Part | null>;
  getPartsBySku(skus: string[]): Promise<Part[]>;
  getFitment(query: { partSkus?: string[]; vehicleId?: string }): Promise<Fitment[]>;
  getCategoryPhotos(): Promise<CategoryPhotos>;

  // Admin-lite writes. Each one also stamps stockCheckedAt with now.
  setPartStatus(sku: string, status: PartStatus): Promise<void>;
  touchStockCheck(sku: string): Promise<void>;

  // Admin-lite photo writes. These never stamp stockCheckedAt. Each part write
  // returns the part's images afterwards.
  addPartPhoto(sku: string, photo: Blob): Promise<string[]>;
  setPartPhotos(sku: string, images: string[]): Promise<string[]>;
  setCategoryPhoto(category: Category, photo: Blob): Promise<void>;
  clearCategoryPhoto(category: Category): Promise<void>;
}

