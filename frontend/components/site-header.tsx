import { UserRound } from "lucide-react";
import Link from "next/link";

import { CartButton } from "@/components/cart-drawer";
import { SiteNav } from "@/components/site-nav";
import { VehicleChip } from "@/components/vehicle-picker";
import type { SessionUser } from "@/lib/auth";
import { vehicleShortLabel } from "@/lib/catalog/labels";
import type { Vehicle } from "@/lib/catalog/types";

export function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm" aria-label="De Car Revolutionist, home">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-[5px] bg-graphite font-display text-[17px] leading-none font-bold tracking-tight text-paper"
      >
        DC
      </span>
      <span aria-hidden className="font-display text-[19px] leading-[0.95] font-bold">
        De Car
        <br />
        Revolutionist
      </span>
    </Link>
  );
}

export function SiteHeader({
  vehicle,
  user,
  accountsEnabled,
}: {
  vehicle: Vehicle | null;
  user: SessionUser | null;
  accountsEnabled: boolean;
}) {
  const label = vehicle ? vehicleShortLabel(vehicle) : null;

  return (
    <header className="border-b border-primer bg-bay">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center gap-3">
          <Wordmark />
          <SiteNav className="ml-6 hidden md:block" />
          <div className="ml-auto flex items-center gap-1">
            <VehicleChip label={label} className="mr-2 hidden max-w-[280px] md:inline-flex" />
            {accountsEnabled ? (
              <Link
                href={user ? "/account" : "/signin"}
                className="flex h-11 items-center gap-2 rounded-md px-2.5 text-[15px] font-semibold hover:bg-paper"
              >
                <UserRound aria-hidden className="size-[22px]" />
                <span className="sr-only sm:not-sr-only">{user ? "Account" : "Sign in"}</span>
              </Link>
            ) : null}
            <CartButton />
          </div>
        </div>
        <div className="pb-3 md:hidden">
          <VehicleChip label={label} className="w-full" />
        </div>
      </div>
      <SiteNav className="border-t border-primer md:hidden" />
    </header>
  );
}
