import { queryOptions, useQuery } from "@tanstack/react-query";

import { api, apiOrNull } from "./api";
import { pickReplacedTogether, type Fitment, type Part, type PartFilters, type Vehicle } from "./domain";

// Catalog reads, the same calls as the website's api-source.ts. Parts are
// never cached as fresh (rule 5: stock truth beats everything); screens
// re-read them on focus and on pull-to-refresh.

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

export function fetchVehicles(): Promise<Vehicle[]> {
  return api<Vehicle[]>("/vehicles");
}

/** Sorted by the API: available first, then most recently checked. */
export async function fetchParts(filters: PartFilters = {}): Promise<Part[]> {
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
}

export async function fetchPart(sku: string): Promise<Part | null> {
  const row = await apiOrNull<PartDto>(`/parts/${encodeURIComponent(sku)}`);
  return row ? toPart(row) : null;
}

export async function fetchPartsBySku(skus: string[]): Promise<Part[]> {
  if (skus.length === 0) return [];
  return (await api<PartDto[]>("/parts/by-sku", { query: { sku: skus } })).map(toPart);
}

export async function fetchFitment({
  partSkus,
  vehicleId,
}: {
  partSkus?: string[];
  vehicleId?: string;
}): Promise<Fitment[]> {
  if (partSkus && partSkus.length === 0) return [];
  const rows = await api<FitmentDto[]>("/fitment", { query: { partSku: partSkus, vehicleId } });
  return rows.map((r) => ({ partSku: r.partSku, vehicleId: r.vehicleId, notes: r.notes ?? undefined }));
}

// --- Queries -----------------------------------------------------------------

// The shop adds a car only when stock for it is listed, so vehicles can stay
// fresh for a while.
export const vehiclesQuery = queryOptions({
  queryKey: ["vehicles"],
  queryFn: fetchVehicles,
  staleTime: 10 * 60_000,
});

export function useVehicles() {
  return useQuery(vehiclesQuery);
}

export function useParts(filters: PartFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["parts", filters],
    queryFn: () => fetchParts(filters),
    enabled: options.enabled ?? true,
  });
}

export function usePart(sku: string | null) {
  return useQuery({
    queryKey: ["part", sku],
    queryFn: () => (sku ? fetchPart(sku) : null),
    enabled: sku !== null,
  });
}

export interface FitmentWithVehicle extends Fitment {
  vehicle: Vehicle;
}

export function usePartFitment(sku: string | null) {
  return useQuery({
    queryKey: ["fitment", sku],
    enabled: sku !== null,
    queryFn: async ({ client }): Promise<FitmentWithVehicle[]> => {
      if (!sku) return [];
      const [rows, vehicles] = await Promise.all([
        fetchFitment({ partSkus: [sku] }),
        client.ensureQueryData(vehiclesQuery),
      ]);
      return rows.flatMap((row) => {
        const vehicle = vehicles.find((v) => v.id === row.vehicleId);
        return vehicle ? [{ ...row, vehicle }] : [];
      });
    },
  });
}

/** "Usually replaced together": companions from the shelf for any car the part fits. */
export function useReplacedTogether(part: Part | null | undefined, fitment: FitmentWithVehicle[] | undefined) {
  return useQuery({
    queryKey: ["together", part?.sku, fitment?.map((f) => f.vehicleId)],
    enabled: !!part && !!fitment,
    queryFn: async () => {
      if (!part || !fitment) return [];
      const pools = await Promise.all(fitment.map((f) => fetchParts({ vehicleId: f.vehicleId })));
      const unique = new Map(pools.flat().map((p) => [p.sku, p]));
      return pickReplacedTogether(part, [...unique.values()]);
    },
  });
}
