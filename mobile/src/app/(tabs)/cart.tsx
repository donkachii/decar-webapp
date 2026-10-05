import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { CartLineList, CartSkeleton } from "@/components/cart-lines";
import { Screen, TabHeader } from "@/components/screen";
import { Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { summariseCart, useCartCount, useCartDetails } from "@/lib/cart";
import { refreshSavedCart } from "@/lib/cart-sync";
import { formatNGN, vehicleLabel, vehicleShortLabel } from "@/lib/domain";
import { usePullToRefresh, useRefreshOnFocus } from "@/lib/refresh";
import { useSelectedVehicle } from "@/lib/vehicle";
import { orderMessage } from "@/lib/whatsapp";

/**
 * The full cart. Every line re-checks price, stock and fit for the selected
 * car. Adding to cart does not reserve a Belgium unit; placing the order does.
 */
export default function CartScreen() {
  const vehicle = useSelectedVehicle();
  const { lines, parts, loading, failed, empty, reload } = useCartDetails(vehicle?.id ?? null);
  const count = useCartCount();
  // Pull to refresh also brings in lines added on the website.
  const reloadAll = useCallback(async () => {
    await refreshSavedCart();
    await reload();
  }, [reload]);
  const { refreshing, onRefresh } = usePullToRefresh(reloadAll);
  useRefreshOnFocus(reload);
  // Lines added on the website since the buyer last looked.
  useFocusEffect(
    useCallback(() => {
      void refreshSavedCart();
    }, []),
  );
  const summary = summariseCart(lines, parts);

  return (
    <Screen tab refreshing={refreshing} onRefresh={onRefresh}>
      <TabHeader title="Your cart">
        <Text>{count === 0 ? "Nothing in it yet." : `${count} ${count === 1 ? "part" : "parts"}`}</Text>
      </TabHeader>

      {empty ? (
        <Panel style={styles.gap}>
          <Text>Your cart is empty. Choose your car, then tap the damaged area on the home screen to find the right part.</Text>
          <Button onPress={() => router.navigate("/")}>Find parts for my car</Button>
        </Panel>
      ) : (
        <>
          {failed ? (
            <Text weight="semibold" tone="warn" style={styles.failed}>
              We couldn&apos;t check prices just now. Pull down to try again.
            </Text>
          ) : null}
          <Panel style={styles.lines}>
            {loading && parts.size === 0 ? (
              <CartSkeleton rows={lines.length} />
            ) : (
              <CartLineList
                lines={lines}
                parts={parts}
                loading={loading}
                vehicleShortLabel={vehicle ? vehicleShortLabel(vehicle) : null}
              />
            )}
          </Panel>

          <Panel style={styles.summary}>
            <View style={styles.subtotal}>
              <Text weight="semibold">Subtotal</Text>
              <Text variant="price">{loading && parts.size === 0 ? "…" : formatNGN(summary.subtotal)}</Text>
            </View>
            <Text variant="bodySm">Pickup at Zuba Market is free. Delivery is priced at checkout before you pay.</Text>
            {summary.blocked && !loading ? (
              <Text variant="bodySm" weight="semibold" tone="warn">
                Remove the unavailable parts to continue.
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button size="lg" disabled={summary.blocked || loading} onPress={() => router.push("/checkout")}>
                Go to checkout
              </Button>
              {summary.ready.length > 0 ? (
                <WhatsappButton
                  message={orderMessage({
                    vehicleLabel: vehicle ? vehicleLabel(vehicle) : null,
                    lines: summary.ready.map(({ line, part }) => ({
                      sku: part.sku,
                      title: part.title,
                      priceNGN: part.priceNGN,
                      qty: line.qty,
                    })),
                  })}
                >
                  Complete order on WhatsApp
                </WhatsappButton>
              ) : null}
            </View>
          </Panel>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  failed: { marginBottom: 12 },
  lines: { paddingVertical: 4 },
  summary: { marginTop: 12, gap: 6 },
  subtotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  actions: { marginTop: 12, gap: 8 },
});
