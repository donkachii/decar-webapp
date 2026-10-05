"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CATEGORY_INFO } from "@/lib/catalog/labels";
import { CATEGORIES } from "@/lib/catalog/types";

export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Categories" className={className}>
      <ul className="flex">
        {CATEGORIES.map((category) => {
          const href = `/shop/${category}`;
          const active = pathname === href;
          return (
            <li key={category} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center px-3 font-display text-lg font-semibold",
                  "border-b-[3px] transition-colors",
                  active ? "border-navy" : "border-transparent hover:border-primer",
                )}
              >
                {CATEGORY_INFO[category].label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
