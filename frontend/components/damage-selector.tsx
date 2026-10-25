"use client";

import { cn } from "cn";
import { Check, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { CarTopView } from "@/components/car-top-view";
import { ConditionBadge } from "@/components/condition-badge";
import { PartImage } from "@/components/part-image";
import { ChooseCarButton } from "@/components/vehicle-picker";
import type { Condition, Position } from "@/lib/catalog/types";
import { ZONE_LABELS, type Zone } from "@/lib/catalog/zones";
import { formatNGN } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export interface ZonePart {
  sku: string;
  title: string;
  position: Position;
  condition: Condition;
  priceNGN: number;
  stockQty: number;
  image: string | null;
  zone: Zone;
}

// Grid cells over the 300 x 440 drawing: columns 0–32–68–100%, rows 0–30–70–100%.
const CELLS: { zone: Zone; area: string; align: string }[] = [
  { zone: "front-left", area: "left-0 top-0 w-[32%] h-[30%]", align: "items-start justify-start" },
  { zone: "front", area: "left-[32%] top-0 w-[36%] h-[30%]", align: "items-start justify-center" },
  { zone: "front-right", area: "right-0 top-0 w-[32%] h-[30%]", align: "items-start justify-end text-right" },
  { zone: "left", area: "left-0 top-[30%] w-[32%] h-[40%]", align: "items-center justify-start" },
  { zone: "right", area: "right-0 top-[30%] w-[32%] h-[40%]", align: "items-center justify-end text-right" },
  { zone: "rear-left", area: "left-0 bottom-0 w-[32%] h-[30%]", align: "items-end justify-start" },
  { zone: "rear", area: "left-[32%] bottom-0 w-[36%] h-[30%]", align: "items-end justify-center" },
  { zone: "rear-right", area: "right-0 bottom-0 w-[32%] h-[30%]", align: "items-end justify-end text-right" },
];

/**
 * Tap the damaged area of the car; the parts for that area on the selected
 * vehicle appear beside it. The one bold element on the site: it sits on the
 * navy bay floor (`on-dark`), with results on a paper card (`on-light`).
 */
export function DamageSelector({
  vehicleShortLabel,
  vehicleLabel,
  parts,
}: {
  vehicleShortLabel: string | null;
  vehicleLabel: string | null;
  parts: ZonePart[];
}) {
  const [zone, setZone] = useState<Zone | null>(null);
  const hasVehicle = vehicleShortLabel !== null;
  const counts = new Map<Zone, number>();
  for (const p of parts) counts.set(p.zone, (counts.get(p.zone) ?? 0) + 1);
  const inZone = zone ? parts.filter((p) => p.zone === zone) : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-start">
      <div className="relative mx-auto aspect-[300/440] w-full max-w-[300px] text-paper">
        <div role="group" aria-label="Damaged area" className="absolute inset-0">
          {CELLS.map(({ zone: z, area, align }) => {
            const selected = zone === z;
            const count = counts.get(z) ?? 0;
            return (
              <button
                key={z}
                type="button"
                aria-pressed={selected}
                onClick={() => setZone(selected ? null : z)}
                className={cn("group absolute flex p-2", area, align)}
              >
                {/* Floor marking: dashed until chosen, then a solid tan bay. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-[3px] rounded-lg transition-colors duration-150",
                    selected
                      ? "border-2 border-tan bg-tan/15"
                      : "border border-dashed border-primer/60 group-hover:border-primer group-hover:bg-paper/[0.06]",
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 flex flex-col gap-0.5 text-[13px] leading-tight font-semibold",
                    (z === "left" || z === "right") && "max-w-[3.25rem]",
                    (z === "front" || z === "rear") && "flex-row items-baseline gap-1.5",
                    (z === "front-right" || z === "right" || z === "rear-right") && "items-end",
                  )}
                >
                  <span className={cn("w-fit transition-colors", selected && "rounded-[4px] bg-tan px-1.5 py-0.5 text-navy")}>
                    {ZONE_LABELS[z]}
                  </span>
                  {hasVehicle ? (
                    <span className={cn("font-medium tabular", selected ? "text-tan" : "text-primer")}>
                      {count === 0 ? "none" : `${count} ${count === 1 ? "part" : "parts"}`}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <CarTopView className="pointer-events-none absolute inset-0 z-[5] size-full" />
        <p className="pointer-events-none absolute top-[44%] left-1/2 z-10 w-[30%] -translate-x-1/2 text-center text-[13px] leading-snug font-semibold">
          {hasVehicle ? "Tap where it's damaged" : "Choose your car first"}
        </p>
      </div>

      <div aria-live="polite" className="flex min-h-24 flex-col md:self-stretch">
        {zone === null ? (
          <ZoneIntro hasVehicle={hasVehicle} vehicleShortLabel={vehicleShortLabel} total={parts.length} />
        ) : (
          <div key={zone} className="on-light animate-settle rounded-xl bg-paper p-4 text-navy sm:p-5">
            <h3 className="text-2xl leading-tight">
              {ZONE_LABELS[zone]}
              {hasVehicle ? <span className="font-semibold">, {vehicleShortLabel}</span> : null}
            </h3>
            {!hasVehicle ? (
              <div className="mt-2">
                <p className="max-w-[40ch]">
                  Choose your car and we&apos;ll show the parts for this area that fit it.
                </p>
                <ChooseCarButton className="mt-4" />
              </div>
            ) : inZone.length === 0 ? (
              <EmptyZone zone={zone} vehicleLabel={vehicleLabel} />
            ) : (
              <ul className="mt-3 divide-y divide-navy/10">
                {inZone.map((p) => (
                  <li key={p.sku} className="flex gap-3 py-3 first:pt-1 last:pb-0">
                    <Link href={`/part/${p.sku}`} className="shrink-0 rounded-md">
                      <PartImage
                        src={p.image}
                        alt=""
                        position={p.position}
                        sizes="72px"
                        className="size-[72px] rounded-md shadow-card"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Link
                        href={`/part/${p.sku}`}
                        className="font-display text-lg leading-tight font-semibold hover:underline hover:decoration-primer hover:underline-offset-2"
                      >
                        {p.title}
                      </Link>
                      <ConditionBadge condition={p.condition} />
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <p className="font-display text-xl font-bold tabular">{formatNGN(p.priceNGN)}</p>
                        <AddToCartButton sku={p.sku} maxQty={p.stockQty} size="sm" className="w-auto" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ZoneIntro({
  hasVehicle,
  vehicleShortLabel,
  total,
}: {
  hasVehicle: boolean;
  vehicleShortLabel: string | null;
  total: number;
}) {
  const steps = [
    { done: hasVehicle, text: hasVehicle ? `Car chosen: ${vehicleShortLabel}` : "Choose your car" },
    { done: false, text: "Tap the damaged area" },
    { done: false, text: "Add the part, then check out or finish on WhatsApp" },
  ];
  return (
    <>
      {hasVehicle ? (
        <div className="md:pt-2">
          <p className="max-w-[34ch] text-[17px] leading-relaxed">
            Tap the area that was hit and we&apos;ll show the parts in stock for your {vehicleShortLabel}.
          </p>
          <p className="mt-3 text-[15px] text-primer tabular">
            {total === 0
              ? "Nothing listed for it yet. Ask us on WhatsApp."
              : `${total} ${total === 1 ? "part" : "parts"} on the shelf for it right now.`}
          </p>
        </div>
      ) : (
        <div className="md:pt-2">
          <p className="max-w-[34ch] text-[17px] leading-relaxed">
            Tell us your car, then tap the area that was hit. We&apos;ll show only the parts confirmed to
            fit, with their grade and price.
          </p>
          <ChooseCarButton className="mt-5" />
        </div>
      )}
      {/* Wide screens have room beside the car for the whole flow. */}
      <ol className="mt-auto hidden space-y-3 border-t border-primer/30 pt-5 md:block">
        {steps.map((step, i) => (
          <li key={step.text} className="flex items-center gap-3 text-[15px] leading-snug">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-bold tabular",
                step.done ? "bg-tan text-navy" : "border border-primer/70",
              )}
            >
              {step.done ? <Check aria-label="Done" className="size-4" strokeWidth={2.5} /> : i + 1}
            </span>
            {step.text}
          </li>
        ))}
      </ol>
    </>
  );
}

function EmptyZone({ zone, vehicleLabel }: { zone: Zone; vehicleLabel: string | null }) {
  const message = `Hello, I need a ${ZONE_LABELS[zone].toLowerCase()} part for my ${vehicleLabel ?? "car"}. Do you have one?`;
  return (
    <div className="mt-2">
      <p className="max-w-[42ch]">
        Nothing for this area on the shelf right now. Tell us what you need and we&apos;ll check the shop
        and the market.
      </p>
      <a
        href={whatsappLink(message)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-navy bg-paper px-4 font-semibold hover:bg-bay"
      >
        <MessageCircle aria-hidden className="size-[18px]" />
        Ask on WhatsApp
      </a>
    </div>
  );
}
