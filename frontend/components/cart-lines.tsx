"use client";

import { cn } from "cn";
import { CircleAlert, Minus, Plus } from "lucide-react";
import Link from "next/link";

import { ConditionBadge } from "@/components/condition-badge";
import { FitStatus } from "@/components/fit-status";
import { PartImage } from "@/components/part-image";
import { useCartActions, type CartLine, type CartPartView } from "@/lib/cart";
import { formatNGN } from "@/lib/format";
import { whatsappLink, orderMessage } from "@/lib/whatsapp";

export interface CartSummary {
  subtotal: number;
  blocked: boolean; // a line is sold, reserved or no longer listed
  ready: { line: CartLine; part: CartPartView }[];
}

export function summariseCart(lines: CartLine[], parts: Map<string, CartPartView>): CartSummary {
  let subtotal = 0;
  let blocked = false;
  const ready: CartSummary["ready"] = [];
  for (const line of lines) {
    const part = parts.get(line.sku);
    if (!part || part.status !== "available" || part.stockQty < line.qty) {
      blocked = true;
      continue;
    }
    subtotal += part.priceNGN * line.qty;
    ready.push({ line, part });
  }
  return { subtotal, blocked, ready };
}

export function cartWhatsappLink(summary: CartSummary, vehicleLabel: string | null): string {
  return whatsappLink(
    orderMessage({
      vehicleLabel,
      lines: summary.ready.map(({ line, part }) => ({
        sku: part.sku,
        title: part.title,
        priceNGN: part.priceNGN,
        qty: line.qty,
      })),
    }),
  );
}

export function CartLineList({
  lines,
  parts,
  loading,
  vehicleShortLabel,
  onNavigate,
}: {
  lines: CartLine[];
  parts: Map<string, CartPartView>;
  loading: boolean;
  vehicleShortLabel: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ul className="divide-y divide-bay">
      {lines.map((line) => (
        <CartLineRow
          key={line.sku}
          line={line}
          part={parts.get(line.sku)}
          loading={loading}
          vehicleShortLabel={vehicleShortLabel}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function CartLineRow({
  line,
  part,
  loading,
  vehicleShortLabel,
  onNavigate,
}: {
  line: CartLine;
  part: CartPartView | undefined;
  loading: boolean;
  vehicleShortLabel: string | null;
  onNavigate?: () => void;
}) {
  const { setQty, remove } = useCartActions();

  if (!part) {
    return (
      <li className="flex items-center gap-3 py-4">
        <div className="size-[72px] shrink-0 rounded-sm bg-bay" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm tabular">{line.sku}</p>
          <p className="mt-1 text-sm">{loading ? "Checking stock…" : "This part is no longer listed."}</p>
        </div>
        {!loading ? <RemoveButton onClick={() => remove(line.sku)} /> : null}
      </li>
    );
  }

  const unavailable = part.status !== "available" || part.stockQty < line.qty;

  return (
    <li className="flex gap-3 py-4">
      <Link href={`/part/${part.sku}`} onClick={onNavigate} className="shrink-0 rounded-sm">
        <PartImage
          src={part.image}
          alt=""
          position={part.position}
          sizes="72px"
          className="size-[72px] rounded-sm border border-bay"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/part/${part.sku}`}
            onClick={onNavigate}
            className="font-display text-lg leading-tight font-semibold hover:underline"
          >
            {part.title}
          </Link>
          <p className="shrink-0 font-display text-lg leading-tight font-bold tabular">
            {formatNGN(part.priceNGN * line.qty)}
          </p>
        </div>
        <ConditionBadge condition={part.condition} />
        <p className="text-[13px] tabular">{part.sku}</p>
        <FitStatus fits={part.fits} vehicleShortLabel={vehicleShortLabel} />

        {unavailable ? (
          <p className="flex items-start gap-1.5 text-sm font-semibold text-warn">
            <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
            {part.status === "sold"
              ? "Sold since you added it. Remove it to continue."
              : part.status === "reserved"
                ? "Reserved by another buyer. Remove it to continue."
                : `Only ${part.stockQty} left. Lower the quantity to continue.`}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-between gap-2">
          {part.belgium ? (
            <p className="text-sm">One unit available</p>
          ) : (
            <QtyStepper
              qty={line.qty}
              max={Math.max(1, part.stockQty)}
              onChange={(qty) => setQty(line.sku, qty, part.stockQty)}
              label={part.title}
            />
          )}
          <RemoveButton onClick={() => remove(line.sku)} />
        </div>
      </div>
    </li>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-sm px-2 text-sm font-semibold underline decoration-primer underline-offset-2 hover:decoration-navy"
    >
      Remove
    </button>
  );
}

function QtyStepper({
  qty,
  max,
  onChange,
  label,
}: {
  qty: number;
  max: number;
  onChange: (qty: number) => void;
  label: string;
}) {
  const btn =
    "grid size-9 place-items-center rounded-sm border border-primer bg-paper hover:border-navy disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" className={btn} onClick={() => onChange(qty - 1)} disabled={qty <= 1} aria-label="One fewer">
        <Minus aria-hidden className="size-4" />
      </button>
      <output aria-live="polite" className="w-8 text-center font-semibold tabular">
        {qty}
      </output>
      <button type="button" className={btn} onClick={() => onChange(qty + 1)} disabled={qty >= max} aria-label="One more">
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function CartSkeleton({ rows }: { rows: number }) {
  return (
    <ul aria-hidden className="divide-y divide-bay">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex gap-3 py-4">
          <div className="size-[72px] rounded-sm bg-bay" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-3/4 rounded-sm bg-bay" />
            <div className="h-4 w-1/3 rounded-sm bg-bay" />
            <div className={cn("h-4 w-1/2 rounded-sm bg-bay")} />
          </div>
        </li>
      ))}
    </ul>
  );
}
