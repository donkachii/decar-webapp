"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Lines hold SKU and quantity only. Prices are always re-read from the
// catalog (CLAUDE.md section 6), so a stale browser can never undercharge.
export interface CartLine {
  sku: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  open: boolean;
  add: (sku: string, maxQty: number) => void;
  setQty: (sku: string, qty: number, maxQty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
}

const clamp = (qty: number, maxQty: number) => Math.max(1, Math.min(qty, Math.max(1, maxQty)));

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      add: (sku, maxQty) =>
        set((state) => {
          const existing = state.lines.find((l) => l.sku === sku);
          const lines = existing
            ? state.lines.map((l) => (l.sku === sku ? { ...l, qty: clamp(l.qty + 1, maxQty) } : l))
            : [...state.lines, { sku, qty: 1 }];
          return { lines, open: true };
        }),
      setQty: (sku, qty, maxQty) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.sku === sku ? { ...l, qty: clamp(qty, maxQty) } : l)),
        })),
      remove: (sku) => set((state) => ({ lines: state.lines.filter((l) => l.sku !== sku) })),
      clear: () => set({ lines: [] }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "dcr-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);
