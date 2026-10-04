import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { CONDITION_INFO } from "@/lib/catalog/labels";
import { CONDITIONS } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "About the shop",
  description: `${SITE.name} sells foreign-used genuine and new Toyota and Lexus body parts at ${SITE.marketLine}.`,
};

// Mission, vision and values belong on this page only (CLAUDE.md section 8).
// Add the owner's own wording here once it is written.

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <h1 className="text-5xl leading-none font-bold">About the shop</h1>
      <p className="mt-5 text-lg leading-relaxed">
        {SITE.name} sells foreign-used genuine Toyota and Lexus body parts, known in the market as
        Belgium parts, plus new genuine and new aftermarket stock. We serve car owners, mechanics,
        panel beaters and dealers.
      </p>
      <p className="mt-4 text-lg leading-relaxed">
        Our promise is simple: the right part for your Toyota or Lexus, first time. We match every
        part to your car&apos;s model, generation and facelift, never just the year, because a part
        from the same year can still be the wrong one.
      </p>

      <section aria-labelledby="grades-title" className="mt-12 scroll-mt-6" id="grades">
        <h2 id="grades-title" className="text-3xl">
          How we grade parts
        </h2>
        <p className="mt-2">
          Every Belgium unit is one of a kind. We photograph it, grade it, and write down any defects
          in plain words.
        </p>
        <dl className="mt-5 divide-y divide-bay rounded-md bg-paper px-5">
          {CONDITIONS.map((c) => (
            <div key={c} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="font-semibold">{CONDITION_INFO[c].label}</dt>
              <dd>{CONDITION_INFO[c].meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="visit" className="mt-12">
        <h2 id="visit" className="text-3xl">
          Visit us
        </h2>
        <address className="mt-3 text-lg leading-relaxed not-italic">
          {SITE.shopLine}
          <br />
          {SITE.marketLine}
        </address>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={whatsappLink(`Hello ${SITE.name}, I'd like to visit the shop.`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-graphite bg-paper px-4 font-semibold hover:bg-bay"
          >
            <MessageCircle aria-hidden className="size-[18px]" />
            Message us on WhatsApp
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Zuba+Spare+Parts+Market+Abuja"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-md px-4 font-semibold underline underline-offset-2"
          >
            Open Zuba Market in Google Maps
          </a>
        </div>
      </section>
    </div>
  );
}
