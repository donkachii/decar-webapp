import { CircleAlert } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { color, GUTTER, radius } from "@/theme";

import { Button } from "./button";
import { Text } from "./text";

/**
 * Loading. The API sleeps when idle (Render free plan), so the first request
 * of the day can take most of a minute; say so instead of spinning silently.
 */
export function Loading({ label = "Loading" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={color.navy} accessibilityLabel={label} />
      {slow ? (
        <Text variant="bodySm" style={styles.slow}>
          Still checking the shelf. The first visit of the day can take up to a minute.
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message = "We couldn't reach the shop just now. Check your connection and try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={styles.errorRow}>
        <CircleAlert size={18} color={color.warn} />
        <Text weight="semibold" tone="warn" style={styles.errorText}>
          {message}
        </Text>
      </View>
      {onRetry ? (
        <Button variant="outline" onPress={onRetry} style={styles.retry}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}

/** A paper panel: empty states and notices. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  center: { paddingHorizontal: GUTTER, paddingVertical: 48, alignItems: "center", gap: 12 },
  slow: { textAlign: "center", maxWidth: 300 },
  errorRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", maxWidth: 340 },
  errorText: { flexShrink: 1 },
  retry: { marginTop: 4 },
  panel: { backgroundColor: color.paper, borderRadius: radius.md, padding: 20 },
});
