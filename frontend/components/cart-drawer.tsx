"use client";

import { Car, MessageCircle, ShoppingCart } from "lucide-react";
import Link from "next/link";

import {
  CartLineList,
  CartSkeleton,
  cartWhatsappLink,
  summariseCart,
} from "@/components/cart-lines";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOpenVehiclePicker } from "@/components/vehicle-picker";
import { useCartCount, useCartDetails, useCartOpen, useHydrated } from "@/lib/cart";
import { formatNGN } from "@/lib/format";

/** Slide-in cart. Opens on "Add to cart"; never navigates on its own. */
export function CartDrawer({ vehicleId }: { vehicleId: string | null }) {
  const [open, setOpen] = useCartOpen();
  const count = useCartCount();
  const { lines, parts, vehicle, loading, failed, empty } = useCartDetails(vehicleId);
  const openPicker = useOpenVehiclePicker();
  const summary = summariseCart(lines, parts);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="gap-0">
        <SheetHeader className="border-b border-bay px-4 pt-5 pb-4">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription className="text-[15px] text-graphite">
            {count === 0 ? "Nothing in it yet." : `${count} ${count === 1 ? "part" : "parts"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {empty ? (
            <div className="py-10">
              <p className="max-w-[30ch] text-[15px]">
                Choose your car, then tap the damaged area on the home page to find the right part.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/" onClick={close}>
                  Find parts for my car
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {!vehicle && !loading ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-dashed border-graphite px-3 py-2.5">
                  <p className="text-sm">Choose your car and we&apos;ll check every part fits.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      close();
                      openPicker();
                    }}
                  >
                    <Car aria-hidden />
                    Choose
                  </Button>
                </div>
              ) : null}
              {failed ? (
                <p className="mt-4 text-sm font-semibold text-warn">
                  We couldn&apos;t check prices just now. Check your connection and reopen the cart.
                </p>
              ) : null}
              {loading && parts.size === 0 ? (
                <CartSkeleton rows={lines.length} />
              ) : (
                <CartLineList
                  lines={lines}
                  parts={parts}
                  loading={loading}
                  vehicleShortLabel={vehicle?.shortLabel ?? null}
                  onNavigate={close}
                />
              )}
            </>
          )}
        </div>

        {!empty ? (
          <div className="border-t border-bay px-4 pt-4 pb-5">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">Subtotal</p>
              <p className="font-display text-2xl font-bold tabular">
                {loading && parts.size === 0 ? "…" : formatNGN(summary.subtotal)}
              </p>
            </div>
            <p className="mt-1 text-sm">
              Pickup at Zuba Market is free. Delivery is priced at checkout before you pay.
            </p>
            <div className="mt-4 grid gap-2">
              {summary.blocked || loading ? (
                <Button size="lg" disabled>
                  Go to checkout
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/checkout" onClick={close}>
                    Go to checkout
                  </Link>
                </Button>
              )}
              {summary.ready.length > 0 ? (
                <Button asChild variant="outline">
                  <a href={cartWhatsappLink(summary, vehicle?.label ?? null)} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden />
                    Complete order on WhatsApp
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="link" className="mx-auto mt-1">
                <Link href="/cart" onClick={close}>
                  View full cart
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function CartButton() {
  const count = useCartCount();
  const [, setOpen] = useCartOpen();
  return <CartButtonView count={count} onClick={() => setOpen(true)} />;
}

function CartButtonView({ count, onClick }: { count: number; onClick: () => void }) {
  const hydrated = useHydrated();
  const shown = hydrated ? count : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid size-11 place-items-center rounded-md hover:bg-paper"
      aria-label={shown > 0 ? `Cart, ${shown} ${shown === 1 ? "part" : "parts"}` : "Cart, empty"}
    >
      <ShoppingCart aria-hidden className="size-[22px]" />
      {shown > 0 ? (
        <span
          aria-hidden
          className="absolute top-1 right-0.5 grid min-w-5 place-items-center rounded-full bg-amber px-1 text-xs leading-5 font-bold tabular"
        >
          {shown}
        </span>
      ) : null}
    </button>
  );
}
