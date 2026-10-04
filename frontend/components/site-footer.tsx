import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { CATEGORY_INFO } from "@/lib/catalog/labels";
import { CATEGORIES } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { whatsappLink } from "@/lib/whatsapp";

export function SiteFooter() {
  return (
    <footer className="on-dark mt-16 bg-graphite text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl leading-tight font-bold">{SITE.name}</p>
          <address className="mt-3 text-[15px] leading-relaxed not-italic text-primer">
            {SITE.shopLine}
            <br />
            {SITE.marketLine}
          </address>
          <a
            href={whatsappLink(`Hello ${SITE.name}, I'm looking for a part.`)}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-md border border-primer px-4 font-semibold hover:border-paper"
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
          Foreign-used genuine and new Toyota and Lexus body parts. Prices in naira, no hidden fees.
        </p>
      </div>
    </footer>
  );
}
