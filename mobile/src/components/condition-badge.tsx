import { StyleSheet, View } from "react-native";

import { CONDITION_INFO, isBelgium, type Condition } from "@/lib/domain";
import { color, font } from "@/theme";

import { Text } from "./text";

/**
 * Inspection tag: a grade square plus the buyer-facing label. Belgium grades
 * get a solid square; new stock gets an outlined one.
 */
export function ConditionBadge({ condition }: { condition: Condition }) {
  const info = CONDITION_INFO[condition];
  const belgium = isBelgium(condition);
  return (
    <View style={styles.row} accessible accessibilityLabel={info.label}>
      <View style={[styles.square, belgium ? styles.solid : styles.outlined]}>
        <Text style={[styles.grade, belgium && { color: color.paper }]}>{info.grade}</Text>
      </View>
      <Text variant="small" weight="medium">
        {info.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  square: { width: 20, height: 20, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  solid: { backgroundColor: color.wine },
  outlined: { borderWidth: 1.5, borderColor: color.navy },
  grade: { fontFamily: font.displayBold, fontSize: 13, lineHeight: 15, color: color.navy },
});
