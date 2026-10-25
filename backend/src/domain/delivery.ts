import type { ShippingClass } from "./catalog.js";

export const DELIVERY_OPTIONS = ["pickup", "abuja", "waybill"] as const;
export const PAYMENT_METHODS = ["paystack", "pay-later"] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "failed"] as const;
export const ORDER_STATUSES = ["new", "completed", "cancelled"] as const;

export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DELIVERY_LABELS: Record<DeliveryOption, string> = {
  pickup: "Pick up at Zuba Market shop",
  abuja: "Abuja delivery",
  waybill: "Interstate waybill",
};

// PLACEHOLDER rates until the owner confirms them. One fee per order, set by the
// largest item, because one trip carries everything. The frontend reads these
// from GET /delivery/rates, so this is the only copy.
export const DELIVERY_RATES: Record<DeliveryOption, Record<ShippingClass, number>> = {
  pickup: { small: 0, medium: 0, bulky: 0, oversized: 0 },
  abuja: { small: 3000, medium: 5000, bulky: 8000, oversized: 12000 },
  waybill: { small: 5000, medium: 8000, bulky: 15000, oversized: 25000 },
};

const CLASS_RANK: Record<ShippingClass, number> = { small: 0, medium: 1, bulky: 2, oversized: 3 };

export function largestShippingClass(classes: readonly ShippingClass[]): ShippingClass | null {
  return classes.reduce<ShippingClass | null>(
    (largest, c) => (largest === null || CLASS_RANK[c] > CLASS_RANK[largest] ? c : largest),
    null,
  );
}

export function deliveryFee(option: DeliveryOption, classes: readonly ShippingClass[]): number {
  const largest = largestShippingClass(classes);
  return largest ? DELIVERY_RATES[option][largest] : 0;
}
