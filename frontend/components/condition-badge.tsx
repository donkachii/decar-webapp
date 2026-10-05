import { cn } from "cn";

import { CONDITION_INFO } from "@/lib/catalog/labels";
import type { Condition } from "@/lib/catalog/types";

/**
 * Inspection tag: a grade square plus the buyer-facing label. Belgium grades
 * get a solid square; new stock gets an outlined one.
 */
export function ConditionBadge({
  condition,
  className,
}: {
  condition: Condition;
  className?: string;
}) {
  const info = CONDITION_INFO[condition];
  const belgium = condition.startsWith("belgium-");
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium leading-none", className)}>
      <span
        aria-hidden
        className={cn(
          "inline-grid size-5 place-items-center rounded-[3px] font-display text-[13px] font-bold",
          belgium ? "bg-wine text-paper" : "border-[1.5px] border-navy text-navy",
        )}
      >
        {info.grade}
      </span>
      {info.label}
    </span>
  );
}
