import { router, Stack, useLocalSearchParams } from "expo-router";
import { Car, CircleAlert, Share2 } from "lucide-react-native";
import { useCallback, type ReactNode } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { Button } from "@/components/button";
import { ConditionBadge } from "@/components/condition-badge";
import { FitStatus } from "@/components/fit-status";
import { useFocusRing } from "@/components/focus";
import { PartGrid } from "@/components/part-card";
import { PartGallery } from "@/components/part-gallery";
import { PositionDiagram } from "@/components/position-diagram";
import { Screen, SectionTitle } from "@/components/screen";
import { StockChecked } from "@/components/stock-checked";
import { ErrorState, Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { useParts, usePart, usePartFitment, useReplacedTogether } from "@/lib/catalog";
import {
  CONDITION_INFO,
  formatNGN,
  isBelgium,
  isDrawing,
  normaliseSku,
  partTitle,
  plainText,
  POSITION_INFO,
  SHIPPING_CLASS_INFO,
  stockLine,
  TYPE_INFO,
  variantLabel,
  variantValue,
  vehicleGenerationLabel,
  vehicleLabel,
  vehicleShortLabel,
  zoneFor,
  type Part,
} from "@/lib/domain";
import { usePullToRefresh, useRefreshOnFocus } from "@/lib/refresh";
import { useSelectedVehicle } from "@/lib/vehicle";
import { partEnquiryMessage, partUrl } from "@/lib/whatsapp";
import { color, GUTTER, radius } from "@/theme";

const BAR_HEIGHT = 76;

export default function PartScreen() {
  const { sku: raw } = useLocalSearchParams<{ sku: string }>();
  const sku = normaliseSku(raw ?? "");
  const partQuery = usePart(sku);
  const fitQuery = usePartFitment(sku);
  const part = partQuery.data ?? null;

  const refetchPart = partQuery.refetch;
  const refetchFit = fitQuery.refetch;
  const refetch = useCallback(() => Promise.all([refetchPart(), refetchFit()]), [refetchPart, refetchFit]);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);
  useRefreshOnFocus(refetch);

  if (!sku || partQuery.data === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Part not found" }} />
        <Panel style={styles.gap}>
          <Text variant="h2">We can&apos;t find that part</Text>
          <Text>It may have been sold and taken off the shelf. Ask us and we&apos;ll check the shop and the market.</Text>
          <WhatsappButton message={`Hello, I'm looking for part ${raw ?? ""}. Do you have it?`} />
        </Panel>
      </Screen>
    );
  }
  if (partQuery.isPending) return <Loading />;
  if (!part) return <ErrorState onRetry={() => void refetch()} />;

  return <PartView part={part} fitQuery={fitQuery} refreshing={refreshing} onRefresh={onRefresh} />;
}

