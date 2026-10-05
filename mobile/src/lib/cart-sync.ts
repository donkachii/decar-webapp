import { useEffect } from "react";
import { AppState } from "react-native";

import { api, ApiError } from "./api";
import { useCartStore, type CartLine } from "./cart";
import { startCartSync, type CartSync } from "./domain";
import { useMe } from "./session";
import { useTokenStore } from "./token";

// Keeps a signed-in buyer's cart the same here and on the website. The rules
// (save every change, re-read on return, merge a guest cart at sign-in) are
// shared with the website in frontend/lib/cart/sync.ts.

async function savedCart(
  path: string,
  method: "GET" | "PUT" | "POST",
  lines?: CartLine[],
): Promise<CartLine[] | null> {
  try {
    const body = lines === undefined ? undefined : { lines };
    return (await api<{ lines: CartLine[] }>(path, { method, body, session: true })).lines;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

let sync: CartSync | undefined;

function cartSync(): CartSync {
  sync ??= startCartSync(useCartStore, {
    load: () => savedCart("/me/cart", "GET"),
    save: (lines) => savedCart("/me/cart", "PUT", lines),
    merge: (lines) => savedCart("/me/cart/merge", "POST", lines),
  });
  return sync;
}

/** Re-reads the cart saved to the buyer's account. Does nothing for guests. */
export function refreshSavedCart(): Promise<void> {
  return sync?.refresh() ?? Promise.resolve();
}

/** Mount once, inside the query client. */
export function useCartSync(): void {
  const token = useTokenStore((s) => s.token);
  const me = useMe();
  // Undefined until the API says who the token belongs to (or while it can't
  // be reached): the cart is left as it is.
  const userId = token === null ? null : me.data === undefined ? undefined : (me.data?.user.id ?? null);

  useEffect(() => {
    if (userId !== undefined) cartSync().setUser(userId);
  }, [userId]);

  // Lines added on the website while the app was in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshSavedCart();
    });
    return () => subscription.remove();
  }, []);
}
