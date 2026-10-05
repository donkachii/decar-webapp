import { router } from "expo-router";
import { Car } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  formatNGN,
  vehicleLabel,
  vehicleShortLabel,
  ZONE_LABELS,
  ZONES,
  type Condition,
  type Position,
  type Vehicle,
  type Zone,
} from "@/lib/domain";
import { color, radius } from "@/theme";

import { AddToCartButton } from "./add-to-cart-button";
import { Button } from "./button";
import { CarTopView } from "./car-top-view";
import { ConditionBadge } from "./condition-badge";
import { useFocusRing } from "./focus";
import { PartImage } from "./part-image";
import { Text } from "./text";
import { WhatsappButton } from "./whatsapp-button";
import { DRAWING_RATIO, ZONE_AREA } from "./zones";

export interface ZonePart {
  sku: string;
  title: string;
  position: Position;
  condition: Condition;
  priceNGN: number;
  stockQty: number;
  image: string | null;
  zone: Zone;
}

const MAX_WIDTH = 320;

// Where each zone's label sits inside its cell.
const ALIGN: Record<Zone, { justifyContent: "flex-start" | "center" | "flex-end"; alignItems: "flex-start" | "center" | "flex-end" }> = {
  "front-left": { justifyContent: "flex-start", alignItems: "flex-start" },
  front: { justifyContent: "flex-start", alignItems: "center" },
  "front-right": { justifyContent: "flex-start", alignItems: "flex-end" },
  left: { justifyContent: "center", alignItems: "flex-start" },
  right: { justifyContent: "center", alignItems: "flex-end" },
  "rear-left": { justifyContent: "flex-end", alignItems: "flex-start" },
  rear: { justifyContent: "flex-end", alignItems: "center" },
  "rear-right": { justifyContent: "flex-end", alignItems: "flex-end" },
};

/**
 * Tap the damaged area of the car; the parts for that area on the selected
 * vehicle appear underneath. The one bold element in the app.
 */
