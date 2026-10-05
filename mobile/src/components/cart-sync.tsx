import { useCartSync } from "@/lib/cart-sync";

/** Saves a signed-in buyer's cart to their account, so the website shows the same one. */
export function CartSync() {
  useCartSync();
  return null;
}
