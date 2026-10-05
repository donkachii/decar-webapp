import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { FilterChips } from "@/components/filter-chips";
import { PartCard, useGridColumns } from "@/components/part-card";
import { ErrorState, Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { VehicleChip } from "@/components/vehicle-chip";
import { WhatsappButton } from "@/components/whatsapp-button";
import { useParts, useVehicles } from "@/lib/catalog";
import {
  CATEGORY_INFO,
  CATEGORY_TYPES,
  CONDITION_INFO,
  CONDITIONS,
  groupSides,
  isCategory,
  parseList,
  POSITION_INFO,
  TYPE_INFO,
  TYPE_POSITIONS,
  vehicleLabel,
  vehicleShortLabel,
  type Category,
  type Condition,
  type Part,
  type PartType,
  type Position,
} from "@/lib/domain";
import { usePullToRefresh, useRefreshOnFocus } from "@/lib/refresh";
import { useSelectedVehicle, useSetVehicle } from "@/lib/vehicle";
import { color, GUTTER, radius } from "@/theme";

type Params = { category: string; type?: string; position?: string; condition?: string; vehicle?: string };

export default function ListingScreen() {
  const params = useLocalSearchParams<Params>();
  if (!isCategory(params.category)) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "Not found" }} />
        <Text>We don&apos;t sell that category. Lights, bumpers, body panels and mirrors are in the Shop tab.</Text>
      </View>
    );
  }
  return <Listing category={params.category} params={params} />;
}

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Listing with filters (vehicle, type, position, condition), like /shop/[category] on the website. */
function Listing({ category, params }: { category: Category; params: Params }) {
  const info = CATEGORY_INFO[category];
  const typeOptions = CATEGORY_TYPES[category];
  const positionOptions = useMemo(
    () => [...new Set(typeOptions.flatMap((t) => TYPE_POSITIONS[t]))] as Position[],
    [typeOptions],
  );

  const [types, setTypes] = useState<PartType[]>(() => parseList(params.type, typeOptions));
  const [positions, setPositions] = useState<Position[]>(() => parseList(params.position, positionOptions));
  const [conditions, setConditions] = useState<Condition[]>(() => parseList(params.condition, CONDITIONS));
  const [showAll, setShowAll] = useState(params.vehicle === "all");

  // A shared link with ?vehicle=<id> makes that car the buyer's car, as on the website.
  const vehicles = useVehicles();
  const setVehicle = useSetVehicle();
  useEffect(() => {
    const id = params.vehicle;
    if (id && id !== "all" && vehicles.data?.some((v) => v.id === id)) setVehicle(id);
  }, [params.vehicle, vehicles.data, setVehicle]);

  const selected = useSelectedVehicle();
  const filter = showAll ? null : selected;
  const anyFilter = types.length + positions.length + conditions.length > 0;

  const parts = useParts({ category, types, positions, conditions, vehicleId: filter?.id });
  // Everything in the category for this car: chips only offer what can match.
  // Same key as `parts` when no filter is on, so it is one request.
  const forCar = useParts({ category, types: [], positions: [], conditions: [], vehicleId: filter?.id });
  // Nothing in the category for this car: is anything listed for any car?
  const anyCar = useParts(
    { category, types: [], positions: [], conditions: [], vehicleId: undefined },
    { enabled: !!filter && forCar.data?.length === 0 },
  );

  // refetch functions are stable, so this is too (useRefreshOnFocus re-runs when it changes).
  const refetchParts = parts.refetch;
  const refetchForCar = forCar.refetch;
  const refetchAll = useCallback(
    () => Promise.all([refetchParts(), refetchForCar()]),
    [refetchParts, refetchForCar],
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetchAll);
  useRefreshOnFocus(refetchAll);

  const { columns, cardWidth, gap } = useGridColumns();
  const groups = useMemo(() => groupSides(parts.data ?? []), [parts.data]);

  const pool = forCar.data ?? [];
  const offered = <T extends string>(values: readonly T[], active: T[], field: (p: Part) => T) =>
    values.filter((v) => active.includes(v) || pool.some((p) => field(p) === v));
  const typeChips = offered(typeOptions, types, (p) => p.type);
  const positionChips = offered(positionOptions, positions, (p) => p.position);
  const conditionChips = offered(CONDITIONS, conditions, (p) => p.condition);
  // A row with one chip left would only repeat the list as it is.
  const worthShowing = (chips: readonly string[], active: string[]) => chips.length > 1 || active.length > 0;

  const askMessage = `Hello, I'm looking for ${info.label.toLowerCase()}${filter ? ` for my ${vehicleLabel(filter)}` : selected ? ` for my ${vehicleLabel(selected)}` : ""}.`;
  const notListed = forCar.data?.length === 0 && (!filter || anyCar.data?.length === 0);

  const header = (
    <View style={styles.header}>
      <Text variant="title" accessibilityRole="header">
        {info.label}
      </Text>
      <Text style={styles.blurb}>{info.blurb}</Text>

      {notListed ? null : (
        <>
          <View style={styles.carBar}>
            {filter ? (
              <>
                <Text variant="bodySm">
                  Parts that fit your <Text weight="semibold" variant="bodySm">{vehicleLabel(filter)}</Text>
                </Text>
                <Button variant="link" size="sm" onPress={() => setShowAll(true)}>
                  Show all cars
                </Button>
              </>
            ) : selected && showAll ? (
              <>
                <Text variant="bodySm">Showing parts for every car.</Text>
                <Button variant="link" size="sm" onPress={() => setShowAll(false)}>
                  {`Only my ${vehicleShortLabel(selected)}`}
                </Button>
              </>
            ) : (
              <>
                <Text variant="bodySm">Showing parts for every car. Choose yours to see only what fits.</Text>
                <VehicleChip />
              </>
            )}
          </View>

          <View style={styles.filters}>
            {worthShowing(typeChips, types) ? (
              <FilterChips
                label="Part"
                options={typeChips.map((t) => ({ value: t, label: TYPE_INFO[t].plural, active: types.includes(t) }))}
                onToggle={(v) => setTypes((list) => toggle(list, v as PartType))}
              />
            ) : null}
            {worthShowing(positionChips, positions) ? (
              <FilterChips
                label="Position"
                options={positionChips.map((p) => ({
                  value: p,
                  label: POSITION_INFO[p].label,
                  active: positions.includes(p),
                }))}
                onToggle={(v) => setPositions((list) => toggle(list, v as Position))}
              />
            ) : null}
            {worthShowing(conditionChips, conditions) ? (
              <FilterChips
                label="Condition"
                options={conditionChips.map((c) => ({
                  value: c,
                  label: CONDITION_INFO[c].label,
                  active: conditions.includes(c),
                }))}
                onToggle={(v) => setConditions((list) => toggle(list, v as Condition))}
              />
            ) : null}
          </View>

          <View style={styles.countRow}>
            <Text weight="semibold" style={styles.tabular} accessibilityLiveRegion="polite">
              {parts.data ? `${parts.data.length} ${parts.data.length === 1 ? "part" : "parts"}` : " "}
            </Text>
            {anyFilter ? (
              <Button
                variant="link"
                size="sm"
                onPress={() => {
                  setTypes([]);
                  setPositions([]);
                  setConditions([]);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </View>
        </>
      )}
    </View>
  );

  const empty = parts.isPending ? (
    <Loading />
  ) : parts.isError ? (
    <ErrorState onRetry={() => void parts.refetch()} />
  ) : notListed ? (
    <Panel style={styles.emptyPanel}>
      <Text variant="h2">Not listed online yet</Text>
      <Text>
        The shop stocks {info.blurb.toLowerCase()} for many Toyota and Lexus models. Tell us your car and the part,
        and we&apos;ll send photos and a price.
      </Text>
      <WhatsappButton message={askMessage} variant="primary" />
    </Panel>
  ) : (
    <Panel style={styles.emptyPanel}>
      <Text variant="h3">Nothing on the shelf matches yet</Text>
      <Text>
        {anyFilter ? "Try clearing a filter. " : ""}Or tell us what you need and we&apos;ll check the shop and the
        market for you.
      </Text>
      <WhatsappButton message={askMessage} />
    </Panel>
  );

  return (
    <>
      {/* The big heading below names the page; the bar stays quiet. */}
      <Stack.Screen options={{ title: "" }} />
      <FlatList
        key={columns}
        data={groups}
        numColumns={columns}
        keyExtractor={(sides) => sides[0].sku}
        renderItem={({ item }) => <PartCard sides={item} width={cardWidth} />}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        style={styles.screen}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.navy} colors={[color.navy]} />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bay },
  content: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 40 },
  missing: { flex: 1, padding: GUTTER, backgroundColor: color.bay },
  header: { marginBottom: 16 },
  blurb: { marginTop: 6, fontSize: 17 },
  carBar: {
    marginTop: 20,
    backgroundColor: color.paper,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filters: { marginTop: 20, gap: 14 },
  countRow: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: color.primer,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabular: { fontVariant: ["tabular-nums"] },
  emptyPanel: { gap: 12 },
});
