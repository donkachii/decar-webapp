import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from "@expo-google-fonts/barlow";
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { CartSheet } from "@/components/cart-sheet";
import { CartSync } from "@/components/cart-sync";
import { useCartStore } from "@/lib/cart";
import { loadToken, useTokenStore } from "@/lib/token";
import { useVehicleStore } from "@/lib/vehicle";
import { color, font } from "@/theme";

void SplashScreen.preventAutoHideAsync();

// Stock truth beats everything (rule 5): parts are stale as soon as they
// arrive, so every screen re-reads them when it comes back into view.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, retry: 1 } },
});

// Re-read stale queries when the app returns to the foreground (also how a
// Paystack payment shows as paid after the buyer closes the browser).
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener("change", (state) => setFocused(state === "active"));
  return () => subscription.remove();
});

type PersistedStore = {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
};

/** True once a persisted store has read the phone's storage. */
function useHydrated(store: PersistedStore): boolean {
  return useSyncExternalStore(store.persist.onFinishHydration, store.persist.hasHydrated);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const tokenReady = useTokenStore((s) => s.ready);
  const cartReady = useHydrated(useCartStore);
  const vehicleReady = useHydrated(useVehicleStore);
  // A font that fails to load falls back to the system font rather than blocking the shop.
  const ready = (fontsLoaded || fontError !== null) && tokenReady && cartReady && vehicleReady;

  useEffect(() => {
    void loadToken();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.paper },
          headerTintColor: color.navy,
          headerTitleStyle: { fontFamily: font.display, fontSize: 20 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: color.bay },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="shop/[category]" options={{ title: "" }} />
        <Stack.Screen name="part/[sku]" options={{ title: "" }} />
        <Stack.Screen name="vehicle/[vehicleId]" options={{ title: "" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="order/[id]" options={{ title: "Your order" }} />
        <Stack.Screen name="choose-car" options={{ presentation: "modal", title: "Choose your car" }} />
      </Stack>
      <CartSheet />
      <CartSync />
    </QueryClientProvider>
  );
}
