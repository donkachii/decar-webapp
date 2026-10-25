"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Pages read stock live, so a slow connection can take a while. Give up after this.
const GIVE_UP_MS = 15_000;

/**
 * A thin bar along the top while a link click is loading the next page.
 * Starts on any same-site link click that changes the address; finishes when
 * the address does.
 */
export function NavProgress() {
  const address = `${usePathname()}?${useSearchParams().toString()}`;
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [shown, setShown] = useState(address);

  // The address changed: the new page is in.
  if (address !== shown) {
    setShown(address);
    if (state === "loading") setState("done");
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState(state === "done" ? "idle" : "done"), state === "done" ? 300 : GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className={
          state === "loading"
            ? "h-full origin-left bg-tan shadow-[0_1px_0_var(--color-navy)] [animation:nav-crawl_8s_cubic-bezier(0.1,0.7,0.2,1)_forwards]"
            : "h-full origin-left bg-tan opacity-0 shadow-[0_1px_0_var(--color-navy)] transition-opacity duration-300"
        }
      />
    </div>
  );
}
