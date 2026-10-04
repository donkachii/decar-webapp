import { cn } from "cn";
import { CircleAlert, CircleCheck } from "lucide-react";

/** Fit confirmed (green) or not confirmed (warn). Renders nothing without a vehicle. */
export function FitStatus({
  fits,
  vehicleShortLabel,
  className,
}: {
  fits: boolean | null;
  vehicleShortLabel: string | null;
  className?: string;
}) {
  if (fits === null || !vehicleShortLabel) return null;
  return fits ? (
    <p className={cn("flex items-start gap-1.5 text-sm font-semibold text-fit", className)}>
      <CircleCheck aria-hidden className="mt-px size-4 shrink-0" />
      Fits your {vehicleShortLabel}
    </p>
  ) : (
    <p className={cn("flex items-start gap-1.5 text-sm font-semibold text-warn", className)}>
      <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
      Not confirmed for your vehicle
    </p>
  );
}
