import Image from "next/image";
import Link from "next/link";

import { DamageSelector, type ZonePart } from "@/components/damage-selector";
import { PartGrid } from "@/components/part-card";
import { PartImage } from "@/components/part-image";
import { getParts } from "@/lib/catalog";
import { isDrawing } from "@/lib/catalog/images";
import {
  CATEGORY_INFO,
  CONDITION_INFO,
  partTitle,
  vehicleLabel,
  vehicleShortLabel,
} from "@/lib/catalog/labels";
import { groupSides } from "@/lib/catalog/sides";
import { CATEGORIES, CATEGORY_TYPES, CONDITIONS } from "@/lib/catalog/types";
import { zoneFor } from "@/lib/catalog/zones";
import { SITE } from "@/lib/config/site";
import { getSelectedVehicle } from "@/lib/vehicle";

const PROMISES = [
  { title: "Checked for fit", body: "Matched to your car's generation and facelift, never just the year." },
  { title: "Graded honestly", body: "Every Belgium unit is graded A, B or C, with defects written down." },
  { title: "Stock you can trust", body: "Each unit shows when we last checked it on the shelf." },
];

export default async function HomePage() {
  const vehicle = await getSelectedVehicle();
  const parts = await getParts({ vehicleId: vehicle?.id });
  const available = parts.filter((p) => p.status === "available");

  const zoneParts: ZonePart[] = vehicle
    ? available.flatMap((p) => {
        const zone = zoneFor(p.type, p.position);
        return zone
          ? [
              {
                sku: p.sku,
                title: partTitle(p),
                position: p.position,
                condition: p.condition,
                priceNGN: p.priceNGN,
                stockQty: p.stockQty,
                image: p.images[0] ?? null,
                zone,
              },
            ]
          : [];
      })
    : [];

  // Four cards; both sides of a fender share one, so count cards, not parts.
  const justChecked = groupSides(
    [...available].sort((a, b) => b.stockCheckedAt.localeCompare(a.stockCheckedAt)),
  )
    .slice(0, 4)
    .flat();

  return (
    <>
      {/* Phones: headline, damage selector, then the promises. Desktop: promises under the headline. */}
      <section className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-8 pb-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-8 lg:pt-14">
        <div className="lg:pt-6">
          <h1 className="text-[44px] leading-[0.92] font-bold sm:text-6xl lg:text-[76px]">
            The right part for your Toyota or Lexus. First time.
          </h1>
          <p className="mt-5 max-w-[44ch] text-lg leading-relaxed">
            Genuine Belgium and new body parts from Zuba Market, checked for fit before they leave
            the shop.
          </p>
        </div>

        <div className="rounded-lg bg-paper p-4 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h2 className="text-[28px] leading-tight">Where is the damage?</h2>
          <p className="mt-1 text-[15px]">
            {vehicle ? `Showing parts for your ${vehicleShortLabel(vehicle)}.` : "Start with your car."}
          </p>
          <div className="mt-5">
            <DamageSelector
              vehicleShortLabel={vehicle ? vehicleShortLabel(vehicle) : null}
              vehicleLabel={vehicle ? vehicleLabel(vehicle) : null}
              parts={zoneParts}
            />
          </div>
        </div>

        <dl className="max-w-md border-t border-primer lg:col-start-1 lg:row-start-2 lg:self-start">
          {PROMISES.map((p) => (
            <div
              key={p.title}
              className="grid gap-0.5 border-b border-primer py-3 sm:grid-cols-[9rem_1fr] sm:gap-4"
            >
              <dt className="font-display text-lg font-semibold">{p.title}</dt>
              <dd className="text-[15px]">{p.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="categories" className="mx-auto max-w-6xl px-4 pb-14">
        <h2 id="categories" className="text-3xl">
          Shop by part
        </h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const inCategory = available.filter((p) => p.category === category);
            const photo = inCategory.find((p) => !isDrawing(p.images[0]));
            return (
              <li key={category} className="flex">
                <Link
                  href={`/shop/${category}`}
                  className="group flex w-full flex-col overflow-hidden rounded-md bg-paper hover:shadow-[0_0_0_1.5px_var(--color-navy)]"
                >
                  {photo ? (
                    <PartImage
                      src={photo.images[0]}
                      alt=""
                      position={photo.position}
                      sizes="(min-width: 1024px) 270px, 50vw"
                      className="aspect-[4/3]"
                    />
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center border-b border-bay">
                      <Image
                        src={`/parts/${CATEGORY_TYPES[category][0]}.svg`}
                        alt=""
                        width={96}
                        height={96}
                        unoptimized
                        className="size-20 sm:size-24"
                      />
                    </div>
                  )}
                  <span className="flex flex-1 flex-col p-3 sm:p-4">
                    <span className="font-display text-2xl leading-none font-bold group-hover:underline group-hover:decoration-primer group-hover:underline-offset-2">
                      {CATEGORY_INFO[category].label}
                    </span>
                    <span className="mt-1.5 text-sm">{CATEGORY_INFO[category].blurb}</span>
                    <span className="mt-auto pt-3 text-sm font-semibold tabular">
                      {inCategory.length === 0
                        ? "Not listed online yet"
                        : `${inCategory.length} in stock${vehicle ? ` for your ${vehicle.model}` : ""}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {justChecked.length > 0 ? (
        <section aria-labelledby="just-checked" className="mx-auto max-w-6xl px-4 pb-14">
          <div className="flex items-end justify-between gap-4">
            <h2 id="just-checked" className="text-3xl">
              Just checked on the shelf
            </h2>
          </div>
          <div className="mt-5">
            <PartGrid parts={justChecked} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="grades" className="mx-auto max-w-6xl px-4 pb-6">
        <div className="grid gap-8 rounded-lg bg-paper p-5 sm:p-8 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 id="grades" className="text-3xl">
              How we grade every part
            </h2>
            <p className="mt-3 max-w-[40ch]">
              Belgium parts are genuine Toyota and Lexus parts from foreign-used cars. Each unit is
              one of a kind, photographed and graded on its own.
            </p>
            <p className="mt-5 text-[15px]">
              Visit us at {SITE.shopLine}, {SITE.marketLine}.
            </p>
          </div>
          <dl className="divide-y divide-bay">
            {CONDITIONS.map((c) => (
              <div key={c} className="grid gap-0.5 py-3 first:pt-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
                <dt className="font-semibold">{CONDITION_INFO[c].label}</dt>
                <dd>{CONDITION_INFO[c].meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
