import { MapPin, MessageCircle, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CATEGORY_INFO } from "@/lib/catalog/labels";
import { CATEGORIES } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { whatsappLink } from "@/lib/whatsapp";

export function SiteFooter() {
  return (
    // A navy page (`page-dark`, the home page) runs straight into the footer; light pages keep a gap.
    <footer className="on-dark mt-16 bg-wine text-paper [main:has(.page-dark)+&]:mt-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            {/* The mark's own wine tile disappears on the wine footer, so it gets a paper hairline. */}
            <Image
              src="/brand/mark-tile.svg"
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-lg ring-1 ring-paper/25"
            />
            <p className="font-display text-2xl leading-tight font-bold">{SITE.name}</p>
          </div>
          <p className="mt-4 max-w-[30ch] font-display text-xl leading-snug font-semibold text-balance">
            {SITE.tagline}
          </p>
          <address className="mt-4 flex gap-2 text-[15px] leading-relaxed not-italic text-primer">
            <MapPin aria-hidden className="mt-1 size-4 shrink-0" />
            <span>
              {SITE.shopLine}
              <br />
              {SITE.marketLine}
            </span>
          </address>
          <ul className="mt-2 flex flex-wrap gap-x-5">
            {SITE.phones.map((p) => (
              <li key={p.tel}>
                <a
                  href={`tel:${p.tel}`}
                  className="inline-flex items-center gap-2 py-1 tabular-nums text-primer hover:text-paper"
                >
                  <Phone aria-hidden className="size-4" />
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={whatsappLink(`Hello ${SITE.name}, I'm looking for a part.`)}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg border border-primer px-4 font-semibold transition-colors hover:border-paper hover:bg-paper/[0.06]"
          >
            <MessageCircle aria-hidden className="size-[18px]" />
            Message the shop on WhatsApp
          </a>
        </div>
        <nav aria-label="Shop">
          <p className="font-display text-lg font-semibold">Shop</p>
          <ul className="mt-3 space-y-1">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link href={`/shop/${c}`} className="inline-block py-1 text-primer hover:text-paper">
                  {CATEGORY_INFO[c].label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="About">
          <p className="font-display text-lg font-semibold">About</p>
          <ul className="mt-3 space-y-1">
            <li>
              <Link href="/about" className="inline-block py-1 text-primer hover:text-paper">
                About the shop
              </Link>
            </li>
            <li>
              <Link href="/about#grades" className="inline-block py-1 text-primer hover:text-paper">
                How we grade parts
              </Link>
            </li>
            <li>
              <Link href="/cart" className="inline-block py-1 text-primer hover:text-paper">
                Your cart
              </Link>
            </li>
            <li>
              <Link href="/admin" className="inline-block py-1 text-primer hover:text-paper">
                Shop staff
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-primer/40">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-primer">
          Foreign-used genuine and new body parts for Japanese cars. Prices in naira, no hidden fees.
        </p>
      </div>
    </footer>
  );
}
