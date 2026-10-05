import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { DamageSelector, type ZonePart } from "@/components/damage-selector";
import { useFocusRing } from "@/components/focus";
import { PartGrid, useGridColumns } from "@/components/part-card";
import { PartImage } from "@/components/part-image";
import { Screen, SectionTitle } from "@/components/screen";
import { ErrorState, Loading } from "@/components/states";
import { Text } from "@/components/text";
import { VehicleChip } from "@/components/vehicle-chip";
import { useParts } from "@/lib/catalog";
import { SITE } from "@/lib/config";
import {
  CATEGORIES,
  CATEGORY_INFO,
  CATEGORY_TYPES,
  CONDITION_INFO,
  CONDITIONS,
  groupSides,
  isDrawing,
  partTitle,
  vehicleShortLabel,
  zoneFor,
  type Category,
  type Part,
} from "@/lib/domain";
import { usePullToRefresh, useRefreshOnFocus } from "@/lib/refresh";
import { useSelectedVehicle } from "@/lib/vehicle";
import { color, font, GUTTER, radius } from "@/theme";

const PROMISES = [
  { title: "Checked for fit", body: "Matched to your car's generation and facelift, never just the year." },
  { title: "Graded honestly", body: "Every Belgium unit is graded A, B or C, with defects written down." },
  { title: "Stock you can trust", body: "Each unit shows when we last checked it on the shelf." },
];

export default function HomeScreen() {
  const vehicle = useSelectedVehicle();
  const query = useParts({ vehicleId: vehicle?.id });
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch);
  useRefreshOnFocus(query.refetch);

  const available = (query.data ?? []).filter((p) => p.status === "available");
  const zoneParts: ZonePart[] = vehicle
    ? available.flatMap((p) => {
        const zone = zoneFor(p.type, p.position);
        return zone
          ? [
              {
                sku: p.sku,
                title: partTitle(p),
                position: p.position,
                condition: p.condition,
                priceNGN: p.priceNGN,
                stockQty: p.stockQty,
                image: p.images[0] ?? null,
                zone,
              },
            ]
          : [];
      })
    : [];
  // Four cards; both sides of a fender share one, so count cards, not parts.
  const justChecked = groupSides([...available].sort((a, b) => b.stockCheckedAt.localeCompare(a.stockCheckedAt)))
    .slice(0, 4)
    .flat();

  return (
    <Screen tab refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.brand}>
        <Image source={require("../../../assets/images/mark-tile.png")} style={styles.brandMark} accessible={false} />
        <Text variant="cardTitle">{SITE.name}</Text>
      </View>
      <Text variant="hero" accessibilityRole="header" style={styles.hero}>
        The right part for your Toyota or Lexus. First time.
      </Text>
      <Text style={styles.sub}>
        Genuine Belgium and new body parts from Zuba Market, checked for fit before they leave the shop.
      </Text>
      <View style={styles.chip}>
        <VehicleChip />
      </View>

      <View style={styles.panel}>
        <Text variant="h2" accessibilityRole="header">
          Where is the damage?
        </Text>
        <Text variant="bodySm" style={styles.panelSub}>
          {vehicle ? `Showing parts for your ${vehicleShortLabel(vehicle)}.` : "Start with your car."}
        </Text>
        <View style={styles.selector}>
          {query.isPending && vehicle ? (
            <Loading />
          ) : query.isError && !query.data ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : (
            <DamageSelector vehicle={vehicle} parts={zoneParts} />
          )}
        </View>
      </View>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p.title} style={styles.promise}>
            <Text variant="h3">{p.title}</Text>
            <Text variant="bodySm">{p.body}</Text>
          </View>
        ))}
      </View>

      <SectionTitle style={styles.section}>Shop by part</SectionTitle>
      <View style={styles.categories}>
        {CATEGORIES.map((category) => (
          <CategoryCard
            key={category}
            category={category}
            parts={available.filter((p) => p.category === category)}
            loading={query.isPending}
            model={vehicle?.model ?? null}
          />
        ))}
      </View>

      {justChecked.length > 0 ? (
        <>
          <SectionTitle style={styles.section}>Just checked on the shelf</SectionTitle>
          <View style={styles.gridTop}>
            <PartGrid parts={justChecked} />
          </View>
        </>
      ) : null}

      <View style={[styles.panel, styles.grades]}>
        <Text variant="h2" accessibilityRole="header">
          How we grade every part
        </Text>
        <Text style={styles.panelSub}>
          Belgium parts are genuine Toyota and Lexus parts from foreign-used cars. Each unit is one of a kind,
          photographed and graded on its own.
        </Text>
        <View style={styles.gradeList}>
          {CONDITIONS.map((c, i) => (
            <View key={c} style={[styles.grade, i > 0 && styles.gradeRule]}>
              <Text weight="semibold">{CONDITION_INFO[c].label}</Text>
              <Text variant="bodySm">{CONDITION_INFO[c].meaning}</Text>
            </View>
          ))}
        </View>
        <Text variant="bodySm" style={styles.visit}>
          Visit us at {SITE.shopLine}, {SITE.marketLine}.
        </Text>
      </View>
    </Screen>
  );
}

