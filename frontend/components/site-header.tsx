import { MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CartButton } from "@/components/cart-drawer";
import { SiteNav } from "@/components/site-nav";
import { VehicleChip } from "@/components/vehicle-picker";
import type { SessionUser } from "@/lib/auth";
import { vehicleShortLabel } from "@/lib/catalog/labels";
import type { Vehicle } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { whatsappLink } from "@/lib/whatsapp";

export function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-sm" aria-label="De Car Revolutionist, home">
      {/* White mark on its wine tile, drawn by scripts/brand-assets.mjs. */}
      <Image src="/brand/mark-tile.svg" alt="" width={40} height={40} loading="eager" className="size-10 rounded-md" />
      <span aria-hidden className="font-display text-[19px] leading-[0.95] font-bold">
        De Car
        <br />
        Revolutionist
      </span>
    </Link>
  );
}

/** Wine strip above the header: where the shop is and how to reach it. */
function ShopStrip() {
  const [phone] = SITE.phones;
  return (
    <div className="on-dark bg-wine text-paper">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-4 px-4 text-[13px]">
        <p className="flex min-w-0 items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-primer" />
          <span className="truncate">
            <span className="hidden sm:inline">{SITE.shopLine}, </span>
            {SITE.marketLine}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-4">
          <a href={`tel:${phone.tel}`} className="flex items-center gap-1.5 font-semibold tabular hover:underline">
            <Phone aria-hidden className="size-3.5 text-primer" />
            {phone.label}
          </a>
          <a
            href={whatsappLink(`Hello ${SITE.name}, I'm looking for a part.`)}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 font-semibold hover:underline sm:flex"
          >
            <MessageCircle aria-hidden className="size-3.5 text-primer" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({
  vehicle,
  user,
}: {
  vehicle: Vehicle | null;
  user: SessionUser | null;
}) {
  const label = vehicle ? vehicleShortLabel(vehicle) : null;

  return (
    <>
      <ShopStrip />
      {/* Pinned on wider screens only: on a phone the three rows would take a third of the screen.
          Named so it holds still while pages crossfade (globals.css). */}
      <header
        style={{ viewTransitionName: "site-header" }}
        className="on-dark z-40 border-b border-paper/10 bg-navy text-paper md:sticky md:top-0"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-16 items-center gap-3">
            <Wordmark />
            <SiteNav className="ml-8 hidden self-stretch md:block" />
            <div className="ml-auto flex items-center gap-1">
              <VehicleChip label={label} className="mr-2 hidden max-w-[280px] md:inline-flex" />
              <Link
                href={user ? "/account" : "/signin"}
                className="flex h-11 items-center gap-2 rounded-lg px-2.5 text-[15px] font-semibold transition-colors hover:bg-paper/10"
              >
                <UserRound aria-hidden className="size-[22px]" />
                <span className="sr-only sm:not-sr-only">{user ? "Account" : "Sign in"}</span>
              </Link>
              <CartButton />
            </div>
          </div>
          <div className="pb-3 md:hidden">
            <VehicleChip label={label} className="w-full" />
          </div>
        </div>
        <SiteNav className="border-t border-paper/10 md:hidden" />
      </header>
    </>
  );
}
