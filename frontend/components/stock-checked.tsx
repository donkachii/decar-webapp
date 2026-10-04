"use client";

import { useEffect, useState } from "react";

import { currentTime, relativeTime } from "@/lib/format";

/**
 * "Stock checked: 2 hours ago". Re-computed in the browser every minute, so
 * a page left open never shows a stale relative time.
 */
export function StockChecked({ at, className }: { at: string; className?: string }) {
  const [now, setNow] = useState(currentTime);

  useEffect(() => {
    const id = setInterval(() => setNow(currentTime()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className}>
      Stock checked:{" "}
      <time dateTime={at} suppressHydrationWarning>
        {relativeTime(at, now)}
      </time>
    </span>
  );
}
