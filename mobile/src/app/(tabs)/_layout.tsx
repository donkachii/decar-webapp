import type { LucideIcon } from "lucide-react-native";
import { House, LayoutGrid, ShoppingCart, User } from "lucide-react-native";
import { Tabs } from "expo-router/js-tabs";
import { StyleSheet, View } from "react-native";

import { useCartCount } from "@/lib/cart";
import { color, font, radius } from "@/theme";

/** The selected tab sits on an tan pill: tan marks where you are and what you can act on. */
function TabIcon({ icon: Icon, focused }: { icon: LucideIcon; focused: boolean }) {
  return (
    <View style={[styles.pill, focused && styles.pillOn]}>
      <Icon size={22} color={color.navy} strokeWidth={focused ? 2.4 : 2} />
    </View>
  );
}

export default function TabsLayout() {
  const count = useCartCount();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.bay },
        tabBarStyle: { backgroundColor: color.paper, borderTopColor: color.primer },
        tabBarActiveTintColor: color.navy,
        tabBarInactiveTintColor: color.navy,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon icon={House} focused={focused} /> }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: "Shop", tabBarIcon: ({ focused }) => <TabIcon icon={LayoutGrid} focused={focused} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ focused }) => <TabIcon icon={ShoppingCart} focused={focused} />,
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarAccessibilityLabel: count > 0 ? `Cart, ${count} ${count === 1 ? "part" : "parts"}` : "Cart, empty",
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ focused }) => <TabIcon icon={User} focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 56, height: 28, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: color.tan },
  badge: {
    backgroundColor: color.navy,
    color: color.paper,
    fontFamily: font.semibold,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});
