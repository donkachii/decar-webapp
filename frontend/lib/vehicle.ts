import "server-only";

import { cookies } from "next/headers";

import { getVehicle } from "@/lib/catalog";
import type { Vehicle } from "@/lib/catalog/types";
import { VEHICLE_COOKIE } from "@/lib/config/site";

export async function getSelectedVehicle(): Promise<Vehicle | null> {
  const store = await cookies();
  return getVehicle(store.get(VEHICLE_COOKIE)?.value);
}

/**
 * Which vehicle filters a listing. `?vehicle=<id>` wins over the cookie so
 * shared links show the same results; `?vehicle=all` shows every car.
 */
export async function resolveListingVehicle(
  param: string | string[] | undefined,
): Promise<{ selected: Vehicle | null; filter: Vehicle | null; showAll: boolean }> {
  const value = Array.isArray(param) ? param[0] : param;
  const fromParam = value && value !== "all" ? await getVehicle(value) : null;
  const selected = fromParam ?? (await getSelectedVehicle());
  const showAll = value === "all";
  return { selected, filter: showAll ? null : selected, showAll };
}
