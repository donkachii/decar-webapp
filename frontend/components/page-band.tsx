import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Navy title band under the header on light pages, continuing the home
 * page's ground. A card after it can tuck up over its lower edge.
 */
export function PageBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="on-dark bg-navy text-paper">
      <div className={cn("mx-auto max-w-6xl px-4 pt-10 pb-20 sm:pt-14 sm:pb-24", className)}>{children}</div>
    </div>
  );
}

/** The band's title: one or two words, set large. */
export function BandTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[clamp(60px,11vw,144px)] leading-[0.85] font-bold tracking-[-0.01em]">{children}</h1>;
}
