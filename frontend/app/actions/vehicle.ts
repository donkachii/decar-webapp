"use server";

import { cookies } from "next/headers";

import { getVehicle } from "@/lib/catalog";
import { VEHICLE_COOKIE } from "@/lib/config/site";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function chooseVehicle(vehicleId: string): Promise<void> {
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) throw new Error("Unknown vehicle");
  const store = await cookies();
  store.set(VEHICLE_COOKIE, vehicle.id, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}

export async function clearVehicle(): Promise<void> {
  const store = await cookies();
  store.delete(VEHICLE_COOKIE);
}
