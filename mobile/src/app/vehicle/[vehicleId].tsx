import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { PartGrid } from "@/components/part-card";
import { Screen, SectionTitle } from "@/components/screen";
import { ErrorState, Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { useParts, useVehicles } from "@/lib/catalog";
import { CATEGORIES, CATEGORY_INFO, vehicleGenerationLabel, vehicleLabel } from "@/lib/domain";
import { usePullToRefresh, useRefreshOnFocus } from "@/lib/refresh";
import { useSelectedVehicle, useSetVehicle } from "@/lib/vehicle";
import { color, radius } from "@/theme";

/** Every part confirmed to fit one car (make + model + generation + facelift). */
export default function VehicleScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const vehicles = useVehicles();
  const vehicle = vehicles.data?.find((v) => v.id === vehicleId) ?? null;
  const parts = useParts({ vehicleId: vehicle?.id }, { enabled: vehicle !== null });
  const selected = useSelectedVehicle();
  const setVehicle = useSetVehicle();
  const { refreshing, onRefresh } = usePullToRefresh(parts.refetch);
  useRefreshOnFocus(parts.refetch);

  if (vehicles.isPending) return <Loading />;
  if (vehicles.isError) return <ErrorState onRetry={() => void vehicles.refetch()} />;
  if (!vehicle) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Car not found" }} />
        <Panel>
          <Text>We don&apos;t list parts for that car yet. Choose yours from the list of cars we stock.</Text>
        </Panel>
      </Screen>
    );
  }

  const list = parts.data ?? [];
  const isMine = selected?.id === vehicle.id;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text variant="title" accessibilityRole="header">
        {vehicleLabel(vehicle)}
      </Text>
      <Text style={styles.sub}>
        {vehicleGenerationLabel(vehicle)}.
        {parts.data ? ` ${list.length} ${list.length === 1 ? "part" : "parts"} confirmed to fit.` : ""}
      </Text>
      <View style={styles.mine}>
        {isMine ? (
          <View style={styles.tag}>
            <Text weight="semibold">This is your car</Text>
          </View>
        ) : (
          <Button onPress={() => setVehicle(vehicle.id)}>Make this my car</Button>
        )}
      </View>

      {parts.isPending ? (
        <Loading />
      ) : parts.isError ? (
        <ErrorState onRetry={() => void parts.refetch()} />
      ) : list.length === 0 ? (
        <Panel style={styles.empty}>
          <Text>
            Nothing on the shelf for this car right now. Message the shop on WhatsApp and we&apos;ll check the market
            for you.
          </Text>
          <WhatsappButton message={`Hello, I'm looking for parts for my ${vehicleLabel(vehicle)}.`} />
        </Panel>
      ) : (
        CATEGORIES.map((category) => {
          const inCategory = list.filter((p) => p.category === category);
          if (inCategory.length === 0) return null;
          return (
            <View key={category} style={styles.section}>
              <SectionTitle style={styles.sectionTitle}>{CATEGORY_INFO[category].label}</SectionTitle>
              <PartGrid parts={inCategory} />
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 6, fontSize: 17 },
  mine: { marginTop: 16, alignItems: "flex-start" },
  tag: { backgroundColor: color.tan, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { marginTop: 32, gap: 16 },
  section: { marginTop: 36 },
  sectionTitle: { marginBottom: 16 },
});
