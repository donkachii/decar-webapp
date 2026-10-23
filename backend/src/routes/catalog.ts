import { Router } from "express";
import { z } from "zod";

import type { Settings } from "../config.js";
import { prisma } from "../db.js";
import { CATEGORIES, CONDITIONS, PART_TYPES, POSITIONS } from "../domain/catalog.js";
import { DELIVERY_RATES } from "../domain/delivery.js";
import { normaliseSku } from "../domain/sku.js";
import { HttpError, parse, pathParam, queryBool, queryValue, queryValues, text } from "../http.js";
import { type FitmentOut, partOut, vehicleOut } from "../schemas.js";
import { categoryPhotos } from "../services/photos.js";

const MAX_SKUS = 50;

const PartsQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  type: z.array(z.enum(PART_TYPES)).optional(),
  position: z.array(z.enum(POSITIONS)).optional(),
  condition: z.array(z.enum(CONDITIONS)).optional(),
  vehicleId: text(64).optional(),
  includeSold: queryBool.default(false),
});

const BySkuQuery = z.object({ sku: z.array(z.string()).min(1).max(MAX_SKUS) });

const FitmentQuery = z.object({
  partSku: z.array(z.string()).max(MAX_SKUS).optional(),
  vehicleId: text(64).optional(),
});

export function catalogRouter(settings: Settings): Router {
  const router = Router();

  router.get("/vehicles", async (_req, res) => {
    const rows = await prisma.vehicle.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }, { yearFrom: "asc" }] });
    res.json(rows.map(vehicleOut));
  });

  /** Listing filters. With vehicleId, only parts with a fitment row for that exact car (rule 1). */
  router.get("/parts", async (req, res) => {
    const q = parse(
      PartsQuery,
      {
        category: queryValue(req, "category"),
        type: queryValues(req, "type"),
        position: queryValues(req, "position"),
        condition: queryValues(req, "condition"),
        vehicleId: queryValue(req, "vehicleId"),
        includeSold: queryValue(req, "includeSold"),
      },
      "query",
    );
    const parts = await prisma.part.findMany({
      where: {
        ...(q.vehicleId ? { fitment: { some: { vehicleId: q.vehicleId } } } : {}),
        ...(q.includeSold ? {} : { status: { not: "sold" } }),
        ...(q.category ? { category: q.category } : {}),
        ...(q.type?.length ? { type: { in: q.type } } : {}),
        ...(q.position?.length ? { position: { in: q.position } } : {}),
        ...(q.condition?.length ? { condition: { in: q.condition } } : {}),
      },
      // Available units first, then reserved, then sold (alphabetical, so the
      // database sorts them), then most recently checked.
      orderBy: [{ status: "asc" }, { stockCheckedAt: "desc" }, { sku: "asc" }],
    });
    res.json(parts.map(partOut));
  });

  /** Fresh price and status for cart lines. Unknown SKUs are left out. */
  router.get("/parts/by-sku", async (req, res) => {
    const q = parse(BySkuQuery, { sku: queryValues(req, "sku") }, "query");
    const wanted = [...new Set(q.sku.map(normaliseSku).filter((sku) => sku !== null))];
    if (wanted.length === 0) {
      res.json([]);
      return;
    }
    const parts = await prisma.part.findMany({ where: { sku: { in: wanted } } });
    res.json(parts.map(partOut));
  });

  router.get("/parts/:sku", async (req, res) => {
    const sku = normaliseSku(pathParam(req, "sku"));
    const part = sku ? await prisma.part.findUnique({ where: { sku } }) : null;
    if (part === null) throw new HttpError(404, "No part with that SKU.");
    res.json(partOut(part));
  });

  router.get("/fitment", async (req, res) => {
    const q = parse(FitmentQuery, { partSku: queryValues(req, "partSku"), vehicleId: queryValue(req, "vehicleId") }, "query");
    const rows = await prisma.fitment.findMany({
      where: {
        ...(q.partSku ? { partSku: { in: q.partSku.map(normaliseSku).filter((sku) => sku !== null) } } : {}),
        ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
      },
    });
    res.json(rows.map((f): FitmentOut => ({ partSku: f.partSku, vehicleId: f.vehicleId, notes: f.notes })));
  });

  /** The owner's photo for each category tile; null where the tile uses a part's photo. */
  router.get("/categories/photos", async (_req, res) => {
    res.json(await categoryPhotos(CATEGORIES));
  });

  /** One fee per order, set by the largest shipping class in it. */
  router.get("/delivery/rates", (_req, res) => {
    res.json(DELIVERY_RATES);
  });

  /** What the clients should offer: Google sign-in, Paystack, demo admin, photo uploads in /admin. */
  router.get("/features", (_req, res) => {
    res.json({
      googleSignIn: settings.googleEnabled,
      paystack: settings.paystackEnabled,
      demoAdmin: settings.demoAdmin,
      photoUploads: settings.cloudinaryEnabled,
    });
  });

  return router;
}
