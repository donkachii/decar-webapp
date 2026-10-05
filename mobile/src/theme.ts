import { StyleSheet, type TextStyle } from "react-native";

// Design tokens: CLAUDE.md section 8, the same values as frontend/app/globals.css.
// No other colours. Tan means "you can act here" and always carries navy
// text; wine carries paper text; primer is for rules, icons and text on navy
// or wine only.
export const color = {
  primer: "#8B9196",
  bay: "#ECEEF0",
  paper: "#FFFFFF",
  navy: "#051632",
  wine: "#4E1526",
  tan: "#D6AE73",
  fit: "#1E7A4C",
  warn: "#B4441C",
} as const;

// Barlow for body and UI, Barlow Condensed for headings and prices. One file
// per weight: Android ignores fontWeight on custom fonts.
export const font = {
  regular: "Barlow_400Regular",
  medium: "Barlow_500Medium",
  semibold: "Barlow_600SemiBold",
  display: "BarlowCondensed_600SemiBold",
  displayBold: "BarlowCondensed_700Bold",
} as const;

export const radius = { sm: 4, md: 6, lg: 8, full: 999 } as const;

/** Side gutter at 360px wide, as on the website. */
export const GUTTER = 16;

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

export const type = StyleSheet.create({
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: color.navy },
  bodySm: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: color.navy },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: color.navy },
  label: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: color.navy },
  hero: { fontFamily: font.displayBold, fontSize: 44, lineHeight: 42, color: color.navy },
  title: { fontFamily: font.displayBold, fontSize: 40, lineHeight: 40, color: color.navy },
  h2: { fontFamily: font.display, fontSize: 28, lineHeight: 30, color: color.navy },
  h3: { fontFamily: font.display, fontSize: 22, lineHeight: 25, color: color.navy },
  cardTitle: { fontFamily: font.display, fontSize: 18, lineHeight: 20, color: color.navy },
  price: { fontFamily: font.displayBold, fontSize: 24, lineHeight: 26, color: color.navy, fontVariant: tabular },
  priceLg: { fontFamily: font.displayBold, fontSize: 44, lineHeight: 44, color: color.navy, fontVariant: tabular },
  tabular: { fontVariant: tabular },
});