function PartView({
  part,
  fitQuery,
  refreshing,
  onRefresh,
}: {
  part: Part;
  fitQuery: ReturnType<typeof usePartFitment>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  const selected = useSelectedVehicle();
  const fitment = fitQuery.data;
  const together = useReplacedTogether(part, fitment);
  const available = part.status === "available";
  const alternatives = useParts(
    { vehicleId: fitment?.[0]?.vehicleId, types: [part.type] },
    { enabled: !available && (fitment?.length ?? 0) > 0 },
  );

  const title = partTitle(part);
  const fits = selected && fitment ? fitment.some((f) => f.vehicleId === selected.id) : null;
  const zone = zoneFor(part.type, part.position);
  const position = POSITION_INFO[part.position];
  const variants = Object.entries(part.variants);
  const others = (alternatives.data ?? []).filter((p) => p.sku !== part.sku && p.status === "available");

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: TYPE_INFO[part.type].label,
          headerRight: () => <ShareButton part={part} />,
        }}
      />
      <Screen refreshing={refreshing} onRefresh={onRefresh} footerSpace={available ? BAR_HEIGHT + insets.bottom : 0}>
        <PartGallery images={part.images} alt={plainText(title)} position={part.position} />
        {isDrawing(part.images[0]) ? (
          <Text variant="bodySm" style={styles.note}>
            Drawing shown. Ask on WhatsApp for photos of this unit.
          </Text>
        ) : null}

        <View style={styles.summary}>
          <ConditionBadge condition={part.condition} />
          <Text variant="title" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text variant="priceLg" style={styles.price}>
            {formatNGN(part.priceNGN)}
          </Text>
          <View style={styles.stock}>
            <Text weight="semibold" tone={available ? "default" : "warn"}>
              {stockLine(part)}
            </Text>
            <StockChecked at={part.stockCheckedAt} variant="bodySm" />
          </View>

          <View style={styles.fit}>
            {selected ? (
              <FitStatus fits={fits} vehicleShortLabel={vehicleShortLabel(selected)} large />
            ) : (
              <View style={styles.choose}>
                <Text variant="bodySm" style={styles.flexShrink}>
                  Choose your car to check this part fits it.
                </Text>
                <Button variant="outline" size="sm" icon={Car} onPress={() => router.push("/choose-car")}>
                  Choose your car
                </Button>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {available ? null : (
              <View style={styles.gone}>
                <CircleAlert size={18} color={color.warn} style={styles.goneIcon} />
                <Text weight="semibold" tone="warn" style={styles.flexShrink}>
                  {part.status === "sold"
                    ? "This unit has been sold."
                    : "Another buyer has reserved this unit. Ask us if it comes back."}
                </Text>
              </View>
            )}
            <WhatsappButton message={partEnquiryMessage({ sku: part.sku, title })}>
              Ask about this part on WhatsApp
            </WhatsappButton>
          </View>
        </View>

        <View style={styles.sheet}>
          <SheetRow heading="Condition">
            <Text weight="semibold">{CONDITION_INFO[part.condition].label}</Text>
            <Text variant="bodySm">{CONDITION_INFO[part.condition].meaning}</Text>
            {part.defects?.length ? (
              <View style={styles.defects}>
                <Text weight="semibold">What to know about this unit</Text>
                {part.defects.map((d) => (
                  <Text key={d} variant="bodySm">
                    {"•"} {d}
                  </Text>
                ))}
              </View>
            ) : null}
          </SheetRow>

          <SheetRow heading="Position">
            <View style={styles.position}>
              {zone ? <PositionDiagram zone={zone} /> : null}
              <View style={styles.flexShrink}>
                <Text weight="semibold">{position.label}</Text>
                {position.hint ? <Text variant="bodySm">{position.hint}</Text> : null}
                <Text variant="small" style={styles.note}>
                  Left and right as seen from the driver&apos;s seat.
                </Text>
              </View>
            </View>
          </SheetRow>

          {variants.length > 0 ? (
            <SheetRow heading="Specification">
              {variants.map(([key, value], i) => (
                <View key={key} style={[styles.spec, i > 0 && styles.specRule]}>
                  <Text variant="bodySm" style={styles.flexShrink}>
                    {variantLabel(key)}
                  </Text>
                  <Text variant="bodySm" weight="semibold">
                    {variantValue(value)}
                  </Text>
                </View>
              ))}
            </SheetRow>
          ) : null}

          <SheetRow heading="Fits">
            {fitQuery.isPending ? (
              <Text variant="bodySm">Checking…</Text>
            ) : (
              (fitment ?? []).map((f) => (
                <View key={f.vehicleId} style={styles.fitRow}>
                  <Button variant="link" onPress={() => router.push(`/vehicle/${f.vehicleId}`)}>
                    {vehicleLabel(f.vehicle)}
                  </Button>
                  <Text variant="small">{vehicleGenerationLabel(f.vehicle)}</Text>
                  {f.notes ? <Text variant="bodySm">{f.notes}</Text> : null}
                </View>
              ))
            )}
          </SheetRow>

          <SheetRow heading="Details">
            <Detail label="SKU" value={part.sku} tabular />
            {part.oemNumber ? <Detail label="OEM number" value={part.oemNumber} tabular /> : null}
            <Detail label="Delivery size" value={SHIPPING_CLASS_INFO[part.shippingClass].label} />
            <Detail label="Units" value={isBelgium(part.condition) ? "One-off unit" : "New stock"} />
          </SheetRow>
        </View>

        {together.data && together.data.length > 0 ? (
          <View style={styles.more}>
            <SectionTitle>Usually replaced together</SectionTitle>
            <Text variant="bodySm" style={styles.moreSub}>
              From the same shelf, for the same car.
            </Text>
            <PartGrid parts={together.data} />
          </View>
        ) : null}

        {others.length > 0 ? (
          <View style={styles.more}>
            <SectionTitle style={styles.moreTitle}>Still on the shelf for this car</SectionTitle>
            <PartGrid parts={others} />
          </View>
        ) : null}
      </Screen>

      {/* Price and Add to cart stay in reach while the buyer reads. */}
      {available ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.flexShrink}>
            <Text variant="price">{formatNGN(part.priceNGN)}</Text>
            <Text variant="small" numberOfLines={1}>
              {stockLine(part)}
            </Text>
          </View>
          <AddToCartButton sku={part.sku} maxQty={part.stockQty} style={styles.barButton} />
        </View>
      ) : null}
    </View>
  );
}

