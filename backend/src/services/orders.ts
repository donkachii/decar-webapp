// Stock and order transactions.
//
// Placing an order (not adding to cart) reserves units. It locks the part rows,
// re-reads status and price, and reserves in one transaction, so two buyers can
// never both get the same Belgium unit.
//
// Prisma has no SELECT … FOR UPDATE, so each lock is one raw statement; the
// locked rows are then read and written with the typed client in the same
// transaction. Writes that stamp stock_checked_at are raw too, so the stamp is
// the database's now(), like every other timestamp.

import { type Part, prisma, type Tx } from "../db.js";
import { isBelgium, oneOf, POSITIONS, type PartStatus, SHIPPING_CLASSES } from "../domain/catalog.js";
import type { Checkout } from "../domain/checkout.js";
import { deliveryFee } from "../domain/delivery.js";
import { partTitle } from "../domain/labels.js";
import type { OrderWithItems } from "../schemas.js";
import { forgetOrdered } from "./carts.js";

export interface Unavailable {
  unavailable: string[];
}

export class UnknownSku extends Error {
  constructor(sku: string) {
    super(`No part ${sku}`);
    this.name = "UnknownSku";
  }
}

// Interactive transactions time out after 5 s by default. A 30-line checkout on
// a slow connection to the database can take longer than that.
const TRANSACTION = { maxWait: 10_000, timeout: 20_000 };

/** Locks the parts in SKU order, so concurrent checkouts can't deadlock, then reads them. */
async function lockParts(tx: Tx, skus: readonly string[]): Promise<Map<string, Part>> {
  await tx.$queryRaw`SELECT sku FROM parts WHERE sku = ANY(${[...skus]}) ORDER BY sku FOR UPDATE`;
  const parts = await tx.part.findMany({ where: { sku: { in: [...skus] } } });
  return new Map(parts.map((p) => [p.sku, p]));
}

export function placeOrder(checkout: Checkout, userId: string | null): Promise<OrderWithItems | Unavailable> {
  const skus = checkout.lines.map((line) => line.sku).sort();
  return prisma.$transaction(async (tx) => {
    const parts = await lockParts(tx, skus);

    const unavailable = checkout.lines
      .filter((line) => {
        const part = parts.get(line.sku);
        return part === undefined || part.status !== "available" || part.stockQty < line.qty;
      })
      .map((line) => line.sku);
    // Nothing written yet, so ending the transaction just releases the locks.
    if (unavailable.length > 0) return { unavailable };

    let vehicleId = checkout.vehicleId;
    if (vehicleId && (await tx.vehicle.findUnique({ where: { id: vehicleId } })) === null) vehicleId = null;

    const ordered = checkout.lines.map((line) => ({ line, part: parts.get(line.sku) as Part }));
    const items = ordered.map(({ line, part }) => ({
      sku: line.sku,
      name: partTitle(part.name, oneOf(POSITIONS, part.position)),
      priceNGN: part.priceNGN,
      qty: line.qty,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.priceNGN * item.qty, 0);
    const fee = deliveryFee(
      checkout.delivery,
      ordered.map(({ part }) => oneOf(SHIPPING_CLASSES, part.shippingClass)),
    );
    const [next] = await tx.$queryRaw<{ number: bigint }[]>`SELECT nextval('order_number_seq') AS number`;
    if (next === undefined) throw new Error("order_number_seq returned nothing");

    const order = await tx.order.create({
      data: {
        number: `DCR-${String(next.number).padStart(5, "0")}`,
        userId,
        customerName: checkout.name,
        customerPhone: checkout.phone,
        customerEmail: checkout.email,
        vehicleId,
        deliveryOption: checkout.delivery,
        deliveryAddress: checkout.address,
        deliveryState: checkout.state,
        deliveryPark: checkout.park,
        deliveryFeeNGN: fee,
        subtotalNGN: subtotal,
        totalNGN: subtotal + fee,
        paymentMethod: checkout.payment,
        paymentStatus: "pending",
        status: "new",
        notes: checkout.notes,
        items: { create: items },
      },
      include: { items: true },
    });

    for (const { line, part } of ordered) {
      const stockQty = part.stockQty - line.qty;
      const reserve = isBelgium(part.condition) || stockQty === 0;
      await tx.part.update({
        where: { sku: part.sku },
        data: reserve ? { stockQty, status: "reserved" } : { stockQty },
      });
    }

    // Ordered parts leave the buyer's saved cart, so the other device doesn't bring them back.
    if (userId !== null) await forgetOrdered(tx, userId, skus);

    // Items in the order the buyer listed them.
    const position = new Map(checkout.lines.map((line, index) => [line.sku, index]));
    order.items.sort((a, b) => (position.get(a.sku) ?? 0) - (position.get(b.sku) ?? 0));
    return order;
  }, TRANSACTION);
}

export function getOrder(orderId: string): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

async function lockNewOrder(tx: Tx, orderId: string): Promise<OrderWithItems | null> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  return order !== null && order.status === "new" ? order : null;
}

function orderSkus(order: OrderWithItems): string[] {
  return order.items.map((item) => item.sku).sort();
}

/** Handed over and paid: reserved units become sold. */
export async function completeOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await lockNewOrder(tx, orderId);
    if (order === null) return;
    await tx.order.update({ where: { id: orderId }, data: { status: "completed" } });
    const parts = await lockParts(tx, orderSkus(order));
    const reserved = [...parts.values()].filter((p) => p.status === "reserved").map((p) => p.sku);
    if (reserved.length > 0) {
      await tx.$executeRaw`UPDATE parts SET status = 'sold', stock_checked_at = now() WHERE sku = ANY(${reserved})`;
    }
  }, TRANSACTION);
}

/** Buyer backed out: units go back on the shelf. */
export async function cancelOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await lockNewOrder(tx, orderId);
    if (order === null) return;
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
    const parts = await lockParts(tx, orderSkus(order));
    for (const item of order.items) {
      const part = parts.get(item.sku);
      if (part === undefined || part.status === "sold") continue;
      await tx.part.update({
        where: { sku: part.sku },
        data: { stockQty: isBelgium(part.condition) ? 1 : part.stockQty + item.qty, status: "available" },
      });
    }
  }, TRANSACTION);
}

/** Admin-lite: mark a unit sold or available. Always stamps stock_checked_at. */
export async function setPartStatus(sku: string, status: PartStatus): Promise<void> {
  const updated = await prisma.$executeRaw`
    UPDATE parts
    SET status = ${status},
        stock_qty = CASE ${status}::text
          WHEN 'sold' THEN 0
          WHEN 'available' THEN greatest(stock_qty, 1)
          ELSE stock_qty
        END,
        stock_checked_at = now()
    WHERE sku = ${sku}`;
  if (updated === 0) throw new UnknownSku(sku);
}

/** The "Checked it now" button: the unit is on the shelf. */
export async function touchStockCheck(sku: string): Promise<void> {
  const updated = await prisma.$executeRaw`UPDATE parts SET stock_checked_at = now() WHERE sku = ${sku}`;
  if (updated === 0) throw new UnknownSku(sku);
}
