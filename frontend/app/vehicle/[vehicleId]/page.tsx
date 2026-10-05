import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { chooseVehicle } from "@/app/actions/vehicle";
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
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="text-5xl leading-none font-bold">{vehicleLabel(vehicle)}</h1>
      <p className="mt-2 text-[17px]">
        {vehicleGenerationLabel(vehicle)}. {parts.length} {parts.length === 1 ? "part" : "parts"} confirmed to fit.
      </p>
      {isMine ? (
        <p className="mt-4 inline-flex rounded-md bg-tan px-3 py-2 font-semibold">This is your car</p>
      ) : (
        <form action={choose} className="mt-4">
          <Button type="submit">Make this my car</Button>
        </form>
      )}

      {CATEGORIES.map((category) => {
        const inCategory = parts.filter((p) => p.category === category);
        if (inCategory.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="mt-12">
            <h2 id={`cat-${category}`} className="text-3xl">
              {CATEGORY_INFO[category].label}
            </h2>
            <div className="mt-4">
              <PartGrid parts={inCategory} />
            </div>
          </section>
        );
      })}

      {parts.length === 0 ? (
        <p className="mt-10 rounded-md bg-paper px-5 py-8">
          Nothing on the shelf for this car right now. Message the shop on WhatsApp and we&apos;ll
          check the market for you.
        </p>
      ) : null}
    </div>
  );
}
