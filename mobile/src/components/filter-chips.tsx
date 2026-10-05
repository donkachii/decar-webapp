import { Pressable, StyleSheet, View } from "react-native";

import { color, radius } from "@/theme";

import { useFocusRing } from "./focus";
import { Text } from "./text";

export interface ChipOption {
  value: string;
  label: string;
  active: boolean;
}

/** One filter row. Active chips are tan: the only action colour. */
export function FilterChips({
  label,
  options,
  onToggle,
}: {
  label: string;
  options: ChipOption[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text variant="small" weight="semibold">
        {label}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={o.value} option={o} onPress={() => onToggle(o.value)} />
        ))}
      </View>
    </View>
  );
}

function Chip({ option, onPress }: { option: ChipOption; onPress: () => void }) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: option.active }}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [
        styles.chip,
        option.active ? styles.on : styles.off,
        pressed && !option.active && styles.pressed,
        focus.ring,
      ]}
    >
      <Text variant="bodySm" weight={option.active ? "semibold" : "medium"}>
        {option.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, justifyContent: "center" },
  on: { backgroundColor: color.tan, borderColor: color.tan },
  off: { backgroundColor: color.paper, borderColor: color.primer },
  pressed: { borderColor: color.navy },
});
