import { router } from "expo-router";
import { Car } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { vehicleLabel } from "@/lib/domain";
import { useSelectedVehicle } from "@/lib/vehicle";
import { color, radius } from "@/theme";

import { useFocusRing } from "./focus";
import { Text } from "./text";

/** Your car, always in reach. Tan when one is chosen; a dashed empty slot when not. */
export function VehicleChip() {
  const vehicle = useSelectedVehicle();
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={vehicle ? `Your car: ${vehicleLabel(vehicle)}. Change` : "Choose your car"}
      onPress={() => router.push("/choose-car")}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [
        styles.chip,
        vehicle ? styles.chosen : styles.empty,
        pressed && styles.pressed,
        focus.ring,
      ]}
    >
      <Car size={18} color={color.navy} />
      {vehicle ? (
        <View style={styles.label}>
          <Text weight="semibold" numberOfLines={1} style={styles.shrink}>
            {vehicleLabel(vehicle)}
          </Text>
          <Text weight="medium" style={styles.change}>
            Change
          </Text>
        </View>
      ) : (
        <Text weight="semibold">Choose your car</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  chosen: { backgroundColor: color.tan, borderWidth: 2, borderColor: color.tan },
  empty: { borderWidth: 1.5, borderStyle: "dashed", borderColor: color.navy },
  pressed: { borderColor: color.navy, borderStyle: "solid", borderWidth: 2 },
  label: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  change: { textDecorationLine: "underline" },
});
