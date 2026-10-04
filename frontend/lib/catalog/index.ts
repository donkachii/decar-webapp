import "server-only";

import { cache } from "react";

import { apiSource } from "./api-source";
import { pickReplacedTogether } from "./related";
import type { CatalogSource } from "./source";
import type { Fitment, Part, PartFilters, PartStatus, Vehicle } from "./types";

// All catalog access goes through this module (CLAUDE.md section 6). The data
// lives behind the FastAPI backend; swapping backends means another source.

const source: CatalogSource = apiSource;

export const getVehicles = cache((): Promise<Vehicle[]> => source.getVehicles());

export async function getVehicle(id: string | null | undefined): Promise<Vehicle | null> {
  if (!id) return null;
  const vehicles = await getVehicles();
  return vehicles.find((v) => v.id === id) ?? null;
}

export function getParts(filters?: PartFilters): Promise<Part[]> {
  return source.getParts(filters);
}

export const getPart = cache((sku: string): Promise<Part | null> => source.getPart(sku));

export function getPartsBySku(skus: string[]): Promise<Part[]> {
  return source.getPartsBySku(skus);
}

export function getFitment(query: { partSkus?: string[]; vehicleId?: string }): Promise<Fitment[]> {
  return source.getFitment(query);
}

export interface FitmentWithVehicle extends Fitment {
  vehicle: Vehicle;
}

export const getPartFitment = cache(async (sku: string): Promise<FitmentWithVehicle[]> => {
  const [rows, vehicles] = await Promise.all([getFitment({ partSkus: [sku] }), getVehicles()]);
  return rows.flatMap((row) => {
    const vehicle = vehicles.find((v) => v.id === row.vehicleId);
    return vehicle ? [{ ...row, vehicle }] : [];
  });
});

/** SKUs from `skus` confirmed to fit `vehicleId` (make + model + generation + facelift). */
export async function getFittingSkus(skus: string[], vehicleId: string): Promise<Set<string>> {
  const rows = await getFitment({ partSkus: skus, vehicleId });
  return new Set(rows.map((r) => r.partSku));
}

export async function getReplacedTogether(part: Part): Promise<Part[]> {
  const fits = await getPartFitment(part.sku);
  const pools = await Promise.all(fits.map((f) => getParts({ vehicleId: f.vehicleId })));
  const unique = new Map(pools.flat().map((p) => [p.sku, p]));
  return pickReplacedTogether(part, [...unique.values()]);
}

export function setPartStatus(sku: string, status: PartStatus): Promise<void> {
  return source.setPartStatus(sku, status);
}

export function touchStockCheck(sku: string): Promise<void> {
  return source.touchStockCheck(sku);
}
