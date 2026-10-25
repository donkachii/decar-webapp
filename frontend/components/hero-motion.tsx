"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The hero section. On large screens with motion allowed, its stage is sticky
 * (CSS) and scrolling through it opens the video window to the full stage and
 * lifts the headline away.
 */
export function HeroMotion({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 64rem) and (prefers-reduced-motion: no-preference)", () => {
        const section = ref.current;
        if (!section) return;

        // Only the section (this component's own element) is animated: the
        // window and the headline read --open and --lift from it in CSS
        // (.hero-stage in globals.css), so a re-render of the hero's contents
        // can't leave GSAP holding elements that are no longer on the page.
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            // The stage sticks under the 64px header.
            start: "top 64px",
            end: "bottom bottom",
            scrub: 0.5,
          },
          // Once the headline has faded, its buttons stop taking clicks and focus.
          onUpdate: () => section.toggleAttribute("data-lifted", tl.progress() > 0.38),
        });
        tl.fromTo(section, { "--open": 0 }, { "--open": 1, duration: 0.75, ease: "power2.inOut" }, 0)
          .fromTo(section, { "--lift": 0 }, { "--lift": 1, duration: 0.4, ease: "power1.in" }, 0)
          // Hold on the open clip before the page moves on.
          .to({}, { duration: 0.25 });
        return () => section.removeAttribute("data-lifted");
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section ref={ref} aria-labelledby={labelledBy} className="relative bg-navy lg:motion-safe:h-[200vh]">
      {children}
    </section>
  );
}
