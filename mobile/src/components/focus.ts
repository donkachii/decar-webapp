import { useState } from "react";
import type { ViewStyle } from "react-native";

import { color } from "@/theme";

/**
 * Visible focus for keyboard and switch users: a navy outline, like the
 * website's global focus style. Touch presses never show it.
 */
export function useFocusRing(onDark = false) {
  const [focused, setFocused] = useState(false);
  const ring: ViewStyle | null = focused
    ? { outlineColor: onDark ? color.paper : color.navy, outlineWidth: 2, outlineStyle: "solid", outlineOffset: 2 }
    : null;
  return { ring, onFocus: () => setFocused(true), onBlur: () => setFocused(false) };
}
