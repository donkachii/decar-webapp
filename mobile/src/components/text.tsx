import { Text as RNText, type TextProps } from "react-native";

import { color, font, type as typeStyles } from "@/theme";

export type TextVariant = keyof typeof typeStyles;
export type TextTone = "default" | "fit" | "warn" | "paper";

const TONES = { default: color.navy, fit: color.fit, warn: color.warn, paper: color.paper } as const;

/** Every piece of text in the app: Barlow or Barlow Condensed, navy by default. */
export function Text({
  variant = "body",
  tone = "default",
  weight,
  style,
  ...props
}: TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Body weights only; display styles carry their own. */
  weight?: "medium" | "semibold";
}) {
  return (
    <RNText
      {...props}
      style={[
        typeStyles[variant],
        weight === "medium" && { fontFamily: font.medium },
        weight === "semibold" && { fontFamily: font.semibold },
        tone !== "default" && { color: TONES[tone] },
        style,
      ]}
    />
  );
}
