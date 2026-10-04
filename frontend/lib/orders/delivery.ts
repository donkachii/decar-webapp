import type { ShippingClass } from "@/lib/catalog/types";

import type { DeliveryOption } from "./types";

export const DELIVERY_OPTIONS: Record<DeliveryOption, { label: string; detail: string }> = {
  pickup: {
    label: "Pick up at Zuba Market shop",
    detail: "Collect from Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market.",
  },
  abuja: {
    label: "Abuja delivery",
    detail: "We bring it to your address or your mechanic in Abuja.",
  },
  waybill: {
    label: "Interstate waybill",
    detail: "We load it at the park in Abuja. You collect it at your destination park.",
  },
};

export const DELIVERY_ORDER: readonly DeliveryOption[] = ["pickup", "abuja", "waybill"];

// Rates live in the API (backend/app/domain/delivery.py, GET /delivery/rates)
// so the fee shown here is the fee charged. One fee per order, set by the
// largest item, because one trip carries everything.
export type DeliveryRates = Record<DeliveryOption, Record<ShippingClass, number>>;

const CLASS_RANK: Record<ShippingClass, number> = { small: 0, medium: 1, bulky: 2, oversized: 3 };

export function largestShippingClass(classes: ShippingClass[]): ShippingClass | null {
  if (classes.length === 0) return null;
  return classes.reduce((a, b) => (CLASS_RANK[b] > CLASS_RANK[a] ? b : a));
}

export function deliveryFee(option: DeliveryOption, classes: ShippingClass[], rates: DeliveryRates): number {
  const largest = largestShippingClass(classes);
  return largest ? rates[option][largest] : 0;
}

export function isDeliveryOption(value: string): value is DeliveryOption {
  return (DELIVERY_ORDER as readonly string[]).includes(value);
}
