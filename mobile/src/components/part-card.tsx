import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { formatNGN, groupSides, partTitle, POSITION_INFO, stockLine, type Part } from "@/lib/domain";
import { color, GUTTER, radius } from "@/theme";

import { AddToCartButton } from "./add-to-cart-button";
import { ConditionBadge } from "./condition-badge";
import { useFocusRing } from "./focus";
import { PartImage } from "./part-image";
import { StockChecked } from "./stock-checked";
import { Text } from "./text";

const GAP = 12;

/** Card width and columns for a grid that spans the screen inside the gutters. */
export function useGridColumns(gutter = GUTTER) {
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 3 : 2;
  return { columns, cardWidth: Math.floor((width - gutter * 2 - GAP * (columns - 1)) / columns), gap: GAP };
}

/**
 * A parts-bay tag: photo, grade, what it is, price, and how fresh the stock
 * check is. Given several sides of the same part, it shows a side picker and
 * everything below the picker follows the chosen side (each side keeps its
 * own SKU, price and stock).
 */
export function PartCard({ sides, width }: { sides: Part[]; width: number }) {
  const [index, setIndex] = useState(0);
  const part = sides[index] ?? sides[0];
  const picker = sides.length > 1;
  const title = partTitle(part);
  const available = part.status === "available";
  const focus = useFocusRing();

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={title}
        onPress={() => router.push(`/part/${part.sku}`)}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        style={({ pressed }) => [styles.link, pressed && styles.pressed, focus.ring]}
      >
        <PartImage src={part.images[0]} alt="" position={part.position} width={width} />
        <View style={styles.head}>
          <ConditionBadge condition={part.condition} />
          <Text variant="cardTitle" style={styles.title}>
            {picker ? partTitle({ name: part.name, position: "n/a" }) : title}
          </Text>
        </View>
      </Pressable>
      <View style={styles.body}>
        {picker ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Side" style={styles.sides}>
            {sides.map((side, i) => (
              <SideChip key={side.sku} label={sideLabel(sides, side)} selected={i === index} onPress={() => setIndex(i)} />
            ))}
          </View>
        ) : null}
        <View>
          <Text variant="price">{formatNGN(part.priceNGN)}</Text>
          <Text
            variant="small"
            weight={available ? undefined : "semibold"}
            tone={available ? "default" : "warn"}
            style={styles.stock}
          >
            {stockLine(part)}
          </Text>
          <StockChecked at={part.stockCheckedAt} />
        </View>
        {available ? <AddToCartButton key={part.sku} sku={part.sku} maxQty={part.stockQty} size="sm" /> : null}
      </View>
    </View>
  );
}

function SideChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={4}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff, focus.ring]}
    >
      <Text variant="small" weight={selected ? "semibold" : "medium"}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "Left" when every side shares its first word (front-left, front-right), else the full position. */
function sideLabel(sides: Part[], side: Part): string {
  const shared = sides[0].position.split("-")[0];
  if (!sides.every((p) => p.position.startsWith(`${shared}-`))) return POSITION_INFO[side.position].label;
  const rest = side.position.slice(shared.length + 1);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Cards in rows, for short lists inside a scrolling screen. Long listings use a FlatList. */
export function PartGrid({ parts }: { parts: Part[] }) {
  const { columns, cardWidth, gap } = useGridColumns();
  const groups = groupSides(parts);
  const rows: Part[][][] = [];
  for (let i = 0; i < groups.length; i += columns) rows.push(groups.slice(i, i + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row) => (
        <View key={row[0][0].sku} style={[styles.row, { gap }]}>
          {row.map((sides) => (
            <PartCard key={sides[0].sku} sides={sides} width={cardWidth} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.paper, borderRadius: radius.md, overflow: "hidden" },
  link: { borderRadius: radius.md },
  pressed: { opacity: 0.85 },
  head: { borderTopWidth: 1, borderTopColor: color.bay, paddingHorizontal: 12, paddingTop: 12 },
  title: { marginTop: 8 },
  body: { marginTop: "auto", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 8 },
  sides: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { minHeight: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center" },
  chipOn: { backgroundColor: color.tan, borderColor: color.tan },
  chipOff: { backgroundColor: color.paper, borderColor: color.primer },
  stock: { marginTop: 6 },
  row: { flexDirection: "row", alignItems: "stretch" },
});
