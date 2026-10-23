// Saved carts: a signed-in buyer's cart lines, so the website and the phone app
// show the same cart.
//
// Each client keeps its own cart and saves every change here; on sign-in its
// guest cart is merged in. Lines are SKU and quantity only and never reserve a
// unit (CLAUDE.md section 7): checkout re-reads status and price as for a guest.

import { prisma, type Tx } from "../db.js";

const MAX_LINES = 50;

export interface Line {
  sku: string;
  qty: number;
}

export function getCart(userId: string, db: Tx = prisma): Promise<Line[]> {
  return db.cartLine.findMany({ where: { userId }, orderBy: { lineNo: "asc" }, select: { sku: true, qty: true } });
}

/** The client's whole cart after a change. Last save wins. */
export function replaceCart(userId: string, lines: readonly Line[]): Promise<Line[]> {
  return prisma.$transaction(async (tx) => {
    await lock(tx, userId);
    return write(tx, userId, lines);
  });
}

/**
 * A guest cart joining the account at sign-in: saved lines first, then new ones.
 *
 * A part in both keeps the larger quantity, so merging the same cart twice
 * changes nothing.
 */
export function mergeCart(userId: string, lines: readonly Line[]): Promise<Line[]> {
  return prisma.$transaction(async (tx) => {
    await lock(tx, userId);
    return write(tx, userId, [...(await getCart(userId, tx)), ...lines]);
  });
}

/** Drops ordered parts from the saved cart, in the caller's transaction. */
export async function forgetOrdered(tx: Tx, userId: string, skus: readonly string[]): Promise<void> {
  await tx.cartLine.deleteMany({ where: { userId, sku: { in: [...skus] } } });
}

async function lock(tx: Tx, userId: string): Promise<void> {
  // One save per account at a time, so the website and the phone can't interleave.
  // Prisma has no SELECT … FOR UPDATE, so the lock is raw SQL.
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
}

async function write(tx: Tx, userId: string, lines: readonly Line[]): Promise<Line[]> {
  const wanted = new Map<string, number>();
  for (const { sku, qty } of lines) wanted.set(sku, Math.max(qty, wanted.get(sku) ?? 0));
  // Parts no longer in the catalog drop out.
  const listed = new Set(
    (await tx.part.findMany({ where: { sku: { in: [...wanted.keys()] } }, select: { sku: true } })).map((p) => p.sku),
  );
  const saved = [...wanted]
    .filter(([sku]) => listed.has(sku))
    .slice(0, MAX_LINES)
    .map(([sku, qty]) => ({ sku, qty }));

  await tx.cartLine.deleteMany({ where: { userId } });
  if (saved.length > 0) {
    await tx.cartLine.createMany({ data: saved.map(({ sku, qty }, lineNo) => ({ userId, sku, qty, lineNo })) });
  }
  return saved;
}
