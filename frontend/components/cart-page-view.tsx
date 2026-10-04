"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";

import {
  CartLineList,
  CartSkeleton,
  cartWhatsappLink,
  summariseCart,
} from "@/components/cart-lines";
import { Button } from "@/components/ui/button";
import { ChooseCarButton } from "@/components/vehicle-picker";
import { useCartDetails } from "@/lib/cart";
import { DELIVERY_OPTIONS, DELIVERY_ORDER, deliveryFee, type DeliveryRates } from "@/lib/orders/delivery";
import { formatNGN } from "@/lib/format";

export function CartPageView({ vehicleId, rates }: { vehicleId: string | null; rates: DeliveryRates }) {
  const { lines, parts, vehicle, loading, failed, empty } = useCartDetails(vehicleId);
  const summary = summariseCart(lines, parts);
  const classes = summary.ready.map((r) => r.part.shippingClass);

  if (empty) {
    return (
      <div className="mt-6 rounded-md bg-paper px-5 py-10">
        <p className="max-w-[44ch] text-[17px]">
          Your cart is empty. Choose your car, then tap the damaged area on the home page to find
          the right part.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">Find parts for my car</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <div className="rounded-md bg-paper px-4">
        {!vehicle && !loading ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bay py-4">
            <p>Choose your car and we&apos;ll check every part fits.</p>
            <ChooseCarButton variant="outline" />
          </div>
        ) : null}
        {failed ? (
          <p className="pt-4 font-semibold text-warn">
            We couldn&apos;t check prices just now. Check your connection and reload the page.
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
          />
        )}
      </div>

      <aside className="rounded-md bg-paper p-5 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Subtotal</h2>
          <p className="font-display text-3xl font-bold tabular">
            {loading && parts.size === 0 ? "…" : formatNGN(summary.subtotal)}
          </p>
        </div>
        <h3 className="mt-5 text-lg">Delivery for this cart</h3>
        <dl className="mt-1 divide-y divide-bay text-[15px]">
          {DELIVERY_ORDER.map((option) => (
            <div key={option} className="flex justify-between gap-4 py-2">
              <dt>{DELIVERY_OPTIONS[option].label}</dt>
              <dd className="font-semibold tabular">
                {classes.length === 0 ? "…" : formatNGN(deliveryFee(option, classes, rates))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm">You choose at checkout. No other fees.</p>
        <div className="mt-5 grid gap-2">
          {summary.blocked || loading ? (
            <Button size="lg" disabled>
              Go to checkout
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/checkout">Go to checkout</Link>
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
        </div>
        {summary.blocked && !loading ? (
          <p className="mt-3 text-sm font-semibold text-warn">
            Remove the parts marked above to continue.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
