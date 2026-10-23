// Photo writes from /admin: a part's photo list and the category tile photos.
//
// A part's list is read and written under a row lock, so an upload finishing
// while the owner removes another photo never loses either change. Photo
// changes are not stock checks: they leave stock_checked_at alone.

import { prisma } from "../db.js";
import { oneOf, PART_TYPES, type Category } from "../domain/catalog.js";
import { keptPhotos, withPhoto } from "../domain/photos.js";
import { UnknownSku } from "./orders.js";

/** The change wasn't allowed: too many photos, or a photo that isn't the part's. */
export class PhotosRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotosRefused";
  }
}

async function changeImages(sku: string, change: (images: string[], type: string) => string[]): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT sku FROM parts WHERE sku = ${sku} FOR UPDATE`;
    const part = await tx.part.findUnique({ where: { sku }, select: { images: true, type: true } });
    if (part === null) throw new UnknownSku(sku);
    const images = change(part.images, part.type);
    await tx.part.update({ where: { sku }, data: { images } });
    return images;
  });
}

/** Adds one uploaded photo at the end of the part's photos. Returns the new list. */
export function addPartPhoto(sku: string, src: string): Promise<string[]> {
  return changeImages(sku, (images) => {
    const next = withPhoto(images, src);
    if (next === null) throw new PhotosRefused("This part has as many photos as it can take. Remove one first.");
    return next;
  });
}

/** Reorders or removes the part's photos. Returns the new list. */
export function keepPartPhotos(sku: string, wanted: readonly string[]): Promise<string[]> {
  return changeImages(sku, (images, type) => {
    const next = keptPhotos(images, wanted, oneOf(PART_TYPES, type));
    if (next === null) throw new PhotosRefused("Only this part's own photos can be kept, each once.");
    return next;
  });
}

/** The owner's photo for each category tile; null where the tile uses a part's photo. */
export async function categoryPhotos(categories: readonly Category[]): Promise<Record<Category, string | null>> {
  const rows = await prisma.categoryPhoto.findMany();
  const byCategory = new Map(rows.map((r) => [r.category, r.image]));
  return Object.fromEntries(categories.map((c) => [c, byCategory.get(c) ?? null])) as Record<Category, string | null>;
}

export async function setCategoryPhoto(category: Category, image: string): Promise<void> {
  await prisma.categoryPhoto.upsert({ where: { category }, create: { category, image }, update: { image } });
}

export async function clearCategoryPhoto(category: Category): Promise<void> {
  await prisma.categoryPhoto.deleteMany({ where: { category } });
}
