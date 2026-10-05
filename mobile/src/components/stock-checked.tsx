import { useSyncExternalStore } from "react";

import { relativeTime } from "@/lib/domain";

import { Text, type TextVariant } from "./text";

// One shared minute clock for every "Stock checked" line on screen.
const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** "Stock checked: 2 hours ago" (rule 5), kept current while the screen is open. */
export function StockChecked({ at, variant = "small" }: { at: string; variant?: TextVariant }) {
  const current = useSyncExternalStore(subscribe, () => now);
  return <Text variant={variant}>Stock checked: {relativeTime(at, current)}</Text>;
}
