"use client";

import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { ConditionBadge } from "@/components/condition-badge";
import { PartImage } from "@/components/part-image";
import { StockChecked } from "@/components/stock-checked";
import { POSITION_INFO, partTitle, stockLine } from "@/lib/catalog/labels";
import { groupSides } from "@/lib/catalog/sides";
import type { Part } from "@/lib/catalog/types";
import { formatNGN } from "@/lib/format";

/**
 * A parts-bay tag: photo, grade, what it is, price, and how fresh the stock
 * check is. Given several sides of the same part, it shows a side picker and
 * everything below the picker follows the chosen side.
 */
export function PartCard({ sides, preload = false }: { sides: Part[]; preload?: boolean }) {
  const [index, setIndex] = useState(0);
  const part = sides[index] ?? sides[0];
  const picker = sides.length > 1;
  const title = partTitle(part);
  const available = part.status === "available";

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-md bg-paper">
      <Link href={`/part/${part.sku}`} className="group block rounded-md focus-visible:outline-offset-[-2px]">
        <PartImage
          src={part.images[0]}
          alt={title}
          position={part.position}
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
          preload={preload}
        />
        <div className="border-t border-bay px-3 pt-3">
          <ConditionBadge condition={part.condition} />
          <h3 className="mt-2 text-[17px] leading-[1.15] group-hover:underline group-hover:decoration-primer group-hover:underline-offset-2 sm:text-lg">
            {picker ? partTitle({ name: part.name, position: "n/a" }) : title}
          </h3>
        </div>
      </Link>
      <div className="mt-auto flex flex-col gap-2 px-3 pt-2 pb-3">
        {picker ? (
          <div role="group" aria-label="Side" className="flex flex-wrap gap-1.5">
            {sides.map((side, i) => (
              <button
                key={side.sku}
                type="button"
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-9 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                  i === index ? "border-tan bg-tan font-semibold" : "border-primer bg-paper hover:border-navy",
                )}
              >
                {sideLabel(sides, side)}
              </button>
            ))}
          </div>
        ) : null}
        <div>
          <p className="font-display text-2xl leading-none font-bold tabular">{formatNGN(part.priceNGN)}</p>
          <p className={available ? "mt-1.5 text-[13px]" : "mt-1.5 text-[13px] font-semibold text-warn"}>
            {stockLine(part)}
          </p>
          <StockChecked at={part.stockCheckedAt} className="block text-[13px]" />
        </div>
        {available ? <AddToCartButton key={part.sku} sku={part.sku} maxQty={part.stockQty} size="sm" /> : null}
      </div>
    </article>
  );
}

/** "Left" when every side shares its first word (front-left, front-right), else the full position. */
function sideLabel(sides: Part[], side: Part): string {
  const shared = sides[0].position.split("-")[0];
  if (!sides.every((p) => p.position.startsWith(`${shared}-`))) return POSITION_INFO[side.position].label;
  const rest = side.position.slice(shared.length + 1);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export function PartGrid({ parts, preloadFirst = 0 }: { parts: Part[]; preloadFirst?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {groupSides(parts).map((sides, i) => (
        <li key={sides[0].sku} className="flex">
          <PartCard sides={sides} preload={i < preloadFirst} />
        </li>
      ))}
    </ul>
  );
}
