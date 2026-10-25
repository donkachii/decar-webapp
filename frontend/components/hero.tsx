import { MessageCircle } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import poster from "@/assets/hero/poster.jpg";
import { HeroMotion } from "@/components/hero-motion";
import { HeroVideo } from "@/components/hero-video";
import { Button } from "@/components/ui/button";
import { ChooseCarButton } from "@/components/vehicle-picker";
import { vehicleLabel } from "@/lib/catalog/labels";
import type { Vehicle } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";
import { whatsappLink } from "@/lib/whatsapp";

const HEADLINE = "The right part for your Toyota, Lexus, Honda or Nissan. First time.";

/** The headline split into letters that light up in turn (`.lit` in globals.css). Words never break. */
function LitText({ text }: { text: string }) {
  const words = text.split(" ");
  const starts = words.map((_, w) => words.slice(0, w).join("").length);
  return words.map((word, w) => (
    <span key={w}>
      {w > 0 ? " " : null}
      <span className="whitespace-nowrap">
        {[...word].map((letter, l) => (
          <span key={l} className="lit" style={{ "--i": starts[w] + l } as CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
    </span>
  ));
}

/**
 * Navy stage with the headline and the showcase clip. Large screens: the clip
 * sits in a window on the right and scrolling opens it to the full stage
 * (HeroMotion). Phones: the clip follows the headline in a 16:9 frame.
 */
export function Hero({ vehicle }: { vehicle: Vehicle | null }) {
  return (
    <HeroMotion labelledBy="hero-title">
      <div
        className="hero-stage on-dark relative overflow-hidden bg-navy text-paper lg:h-[calc(100dvh-4rem)] lg:min-h-[36rem] lg:motion-safe:sticky lg:motion-safe:top-16"
      >
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-12 lg:static lg:grid lg:h-full lg:grid-cols-2 lg:items-center lg:py-0">
          <div className="hero-copy relative z-10 lg:pr-6">
            <h1
              id="hero-title"
              className="text-[clamp(44px,min(6.2vw,10.5vh),100px)] leading-[0.9] font-bold tracking-[-0.015em]"
            >
              <span className="sr-only">{HEADLINE}</span>
              <span aria-hidden>
                <LitText text={HEADLINE} />
              </span>
            </h1>
            <p className="rise mt-6 max-w-[40ch] text-lg leading-relaxed [animation-delay:700ms]">
              Genuine Belgium and new body parts, checked for fit before they leave the shop.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3 [animation-delay:850ms]">
              {vehicle ? (
                <Button asChild size="lg">
                  <Link href={`/vehicle/${vehicle.id}`}>See parts for your {vehicle.model}</Link>
                </Button>
              ) : (
                <ChooseCarButton className="h-12 px-5 text-base" />
              )}
              <Button asChild size="lg" variant="inverse">
                <a
                  href={whatsappLink(
                    `Hello ${SITE.name}, I'm looking for a part${vehicle ? ` for my ${vehicleLabel(vehicle)}` : ""}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden />
                  Ask on WhatsApp
                </a>
              </Button>
            </div>
          </div>

          <div className="hero-window mt-10 bg-navy lg:mt-0">
            <HeroVideo poster={poster} />
          </div>
        </div>
      </div>
    </HeroMotion>
  );
}
