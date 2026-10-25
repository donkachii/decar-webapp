import { Car, Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { chooseVehicle } from "@/app/actions/vehicle";
import { PageBand } from "@/components/page-band";
import { PartGrid } from "@/components/part-card";
import { Button } from "@/components/ui/button";
import { getParts, getVehicle } from "@/lib/catalog";
import { CATEGORY_INFO, plainText, vehicleGenerationLabel, vehicleLabel } from "@/lib/catalog/labels";
import { CATEGORIES } from "@/lib/catalog/types";
import { getSelectedVehicle } from "@/lib/vehicle";

export async function generateMetadata({ params }: PageProps<"/vehicle/[vehicleId]">): Promise<Metadata> {
  const vehicle = await getVehicle((await params).vehicleId);
  if (!vehicle) return { title: "Vehicle not found" };
  const label = plainText(vehicleLabel(vehicle));
  return {
    title: `Body parts for ${label}`,
    description: `Lights, bumpers, body panels and mirrors confirmed to fit the ${label} (${vehicleGenerationLabel(vehicle)}).`,
  };
}

export default async function VehiclePage({ params }: PageProps<"/vehicle/[vehicleId]">) {
  const vehicle = await getVehicle((await params).vehicleId);
  if (!vehicle) notFound();

  const [parts, selected] = await Promise.all([getParts({ vehicleId: vehicle.id }), getSelectedVehicle()]);
  const isMine = selected?.id === vehicle.id;
  const choose = chooseVehicle.bind(null, vehicle.id);

  return (
    <>
      <PageBand className="pb-12 sm:pb-14">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-6">
          <div>
            <Car aria-hidden className="size-9 text-primer" strokeWidth={1.5} />
            <h1 className="mt-3 text-[clamp(44px,7vw,88px)] leading-[0.9] font-bold">{vehicleLabel(vehicle)}</h1>
            <p className="mt-3 text-lg">
              {vehicleGenerationLabel(vehicle)}. {parts.length} {parts.length === 1 ? "part" : "parts"} confirmed to fit.
            </p>
          </div>
          {isMine ? (
            <p className="inline-flex h-11 items-center gap-2 rounded-lg bg-tan px-4 font-semibold text-navy">
              <Check aria-hidden className="size-[18px]" />
              This is your car
            </p>
          ) : (
            <form action={choose}>
              <Button type="submit" size="lg">
                Make this my car
              </Button>
            </form>
          )}
        </div>
      </PageBand>
      <div className="mx-auto max-w-6xl px-4">
        {CATEGORIES.map((category) => {
          const inCategory = parts.filter((p) => p.category === category);
          if (inCategory.length === 0) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`} className="mt-12">
              <h2 id={`cat-${category}`} className="flex items-baseline gap-3 text-3xl sm:text-4xl">
                {CATEGORY_INFO[category].label}
                <span className="font-sans text-base font-medium tabular">
                  {inCategory.length} {inCategory.length === 1 ? "part" : "parts"}
                </span>
              </h2>
              <div className="mt-4">
                <PartGrid parts={inCategory} />
              </div>
            </section>
          );
        })}

        {parts.length === 0 ? (
          <p className="mt-10 rounded-2xl bg-paper px-5 py-8 shadow-card sm:px-8">
            Nothing on the shelf for this car right now. Message the shop on WhatsApp and we&apos;ll
            check the market for you.
          </p>
        ) : null}
      </div>
    </>
  );
}
