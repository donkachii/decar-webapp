"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { CartDetailsResponse, CartPartView } from "./types";
import { useCartStore, type CartLine } from "./store";
import { startCartSync, type CartSync, type SavedCartApi } from "./sync";

// Public cart API for components. Backed by a persisted client store, saved
// to the buyer's account while they are signed in (./sync.ts).

export type { CartLine, CartPartView };

async function savedCart(method: "GET" | "PUT" | "POST", lines?: CartLine[]): Promise<CartLine[] | null> {
  const res = await fetch("/api/cart/saved", {
    method,
    headers: lines ? { "content-type": "application/json" } : undefined,
    body: lines ? JSON.stringify({ lines }) : undefined,
    cache: "no-store",
    // A change made just before the tab closes still reaches the account.
    keepalive: method === "PUT",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Saved cart ${method} responded ${res.status}`);
  return ((await res.json()) as { lines: CartLine[] }).lines;
}

const savedCartApi: SavedCartApi = {
  load: () => savedCart("GET"),
  save: (lines) => savedCart("PUT", lines),
  merge: (lines) => savedCart("POST", lines),
};

let sync: CartSync | undefined;

function cartSync(): CartSync {
  sync ??= startCartSync(useCartStore, savedCartApi);
  return sync;
}

/** Re-reads the cart saved to the buyer's account. Does nothing for guests. */
export function refreshSavedCart(): Promise<void> {
  return sync?.refresh() ?? Promise.resolve();
}

/**
 * Keeps a signed-in buyer's cart the same here and in the phone app. Mount
 * once, with the signed-in account's id (null for guests).
 */
export function useCartSync(userId: string | null): void {
  useEffect(() => {
    cartSync().setUser(userId);
  }, [userId]);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") void refreshSavedCart();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
}

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
