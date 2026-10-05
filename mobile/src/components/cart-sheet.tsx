import { router } from "expo-router";
import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { summariseCart, useCartCount, useCartDetails, useCartStore } from "@/lib/cart";
import { formatNGN, vehicleLabel, vehicleShortLabel } from "@/lib/domain";
import { useSelectedVehicle } from "@/lib/vehicle";
import { orderMessage } from "@/lib/whatsapp";
import { color, GUTTER, radius } from "@/theme";

import { Button } from "./button";
import { CartLineList, CartSkeleton } from "./cart-lines";
import { useFocusRing } from "./focus";
import { Text } from "./text";
import { WhatsappButton } from "./whatsapp-button";

/**
 * Slides up on "Add to cart" over whatever the buyer was looking at; never
 * navigates on its own (CLAUDE.md section 7). Mounted once in the root layout.
 */
export function CartSheet() {
  const open = useCartStore((s) => s.open);
  const setOpen = useCartStore((s) => s.setOpen);
  const count = useCartCount();
  const vehicle = useSelectedVehicle();
  const { lines, parts, loading, failed, empty } = useCartDetails(vehicle?.id ?? null);
  const insets = useSafeAreaInsets();
  const summary = summariseCart(lines, parts);
  const close = () => setOpen(false);
  const go = (path: "/checkout" | "/cart" | "/choose-car" | "/") => {
    close();
    // Tabs already exist under every screen: go back to them, never stack another copy.
    if (path === "/" || path === "/cart") router.navigate(path);
    else router.push(path);
  };
  const closeFocus = useFocusRing();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close cart" style={styles.backdrop} onPress={close} />
        <Animated.View
          entering={SlideInDown.duration(220)}
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View>
              <Text variant="h2" accessibilityRole="header">
                Your cart
              </Text>
              <Text variant="bodySm">{count === 0 ? "Nothing in it yet." : `${count} ${count === 1 ? "part" : "parts"}`}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              onFocus={closeFocus.onFocus}
              onBlur={closeFocus.onBlur}
              hitSlop={8}
              style={[styles.close, closeFocus.ring]}
            >
              <X size={22} color={color.navy} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {empty ? (
              <View style={styles.emptyBox}>
                <Text variant="bodySm">
                  Choose your car, then tap the damaged area on the home screen to find the right part.
                </Text>
                <Button variant="outline" onPress={() => go("/")}>
                  Find parts for my car
                </Button>
              </View>
            ) : (
              <>
                {!vehicle ? (
                  <View style={styles.notice}>
                    <Text variant="bodySm" style={styles.shrink}>
                      Choose your car and we&apos;ll check every part fits.
                    </Text>
                    <Button size="sm" variant="outline" onPress={() => go("/choose-car")}>
                      Choose
                    </Button>
                  </View>
                ) : null}
                {failed ? (
                  <Text variant="bodySm" weight="semibold" tone="warn" style={styles.failed}>
                    We couldn&apos;t check prices just now. Check your connection and reopen the cart.
                  </Text>
                ) : null}
                {loading && parts.size === 0 ? (
                  <CartSkeleton rows={lines.length} />
                ) : (
                  <CartLineList
                    lines={lines}
                    parts={parts}
                    loading={loading}
                    vehicleShortLabel={vehicle ? vehicleShortLabel(vehicle) : null}
                    onNavigate={close}
                  />
                )}
              </>
            )}
          </ScrollView>

          {!empty ? (
            <View style={styles.footer}>
              <View style={styles.subtotal}>
                <Text weight="semibold">Subtotal</Text>
                <Text variant="price">{loading && parts.size === 0 ? "…" : formatNGN(summary.subtotal)}</Text>
              </View>
              <Text variant="bodySm">Pickup at Zuba Market is free. Delivery is priced at checkout before you pay.</Text>
              <View style={styles.actions}>
                <Button size="lg" disabled={summary.blocked || loading} onPress={() => go("/checkout")}>
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
                <Button variant="link" onPress={() => go("/cart")} style={styles.center}>
                  View full cart
                </Button>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  // Navy, dimmed: the page behind stays visible but out of reach.
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.navy, opacity: 0.45 },
  sheet: {
    maxHeight: "88%",
    backgroundColor: color.paper,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: GUTTER,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.bay,
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, marginRight: -10 },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { paddingHorizontal: GUTTER },
  emptyBox: { paddingVertical: 32, gap: 16 },
  notice: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.navy,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shrink: { flexShrink: 1 },
  failed: { marginTop: 16 },
  footer: { borderTopWidth: 1, borderTopColor: color.bay, paddingHorizontal: GUTTER, paddingTop: 16, gap: 4 },
  subtotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  actions: { marginTop: 12, gap: 8 },
  center: { alignSelf: "center" },
});
