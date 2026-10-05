import { Image } from "expo-image";
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { imageUri } from "@/lib/images";
import { isDrawing, type Position } from "@/lib/domain";
import { color } from "@/theme";

/**
 * Square image well on paper. Photos fill the well (`cover`) on cards and
 * thumbnails; the product page shows the whole part (`contain`). Placeholder
 * drawings are drawn as the right-hand part and mirrored for left-hand
 * positions; real photos never are.
 */
export function PartImage({
  src,
  alt,
  position,
  width,
  fit = "cover",
  style,
}: {
  src: string | null | undefined;
  /** Empty when the image repeats text next to it. */
  alt: string;
  position: Position;
  /** Rendered width in points, used to request a photo of the right size. */
  width: number;
  fit?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
}) {
  const drawing = isDrawing(src);
  const uri = imageUri(src, width * PixelRatio.get());
  const flip = drawing && position.endsWith("left");

  return (
    <View
      style={[styles.well, style]}
      accessible={alt !== "" || undefined}
      accessibilityRole={alt !== "" ? "image" : undefined}
      accessibilityLabel={alt || undefined}
    >
      {uri ? (
        <Image
          source={{ uri }}
          recyclingKey={uri}
          contentFit={drawing ? "contain" : fit}
          style={[drawing ? styles.drawing : StyleSheet.absoluteFill, flip && styles.flip]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { aspectRatio: 1, overflow: "hidden", backgroundColor: color.paper },
  drawing: { position: "absolute", top: "14%", left: "14%", right: "14%", bottom: "14%" },
  flip: { transform: [{ scaleX: -1 }] },
});
