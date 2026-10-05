import { useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View, type ViewToken } from "react-native";

import type { Position } from "@/lib/domain";
import { color, GUTTER, radius } from "@/theme";

import { PartImage } from "./part-image";
import { Text } from "./text";

/** Real photos of this unit, swiped or picked from the thumbnails. The whole part shows (`contain`). */
export function PartGallery({ images, alt, position }: { images: string[]; alt: string; position: Position }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - GUTTER * 2;
  const [index, setIndex] = useState(0);
  const [list, setList] = useState<FlatList<string> | null>(null);
  const shown = images.length > 0 ? images : [""];

  // FlatList refuses a new callback or config after mount, so both are created once.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken<string>[] }) => {
    const first = viewableItems[0]?.index;
    if (typeof first === "number") setIndex(first);
  });
  const [viewability] = useState({ itemVisiblePercentThreshold: 60 });

  return (
    <View>
      <FlatList
        ref={setList}
        data={shown}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(src, i) => `${i}-${src}`}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewability}
        style={[styles.well, { width }]}
        renderItem={({ item, index: i }) => (
          <PartImage
            src={item || null}
            alt={images.length > 1 ? `${alt}, photo ${i + 1} of ${images.length}` : alt}
            position={position}
            width={width}
            fit="contain"
            style={{ width }}
          />
        )}
      />
      {images.length > 1 ? (
        <>
          <Text variant="small" style={styles.counter} accessibilityLiveRegion="polite">
            Photo {index + 1} of {images.length}
          </Text>
          <View style={styles.thumbs}>
            {images.map((src, i) => (
              <Pressable
                key={`${i}-${src}`}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${i + 1}`}
                accessibilityState={{ selected: i === index }}
                onPress={() => {
                  setIndex(i);
                  list?.scrollToIndex({ index: i, animated: true });
                }}
                style={[styles.thumb, i === index ? styles.thumbOn : styles.thumbOff]}
              >
                <PartImage src={src} alt="" position={position} width={64} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { borderRadius: radius.lg, backgroundColor: color.paper },
  counter: { marginTop: 8 },
  thumbs: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 2, overflow: "hidden" },
  thumbOn: { borderColor: color.navy },
  thumbOff: { borderColor: color.paper },
});