function ShareButton({ part }: { part: Part }) {
  const focus = useFocusRing();
  // The website's product page: it previews with photo, title and price in WhatsApp.
  const share = () =>
    void Share.share({ message: `${plainText(partTitle(part))}, ${formatNGN(part.priceNGN)}\n${partUrl(part.sku)}` });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share this part"
      onPress={share}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={8}
      style={[styles.share, focus.ring]}
    >
      <Share2 size={20} color={color.navy} />
    </Pressable>
  );
}

function SheetRow({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="h3" accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

function Detail({ label, value, tabular = false }: { label: string; value: string; tabular?: boolean }) {
  return (
    <View style={styles.detail}>
      <Text variant="bodySm">{label}</Text>
      <Text variant="bodySm" weight="semibold" style={[styles.detailValue, tabular && styles.tabular]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bay },
  flexShrink: { flexShrink: 1 },
  gap: { gap: 12 },
  note: { marginTop: 8 },
  summary: { marginTop: 20 },
  title: { marginTop: 12 },
  price: { marginTop: 16 },
  stock: { marginTop: 12, gap: 2 },
  fit: { marginTop: 16 },
  choose: {
    gap: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.navy,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: { marginTop: 20, gap: 8 },
  gone: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: color.paper,
    borderRadius: radius.md,
    padding: 12,
  },
  goneIcon: { marginTop: 3 },
  sheet: { marginTop: 32, borderTopWidth: 1, borderTopColor: color.primer },
  row: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: color.primer, gap: 8 },
  rowBody: { gap: 4 },
  defects: { marginTop: 8, backgroundColor: color.paper, borderRadius: radius.md, padding: 12, gap: 4 },
  position: { flexDirection: "row", alignItems: "center", gap: 16 },
  spec: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 6 },
  specRule: { borderTopWidth: 1, borderTopColor: color.bay },
  fitRow: { marginBottom: 8 },
  detail: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 3 },
  detailValue: { flexShrink: 1, textAlign: "right" },
  tabular: { fontVariant: ["tabular-nums"] },
  more: { marginTop: 40 },
  moreTitle: { marginBottom: 16 },
  moreSub: { marginTop: 4, marginBottom: 16 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    backgroundColor: color.paper,
    borderTopWidth: 1,
    borderTopColor: color.primer,
  },
  barButton: { marginLeft: "auto", minWidth: 152 },
  share: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
});
