import { router } from "expo-router";
import { CircleAlert, Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { useCartStore, type CartLine } from "@/lib/cart";
import { formatNGN, type CartPartView } from "@/lib/domain";
import { color, font, radius } from "@/theme";

import { ConditionBadge } from "./condition-badge";
import { FitStatus } from "./fit-status";
import { useFocusRing } from "./focus";
import { PartImage } from "./part-image";
import { Text } from "./text";

/** Cart lines with live price, stock and fit for the selected car (CLAUDE.md section 7). */
export function CartLineList({
  lines,
  parts,
  loading,
  vehicleShortLabel,
  onNavigate,
}: {
  lines: CartLine[];
  parts: Map<string, CartPartView>;
  loading: boolean;
  vehicleShortLabel: string | null;
  onNavigate?: () => void;
}) {
  return (
    <View>
      {lines.map((line, i) => (
        <CartLineRow
          key={line.sku}
          line={line}
          part={parts.get(line.sku)}
          loading={loading}
          vehicleShortLabel={vehicleShortLabel}
          onNavigate={onNavigate}
          first={i === 0}
        />
      ))}
    </View>
  );
}

function CartLineRow({
  line,
  part,
  loading,
  vehicleShortLabel,
  onNavigate,
  first,
}: {
  line: CartLine;
  part: CartPartView | undefined;
  loading: boolean;
  vehicleShortLabel: string | null;
  onNavigate?: () => void;
  first: boolean;
}) {
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);

  if (!part) {
    return (
      <View style={[styles.row, !first && styles.rule]}>
        <View style={styles.placeholder} />
        <View style={styles.body}>
          <Text variant="small" style={styles.tabular} numberOfLines={1}>
            {line.sku}
          </Text>
          <Text variant="bodySm">{loading ? "Checking stock…" : "This part is no longer listed."}</Text>
        </View>
        {!loading ? <RemoveButton onPress={() => remove(line.sku)} /> : null}
      </View>
    );
  }

  const unavailable = part.status !== "available" || part.stockQty < line.qty;
  const open = () => {
    onNavigate?.();
    router.push(`/part/${part.sku}`);
  };

  return (
    <View style={[styles.row, !first && styles.rule]}>
      <Pressable accessibilityRole="link" accessibilityLabel={part.title} onPress={open} style={styles.thumb}>
        <PartImage src={part.image} alt="" position={part.position} width={72} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Pressable accessibilityRole="link" onPress={open} style={styles.shrink} hitSlop={4}>
            <Text variant="cardTitle">{part.title}</Text>
          </Pressable>
          <Text variant="cardTitle" style={[styles.tabular, styles.price]}>
            {formatNGN(part.priceNGN * line.qty)}
          </Text>
        </View>
        <ConditionBadge condition={part.condition} />
        <Text variant="small" style={styles.tabular}>
          {part.sku}
        </Text>
        <FitStatus fits={part.fits} vehicleShortLabel={vehicleShortLabel} />
        {unavailable ? (
          <View style={styles.alert}>
            <CircleAlert size={16} color={color.warn} style={styles.alertIcon} />
            <Text variant="bodySm" weight="semibold" tone="warn" style={styles.shrink}>
              {part.status === "sold"
                ? "Sold since you added it. Remove it to continue."
                : part.status === "reserved"
                  ? "Reserved by another buyer. Remove it to continue."
                  : `Only ${part.stockQty} left. Lower the quantity to continue.`}
            </Text>
          </View>
        ) : null}
        <View style={styles.foot}>
          {part.belgium ? (
            <Text variant="bodySm">One unit available</Text>
          ) : (
            <QtyStepper
              qty={line.qty}
              max={Math.max(1, part.stockQty)}
              onChange={(qty) => setQty(line.sku, qty, part.stockQty)}
              label={part.title}
            />
          )}
          <RemoveButton onPress={() => remove(line.sku)} />
        </View>
      </View>
    </View>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      hitSlop={6}
      style={[styles.remove, focus.ring]}
    >
      <Text variant="bodySm" weight="semibold" style={styles.underline}>
        Remove
      </Text>
    </Pressable>
  );
}

function QtyStepper({
  qty,
  max,
  onChange,
  label,
}: {
  qty: number;
  max: number;
  onChange: (qty: number) => void;
  label: string;
}) {
  return (
    <View style={styles.stepper} accessibilityLabel={`Quantity of ${label}`}>
      <StepButton icon="minus" label="One fewer" disabled={qty <= 1} onPress={() => onChange(qty - 1)} />
      <Text weight="semibold" style={[styles.qty, styles.tabular]} accessibilityLiveRegion="polite">
        {qty}
      </Text>
      <StepButton icon="plus" label="One more" disabled={qty >= max} onPress={() => onChange(qty + 1)} />
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const focus = useFocusRing();
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.disabled, focus.ring]}
    >
      <Icon size={16} color={color.navy} />
    </Pressable>
  );
}

export function CartSkeleton({ rows }: { rows: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rule]}>
          <View style={styles.placeholder} />
          <View style={[styles.body, styles.skeleton]}>
            <View style={[styles.bar, { width: "75%" }]} />
            <View style={[styles.bar, { width: "33%" }]} />
            <View style={[styles.bar, { width: "50%" }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 16 },
  rule: { borderTopWidth: 1, borderTopColor: color.bay },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, borderWidth: 1, borderColor: color.bay, overflow: "hidden" },
  placeholder: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: color.bay },
  body: { flex: 1, minWidth: 0, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  shrink: { flexShrink: 1 },
  price: { fontFamily: font.displayBold },
  tabular: { fontVariant: ["tabular-nums"] },
  alert: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  alertIcon: { marginTop: 3 },
  foot: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  remove: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8, borderRadius: radius.sm },
  underline: { textDecorationLine: "underline", textDecorationColor: color.primer },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  step: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.primer,
    backgroundColor: color.paper,
  },
  stepPressed: { borderColor: color.navy },
  disabled: { opacity: 0.4 },
  qty: { width: 32, textAlign: "center" },
  skeleton: { paddingTop: 4, gap: 8 },
  bar: { height: 16, borderRadius: radius.sm, backgroundColor: color.bay },
});
