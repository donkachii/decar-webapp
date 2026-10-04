import { cn } from "cn";
import { Check } from "lucide-react";
import Link from "next/link";

/** A row of link chips. Active chips are amber (CLAUDE.md: active filters). */
export function FilterChips({
  label,
  options,
}: {
  label: string;
  options: { value: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <span className="w-[4.5rem] shrink-0 text-sm font-semibold">{label}</span>
      <ul className="-my-1 flex min-w-0 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
        {options.map((o) => (
          <li key={o.value} className="shrink-0">
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.active ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                o.active
                  ? "border-amber bg-amber font-semibold"
                  : "border-primer bg-paper hover:border-graphite",
              )}
            >
              {o.active ? <Check aria-hidden className="size-3.5" /> : null}
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
