// Paystack card and bank-transfer payments. On only when PAYSTACK_SECRET_KEY is set;
// without it checkout offers pay-on-collection only.

import { randomBytes } from "node:crypto";

import type { Settings } from "../config.js";
import { type Order, prisma } from "../db.js";

const API = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

class PaystackError extends Error {}

function headers(settings: Settings): Record<string, string> {
  return { Authorization: `Bearer ${settings.paystackSecretKey}` };
}

function newReference(orderNumber: string): string {
  return `${orderNumber}-${randomBytes(4).toString("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Starts a payment and returns the Paystack page to send the buyer to. */
async function initializePayment(
  settings: Settings,
  payment: { email: string; amountNGN: number; reference: string; orderNumber: string },
): Promise<string> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { ...headers(settings), "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payment.email,
      amount: payment.amountNGN * 100, // kobo
      currency: "NGN",
      reference: payment.reference,
      callback_url: `${settings.frontendOrigin}/api/paystack/callback`,
      metadata: { order_number: payment.orderNumber },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body: unknown = await res.json();
  const url = isRecord(body) && isRecord(body.data) ? body.data.authorization_url : undefined;
  if (!res.ok || typeof url !== "string") {
    throw new PaystackError(`Paystack: ${isRecord(body) ? String(body.message) : res.status}`);
  }
  return url;
}

/** Confirms with Paystack that the payment succeeded for the expected amount. */
async function verifyPayment(settings: Settings, reference: string, expectedNGN: number): Promise<boolean> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(settings),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body: unknown = await res.json();
  const data = isRecord(body) ? body.data : undefined;
  if (!res.ok || !isRecord(data)) return false;
  return data.status === "success" && data.currency === "NGN" && data.amount === expectedNGN * 100;
}

/** Gives the order a fresh reference and returns the Paystack page, or null if it can't start. */
export async function startPayment(settings: Settings, order: Order): Promise<string | null> {
  if (!settings.paystackEnabled || !order.customerEmail) return null;
  const reference = newReference(order.number);
  await prisma.order.update({ where: { id: order.id }, data: { paystackReference: reference } });
  order.paystackReference = reference;
  try {
    return await initializePayment(settings, {
      email: order.customerEmail,
      amountNGN: order.totalNGN,
      reference,
      orderNumber: order.number,
    });
  } catch (error) {
    console.error(`[paystack] could not start payment for ${order.number}:`, error);
    return null;
  }
}

/** Marks the order paid if Paystack confirms the full amount. Null for an unknown reference. */
export async function confirmPayment(
  settings: Settings,
  reference: string,
): Promise<{ id: string; paid: boolean } | null> {
  const order = await prisma.order.findUnique({ where: { paystackReference: reference } });
  if (order === null) return null;
  let paid = order.paymentStatus === "paid";
  if (!paid && settings.paystackEnabled) {
    try {
      paid = await verifyPayment(settings, reference, order.totalNGN);
    } catch (error) {
      console.error(`[paystack] could not verify ${reference}:`, error);
    }
    if (paid) await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "paid" } });
  }
  return { id: order.id, paid };
}
