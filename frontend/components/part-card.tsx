import Link from "next/link";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { ConditionBadge } from "@/components/condition-badge";
import { PartImage } from "@/components/part-image";
import { StockChecked } from "@/components/stock-checked";
import { partTitle, stockLine } from "@/lib/catalog/labels";
import type { Part } from "@/lib/catalog/types";
import { formatNGN } from "@/lib/format";

/** A parts-bay tag: photo, grade, what it is, price, and how fresh the stock check is. */
export function PartCard({ part, preload = false }: { part: Part; preload?: boolean }) {
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
            {title}
          </h3>
        </div>
      </Link>
      <div className="mt-auto flex flex-col gap-2 px-3 pt-2 pb-3">
        <div>
          <p className="font-display text-2xl leading-none font-bold tabular">{formatNGN(part.priceNGN)}</p>
          <p className={available ? "mt-1.5 text-[13px]" : "mt-1.5 text-[13px] font-semibold text-warn"}>
            {stockLine(part)}
          </p>
          <StockChecked at={part.stockCheckedAt} className="block text-[13px]" />
        </div>
        {available ? <AddToCartButton sku={part.sku} maxQty={part.stockQty} size="sm" /> : null}
      </div>
    </article>
  );
}

export function PartGrid({ parts, preloadFirst = 0 }: { parts: Part[]; preloadFirst?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {parts.map((part, i) => (
        <li key={part.sku} className="flex">
          <PartCard part={part} preload={i < preloadFirst} />
        </li>
      ))}
    </ul>
  );
}
