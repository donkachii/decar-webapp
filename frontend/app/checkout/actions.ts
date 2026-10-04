"use server";

import { redirect } from "next/navigation";

import { placeOrder as placeOrderWithApi, retryPayment as retryPaymentWithApi } from "@/lib/orders/api";
import { getSelectedVehicle } from "@/lib/vehicle";

export type CheckoutField = "name" | "phone" | "email" | "delivery" | "address" | "state" | "park" | "payment";

export interface CheckoutState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<CheckoutField, string>>;
  unavailable?: string[];
}

function parseLines(raw: FormDataEntryValue | null): { sku: string; qty: number }[] {
  if (typeof raw !== "string") return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: { sku?: unknown; qty?: unknown }) =>
      typeof item.sku === "string" && typeof item.qty === "number" ? [{ sku: item.sku, qty: item.qty }] : [],
    );
  } catch {
    return [];
  }
}

// The API validates the form, re-reads price and status under a row lock,
// reserves the units and sends the order emails. This action only forwards
// the form and turns the answer into form state or a redirect.
export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const field = (key: string) => String(formData.get(key) ?? "");
  const vehicle = await getSelectedVehicle();

  const result = await placeOrderWithApi({
    name: field("name"),
    phone: field("phone"),
    email: field("email"),
    delivery: field("delivery"),
    address: field("address"),
    state: field("state"),
    park: field("park"),
    payment: field("payment"),
    notes: field("notes"),
    vehicleId: vehicle?.id ?? null,
    lines: parseLines(formData.get("lines")),
  }).catch((error: unknown) => {
    console.error("[checkout] order failed", error);
    return null;
  });

  if (!result) {
    return {
      status: "error",
      message: "We couldn't place your order just now. Try again, or complete it on WhatsApp.",
    };
  }
  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      fieldErrors: result.fieldErrors,
      unavailable: result.unavailable,
    };
  }

  const { order, paymentUrl } = result;
  if (order.paymentMethod === "paystack") redirect(paymentUrl ?? `/order/${order.id}?placed=1&payment=retry`);
  redirect(`/order/${order.id}?placed=1`);
}

/** "Pay now" on the order page, for a Paystack payment that didn't finish. */
export async function retryPayment(orderId: string): Promise<void> {
  const result = await retryPaymentWithApi(orderId);
  if (result === "nothing-to-pay") redirect(`/order/${orderId}`);
  redirect(result.paymentUrl ?? `/order/${orderId}?payment=retry`);
}
