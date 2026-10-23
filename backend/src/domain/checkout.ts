// Checkout validation. Messages are shown next to form fields, so they follow
// the copy rules in CLAUDE.md section 8.

import type { CheckoutIn, CheckoutLineIn } from "../schemas.js";
import { DELIVERY_OPTIONS, type DeliveryOption, type PaymentMethod } from "./delivery.js";
import { normaliseSku } from "./sku.js";

export const MAX_LINES = 30;
export const MAX_QTY = 20;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Line {
  sku: string;
  qty: number;
}

export interface Checkout {
  name: string;
  phone: string;
  email: string | null;
  delivery: DeliveryOption;
  address: string | null;
  state: string | null;
  park: string | null;
  payment: PaymentMethod;
  notes: string | null;
  vehicleId: string | null;
  lines: Line[];
}

export interface CheckoutErrors {
  message: string;
  fieldErrors: Record<string, string>;
}

/** Length in characters, so a name with an accent or an emoji counts as people see it. */
function length(value: string): number {
  return [...value].length;
}

/** 0803 123 4567, 803 123 4567, +234 803 123 4567 → +2348031234567 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+234\d{10}$/.test(digits)) return digits;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `+234${digits}`;
  return null;
}

/** Valid SKUs only, one line per SKU (the last one wins), quantities 1 to 20. */
export function cleanLines(raw: readonly CheckoutLineIn[]): Line[] {
  const lines = new Map<string, number>();
  for (const item of raw.slice(0, MAX_LINES)) {
    const sku = normaliseSku(item.sku);
    if (sku && item.qty >= 1 && item.qty <= MAX_QTY) lines.set(sku, item.qty);
  }
  return [...lines].map(([sku, qty]) => ({ sku, qty }));
}

function deliveryOption(value: string): DeliveryOption | null {
  return DELIVERY_OPTIONS.find((option) => option === value) ?? null;
}

export function validateCheckout(
  form: CheckoutIn,
  { paystackEnabled }: { paystackEnabled: boolean },
): Checkout | CheckoutErrors {
  const name = form.name.trim();
  const phone = normalisePhone(form.phone.trim());
  const email = form.email.trim().toLowerCase();
  const delivery = deliveryOption(form.delivery.trim());
  const address = form.address.trim();
  const state = form.state.trim();
  const park = form.park.trim();
  const payment = form.payment.trim();
  const notes = [...form.notes.trim()].slice(0, 500).join("");
  const lines = cleanLines(form.lines);

  if (lines.length === 0) return { message: "Your cart is empty.", fieldErrors: {} };

  const errors: Record<string, string> = {};
  if (length(name) < 2 || length(name) > 80) errors.name = "Enter your name.";
  if (!phone) errors.phone = "Enter a Nigerian phone number, like 0803 123 4567.";
  if (email && !EMAIL.test(email)) errors.email = "Check the email address.";
  if (delivery === null) errors.delivery = "Choose how you want to get your parts.";
  if (delivery === "abuja" && length(address) < 5) errors.address = "Enter the delivery address in Abuja.";
  if (delivery === "waybill" && length(state) < 2) errors.state = "Enter the destination state.";
  if (delivery === "waybill" && length(park) < 2) errors.park = "Enter the park where you'll collect it.";
  if (payment !== "paystack" && payment !== "pay-later") errors.payment = "Choose how you want to pay.";
  if (payment === "paystack" && !paystackEnabled) {
    errors.payment = "Card payment isn't available yet. Choose to pay later.";
  }
  if (payment === "paystack" && !email) errors.email = "Paystack needs an email address for your receipt.";

  if (Object.keys(errors).length > 0 || phone === null || delivery === null) {
    return { message: "Check the highlighted fields.", fieldErrors: errors };
  }

  return {
    name,
    phone,
    email: email || null,
    delivery,
    address: delivery === "abuja" ? address : null,
    state: delivery === "waybill" ? state : null,
    park: delivery === "waybill" ? park : null,
    payment: payment === "paystack" ? "paystack" : "pay-later",
    notes: notes || null,
    vehicleId: form.vehicleId || null,
    lines,
  };
}

export function isCheckoutErrors(result: Checkout | CheckoutErrors): result is CheckoutErrors {
  return "fieldErrors" in result;
}
