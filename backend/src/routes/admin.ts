// Admin-lite for the owner's phone. Every route checks the signed-in owner first.

import { randomBytes } from "node:crypto";

import express, { type Request, Router } from "express";
import { z } from "zod";

import { requireAdmin } from "../auth.js";
import type { Settings } from "../config.js";
import { prisma } from "../db.js";
import { CATEGORIES, type Category } from "../domain/catalog.js";
import { adminPhotoName, MAX_PART_PHOTOS, MAX_PHOTO_BYTES, PHOTO_TYPES } from "../domain/photos.js";
import { normaliseSku } from "../domain/sku.js";
import { HttpError, parse, pathParam, pathUuid, queryValue } from "../http.js";
import { orderOut, PartStatusIn } from "../schemas.js";
import * as cloudinary from "../services/cloudinary.js";
import { cancelOrder, completeOrder, setPartStatus, touchStockCheck, UnknownSku } from "../services/orders.js";
import {
  addPartPhoto,
  clearCategoryPhoto,
  keepPartPhotos,
  PhotosRefused,
  setCategoryPhoto,
} from "../services/photos.js";

const OrdersQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
const PhotosIn = z.object({ images: z.array(z.string()).max(MAX_PART_PHOTOS) });

// A photo upload's body is the photo itself, with its own Content-Type.
const photoBody = express.raw({ type: [...PHOTO_TYPES], limit: MAX_PHOTO_BYTES });

function skuParam(req: Request): string {
  const sku = normaliseSku(pathParam(req, "sku"));
  if (sku === null) throw new HttpError(404, "No part with that SKU.");
  return sku;
}

function categoryParam(req: Request): Category {
  return parse(z.enum(CATEGORIES), pathParam(req, "category"), "path");
}

async function knownSku<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof UnknownSku) throw new HttpError(404, "No part with that SKU.");
    if (error instanceof PhotosRefused) throw new HttpError(422, error.message);
    throw error;
  }
}

function photoData(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(415, "Send one photo as the body: JPEG, PNG, WebP or HEIC.");
  }
  return req.body;
}

export function adminRouter(settings: Settings): Router {
  const router = Router();

  router.use(async (req, _res, next) => {
    await requireAdmin(req, settings);
    next();
  });

  /** Uploads to Cloudinary (signed, so only the API can) and returns the delivery URL. */
  async function upload(publicId: string, data: Buffer): Promise<string> {
    if (!settings.cloudinaryEnabled) throw new HttpError(503, "Photo uploads are off: set CLOUDINARY_URL on the API.");
    try {
      const account = cloudinary.parseCloudinaryUrl(settings.cloudinaryUrl);
      const version = await cloudinary.upload(account, { publicId, filename: "photo", data });
      return cloudinary.deliveryUrl(account, publicId, version);
    } catch (error) {
      if (error instanceof cloudinary.CloudinaryError) throw new HttpError(502, error.message);
      throw error;
    }
  }

  router.get("/orders", async (req, res) => {
    const { limit } = parse(OrdersQuery, { limit: queryValue(req, "limit") }, "query");
    const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { items: true } });
    res.json(orders.map(orderOut));
  });

  /** The "Mark as sold" and "Mark available" buttons. Stamps stock checked. */
  router.post("/parts/:sku/status", async (req, res) => {
    const { status } = parse(PartStatusIn, req.body, "body");
    await knownSku(() => setPartStatus(skuParam(req), status));
    res.status(204).end();
  });

  /** The "Checked it now" button: the unit is on the shelf. Stamps stock checked. */
  router.post("/parts/:sku/checked", async (req, res) => {
    await knownSku(() => touchStockCheck(skuParam(req)));
    res.status(204).end();
  });

  /** Adds one photo at the end of the part's photos. The body is the photo. */
  router.post("/parts/:sku/photos", photoBody, async (req, res) => {
    const sku = skuParam(req);
    const data = photoData(req);
    // Check before uploading, so a wrong SKU never leaves a photo nothing links to.
    if ((await prisma.part.count({ where: { sku } })) === 0) throw new HttpError(404, "No part with that SKU.");
    const src = await upload(`${cloudinary.ROOT}/parts/${sku}/${adminPhotoName(Date.now(), randomBytes(3).toString("hex"))}`, data);
    res.json({ images: await knownSku(() => addPartPhoto(sku, src)) });
  });

  /** Reorders or removes photos: the part's own photos, in the order to show them. */
  router.put("/parts/:sku/photos", async (req, res) => {
    const { images } = parse(PhotosIn, req.body, "body");
    res.json({ images: await knownSku(() => keepPartPhotos(skuParam(req), images)) });
  });

  /** Sets the category tile photo on the home page. The body is the photo. */
  router.post("/categories/:category/photo", photoBody, async (req, res) => {
    const category = categoryParam(req);
    const image = await upload(`${cloudinary.ROOT}/categories/${category}`, photoData(req));
    await setCategoryPhoto(category, image);
    res.json({ image });
  });

  /** The tile goes back to the first in-stock part photo in the category. */
  router.delete("/categories/:category/photo", async (req, res) => {
    await clearCategoryPhoto(categoryParam(req));
    res.status(204).end();
  });

  /** Handed over and paid: reserved units become sold. */
  router.post("/orders/:orderId/complete", async (req, res) => {
    await completeOrder(pathUuid(req, "orderId"));
    res.status(204).end();
  });

  /** Buyer backed out: units go back on the shelf. */
  router.post("/orders/:orderId/cancel", async (req, res) => {
    await cancelOrder(pathUuid(req, "orderId"));
    res.status(204).end();
  });

  return router;
}
