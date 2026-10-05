import { cn } from "cn";

import { CarTopView } from "@/components/car-top-view";
import type { Zone } from "@/lib/catalog/zones";

const ZONE_AREA: Record<Zone, string> = {
  "front-left": "left-0 top-0 w-[32%] h-[30%]",
  front: "left-[32%] top-0 w-[36%] h-[30%]",
  "front-right": "right-0 top-0 w-[32%] h-[30%]",
  left: "left-0 top-[30%] w-[32%] h-[40%]",
  right: "right-0 top-[30%] w-[32%] h-[40%]",
  "rear-left": "left-0 bottom-0 w-[32%] h-[30%]",
  rear: "left-[32%] bottom-0 w-[36%] h-[30%]",
  "rear-right": "right-0 bottom-0 w-[32%] h-[30%]",
};

/** Small top view with the part's area marked, so left and right are never guessed. */
export function PositionDiagram({ zone, className }: { zone: Zone; className?: string }) {
  return (
    <div aria-hidden className={cn("relative aspect-[300/440] w-[84px] shrink-0", className)}>
      <span className={cn("absolute rounded-[4px] border-2 border-navy bg-bay", ZONE_AREA[zone])} />
      <CarTopView className="absolute inset-0 size-full" />
    </div>
  );
}
