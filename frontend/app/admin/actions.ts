"use server";

import { revalidatePath } from "next/cache";

import { setPartStatus, touchStockCheck } from "@/lib/catalog";
import { normaliseSku } from "@/lib/catalog/sku";
import { cancelOrder as cancelOrderWithApi, completeOrder as completeOrderWithApi } from "@/lib/orders/api";

// Every write goes to the API with the owner's session; the API checks
// ADMIN_EMAILS before touching stock and refuses everyone else.

function sku(raw: string): string {
  const value = normaliseSku(raw);
  if (!value) throw new Error("Invalid SKU");
  return value;
}

function refresh(partSku?: string) {
  revalidatePath("/admin");
  if (partSku) revalidatePath(`/part/${partSku}`);
}

export async function markSold(rawSku: string): Promise<void> {
  const value = sku(rawSku);
  await setPartStatus(value, "sold");
  refresh(value);
}

export async function markAvailable(rawSku: string): Promise<void> {
  const value = sku(rawSku);
  await setPartStatus(value, "available");
  refresh(value);
}

export async function markChecked(rawSku: string): Promise<void> {
  const value = sku(rawSku);
  await touchStockCheck(value);
  refresh(value);
}

export async function completeOrder(orderId: string): Promise<void> {
  await completeOrderWithApi(orderId);
  refresh();
}

export async function cancelOrder(orderId: string): Promise<void> {
  await cancelOrderWithApi(orderId);
  refresh();
}
