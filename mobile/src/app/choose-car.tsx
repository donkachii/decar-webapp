import { router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { useFocusRing } from "@/components/focus";
import { ErrorState, Loading } from "@/components/states";
import { Text } from "@/components/text";
import { useVehicles } from "@/lib/catalog";
import { vehicleGenerationLabel, yearRange, type Make, type Vehicle } from "@/lib/domain";
import { useSelectedVehicle, useSetVehicle } from "@/lib/vehicle";
import { color, font, GUTTER, radius } from "@/theme";

/** The vehicle picker. Facelift and pre-facelift are different cars here, as on the shelf. */
export default function ChooseCarScreen() {
  const vehicles = useVehicles();
  const selected = useSelectedVehicle();
  const setVehicle = useSetVehicle();
  const [make, setMake] = useState<Make>(selected?.make ?? "toyota");
  const insets = useSafeAreaInsets();

  const pick = (id: string | null) => {
    setVehicle(id);
    router.back();
  };

  if (vehicles.isPending) return <Loading />;
  if (vehicles.isError) return <ErrorState onRetry={() => void vehicles.refetch()} />;

  const ofMake = vehicles.data.filter((v) => v.make === make);
  const models = [...new Set(ofMake.map((v) => v.model))];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Text variant="bodySm">
        We only show parts confirmed to fit it. Facelift and pre-facelift parts are different, so pick the years on
        your vehicle papers.
      </Text>

      <View accessibilityRole="tablist" style={styles.makes}>
        {(["toyota", "lexus"] as const).map((m) => (
          <MakeButton key={m} label={m === "toyota" ? "Toyota" : "Lexus"} selected={make === m} onPress={() => setMake(m)} />
        ))}
      </View>

      {models.length === 0 ? (
        <Text style={styles.none}>No {make === "toyota" ? "Toyota" : "Lexus"} cars listed yet.</Text>
      ) : null}

      {models.map((model) => (
        <View key={model} style={styles.model}>
          <Text variant="h3" accessibilityRole="header">
            {model}
          </Text>
          {ofMake
            .filter((v) => v.model === model)
            .map((v) => (
              <VehicleButton key={v.id} vehicle={v} selected={v.id === selected?.id} onPress={() => pick(v.id)} />
            ))}
        </View>
      ))}

      {selected ? (
        <View style={styles.clear}>
          <Button variant="outline" onPress={() => pick(null)}>
            Clear my car and show every part
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
}

function MakeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[styles.make, selected && styles.makeOn, focus.ring]}
    >
      <Text variant="h3">{label}</Text>
    </Pressable>
  );
}

function VehicleButton({ vehicle, selected, onPress }: { vehicle: Vehicle; selected: boolean; onPress: () => void }) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${vehicle.model} ${yearRange(vehicle)}, ${vehicleGenerationLabel(vehicle)}`}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [styles.vehicle, selected ? styles.vehicleOn : pressed ? styles.vehiclePressed : null, focus.ring]}
    >
      <View>
        <Text variant="h3" style={styles.years}>
          {yearRange(vehicle)}
        </Text>
        <Text variant="bodySm">{vehicleGenerationLabel(vehicle)}</Text>
      </View>
      {selected ? <Check size={20} color={color.navy} /> : <ChevronRight size={20} color={color.primer} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: GUTTER },
  makes: {
    marginTop: 16,
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: color.bay,
  },
  make: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  makeOn: { backgroundColor: color.paper, borderBottomWidth: 1, borderBottomColor: color.primer },
  none: { marginTop: 20 },
  model: { marginTop: 24, gap: 8 },
  vehicle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.primer,
    backgroundColor: color.paper,
  },
  vehicleOn: { backgroundColor: color.tan, borderColor: color.tan },
  vehiclePressed: { borderColor: color.navy },
  years: { fontFamily: font.displayBold, fontVariant: ["tabular-nums"] },
  clear: { marginTop: 32 },
});
