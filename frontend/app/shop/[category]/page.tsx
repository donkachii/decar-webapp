import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FilterChips } from "@/components/filter-chips";
import { PartGrid } from "@/components/part-card";
import { ChooseCarButton } from "@/components/vehicle-picker";
import { getParts } from "@/lib/catalog";
import {
  CATEGORY_INFO,
  CONDITION_INFO,
  POSITION_INFO,
  TYPE_INFO,
  vehicleLabel,
  vehicleShortLabel,
} from "@/lib/catalog/labels";
import { CATEGORY_TYPES, CONDITIONS, isCategory, type Position } from "@/lib/catalog/types";
import { TYPE_POSITIONS } from "@/lib/catalog/zones";
import { keepHref, parseList, setHref, toggleHref } from "@/lib/filters";
import { resolveListingVehicle } from "@/lib/vehicle";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return {};
  const info = CATEGORY_INFO[category];
  return {
    title: `${info.label} for Toyota and Lexus`,
    description: `${info.blurb}. Genuine Belgium and new, checked for fit at Zuba Market, Abuja.`,
  };
}

export default async function ShopPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  const sp = await searchParams;
  const pathname = `/shop/${category}`;

  const typeOptions = CATEGORY_TYPES[category];
  const positionOptions = [...new Set(typeOptions.flatMap((t) => TYPE_POSITIONS[t]))] as Position[];

  const types = parseList(sp.type, typeOptions);
  const conditions = parseList(sp.condition, CONDITIONS);
  const positions = parseList(sp.position, positionOptions);
  const { selected, filter, showAll } = await resolveListingVehicle(sp.vehicle);

  const parts = await getParts({ category, types, conditions, positions, vehicleId: filter?.id });
  const info = CATEGORY_INFO[category];
  const anyFilter = types.length + conditions.length + positions.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="text-5xl leading-none font-bold">{info.label}</h1>
      <p className="mt-2 text-[17px]">{info.blurb}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md bg-paper px-4 py-3">
        {filter ? (
          <>
            <p>
              Parts that fit your <strong className="font-semibold">{vehicleLabel(filter)}</strong>
            </p>
            <Link href={setHref(pathname, sp, "vehicle", "all")} className="text-sm font-semibold underline underline-offset-2">
              Show all cars
            </Link>
          </>
        ) : selected && showAll ? (
          <>
            <p>Showing parts for every car.</p>
            <Link href={setHref(pathname, sp, "vehicle", null)} className="text-sm font-semibold underline underline-offset-2">
              Only my {vehicleShortLabel(selected)}
            </Link>
          </>
        ) : (
          <>
            <p>Showing parts for every car. Choose yours to see only what fits.</p>
            <ChooseCarButton variant="outline" />
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {typeOptions.length > 1 ? (
          <FilterChips
            label="Part"
            options={typeOptions.map((t) => ({
              value: t,
              label: TYPE_INFO[t].plural,
              href: toggleHref(pathname, sp, "type", t),
              active: types.includes(t),
            }))}
          />
        ) : null}
        <FilterChips
          label="Position"
          options={positionOptions.map((p) => ({
            value: p,
            label: POSITION_INFO[p].label,
            href: toggleHref(pathname, sp, "position", p),
            active: positions.includes(p),
          }))}
        />
        <FilterChips
          label="Condition"
          options={CONDITIONS.map((c) => ({
            value: c,
            label: CONDITION_INFO[c].label,
            href: toggleHref(pathname, sp, "condition", c),
            active: conditions.includes(c),
          }))}
        />
      </div>

      <div className="mt-6 flex items-baseline justify-between border-t border-primer pt-4">
        <p className="font-semibold tabular" aria-live="polite">
          {parts.length} {parts.length === 1 ? "part" : "parts"}
        </p>
        {anyFilter ? (
          <Link href={keepHref(pathname, sp, ["vehicle"])} scroll={false} className="text-sm font-semibold underline underline-offset-2">
            Clear filters
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        {parts.length > 0 ? (
          <PartGrid parts={parts} preloadFirst={2} />
        ) : (
          <div className="rounded-md bg-paper px-5 py-10">
            <h2 className="text-2xl">Nothing on the shelf matches yet</h2>
            <p className="mt-2 max-w-[48ch]">
              {anyFilter ? "Try clearing a filter. " : ""}
              Or tell us what you need and we&apos;ll check the shop and the market for you.
            </p>
            <a
              href={whatsappLink(
                `Hello, I'm looking for ${info.label.toLowerCase()}${filter ? ` for my ${vehicleLabel(filter)}` : ""}.`,
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md border border-graphite px-4 font-semibold hover:bg-bay"
            >
              <MessageCircle aria-hidden className="size-[18px]" />
              Ask on WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
