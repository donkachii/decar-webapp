"use client";

import { cn } from "cn";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartActions, useCartLines, useCartOpen, useHydrated } from "@/lib/cart";

/** Adds the part and slides the cart drawer open. No navigation. */
export function AddToCartButton({
  sku,
  maxQty,
  size = "default",
  className,
}: {
  sku: string;
  maxQty: number;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const { add } = useCartActions();
  const [, setOpen] = useCartOpen();
  const lines = useCartLines();
  const hydrated = useHydrated();
  const inCart = hydrated ? lines.find((l) => l.sku === sku) : undefined;
  const full = inCart !== undefined && inCart.qty >= maxQty;

  if (full) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("w-full", className)}
        onClick={() => setOpen(true)}
      >
        <Check aria-hidden />
        View in cart
      </Button>
    );
  }

  return (
    <Button size={size} className={cn("w-full", className)} onClick={() => add(sku, maxQty)}>
      <Plus aria-hidden />
      Add to cart
    </Button>
  );
}
