import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { useFocusRing } from "@/components/focus";
import { Screen, TabHeader } from "@/components/screen";
import { Text } from "@/components/text";
import { useParts } from "@/lib/catalog";
import { CATEGORIES, CATEGORY_INFO, CATEGORY_TYPES, TYPE_INFO, vehicleShortLabel, type Category } from "@/lib/domain";
import { usePullToRefresh, useRefreshOnFocus } from "@/lib/refresh";
import { useSelectedVehicle } from "@/lib/vehicle";
import { color, radius } from "@/theme";

/** The four categories; part types are filters inside each, never pages of their own. */
export default function ShopScreen() {
  const vehicle = useSelectedVehicle();
  const query = useParts({ vehicleId: vehicle?.id });
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch);
  useRefreshOnFocus(query.refetch);
  const available = (query.data ?? []).filter((p) => p.status === "available");

  return (
    <Screen tab refreshing={refreshing} onRefresh={onRefresh}>
      <TabHeader title="Shop by part" />

      {vehicle ? (
        <View style={[styles.block, styles.mine]}>
          <Row
            title={`Everything for your ${vehicleShortLabel(vehicle)}`}
            detail={query.data ? `${available.length} ${available.length === 1 ? "part" : "parts"} in stock` : " "}
            onPress={() => router.push(`/vehicle/${vehicle.id}`)}
            large
          />
        </View>
      ) : null}

      <View style={styles.list}>
        {CATEGORIES.map((category) => (
          <CategoryBlock
            key={category}
            category={category}
            count={query.data ? available.filter((p) => p.category === category).length : null}
          />
        ))}
      </View>
    </Screen>
  );
}

function CategoryBlock({ category, count }: { category: Category; count: number | null }) {
  const info = CATEGORY_INFO[category];
  return (
    <View style={styles.block}>
      <Row
        title={info.label}
        detail={count === null ? " " : count === 0 ? "Not listed online yet" : `${count} in stock`}
        onPress={() => router.push(`/shop/${category}`)}
        large
      />
      {CATEGORY_TYPES[category].length > 1 ? (
        <View style={styles.types}>
          {CATEGORY_TYPES[category].map((type) => (
            <Row
              key={type}
              title={TYPE_INFO[type].plural}
              onPress={() => router.push({ pathname: "/shop/[category]", params: { category, type } })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Row({
  title,
  detail,
  onPress,
  large = false,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
  large?: boolean;
}) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [styles.row, large ? styles.rowLarge : styles.rowSmall, pressed && styles.pressed, focus.ring]}
    >
      <View style={styles.rowText}>
        <Text variant={large ? "h2" : "body"} weight={large ? undefined : "medium"}>
          {title}
        </Text>
        {detail ? <Text variant="bodySm">{detail}</Text> : null}
      </View>
      <ChevronRight size={20} color={color.primer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 8, gap: 12 },
  block: { backgroundColor: color.paper, borderRadius: radius.md, overflow: "hidden" },
  mine: { marginBottom: 12 },
  types: { borderTopWidth: 1, borderTopColor: color.bay, paddingLeft: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 12, minHeight: 48 },
  rowLarge: { paddingLeft: 16, paddingVertical: 14 },
  rowSmall: { paddingVertical: 10 },
  rowText: { flex: 1, gap: 2 },
  pressed: { backgroundColor: color.bay },
});
