import { cn } from "cn";

import { CONDITION_INFO } from "@/lib/catalog/labels";
import type { Condition } from "@/lib/catalog/types";

/**
 * The grade square on its own. Belgium grades are solid wine; new stock is
 * outlined in navy.
 */
export function GradeSquare({
  condition,
  size = "sm",
  className,
}: {
  condition: Condition;
  size?: "sm" | "lg";
  className?: string;
}) {
  const belgium = condition.startsWith("belgium-");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center font-display font-bold",
        size === "sm" ? "size-5 rounded-[3px] text-[13px]" : "size-11 rounded-md text-2xl",
        belgium ? "bg-wine text-paper" : cn("border-navy text-navy", size === "sm" ? "border-[1.5px]" : "border-2"),
        className,
      )}
    >
      {CONDITION_INFO[condition].grade}
    </span>
  );
}

/** Inspection tag: a grade square plus the buyer-facing label. */
export function ConditionBadge({
  condition,
  className,
}: {
  condition: Condition;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium leading-none", className)}>
      <GradeSquare condition={condition} />
      {CONDITION_INFO[condition].label}
    </span>
  );
}
