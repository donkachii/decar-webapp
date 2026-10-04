import { CircleCheck, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { retryPayment } from "@/app/checkout/actions";
import { ClearCart } from "@/components/clear-cart";
import { Button } from "@/components/ui/button";
import { getVehicle } from "@/lib/catalog";
import { vehicleLabel } from "@/lib/catalog/labels";
import { SITE } from "@/lib/config/site";
import { formatDateTime, formatNGN } from "@/lib/format";
import { getFeatures } from "@/lib/features";
import { DELIVERY_OPTIONS } from "@/lib/orders/delivery";
import { getOrder } from "@/lib/orders/api";
import { orderMessage, whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

export default async function OrderPage({ params, searchParams }: PageProps<"/order/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const [order, features] = await Promise.all([getOrder(id), getFeatures()]);
  if (!order) notFound();

  const vehicle = await getVehicle(order.vehicleId);
  const placed = sp.placed === "1";
  const deliveryLabel = DELIVERY_OPTIONS[order.deliveryOption].label;
  const deliveryDetail =
    order.deliveryOption === "abuja"
      ? order.deliveryAddress
      : order.deliveryOption === "waybill"
        ? [order.deliveryPark, order.deliveryState].filter(Boolean).join(", ")
        : SITE.address;
  const needsPayment =
    order.paymentMethod === "paystack" && order.paymentStatus !== "paid" && order.status === "new";

  const wa = whatsappLink(
    orderMessage({
      orderNumber: order.number,
      vehicleLabel: vehicle ? vehicleLabel(vehicle) : null,
      deliveryLabel,
      lines: order.items.map((i) => ({ sku: i.sku, title: i.name, priceNGN: i.priceNGN, qty: i.qty })),
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      {placed ? <ClearCart /> : null}

      {placed ? (
        <p className="flex items-center gap-2 font-semibold">
          <CircleCheck aria-hidden className="size-5" />
          Order placed
        </p>
      ) : null}
      <h1 className="mt-2 text-5xl leading-none font-bold tabular">{order.number}</h1>
      <p className="mt-2 text-[17px]">
        {formatDateTime(order.createdAt)}.{" "}
        {order.status === "cancelled"
          ? "This order was cancelled."
          : order.status === "completed"
            ? "Completed. Thank you."
            : `We'll call or WhatsApp you on ${order.customerPhone} to confirm your parts.`}
      </p>

      {sp.payment === "incomplete" || sp.payment === "retry" ? (
        <p role="alert" className="mt-4 rounded-md bg-paper px-4 py-3 font-semibold text-warn">
          Your payment didn&apos;t go through. Your parts are held for now. Try again, or pay when you
          collect.
        </p>
      ) : null}
      {sp.paid === "1" || order.paymentStatus === "paid" ? (
        <p className="mt-4 rounded-md bg-paper px-4 py-3 font-semibold">Payment received.</p>
      ) : null}

      <div className="mt-6 grid gap-2 sm:max-w-sm">
        {needsPayment && features.paystack ? (
          <form action={retryPayment.bind(null, order.id)}>
            <Button type="submit" size="lg" className="w-full">
              Pay {formatNGN(order.totalNGN)} with Paystack
            </Button>
          </form>
        ) : null}
        {order.status === "new" ? (
          <Button asChild size="lg" variant={needsPayment ? "outline" : "default"}>
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden />
              Complete order on WhatsApp
            </a>
          </Button>
        ) : null}
      </div>

      <section className="mt-8 rounded-md bg-paper p-5">
        <h2 className="text-2xl">Parts</h2>
        <ul className="mt-2 divide-y divide-bay">
          {order.items.map((item) => (
            <li key={item.sku} className="flex justify-between gap-3 py-2.5">
              <div>
                <p className="leading-tight font-semibold">
                  {item.name}
                  {item.qty > 1 ? ` x${item.qty}` : ""}
                </p>
                <p className="text-[13px] tabular">{item.sku}</p>
              </div>
              <p className="font-semibold tabular">{formatNGN(item.priceNGN * item.qty)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t border-primer pt-3">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-semibold tabular">{formatNGN(order.subtotalNGN)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="font-semibold tabular">{formatNGN(order.deliveryFeeNGN)}</dd>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-display text-2xl font-semibold">Total</dt>
            <dd className="font-display text-3xl font-bold tabular">{formatNGN(order.totalNGN)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 grid gap-4 rounded-md bg-paper p-5 sm:grid-cols-2">
        <div>
          <h2 className="text-xl">{deliveryLabel}</h2>
          <p className="mt-1">{deliveryDetail}</p>
        </div>
        <div>
          <h2 className="text-xl">Payment</h2>
          <p className="mt-1">
            {order.paymentStatus === "paid"
              ? "Paid with Paystack"
              : order.paymentMethod === "paystack"
                ? "Paystack, not paid yet"
                : order.deliveryOption === "pickup"
                  ? "Pay at the shop when you collect"
                  : order.deliveryOption === "abuja"
                    ? "Pay on delivery"
                    : "Bank transfer before we load it"}
          </p>
        </div>
      </section>
    </div>
  );
}
