"use client";

import { useCartSync } from "@/lib/cart";

/** Saves a signed-in buyer's cart to their account, so the phone app shows the same one. */
export function CartSync({ userId }: { userId: string | null }) {
  useCartSync(userId);
  return null;
}
