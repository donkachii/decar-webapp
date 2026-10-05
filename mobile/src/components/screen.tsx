import type { ReactNode, Ref } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, GUTTER } from "@/theme";

import { Text } from "./text";
import { VehicleChip } from "./vehicle-chip";

/**
 * A scrolling screen on the bay background with pull-to-refresh, so the buyer
 * can always re-check stock. Tab screens have no navigation bar and pad for
 * the status bar themselves.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  tab = false,
  footerSpace = 0,
  scrollRef,
  style,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  tab?: boolean;
  /** Room for a bar fixed to the bottom of the screen. */
  footerSpace?: number;
  scrollRef?: Ref<ScrollView>;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: tab ? insets.top + 12 : 16, paddingBottom: 32 + footerSpace },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={color.navy} colors={[color.navy]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** Title block for a tab screen, with the car chip under it. */
export function TabHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {children}
      <VehicleChip />
    </View>
  );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text variant="h2" accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bay },
  content: { paddingHorizontal: GUTTER },
  header: { gap: 12, marginBottom: 20 },
});
