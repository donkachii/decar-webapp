import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useVehicles } from "./catalog";
import type { Vehicle } from "./domain";
import { phoneStorage } from "./storage";

// The buyer's car (a generation + facelift, never a single year). Persists
// across launches like the website's dcr_vehicle cookie and filters every
// listing.

interface VehicleState {
  vehicleId: string | null;
  setVehicleId: (id: string | null) => void;
}

export const useVehicleStore = create<VehicleState>()(
  persist(
    (set) => ({
      vehicleId: null,
      setVehicleId: (vehicleId) => set({ vehicleId }),
    }),
    { name: "dcr-vehicle", version: 1, storage: phoneStorage },
  ),
);

export function useSelectedVehicle(): Vehicle | null {
  const id = useVehicleStore((s) => s.vehicleId);
  const { data } = useVehicles();
  return (id && data?.find((v) => v.id === id)) || null;
}

export function useSetVehicle(): (id: string | null) => void {
  return useVehicleStore((s) => s.setVehicleId);
}
