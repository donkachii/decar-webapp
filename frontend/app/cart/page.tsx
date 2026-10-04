import type { Metadata } from "next";

import { CartPageView } from "@/components/cart-page-view";
import { getDeliveryRates } from "@/lib/orders/api";
import { getSelectedVehicle } from "@/lib/vehicle";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false },
};

export default async function CartPage() {
  const [vehicle, rates] = await Promise.all([getSelectedVehicle(), getDeliveryRates()]);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="text-5xl leading-none font-bold">Your cart</h1>
      <CartPageView vehicleId={vehicle?.id ?? null} rates={rates} />
    </div>
  );
}
