import { CircleAlert, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { ConditionBadge } from "@/components/condition-badge";
import { FitStatus } from "@/components/fit-status";
import { PartGrid } from "@/components/part-card";
import { PartGallery } from "@/components/part-gallery";
import { PositionDiagram } from "@/components/position-diagram";
import { StockChecked } from "@/components/stock-checked";
import { ChooseCarButton } from "@/components/vehicle-picker";
import { getPart, getPartFitment, getParts, getReplacedTogether } from "@/lib/catalog";
import {
  CATEGORY_INFO,
  CONDITION_INFO,
  POSITION_INFO,
  SHIPPING_CLASS_INFO,
  TYPE_INFO,
  partTitle,
  plainText,
  stockLine,
  variantLabel,
  variantValue,
  vehicleGenerationLabel,
  vehicleLabel,
  vehicleShortLabel,
} from "@/lib/catalog/labels";
import { normaliseSku } from "@/lib/catalog/sku";
import { isBelgium, type Part } from "@/lib/catalog/types";
import { zoneFor } from "@/lib/catalog/zones";
import { SITE } from "@/lib/config/site";
import { formatNGN } from "@/lib/format";
import { getSelectedVehicle } from "@/lib/vehicle";
import { partEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

async function loadPart(raw: string): Promise<Part | null> {
  const sku = normaliseSku(raw);
  return sku ? getPart(sku) : null;
}

export async function generateMetadata({ params }: PageProps<"/part/[sku]">): Promise<Metadata> {
  const part = await loadPart((await params).sku);
  if (!part) return { title: "Part not found" };
  const title = `${plainText(partTitle(part))}, ${formatNGN(part.priceNGN)}`;
  const description = `${CONDITION_INFO[part.condition].label}. ${stockLine(part)}. ${SITE.name}, ${SITE.marketLine}.`;
  return {
    title,
    description,
    alternates: { canonical: `/part/${part.sku}` },
    openGraph: { title, description, url: `/part/${part.sku}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PartPage({ params }: PageProps<"/part/[sku]">) {
  const part = await loadPart((await params).sku);
  if (!part) notFound();

  const [fitment, selected, together] = await Promise.all([
    getPartFitment(part.sku),
    getSelectedVehicle(),
    getReplacedTogether(part),
  ]);

  const title = partTitle(part);
  const available = part.status === "available";
  const fits = selected ? fitment.some((f) => f.vehicleId === selected.id) : null;
  const zone = zoneFor(part.type, part.position);
  const variants = Object.entries(part.variants);
  const position = POSITION_INFO[part.position];
  const url = `${SITE.url}/part/${part.sku}`;

  const alternatives =
    available || fitment.length === 0
      ? []
      : (await getParts({ vehicleId: fitment[0].vehicleId, types: [part.type] })).filter(
          (p) => p.sku !== part.sku && p.status === "available",
        );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href={`/shop/${part.category}`} className="font-semibold underline underline-offset-2">
          {CATEGORY_INFO[part.category].label}
        </Link>
        <span aria-hidden className="px-2 text-primer">/</span>
        <Link
          href={`/shop/${part.category}?type=${part.type}`}
          className="font-semibold underline underline-offset-2"
        >
          {TYPE_INFO[part.type].plural}
        </Link>
      </nav>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <PartGallery images={part.images} alt={title} position={part.position} />
          {part.images[0]?.startsWith("/parts/") ? (
            <p className="mt-2 text-sm">Drawing shown. Ask on WhatsApp for photos of this unit.</p>
          ) : null}
        </div>

        <div>
          <ConditionBadge condition={part.condition} />
          <h1 className="mt-3 text-4xl leading-[1.02] font-bold sm:text-5xl">{title}</h1>
          <p className="mt-4 font-display text-[44px] leading-none font-bold tabular">
            {formatNGN(part.priceNGN)}
          </p>

          <div className="mt-4 space-y-1 text-[15px]">
            <p className={available ? "font-semibold" : "font-semibold text-warn"}>{stockLine(part)}</p>
            <StockChecked at={part.stockCheckedAt} className="block" />
          </div>

          <div className="mt-5">
            {selected ? (
              <FitStatus fits={fits} vehicleShortLabel={vehicleShortLabel(selected)} className="text-base" />
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-graphite px-3 py-2.5">
                <p className="text-[15px]">Choose your car to check this part fits it.</p>
                <ChooseCarButton variant="outline" className="h-9 px-3 text-sm" />
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-2 sm:max-w-sm">
            {available ? (
              <AddToCartButton sku={part.sku} maxQty={part.stockQty} size="lg" />
            ) : (
              <p className="flex items-start gap-2 rounded-md bg-paper px-3 py-3 font-semibold text-warn">
                <CircleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" />
                {part.status === "sold"
                  ? "This unit has been sold."
                  : "Another buyer has reserved this unit. Ask us if it comes back."}
              </p>
            )}
            <a
              href={whatsappLink(partEnquiryMessage({ sku: part.sku, title, url }))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-graphite bg-paper px-4 font-semibold hover:bg-bay"
            >
              <MessageCircle aria-hidden className="size-[18px]" />
              Ask about this part on WhatsApp
            </a>
          </div>

          <div className="mt-8 border-t border-primer">
            <SheetRow heading="Condition">
              <p className="font-semibold">{CONDITION_INFO[part.condition].label}</p>
              <p className="mt-1">{CONDITION_INFO[part.condition].meaning}</p>
              {part.defects?.length ? (
                <div className="mt-3 rounded-md bg-paper p-3">
                  <p className="font-semibold">What to know about this unit</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">
                    {part.defects.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SheetRow>

            <SheetRow heading="Position">
              <div className="flex items-center gap-4">
                {zone ? <PositionDiagram zone={zone} /> : null}
                <div>
                  <p className="font-semibold">{position.label}</p>
                  {position.hint ? <p className="mt-1">{position.hint}</p> : null}
                  <p className="mt-2 text-sm">Left and right as seen from the driver&apos;s seat.</p>
                </div>
              </div>
            </SheetRow>

            {variants.length > 0 ? (
              <SheetRow heading="Specification">
                <dl className="divide-y divide-bay">
                  {variants.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 py-1.5 first:pt-0">
                      <dt>{variantLabel(key)}</dt>
                      <dd className="font-semibold">{variantValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </SheetRow>
            ) : null}

            <SheetRow heading="Fits">
              <ul className="space-y-3">
                {fitment.map((f) => (
                  <li key={f.vehicleId}>
                    <Link href={`/vehicle/${f.vehicleId}`} className="font-semibold underline underline-offset-2">
                      {vehicleLabel(f.vehicle)}
                    </Link>
                    <p className="text-sm">{vehicleGenerationLabel(f.vehicle)}</p>
                    {f.notes ? <p className="mt-1">{f.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </SheetRow>

            <SheetRow heading="Details">
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt>SKU</dt>
                  <dd className="font-semibold tabular">{part.sku}</dd>
                </div>
                {part.oemNumber ? (
                  <div className="flex justify-between gap-4">
                    <dt>OEM number</dt>
                    <dd className="font-semibold tabular">{part.oemNumber}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt>Delivery size</dt>
                  <dd className="font-semibold">{SHIPPING_CLASS_INFO[part.shippingClass].label}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Units</dt>
                  <dd className="font-semibold">
                    {isBelgium(part.condition) ? "One-off unit" : "New stock"}
                  </dd>
                </div>
              </dl>
            </SheetRow>
          </div>
        </div>
      </div>

      {together.length > 0 ? (
        <section aria-labelledby="together" className="mt-14">
          <h2 id="together" className="text-3xl">
            Usually replaced together
          </h2>
          <p className="mt-1">From the same shelf, for the same car.</p>
          <div className="mt-5">
            <PartGrid parts={together} />
          </div>
        </section>
      ) : null}

      {alternatives.length > 0 ? (
        <section aria-labelledby="alternatives" className="mt-14">
          <h2 id="alternatives" className="text-3xl">
            Still on the shelf for this car
          </h2>
          <div className="mt-5">
            <PartGrid parts={alternatives} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SheetRow({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 border-b border-primer py-5 sm:grid-cols-[8.5rem_1fr] sm:gap-6">
      <h2 className="text-xl leading-tight">{heading}</h2>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}
