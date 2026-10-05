import { router, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { color, GUTTER } from "@/theme";

export default function NotFoundScreen() {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Not found" }} />
      <Text variant="h2">We can&apos;t find that page</Text>
      <Text>The link may be old, or the part may have been sold and taken off the shelf.</Text>
      <Button onPress={() => router.replace("/")}>Find parts for my car</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: GUTTER, gap: 16, backgroundColor: color.bay },
});
