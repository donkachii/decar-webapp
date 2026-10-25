import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { GradeSquare } from "@/components/condition-badge";
import { DamageSelector, type ZonePart } from "@/components/damage-selector";
import { Hero } from "@/components/hero";
import { PartGrid } from "@/components/part-card";
import { PartImage } from "@/components/part-image";
import { getCategoryPhotos, getParts } from "@/lib/catalog";
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

/** Section heading row: big title on the left, a quiet note on the right. */
function SectionHead({ id, title, note }: { id: string; title: string; note?: string | null }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <h2 id={id} className="text-[clamp(40px,6vw,72px)] leading-[0.92] font-bold">
        {title}
      </h2>
      {note ? <p className="text-[15px] text-primer">{note}</p> : null}
    </div>
  );
}

export default async function HomePage() {
  const vehicle = await getSelectedVehicle();
  const [parts, categoryPhotos] = await Promise.all([getParts({ vehicleId: vehicle?.id }), getCategoryPhotos()]);
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
    <div className="page-dark on-dark bg-navy text-paper">
      <Hero vehicle={vehicle} />

      <section aria-label="Our promise" className="relative border-y border-paper/10 bg-navy">
        <dl className="mx-auto grid max-w-6xl divide-y divide-paper/10 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {PROMISES.map(({ title, body }) => (
            <div key={title} className="py-6 sm:px-6 sm:py-8 sm:first:pl-0 sm:last:pr-0">
              <dt className="font-display text-2xl leading-tight font-semibold">{title}</dt>
              <dd className="mt-1 text-[15px] leading-snug text-primer">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="damage" className="bay-floor border-b border-paper/10">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <SectionHead
            id="damage"
            title="Where is the damage?"
            note={vehicle ? `Showing parts for your ${vehicleShortLabel(vehicle)}` : "Start with your car"}
          />
          <div className="mt-10">
            <DamageSelector
              vehicleShortLabel={vehicle ? vehicleShortLabel(vehicle) : null}
              vehicleLabel={vehicle ? vehicleLabel(vehicle) : null}
              parts={zoneParts}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="categories" className="mx-auto max-w-6xl px-4 pt-16 pb-8 lg:pt-24">
        <SectionHead
          id="categories"
          title="Shop by part"
          note={vehicle ? `Counted for your ${vehicleShortLabel(vehicle)}` : null}
        />
        <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const inCategory = available.filter((p) => p.category === category);
            // The owner's tile photo from /admin, else the first in-stock part photo, else a drawing.
            const partPhoto = inCategory.find((p) => !isDrawing(p.images[0]));
            const photo = categoryPhotos[category] ?? partPhoto?.images[0] ?? `/parts/${CATEGORY_TYPES[category][0]}.svg`;
            return (
              <li key={category} className="flex">
                <Link href={`/shop/${category}`} className="group flex w-full flex-col rounded-xl">
                  <PartImage
                    src={photo}
                    alt=""
                    position="n/a"
                    sizes="(min-width: 1024px) 270px, 50vw"
                    className="rounded-xl"
                  />
                  <span className="mt-4 flex items-center justify-between gap-2">
                    <span className="font-display text-[28px] leading-none font-bold sm:text-4xl">
                      {CATEGORY_INFO[category].label}
                    </span>
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-paper/30 transition-colors group-hover:border-tan group-hover:bg-tan group-hover:text-navy"
                    >
                      <ArrowUpRight className="size-4" />
                    </span>
                  </span>
                  <span className="mt-2 text-sm leading-snug text-primer">{CATEGORY_INFO[category].blurb}</span>
                  <span className="mt-auto pt-2 text-sm font-semibold tabular">
                    {inCategory.length === 0
                      ? "Not listed online yet"
                      : `${inCategory.length} in stock${vehicle ? ` for your ${vehicle.model}` : ""}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {justChecked.length > 0 ? (
        <section aria-labelledby="just-checked" className="mx-auto max-w-6xl px-4 pt-16 pb-8 lg:pt-24">
          <SectionHead id="just-checked" title="Just checked on the shelf" note="Freshest stock checks first" />
          <div className="on-light mt-8 text-navy">
            <PartGrid parts={justChecked} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="grades" className="mx-auto max-w-6xl px-4 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="on-light overflow-hidden rounded-2xl bg-paper text-navy">
          <div className="grid gap-3 p-5 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12">
            <h2 id="grades" className="text-4xl leading-none font-bold sm:text-5xl">
              How we grade every part
            </h2>
            <p className="max-w-[56ch] leading-relaxed">
              Belgium parts are genuine parts from foreign-used Japanese cars. Each unit is one of a
              kind, photographed and graded on its own. Visit us at {SITE.shopLine},{" "}
              {SITE.marketLine}.
            </p>
          </div>
          <dl className="grid divide-y divide-navy/10 border-t border-navy/10 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
            {CONDITIONS.map((c) => (
              <div key={c} className="flex gap-4 px-5 py-4 sm:px-8 lg:flex-col lg:gap-5 lg:px-6 lg:py-7">
                <GradeSquare condition={c} size="lg" />
                <div>
                  <dt className="font-display text-lg leading-tight font-semibold">{CONDITION_INFO[c].label}</dt>
                  <dd className="mt-1 text-[15px] leading-snug">{CONDITION_INFO[c].meaning}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
