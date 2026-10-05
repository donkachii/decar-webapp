import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { fetchFitment, fetchPartsBySku } from "./catalog";
import { isBelgium, partTitle, type CartLine, type CartPartView, type Part, type SyncedCart } from "./domain";
import { phoneStorage } from "./storage";

// Lines hold SKU and quantity only. Prices are always re-read from the API
// (CLAUDE.md section 6), so a stale phone can never undercharge.
export type { CartLine };

// owner and unsaved belong to the account sync (./cart-sync.ts).
interface CartState extends SyncedCart {
  /** The slide-up cart sheet. Opens on "Add to cart"; never navigates on its own. */
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
      storage: phoneStorage,
      partialize: ({ lines, owner, unsaved }) => ({ lines, owner, unsaved }),
    },
  ),
);

export function useCartLines(): CartLine[] {
  return useCartStore((s) => s.lines);
}

export function useCartCount(): number {
  return useCartStore((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
}

function toView(part: Part, fitting: Set<string> | null): CartPartView {
  return {
    sku: part.sku,
    title: partTitle(part),
    type: part.type,
    position: part.position,
    condition: part.condition,
    priceNGN: part.priceNGN,
    status: part.status,
    stockQty: part.stockQty,
    belgium: isBelgium(part.condition),
    image: part.images[0] ?? null,
    shippingClass: part.shippingClass,
    fits: fitting ? fitting.has(part.sku) : null,
  };
}

/**
 * Live price, status and fitment for every line (CLAUDE.md section 7).
 * Re-read whenever the lines or the selected vehicle change.
 */
export function useCartDetails(vehicleId: string | null) {
  const lines = useCartLines();
  const skus = useMemo(() => [...new Set(lines.map((l) => l.sku))].sort(), [lines]);
  const query = useQuery({
    queryKey: ["cart", skus, vehicleId],
    enabled: skus.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [parts, fitting] = await Promise.all([
        fetchPartsBySku(skus),
        vehicleId ? fetchFitment({ partSkus: skus, vehicleId }) : Promise.resolve(null),
      ]);
      const fits = fitting ? new Set(fitting.map((f) => f.partSku)) : null;
      return new Map(parts.map((p) => [p.sku, toView(p, fits)]));
    },
  });
  const empty = skus.length === 0;
  return {
    lines,
    parts: query.data ?? new Map<string, CartPartView>(),
    loading: !empty && (query.isPending || query.isPlaceholderData),
    failed: query.isError,
    empty,
    reload: query.refetch,
  };
}

export interface CartSummary {
  subtotal: number;
  blocked: boolean; // a line is sold, reserved or no longer listed
  ready: { line: CartLine; part: CartPartView }[];
}

export function summariseCart(lines: CartLine[], parts: Map<string, CartPartView>): CartSummary {
  let subtotal = 0;
  let blocked = false;
  const ready: CartSummary["ready"] = [];
  for (const line of lines) {
    const part = parts.get(line.sku);
    if (!part || part.status !== "available" || part.stockQty < line.qty) {
      blocked = true;
      continue;
    }
    subtotal += part.priceNGN * line.qty;
    ready.push({ line, part });
  }
  return { subtotal, blocked, ready };
}
