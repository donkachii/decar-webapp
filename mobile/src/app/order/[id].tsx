import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CircleCheck } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ErrorState, Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { useVehicles } from "@/lib/catalog";
import { SITE } from "@/lib/config";
import { DELIVERY_OPTIONS, formatDateTime, formatNGN, vehicleLabel } from "@/lib/domain";
import { useFeatures } from "@/lib/features";
import { retryPayment, useOrder } from "@/lib/orders";
import { usePullToRefresh } from "@/lib/refresh";
import { orderMessage } from "@/lib/whatsapp";
import { color } from "@/theme";

/** The order page. Anyone with the id sees it, so the API masks the phone. */
export default function OrderScreen() {
  const params = useLocalSearchParams<{ id: string; placed?: string; payment?: string }>();
  const order = useOrder(params.id ?? null);
  const features = useFeatures();
  const vehicles = useVehicles();
  const client = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [payFailed, setPayFailed] = useState(params.payment === "retry");
  const { refreshing, onRefresh } = usePullToRefresh(order.refetch);

  if (order.isPending) return <Loading />;
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />;
  if (!order.data) {
    return (
      <Screen>
        <Panel>
          <Text>We can&apos;t find that order. Message the shop on WhatsApp with your order number.</Text>
        </Panel>
      </Screen>
    );
  }

  const o = order.data;
  const vehicle = vehicles.data?.find((v) => v.id === o.vehicleId) ?? null;
  const placed = params.placed === "1";
  const deliveryLabel = DELIVERY_OPTIONS[o.deliveryOption].label;
  const deliveryDetail =
    o.deliveryOption === "abuja"
      ? o.deliveryAddress
      : o.deliveryOption === "waybill"
        ? [o.deliveryPark, o.deliveryState].filter(Boolean).join(", ")
        : SITE.address;
  const needsPayment = o.paymentMethod === "paystack" && o.paymentStatus !== "paid" && o.status === "new";

  async function pay() {
    setPaying(true);
    try {
      const result = await retryPayment(o.id);
      if (result === "nothing-to-pay" || !result.paymentUrl) {
        setPayFailed(result !== "nothing-to-pay");
        return;
      }
      setPayFailed(false);
      await WebBrowser.openBrowserAsync(result.paymentUrl);
      await client.invalidateQueries({ queryKey: ["order", o.id] });
    } catch {
      setPayFailed(true);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {placed ? (
        <View style={styles.placed}>
          <CircleCheck size={20} color={color.navy} />
          <Text weight="semibold">Order placed</Text>
        </View>
      ) : null}
      <Text variant="title" accessibilityRole="header" style={styles.number}>
        {o.number}
      </Text>
      <Text style={styles.sub}>
        {formatDateTime(o.createdAt)}.{" "}
        {o.status === "cancelled"
          ? "This order was cancelled."
          : o.status === "completed"
            ? "Completed. Thank you."
            : `We'll call or WhatsApp you on ${o.customerPhone} to confirm your parts.`}
      </Text>

      {needsPayment && payFailed ? (
        <Panel style={styles.notice}>
          <Text weight="semibold" tone="warn" accessibilityRole="alert">
            Your payment didn&apos;t go through. Your parts are held for now. Try again, or pay when you collect.
          </Text>
        </Panel>
      ) : null}
      {o.paymentStatus === "paid" ? (
        <Panel style={styles.notice}>
          <Text weight="semibold">Payment received.</Text>
        </Panel>
      ) : null}

      <View style={styles.actions}>
        {needsPayment && features.data?.paystack ? (
          <Button size="lg" disabled={paying} onPress={() => void pay()}>
            {paying ? "Opening Paystack…" : `Pay ${formatNGN(o.totalNGN)} with Paystack`}
          </Button>
        ) : null}
        {o.status === "new" ? (
          <WhatsappButton
            variant={needsPayment ? "outline" : "primary"}
            message={orderMessage({
              orderNumber: o.number,
              vehicleLabel: vehicle ? vehicleLabel(vehicle) : null,
              deliveryLabel,
              lines: o.items.map((i) => ({ sku: i.sku, title: i.name, priceNGN: i.priceNGN, qty: i.qty })),
            })}
          >
            Complete order on WhatsApp
          </WhatsappButton>
        ) : null}
      </View>

      <Panel style={styles.section}>
        <Text variant="h2" accessibilityRole="header">
          Parts
        </Text>
        {o.items.map((item, i) => (
          <View key={item.sku} style={[styles.item, i > 0 && styles.rule]}>
            <View style={styles.shrink}>
              <Text weight="semibold">
                {item.name}
                {item.qty > 1 ? ` x${item.qty}` : ""}
              </Text>
              <Text variant="small" style={styles.tabular}>
                {item.sku}
              </Text>
            </View>
            <Text weight="semibold" style={styles.tabular}>
              {formatNGN(item.priceNGN * item.qty)}
            </Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Row label="Subtotal" value={formatNGN(o.subtotalNGN)} />
          <Row label="Delivery" value={formatNGN(o.deliveryFeeNGN)} />
          <View style={styles.totalRow}>
            <Text variant="h2">Total</Text>
            <Text variant="price" style={styles.total}>
              {formatNGN(o.totalNGN)}
            </Text>
          </View>
        </View>
      </Panel>

      <Panel style={[styles.section, styles.gap]}>
        <View>
          <Text variant="h3">{deliveryLabel}</Text>
          <Text>{deliveryDetail}</Text>
        </View>
        <View>
          <Text variant="h3">Payment</Text>
          <Text>
            {o.paymentStatus === "paid"
              ? "Paid with Paystack"
              : o.paymentMethod === "paystack"
                ? "Paystack, not paid yet"
                : o.deliveryOption === "pickup"
                  ? "Pay at the shop when you collect"
                  : o.deliveryOption === "abuja"
                    ? "Pay on delivery"
                    : "Bank transfer before we load it"}
          </Text>
        </View>
      </Panel>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text weight="semibold" style={styles.tabular}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placed: { flexDirection: "row", alignItems: "center", gap: 8 },
  number: { marginTop: 8, fontVariant: ["tabular-nums"] },
  sub: { marginTop: 8, fontSize: 17 },
  notice: { marginTop: 16, paddingVertical: 14 },
  actions: { marginTop: 20, gap: 8 },
  section: { marginTop: 24 },
  gap: { gap: 16 },
  item: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  rule: { borderTopWidth: 1, borderTopColor: color.bay },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  totals: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: color.primer, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4 },
  total: { fontSize: 30, lineHeight: 32 },
});
