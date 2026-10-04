import type { Metadata } from "next";

import { CheckoutForm } from "@/components/checkout-form";
import { getUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";
import { getDeliveryRates, listMyOrders } from "@/lib/orders/api";
import { getSelectedVehicle } from "@/lib/vehicle";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const [user, vehicle, features, rates] = await Promise.all([
    getUser(),
    getSelectedVehicle(),
    getFeatures(),
    getDeliveryRates(),
  ]);
  const lastOrder = user ? (await listMyOrders())[0] : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="text-5xl leading-none font-bold">Checkout</h1>
      <p className="mt-2 text-[17px]">
        {user
          ? `Signed in as ${user.email ?? user.name ?? "you"}.`
          : "No account needed. We only need a name and phone number to reach you."}
      </p>
      <CheckoutForm
        vehicleId={vehicle?.id ?? null}
        paystack={features.paystack}
        showSignIn={!user && features.googleSignIn}
        rates={rates}
        defaults={{
          name: user?.name ?? lastOrder?.customerName ?? "",
          email: user?.email ?? lastOrder?.customerEmail ?? "",
          phone: lastOrder?.customerPhone ?? "",
        }}
      />
    </div>
  );
}
