import { CircleAlert, CircleCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { color } from "@/theme";

import { Text } from "./text";

/** Fit confirmed (green) or not confirmed (warn). Renders nothing without a vehicle. */
export function FitStatus({
  fits,
  vehicleShortLabel,
  large = false,
}: {
  fits: boolean | null;
  vehicleShortLabel: string | null;
  large?: boolean;
}) {
  if (fits === null || !vehicleShortLabel) return null;
  const Icon = fits ? CircleCheck : CircleAlert;
  return (
    <View style={styles.row}>
      <Icon size={large ? 18 : 16} color={fits ? color.fit : color.warn} style={styles.icon} />
      <Text variant={large ? "body" : "bodySm"} weight="semibold" tone={fits ? "fit" : "warn"} style={styles.text}>
        {fits ? `Fits your ${vehicleShortLabel}` : "Not confirmed for your vehicle"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  icon: { marginTop: 2 },
  text: { flexShrink: 1 },
});