export function DamageSelector({ vehicle, parts }: { vehicle: Vehicle | null; parts: ZonePart[] }) {
  const [zone, setZone] = useState<Zone | null>(null);
  const [width, setWidth] = useState(0);
  const counts = new Map<Zone, number>();
  for (const p of parts) counts.set(p.zone, (counts.get(p.zone) ?? 0) + 1);
  const inZone = zone ? parts.filter((p) => p.zone === zone) : [];
  const drawingWidth = Math.min(MAX_WIDTH, width);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {drawingWidth > 0 ? (
        <View style={[styles.drawing, { width: drawingWidth, height: drawingWidth * DRAWING_RATIO }]}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Damaged area" style={StyleSheet.absoluteFill}>
            {ZONES.map((z) => (
              <ZoneCell
                key={z}
                zone={z}
                selected={zone === z}
                count={vehicle ? (counts.get(z) ?? 0) : null}
                onPress={() => setZone(zone === z ? null : z)}
              />
            ))}
          </View>
          <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
            <CarTopView width={drawingWidth} height={drawingWidth * DRAWING_RATIO} />
          </View>
          <View style={[styles.prompt, styles.passThrough]}>
            <Text variant="small" weight="semibold" style={styles.center}>
              {vehicle ? "Tap where it's damaged" : "Choose your car first"}
            </Text>
          </View>
        </View>
      ) : null}

      <View accessibilityLiveRegion="polite" style={styles.results}>
        {zone === null ? (
          <ZoneIntro vehicle={vehicle} />
        ) : (
          <Animated.View key={zone} entering={FadeIn.duration(180)}>
            <Text variant="h3">
              {ZONE_LABELS[zone]}
              {vehicle ? `, ${vehicleShortLabel(vehicle)}` : ""}
            </Text>
            {!vehicle ? (
              <View style={styles.gap}>
                <Text>Choose your car and we&apos;ll show the parts for this area that fit it.</Text>
                <Button icon={Car} onPress={() => router.push("/choose-car")}>
                  Choose your car
                </Button>
              </View>
            ) : inZone.length === 0 ? (
              <View style={styles.gap}>
                <Text>
                  Nothing for this area on the shelf right now. Tell us what you need and we&apos;ll check the shop
                  and the market.
                </Text>
                <WhatsappButton
                  message={`Hello, I need a ${ZONE_LABELS[zone].toLowerCase()} part for my ${vehicleLabel(vehicle)}. Do you have one?`}
                />
              </View>
            ) : (
              <View style={styles.list}>
                {inZone.map((p, i) => (
                  <ZoneRow key={p.sku} part={p} first={i === 0} />
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function ZoneCell({
  zone,
  selected,
  count,
  onPress,
}: {
  zone: Zone;
  selected: boolean;
  count: number | null;
  onPress: () => void;
}) {
  const focus = useFocusRing();
  const countLabel = count === null ? null : count === 0 ? "none" : `${count} ${count === 1 ? "part" : "parts"}`;
  const row = zone === "front" || zone === "rear";
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={countLabel ? `${ZONE_LABELS[zone]}, ${countLabel}` : ZONE_LABELS[zone]}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[styles.cell, ZONE_AREA[zone], ALIGN[zone]]}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.cellBox, selected ? styles.cellOn : pressed && styles.cellPressed, focus.ring]} />
          <View style={[row ? styles.labelRow : styles.labelColumn, (zone === "left" || zone === "right") && styles.narrow]}>
            <Text variant="small" weight="semibold" style={ALIGN[zone].alignItems === "flex-end" && styles.end}>
              {ZONE_LABELS[zone]}
            </Text>
            {countLabel ? (
              <Text variant="small" style={[styles.count, ALIGN[zone].alignItems === "flex-end" && styles.end]}>
                {countLabel}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

function ZoneRow({ part, first }: { part: ZonePart; first: boolean }) {
  const open = () => router.push(`/part/${part.sku}`);
  return (
    <View style={[styles.row, !first && styles.rowRule]}>
      <Pressable accessibilityRole="link" accessibilityLabel={part.title} onPress={open} style={styles.thumb}>
        <PartImage src={part.image} alt="" position={part.position} width={72} />
      </Pressable>
      <View style={styles.rowBody}>
        <Pressable accessibilityRole="link" onPress={open} hitSlop={4}>
          <Text variant="cardTitle">{part.title}</Text>
        </Pressable>
        <ConditionBadge condition={part.condition} />
        <View style={styles.rowFoot}>
          <Text variant="price" style={styles.rowPrice}>
            {formatNGN(part.priceNGN)}
          </Text>
          <AddToCartButton sku={part.sku} maxQty={part.stockQty} size="sm" />
        </View>
      </View>
    </View>
  );
}

function ZoneIntro({ vehicle }: { vehicle: Vehicle | null }) {
  if (!vehicle) {
    return (
      <View style={styles.gapTight}>
        <Text>
          Tell us your car, then tap the area that was hit. We&apos;ll show only the parts confirmed to fit, with their
          grade and price.
        </Text>
        <Button icon={Car} onPress={() => router.push("/choose-car")}>
          Choose your car
        </Button>
      </View>
    );
  }
  return (
    <Text>Tap the area that was hit and we&apos;ll show the parts in stock for your {vehicleShortLabel(vehicle)}.</Text>
  );
}

const styles = StyleSheet.create({
  drawing: { alignSelf: "center" },
  cell: { position: "absolute", padding: 8, flexDirection: "column" },
  cellBox: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.primer,
  },
  cellOn: { backgroundColor: color.tan, borderColor: color.tan, borderStyle: "solid" },
  cellPressed: { backgroundColor: color.bay },
  labelColumn: { gap: 1 },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  narrow: { maxWidth: 56 },
  count: { fontVariant: ["tabular-nums"] },
  end: { textAlign: "right" },
  prompt: { position: "absolute", top: "44%", left: "35%", width: "30%" },
  // The drawing and prompt sit over the zones; taps go through to them.
  passThrough: { pointerEvents: "none" },
  center: { textAlign: "center" },
  results: { marginTop: 20, minHeight: 96 },
  gap: { marginTop: 12, gap: 16 },
  gapTight: { gap: 16 },
  list: { marginTop: 12, borderWidth: 1, borderColor: color.bay, borderRadius: radius.md },
  row: { flexDirection: "row", gap: 12, padding: 12 },
  rowRule: { borderTopWidth: 1, borderTopColor: color.bay },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, borderWidth: 1, borderColor: color.bay, overflow: "hidden" },
  rowBody: { flex: 1, minWidth: 0, gap: 6 },
  rowFoot: { marginTop: 4, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowPrice: { flexShrink: 1 },
});
