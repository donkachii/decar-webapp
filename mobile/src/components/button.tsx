import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { color, radius } from "@/theme";

import { useFocusRing } from "./focus";
import { Text } from "./text";

type Variant = "primary" | "outline" | "link";
type Size = "sm" | "md" | "lg";

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 52 };

/**
 * Says exactly what happens ("Add to cart", "Choose your car"). Primary is
 * tan, the only action colour, with navy text.
 */
export function Button({
  children,
  onPress,
  icon: Icon,
  variant = "primary",
  size = "md",
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const focus = useFocusRing();
  const link = variant === "link";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={link ? 8 : undefined}
      style={({ pressed }) => [
        styles.base,
        link ? styles.link : { minHeight: HEIGHT[size], paddingHorizontal: size === "sm" ? 12 : 16 },
        variant === "primary" && styles.primary,
        variant === "outline" && styles.outline,
        pressed && !link && styles.pressed,
        disabled && styles.disabled,
        focus.ring,
        style,
      ]}
    >
      {Icon ? (
        <Icon size={size === "sm" ? 16 : 18} color={color.navy} strokeWidth={2.25} />
      ) : null}
      <Text
        variant={size === "sm" ? "bodySm" : "body"}
        weight="semibold"
        style={link ? styles.linkText : undefined}
        numberOfLines={2}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
  },
  primary: { backgroundColor: color.tan, borderWidth: 2, borderColor: color.tan },
  outline: { backgroundColor: color.paper, borderWidth: 1, borderColor: color.navy },
  // Pressing shows a navy edge, like the website's hover.
  pressed: { borderColor: color.navy, borderWidth: 2 },
  disabled: { opacity: 0.55 },
  link: { alignSelf: "flex-start", minHeight: 32 },
  linkText: { textDecorationLine: "underline" },
});
