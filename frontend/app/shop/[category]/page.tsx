import { cn } from "cn";
import { Car, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FilterChips } from "@/components/filter-chips";
import { BandTitle, PageBand } from "@/components/page-band";
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
import { CATEGORY_TYPES, CONDITIONS, isCategory, type Part, type Position } from "@/lib/catalog/types";
import { TYPE_POSITIONS } from "@/lib/catalog/zones";
import { keepHref, parseList, setHref, toggleHref } from "@/lib/filters";
import { resolveListingVehicle } from "@/lib/vehicle";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return {};
  const info = CATEGORY_INFO[category];
  return {
    title: `${info.label} for Japanese cars`,
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
  // Everything in the category for this car: chips only offer what can match.
  const forCar = anyFilter ? await getParts({ category, vehicleId: filter?.id }) : parts;
  // Nothing in the category for any car: skip the filters and say so.
  const listed = filter && forCar.length === 0 ? (await getParts({ category })).length : forCar.length;
  const offered = <T extends string>(values: readonly T[], active: T[], field: (p: Part) => T) =>
    values.filter((v) => active.includes(v) || forCar.some((p) => field(p) === v));
  const typeChips = offered(typeOptions, types, (p) => p.type);
  const positionChips = offered(positionOptions, positions, (p) => p.position);
  const conditionChips = offered(CONDITIONS, conditions, (p) => p.condition);
  // A row with one chip left would only repeat the list as it is.
  const worthShowing = (chips: readonly string[], active: string[]) => chips.length > 1 || active.length > 0;

  const band = (
    <PageBand>
      <BandTitle>{info.label}</BandTitle>
      <p className="mt-6 text-lg">{info.blurb}</p>
    </PageBand>
  );

  if (listed === 0) {
    return (
      <>
        {band}
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative -mt-12 rounded-2xl bg-paper px-5 py-8 shadow-lift sm:px-8">
            <h2 className="text-3xl">Not listed online yet</h2>
            <p className="mt-2 max-w-[52ch]">
              The shop stocks {info.blurb.toLowerCase()} for many Japanese cars. Tell us your car and
              the part, and we&apos;ll send photos and a price.
            </p>
            <a
              href={whatsappLink(
                `Hello, I'm looking for ${info.label.toLowerCase()}${selected ? ` for my ${vehicleLabel(selected)}` : ""}.`,
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-tan px-4 font-semibold hover:shadow-[inset_0_0_0_2px_var(--color-navy)]"
            >
              <MessageCircle aria-hidden className="size-[18px]" />
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </>
    );
  }

  const chipRows = [
    worthShowing(typeChips, types) ? (
      <FilterChips
        key="type"
        label="Part"
        options={typeChips.map((t) => ({
          value: t,
          label: TYPE_INFO[t].plural,
          href: toggleHref(pathname, sp, "type", t),
          active: types.includes(t),
        }))}
      />
    ) : null,
    worthShowing(positionChips, positions) ? (
      <FilterChips
        key="position"
        label="Position"
        options={positionChips.map((p) => ({
          value: p,
          label: POSITION_INFO[p].label,
          href: toggleHref(pathname, sp, "position", p),
          active: positions.includes(p),
        }))}
      />
    ) : null,
    worthShowing(conditionChips, conditions) ? (
      <FilterChips
        key="condition"
        label="Condition"
        options={conditionChips.map((c) => ({
          value: c,
          label: CONDITION_INFO[c].label,
          href: toggleHref(pathname, sp, "condition", c),
          active: conditions.includes(c),
        }))}
      />
    ) : null,
  ].filter((row) => row !== null);

  return (
    <>
      {band}
      <div className="mx-auto max-w-6xl px-4">
        <div className="relative -mt-12 rounded-2xl bg-paper shadow-lift">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <p className="flex min-w-0 items-center gap-3">
              {/* Tan marks a chosen car, as in the header. */}
              <span
                aria-hidden
                className={cn("grid size-9 shrink-0 place-items-center rounded-full", filter ? "bg-tan" : "bg-bay")}
              >
                <Car className="size-[18px]" />
              </span>
              <span>
                {filter ? (
                  <>
                    Parts that fit your <strong className="font-semibold">{vehicleLabel(filter)}</strong>
                  </>
                ) : selected && showAll ? (
                  "Showing parts for every car."
                ) : (
                  "Showing parts for every car. Choose yours to see only what fits."
                )}
              </span>
            </p>
            {filter ? (
              <Link href={setHref(pathname, sp, "vehicle", "all")} className="text-sm font-semibold underline underline-offset-2">
                Show all cars
              </Link>
            ) : selected && showAll ? (
              <Link href={setHref(pathname, sp, "vehicle", null)} className="text-sm font-semibold underline underline-offset-2">
                Only my {vehicleShortLabel(selected)}
              </Link>
            ) : (
              <ChooseCarButton variant="outline" className="h-10" />
            )}
          </div>
          {chipRows.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-navy/10 px-4 py-4 sm:px-5">{chipRows}</div>
          ) : null}
        </div>

        <div className="mt-8 flex items-baseline justify-between">
          <p className="font-display text-xl font-semibold tabular" aria-live="polite">
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
            <div className="rounded-2xl bg-paper px-5 py-10 shadow-card sm:px-8">
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
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg border border-navy px-4 font-semibold hover:bg-bay"
              >
                <MessageCircle aria-hidden className="size-[18px]" />
                Ask on WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
