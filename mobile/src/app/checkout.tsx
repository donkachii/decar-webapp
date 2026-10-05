import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CircleAlert } from "lucide-react-native";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { ChoiceCard, Field, Fieldset } from "@/components/form";
import { Screen } from "@/components/screen";
import { Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { summariseCart, useCartDetails, useCartStore } from "@/lib/cart";
import {
  DELIVERY_OPTIONS,
  DELIVERY_ORDER,
  deliveryFee,
  formatNGN,
  vehicleLabel,
  type DeliveryOption,
  type PaymentMethod,
} from "@/lib/domain";
import { useFeatures } from "@/lib/features";
import { placeOrder, useDeliveryRates, usePlacedOrders, verifyPaystack, type CheckoutField } from "@/lib/orders";
import { signInFailure, useCanSignIn, useMe, useSignIn } from "@/lib/session";
import { useSelectedVehicle } from "@/lib/vehicle";
import { orderMessage } from "@/lib/whatsapp";
import { color, radius } from "@/theme";

type Form = Record<"name" | "phone" | "email" | "address" | "state" | "park" | "notes", string>;

const EMPTY: Form = { name: "", phone: "", email: "", address: "", state: "", park: "", notes: "" };

/**
 * Checkout v1. Guest checkout always works; sign-in only fills the form in.
 * The API validates the form, re-reads price and status under a row lock and
 * reserves the units, so nothing here is trusted for price or stock.
 */
export default function CheckoutScreen() {
  const vehicle = useSelectedVehicle();
  const { lines, parts, loading, empty, reload } = useCartDetails(vehicle?.id ?? null);
  const rates = useDeliveryRates();
  const features = useFeatures();
  const me = useMe();
  const canSignIn = useCanSignIn();
  const signIn = useSignIn();
  const clearCart = useCartStore((s) => s.clear);
  const remember = usePlacedOrders((s) => s.remember);
  const client = useQueryClient();

  const [edits, setEdits] = useState<Partial<Form>>({});
  const [delivery, setDelivery] = useState<DeliveryOption>("pickup");
  const [chosenPayment, setPayment] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  // "Place order" sits at the bottom; problems are listed at the top.
  const scroll = useRef<ScrollView>(null);
  const showProblem = (text: string) => {
    setMessage(text);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const paystack = features.data?.paystack === true;
  const payment: PaymentMethod = chosenPayment ?? (paystack ? "paystack" : "pay-later");

  // Signed in: start from what the account knows; typing always wins.
  const user = me.data?.user;
  const form: Form = { ...EMPTY, name: user?.name ?? "", email: user?.email ?? "", ...edits };

  // An error stays until the buyer edits that field, as on the website.
  const clearError = (field: string) =>
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([f]) => f !== field)));
  const set = (key: keyof Form) => (value: string) => {
    setEdits((e) => ({ ...e, [key]: value }));
    clearError(key);
  };

  if (empty) {
    return (
      <Screen>
        <Panel style={styles.gap}>
          <Text>Your cart is empty.</Text>
          <Button onPress={() => router.navigate("/")}>Find parts for my car</Button>
        </Panel>
      </Screen>
    );
  }
  if (!rates.data) return <Loading />;

  const summary = summariseCart(lines, parts);
  const classes = summary.ready.map((r) => r.part.shippingClass);
  const fee = deliveryFee(delivery, classes, rates.data);
  const total = summary.subtotal + fee;

  const payLaterLabel =
    delivery === "pickup"
      ? "Pay at the shop when you collect"
      : delivery === "abuja"
        ? "Pay on delivery"
        : "Pay by bank transfer before we load it";
  const payLaterDetail =
    delivery === "waybill"
      ? "We'll confirm the total and send account details on WhatsApp."
      : "Cash or transfer. We'll call to confirm first.";

  async function submit() {
    setPending(true);
    setMessage(null);
    try {
      const result = await placeOrder({
        ...form,
        delivery,
        payment,
        vehicleId: vehicle?.id ?? null,
        lines: summary.ready.map((r) => r.line),
      });
      if (!result.ok) {
        showProblem(result.message);
        setErrors(result.fieldErrors ?? {});
        setUnavailable(result.unavailable ?? []);
        // Parts that sold mid-checkout: re-read the cart so the lines show it.
        if (result.unavailable?.length) void reload();
        return;
      }

      const { order, paymentUrl } = result;
      remember({ id: order.id, number: order.number, createdAt: order.createdAt });
      clearCart();
      const paying = order.paymentMethod === "paystack";
      router.replace({
        pathname: "/order/[id]",
        params: { id: order.id, placed: "1", ...(paying && !paymentUrl ? { payment: "retry" } : {}) },
      });
      if (paying && paymentUrl) {
        // Paystack sends the buyer back to the website, which confirms the
        // payment; the order screen re-reads the order when the app returns.
        await WebBrowser.openBrowserAsync(paymentUrl);
        if (order.paystackReference) await verifyPaystack(order.paystackReference).catch(() => null);
        await client.invalidateQueries({ queryKey: ["order", order.id] });
      }
    } catch {
      showProblem("We couldn't place your order just now. Try again, or complete it on WhatsApp.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scrollRef={scroll}>
      {message ? (
        <View style={styles.alert} accessibilityRole="alert">
          <CircleAlert size={18} color={color.warn} style={styles.alertIcon} />
          <Text weight="semibold" tone="warn" style={styles.shrink}>
            {message}
          </Text>
        </View>
      ) : null}

      <View style={styles.sections}>
        <Fieldset legend="Your details">
          {canSignIn && !user ? (
            <View style={styles.signIn}>
              <Text variant="bodySm">Bought from us before? Sign in with Google to fill this in. Optional.</Text>
              <Button
                variant="link"
                size="sm"
                onPress={() => {
                  setSignInError(null);
                  void signIn().catch((error: unknown) => {
                    const { message, detail } = signInFailure(error);
                    setSignInError(detail ? `${message} Development build only: ${detail}` : message);
                  });
                }}
              >
                Sign in with Google
              </Button>
              {signInError ? (
                <Text variant="bodySm" weight="semibold" tone="warn" accessibilityRole="alert">
                  {signInError}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Field
            label="Full name"
            value={form.name}
            onChangeText={set("name")}
            error={errors.name}
            autoComplete="name"
            textContentType="name"
          />
          <Field
            label="Phone number"
            hint="We call or WhatsApp this number to confirm."
            value={form.phone}
            onChangeText={set("phone")}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Field
            label={payment === "paystack" ? "Email" : "Email (optional)"}
            hint="For your order confirmation."
            value={form.email}
            onChangeText={set("email")}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
        </Fieldset>

        <Fieldset legend="Delivery" error={errors.delivery}>
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {DELIVERY_ORDER.map((option) => (
              <ChoiceCard
                key={option}
                checked={delivery === option}
                onPress={() => {
                  setDelivery(option);
                  clearError("delivery");
                }}
                title={DELIVERY_OPTIONS[option].label}
                detail={DELIVERY_OPTIONS[option].detail}
                aside={classes.length ? formatNGN(deliveryFee(option, classes, rates.data)) : "…"}
              />
            ))}
          </View>
          {delivery === "abuja" ? (
            <Field
              label="Delivery address in Abuja"
              hint="Street, area, and a landmark. Or your mechanic's workshop."
              value={form.address}
              onChangeText={set("address")}
              error={errors.address}
              multiline
              autoComplete="street-address"
              textContentType="fullStreetAddress"
            />
          ) : null}
          {delivery === "waybill" ? (
            <>
              <Field
                label="Destination state"
                value={form.state}
                onChangeText={set("state")}
                error={errors.state}
                textContentType="addressState"
              />
              <Field
                label="Park to collect from"
                hint="For example, Jibowu Park, Lagos."
                value={form.park}
                onChangeText={set("park")}
                error={errors.park}
              />
            </>
          ) : null}
        </Fieldset>

        <Fieldset legend="Payment" error={errors.payment}>
          <View accessibilityRole="radiogroup" style={styles.choices}>
            <ChoiceCard
              checked={payment === "paystack"}
              onPress={() => setPayment("paystack")}
              disabled={!paystack}
              title="Card or bank transfer with Paystack"
              detail={paystack ? "Pay now. Your receipt goes to your email." : "Coming soon. Choose to pay later for now."}
            />
            <ChoiceCard
              checked={payment === "pay-later"}
              onPress={() => setPayment("pay-later")}
              title={payLaterLabel}
              detail={payLaterDetail}
            />
          </View>
        </Fieldset>

        <Fieldset legend="Anything we should know?">
          <Field
            label="Notes (optional)"
            hint="Colour, chassis number, or a time that suits you."
            value={form.notes}
            onChangeText={set("notes")}
            multiline
            maxLength={500}
          />
        </Fieldset>

        <Panel style={styles.order}>
          <Text variant="h2" accessibilityRole="header">
            Your order
          </Text>
          <View>
            {lines.map((line, i) => {
              const part = parts.get(line.sku);
              const gone = !part || part.status !== "available" || part.stockQty < line.qty || unavailable.includes(line.sku);
              return (
                <View key={line.sku} style={[styles.line, i > 0 && styles.lineRule]}>
                  <View style={styles.shrink}>
                    <Text weight="semibold">
                      {part?.title ?? line.sku}
                      {line.qty > 1 ? ` x${line.qty}` : ""}
                    </Text>
                    <Text variant="small" style={styles.tabular}>
                      {line.sku}
                    </Text>
                    {gone ? (
                      <Text variant="bodySm" weight="semibold" tone="warn">
                        {loading ? "Checking…" : "No longer available. Remove it from your cart."}
                      </Text>
                    ) : vehicle && part?.fits === false ? (
                      <Text variant="bodySm" weight="semibold" tone="warn">
                        Not confirmed for your vehicle
                      </Text>
                    ) : null}
                  </View>
                  <Text weight="semibold" style={styles.tabular}>
                    {part ? formatNGN(part.priceNGN * line.qty) : "…"}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.totals}>
            <Row label="Subtotal" value={formatNGN(summary.subtotal)} />
            <Row label={DELIVERY_OPTIONS[delivery].label} value={formatNGN(fee)} />
            <View style={styles.totalRow}>
              <Text variant="h2">Total</Text>
              <Text variant="price" style={styles.total}>
                {formatNGN(total)}
              </Text>
            </View>
            <Text variant="bodySm">No other fees.</Text>
          </View>

          {summary.blocked && !loading ? (
            <View style={styles.blocked}>
              <Text variant="bodySm" weight="semibold" tone="warn">
                Remove the unavailable parts from your cart to continue.
              </Text>
              <Button variant="link" size="sm" onPress={() => router.navigate("/cart")}>
                Go to cart
              </Button>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button
              size="lg"
              disabled={pending || loading || summary.blocked || summary.ready.length === 0}
              onPress={() => void submit()}
            >
              {pending
                ? "Placing your order…"
                : payment === "paystack"
                  ? `Place order and pay ${formatNGN(total)}`
                  : "Place order"}
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
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.shrink}>{label}</Text>
      <Text weight="semibold" style={styles.tabular}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  alert: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: color.paper,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 20,
  },
  alertIcon: { marginTop: 3 },
  sections: { gap: 32 },
  signIn: { gap: 2 },
  choices: { gap: 8 },
  order: { gap: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  lineRule: { borderTopWidth: 1, borderTopColor: color.bay },
  totals: { borderTopWidth: 1, borderTopColor: color.primer, paddingTop: 12, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6 },
  total: { fontSize: 30, lineHeight: 32 },
  blocked: { gap: 2 },
  actions: { marginTop: 8, gap: 8 },
});
