import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronRight, Phone } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { useFocusRing } from "@/components/focus";
import { Screen, SectionTitle } from "@/components/screen";
import { Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { SITE, SITE_URL } from "@/lib/config";
import { formatDateTime, formatNGN, type Order } from "@/lib/domain";
import { useMyOrders, usePlacedOrders } from "@/lib/orders";
import { usePullToRefresh } from "@/lib/refresh";
import { signInFailure, useMe, useSignIn, useSignInAvailability, useSignOut } from "@/lib/session";
import { color, radius } from "@/theme";

type Intent = "sign-in" | "sign-up";

const STATUS: Record<Order["status"], string> = {
  new: "Waiting for confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Optional account (Google sign-in), orders, and how to reach the shop. Never needed to buy. */
export default function AccountScreen() {
  const me = useMe();
  const mine = useMyOrders();
  const placed = usePlacedOrders((s) => s.orders);
  const availability = useSignInAvailability();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const [failure, setFailure] = useState<{ message: string; detail: string | null } | null>(null);
  const [busy, setBusy] = useState<Intent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { refreshing, onRefresh } = usePullToRefresh(mine.refetch);
  const user = me.data?.user ?? null;

  // Orders placed on this phone that the account list doesn't already show.
  const accountIds = new Set((mine.data ?? []).map((o) => o.id));
  const onPhone = placed.filter((o) => !accountIds.has(o.id));

  // Both buttons run the same Google flow; the API says whether it made the account.
  async function start(intent: Intent) {
    setBusy(intent);
    setFailure(null);
    try {
      const result = await signIn();
      if (result === "signed-up") setNotice("Account created. Your cart and orders now follow you to the website.");
      else if (result === "signed-in" && intent === "sign-up") {
        setNotice("You already had an account with this Google address, so you're signed in.");
      }
    } catch (error) {
      setFailure(signInFailure(error));
    } finally {
      setBusy(null);
    }
  }

  async function end() {
    setNotice(null);
    await signOut();
  }

  return (
    <Screen tab refreshing={refreshing} onRefresh={user ? onRefresh : undefined}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        Your account
      </Text>

      {me.isLoading ? (
        <Loading />
      ) : user ? (
        <Panel style={styles.gap}>
          {notice ? (
            <Text weight="semibold" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          <Text>{user.name ? `${user.name}, ${user.email}` : user.email}</Text>
          <Button variant="outline" size="sm" onPress={() => void end()} style={styles.start}>
            Sign out
          </Button>
        </Panel>
      ) : availability.available ? (
        <Panel style={styles.gap}>
          <Text>
            Optional. With an account your orders show here, your cart is the same on this phone and the website,
            and checkout fills in your details.
          </Text>
          <Button onPress={() => void start("sign-in")} disabled={busy !== null}>
            {busy === "sign-in" ? "Signing in…" : "Sign in with Google"}
          </Button>
          <View style={styles.signUp}>
            <Text variant="bodySm">New here?</Text>
            <Button variant="outline" onPress={() => void start("sign-up")} disabled={busy !== null}>
              {busy === "sign-up" ? "Signing up…" : "Sign up with Google"}
            </Button>
          </View>
          {failure ? (
            <View accessibilityRole="alert" style={styles.failure}>
              <Text variant="bodySm" weight="semibold" tone="warn">
                {failure.message}
              </Text>
              {failure.detail ? <Text variant="small">Development build only: {failure.detail}</Text> : null}
            </View>
          ) : null}
          {__DEV__ && availability.note ? <Text variant="small">Development build only: {availability.note}</Text> : null}
        </Panel>
      ) : (
        <Panel style={styles.gap}>
          <Text>You don&apos;t need an account to buy. Orders you place on this phone show up here.</Text>
          {__DEV__ && availability.reason ? (
            <Text variant="small">Development build only: Google sign-in is hidden. {availability.reason}</Text>
          ) : null}
        </Panel>
      )}

      {user ? (
        <>
          <SectionTitle style={styles.section}>Your orders</SectionTitle>
          {mine.isPending ? (
            <Loading />
          ) : (mine.data ?? []).length === 0 ? (
            <Panel style={styles.listTop}>
              <Text>No orders yet. Orders you place while signed in show up here.</Text>
            </Panel>
          ) : (
            <View style={[styles.list, styles.listTop]}>
              {(mine.data ?? []).map((o, i) => (
                <OrderRow
                  key={o.id}
                  id={o.id}
                  number={o.number}
                  detail={`${formatDateTime(o.createdAt)}. ${o.items.length} ${o.items.length === 1 ? "part" : "parts"}. ${STATUS[o.status]}`}
                  total={formatNGN(o.totalNGN)}
                  first={i === 0}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {onPhone.length > 0 ? (
        <>
          <SectionTitle style={styles.section}>{user ? "Also placed on this phone" : "Your orders"}</SectionTitle>
          <View style={[styles.list, styles.listTop]}>
            {onPhone.map((o, i) => (
              <OrderRow key={o.id} id={o.id} number={o.number} detail={formatDateTime(o.createdAt)} first={i === 0} />
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle style={styles.section}>The shop</SectionTitle>
      <Panel style={[styles.listTop, styles.gap]}>
        <View>
          <Text weight="semibold">{SITE.shopLine}</Text>
          <Text>{SITE.marketLine}</Text>
        </View>
        <WhatsappButton message={`Hello ${SITE.name}, `}>Message the shop on WhatsApp</WhatsappButton>
        {SITE.phones.map((p) => (
          <Button
            key={p.tel}
            variant="link"
            icon={Phone}
            onPress={() => void Linking.openURL(`tel:${p.tel}`).catch(() => {})}
          >
            {`Call ${p.label}`}
          </Button>
        ))}
        <Button variant="link" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/about`)}>
          About us
        </Button>
      </Panel>
    </Screen>
  );
}

function OrderRow({
  id,
  number,
  detail,
  total,
  first,
}: {
  id: string;
  number: string;
  detail: string;
  total?: string;
  first: boolean;
}) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/order/${id}`)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={({ pressed }) => [styles.row, !first && styles.rule, pressed && styles.pressed, focus.ring]}
    >
      <View style={styles.rowText}>
        <Text variant="h3" style={styles.tabular}>
          {number}
        </Text>
        <Text variant="bodySm">{detail}</Text>
      </View>
      {total ? (
        <Text weight="semibold" style={styles.tabular}>
          {total}
        </Text>
      ) : null}
      <ChevronRight size={20} color={color.primer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 20 },
  gap: { gap: 14 },
  start: { alignSelf: "flex-start" },
  signUp: { gap: 8, marginTop: 4 },
  failure: { gap: 4 },
  section: { marginTop: 32 },
  list: { backgroundColor: color.paper, borderRadius: radius.md, overflow: "hidden" },
  listTop: { marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rule: { borderTopWidth: 1, borderTopColor: color.bay },
  pressed: { backgroundColor: color.bay },
  rowText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ["tabular-nums"] },
});
