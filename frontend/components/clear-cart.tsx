"use client";

import { useEffect } from "react";

import { useCartActions } from "@/lib/cart";

/** Empties the cart once an order has been placed. */
export function ClearCart() {
  const { clear } = useCartActions();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
