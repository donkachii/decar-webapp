import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api, apiOrNull, ApiError } from "./api";
import type { DeliveryRates, Order } from "./domain";
import { phoneStorage } from "./storage";
import { useTokenStore } from "./token";

// Orders and payments. The API places orders in one locked transaction, so
// stock and price checks happen there, not here.

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

export type CheckoutField = "name" | "phone" | "email" | "delivery" | "address" | "state" | "park" | "payment";

export type CheckoutResult =
  | { ok: true; order: Order; paymentUrl: string | null }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<CheckoutField, string>>;
      unavailable?: string[];
    };

interface CheckoutProblem {
  message?: unknown;
  fieldErrors?: Partial<Record<CheckoutField, string>>;
  unavailable?: string[];
}

/** Guest checkout always works; a session only links the order to the buyer's account. */
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

/** Asks the API to confirm a Paystack payment. Paystack's redirect to the website does this too. */
export function verifyPaystack(reference: string): Promise<{ orderId: string; paid: boolean } | null> {
  return apiOrNull("/payments/paystack/verify", { method: "POST", body: { reference } });
}

/** The order page. The API masks the phone and leaves out the email. */
export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ["order", id],
    enabled: id !== null,
    queryFn: () => (id ? apiOrNull<Order>(`/orders/${encodeURIComponent(id)}`) : null),
  });
}

export function useDeliveryRates() {
  return useQuery({
    queryKey: ["delivery-rates"],
    queryFn: () => api<DeliveryRates>("/delivery/rates"),
    staleTime: 10 * 60_000,
  });
}

/** The signed-in buyer's orders, newest first. */
export function useMyOrders() {
  const token = useTokenStore((s) => s.token);
  return useQuery({
    queryKey: ["my-orders", token],
    enabled: token !== null,
    queryFn: () => api<Order[]>("/me/orders", { session: true }),
  });
}

// Orders placed on this phone. A guest has no account and the app has no
// address bar, so this list is how they get back to an order page.
export interface PlacedOrder {
  id: string;
  number: string;
  createdAt: string;
}

interface PlacedOrdersState {
  orders: PlacedOrder[];
  remember: (order: PlacedOrder) => void;
}

export const usePlacedOrders = create<PlacedOrdersState>()(
  persist(
    (set) => ({
      orders: [],
      remember: (order) =>
        set((state) => ({ orders: [order, ...state.orders.filter((o) => o.id !== order.id)].slice(0, 20) })),
    }),
    { name: "dcr-orders", version: 1, storage: phoneStorage },
  ),
);
