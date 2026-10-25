"use server";

import { revalidatePath } from "next/cache";

import type { PhotoResult } from "@/components/photo-upload";
import { ApiError } from "@/lib/api/client";
import {
  addPartPhoto as addPartPhotoWithApi,
  clearCategoryPhoto as clearCategoryPhotoWithApi,
  getPart,
  setCategoryPhoto as setCategoryPhotoWithApi,
  setPartPhotos,
  setPartStatus,
  touchStockCheck,
} from "@/lib/catalog";
import { isDrawing } from "@/lib/catalog/images";
import { normaliseSku } from "@/lib/catalog/sku";
import { type Category, isCategory } from "@/lib/catalog/types";
import { cancelOrder as cancelOrderWithApi, completeOrder as completeOrderWithApi } from "@/lib/orders/api";

// Every write goes to the API with the owner's session; the API checks
// ADMIN_EMAILS before touching stock and refuses everyone else.

function sku(raw: string): string {
  const value = normaliseSku(raw);
  if (!value) throw new Error("Invalid SKU");
  return value;
}

function category(raw: string): Category {
  if (!isCategory(raw)) throw new Error("Invalid category");
  return raw;
}

function refresh(partSku?: string) {
  revalidatePath("/admin");
  if (partSku) {
    revalidatePath(`/part/${partSku}`);
    revalidatePath(`/admin/photos/${partSku}`);
  }
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

// --- Photos -------------------------------------------------------------------
// The upload button sends one photo per call, already shrunk in the browser.
// Failures come back as words for the button to show, not as thrown errors.

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function photoFrom(form: FormData): File | { error: string } {
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choose a photo first." };
  if (!PHOTO_TYPES.has(photo.type)) return { error: "Send photos as JPEG, PNG, WebP or HEIC." };
  return photo;
}

async function sendPhoto(send: () => Promise<unknown>): Promise<PhotoResult> {
  try {
    await send();
    return { ok: true };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401 || error.status === 403) return { error: "Sign in again to add photos." };
    const detail = typeof error.body === "object" && error.body !== null && "detail" in error.body ? error.body.detail : null;
    return { error: typeof detail === "string" ? detail : "It didn't upload. Try again." };
  }
}

/** Appends one photo to the part's photos. */
export async function addPartPhoto(rawSku: string, form: FormData): Promise<PhotoResult> {
  const value = sku(rawSku);
  const photo = photoFrom(form);
  if (!(photo instanceof File)) return photo;
  const result = await sendPhoto(() => addPartPhotoWithApi(value, photo));
  refresh(value);
  return result;
}

async function changePhotos(rawSku: string, change: (photos: string[]) => string[]): Promise<void> {
  const value = sku(rawSku);
  const part = await getPart(value);
  if (!part) throw new Error("No part with that SKU");
  await setPartPhotos(value, change(part.images.filter((src) => !isDrawing(src))));
  refresh(value);
}

/** Moves a photo to the front: the card, gallery and WhatsApp preview photo. */
export async function makeCardPhoto(rawSku: string, src: string): Promise<void> {
  await changePhotos(rawSku, (photos) => [src, ...photos.filter((p) => p !== src)]);
}

/** Takes a photo off the part. It stays on Cloudinary. */
export async function removePartPhoto(rawSku: string, src: string): Promise<void> {
  await changePhotos(rawSku, (photos) => photos.filter((p) => p !== src));
}

/** Sets the home page tile photo for a category. */
export async function setCategoryPhoto(rawCategory: string, form: FormData): Promise<PhotoResult> {
  const value = category(rawCategory);
  const photo = photoFrom(form);
  if (!(photo instanceof File)) return photo;
  const result = await sendPhoto(() => setCategoryPhotoWithApi(value, photo));
  revalidatePath("/");
  revalidatePath("/admin");
  return result;
}

/** The tile goes back to a photo of a part in stock. */
export async function clearCategoryPhoto(rawCategory: string): Promise<void> {
  await clearCategoryPhotoWithApi(category(rawCategory));
  revalidatePath("/");
  revalidatePath("/admin");
}
