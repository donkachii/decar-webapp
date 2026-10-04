import "server-only";

import { api, apiOrNull, ApiError } from "@/lib/api/client";

import type { DeliveryRates } from "./delivery";
import type { Order } from "./types";

// Orders, payments and admin order actions. The API places orders in one
// locked transaction, so stock and price checks happen there, not here.

export interface CheckoutRequest {
  name: string;
  phone: string;
  email: string;
  delivery: string;
  address: string;
  state: string;
  park: string;
  payment: string;
  notes: string;
  vehicleId: string | null;
  lines: { sku: string; qty: number }[];
}

export type CheckoutResult =
  | { ok: true; order: Order; paymentUrl: string | null }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; unavailable?: string[] };

interface CheckoutProblem {
  message?: unknown;
  fieldErrors?: Record<string, string>;
  unavailable?: string[];
}

export async function placeOrder(request: CheckoutRequest): Promise<CheckoutResult> {
  try {
    const placed = await api<{ order: Order; paymentUrl: string | null }>("/orders", {
      method: "POST",
      body: request,
      session: true,
    });
    return { ok: true, ...placed };
  } catch (error) {
    // 422: form errors by field. 409: units sold or reserved meanwhile.
    if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
      const body = (error.body ?? {}) as CheckoutProblem;
      if (typeof body.message === "string") {
        return { ok: false, message: body.message, fieldErrors: body.fieldErrors, unavailable: body.unavailable };
      }
    }
    throw error;
  }
}

/** The order page. The API masks the phone and leaves out the email. */
export function getOrder(id: string): Promise<Order | null> {
  return apiOrNull<Order>(`/orders/${encodeURIComponent(id)}`);
}

/** Paystack page for a payment that didn't finish; null when Paystack couldn't start. */
export async function retryPayment(orderId: string): Promise<{ paymentUrl: string | null } | "nothing-to-pay"> {
  try {
    return await api<{ paymentUrl: string | null }>(`/orders/${encodeURIComponent(orderId)}/payment`, {
      method: "POST",
    });
  } catch (error) {
    if (error instanceof ApiError && [404, 409, 422].includes(error.status)) return "nothing-to-pay";
    throw error;
  }
}

/** Paystack sent the buyer back. Null for an unknown reference. */
export function verifyPaystack(reference: string): Promise<{ orderId: string; paid: boolean } | null> {
  return apiOrNull("/payments/paystack/verify", { method: "POST", body: { reference } });
}

export function getDeliveryRates(): Promise<DeliveryRates> {
  return api<DeliveryRates>("/delivery/rates");
}

/** The signed-in buyer's orders, newest first. Empty for guests. */
export async function listMyOrders(): Promise<Order[]> {
  try {
    return await api<Order[]>("/me/orders", { session: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return [];
    throw error;
  }
}

// --- Admin: the API checks the owner's session on every call. ---------------

export function listOrders(limit = 50): Promise<Order[]> {
  return api<Order[]>("/admin/orders", { query: { limit }, session: true });
}

export async function completeOrder(id: string): Promise<void> {
  await api(`/admin/orders/${encodeURIComponent(id)}/complete`, { method: "POST", session: true });
}

export async function cancelOrder(id: string): Promise<void> {
  await api(`/admin/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", session: true });
}
