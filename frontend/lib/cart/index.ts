"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { CartDetailsResponse, CartPartView } from "./types";
import { useCartStore, type CartLine } from "./store";

// Public cart API for components. Backed by a persisted client store today;
// moving to a server cart later only changes this folder.

export type { CartLine, CartPartView };

export function useCartLines(): CartLine[] {
  return useCartStore((s) => s.lines);
}

export function useCartCount(): number {
  return useCartStore((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
}

export function useCartOpen(): [boolean, (open: boolean) => void] {
  return [useCartStore((s) => s.open), useCartStore((s) => s.setOpen)];
}

export function useCartActions() {
  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  return { add, setQty, remove, clear };
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true after. Guards persisted UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

interface DetailsState {
  key: string;
  data: CartDetailsResponse | null;
  failed: boolean;
}

/**
 * Live price, status and fitment for every line. Re-fetches when the lines
 * or the selected vehicle change.
 */
export function useCartDetails(vehicleId: string | null) {
  const lines = useCartLines();
  const hydrated = useHydrated();
  const skus = useMemo(() => [...new Set(lines.map((l) => l.sku))].sort(), [lines]);
  const [nonce, setNonce] = useState(0);
  const key = `${skus.join(",")}|${vehicleId ?? ""}|${nonce}`;
  const [state, setState] = useState<DetailsState>({ key: "", data: null, failed: false });

  useEffect(() => {
    if (!hydrated || skus.length === 0) return;
    const controller = new AbortController();
    fetch("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skus }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<CartDetailsResponse>;
      })
      .then((data) => setState({ key, data, failed: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ key, data: null, failed: true });
      });
    return () => controller.abort();
  }, [hydrated, key, skus]);

  const empty = hydrated && skus.length === 0;
  const bySku = useMemo(
    () => new Map((state.data?.parts ?? []).map((p) => [p.sku, p])),
    [state.data],
  );

  return {
    lines,
    parts: bySku,
    vehicle: state.data?.vehicle ?? null,
    loading: !empty && (!hydrated || state.key !== key),
    failed: state.failed && state.key === key,
    empty,
    reload: () => setNonce((n) => n + 1),
  };
}