function CategoryCard({
  category,
  parts,
  loading,
  model,
}: {
  category: Category;
  parts: Part[];
  loading: boolean;
  model: string | null;
}) {
  const { cardWidth } = useGridColumns();
  const focus = useFocusRing();
  const photo = parts.find((p) => !isDrawing(p.images[0]));
  const info = CATEGORY_INFO[category];
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/shop/${category}`)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [styles.category, { width: cardWidth }, pressed && styles.pressed, focus.ring]}
    >
      <View style={styles.categoryImage}>
        <PartImage
          src={photo ? photo.images[0] : `/parts/${CATEGORY_TYPES[category][0]}.svg`}
          alt=""
          position={photo?.position ?? "n/a"}
          width={cardWidth}
          style={styles.wide}
        />
      </View>
      <View style={styles.categoryBody}>
        <Text variant="h2" style={styles.categoryLabel}>
          {info.label}
        </Text>
        <Text variant="small">{info.blurb}</Text>
        <Text variant="small" weight="semibold" style={styles.categoryCount}>
          {loading
            ? " "
            : parts.length === 0
              ? "Not listed online yet"
              : `${parts.length} in stock${model ? ` for your ${model}` : ""}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  brandMark: { width: 40, height: 40 },
  hero: {},
  sub: { marginTop: 12, fontSize: 17, lineHeight: 26 },
  chip: { marginTop: 20 },
  panel: { marginTop: 24, backgroundColor: color.paper, borderRadius: radius.lg, padding: GUTTER },
  panelSub: { marginTop: 4 },
  selector: { marginTop: 20 },
  promises: { marginTop: 24, borderTopWidth: 1, borderTopColor: color.primer },
  promise: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color.primer, gap: 2 },
  section: { marginTop: 36 },
  categories: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  category: { backgroundColor: color.paper, borderRadius: radius.md, overflow: "hidden" },
  pressed: { opacity: 0.85 },
  categoryImage: { aspectRatio: 4 / 3, overflow: "hidden", borderBottomWidth: 1, borderBottomColor: color.bay },
  wide: { aspectRatio: 4 / 3 },
  categoryBody: { padding: 12, flex: 1 },
  categoryLabel: { fontFamily: font.displayBold },
  categoryCount: { marginTop: "auto", paddingTop: 12 },
  gridTop: { marginTop: 16 },
  grades: { marginTop: 36 },
  gradeList: { marginTop: 16 },
  grade: { paddingVertical: 12, gap: 2 },
  gradeRule: { borderTopWidth: 1, borderTopColor: color.bay },
  visit: { marginTop: 16 },
});
