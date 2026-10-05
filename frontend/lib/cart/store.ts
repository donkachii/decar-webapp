"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { SyncedCart } from "./sync";
import type { CartLine } from "./types";

export type { CartLine };

// owner and unsaved belong to the account sync (./sync.ts).
interface CartState extends SyncedCart {
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
      owner: null,
      unsaved: false,
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
      partialize: ({ lines, owner, unsaved }) => ({ lines, owner, unsaved }),
    },
  ),
);
