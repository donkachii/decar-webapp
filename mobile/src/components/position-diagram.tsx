import { StyleSheet, View } from "react-native";

import type { Zone } from "@/lib/domain";
import { color } from "@/theme";

import { CarTopView } from "./car-top-view";
import { DRAWING_RATIO, ZONE_AREA } from "./zones";

const WIDTH = 84;

/** Small top view with the part's area marked, so left and right are never guessed. */
export function PositionDiagram({ zone }: { zone: Zone }) {
  const height = WIDTH * DRAWING_RATIO;
  return (
    <View style={{ width: WIDTH, height }} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[styles.mark, ZONE_AREA[zone]]} />
      <CarTopView width={WIDTH} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 2,
    borderColor: color.navy,
    backgroundColor: color.bay,
  },
});
