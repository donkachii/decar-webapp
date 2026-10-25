import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronRight, Phone } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { useFocusRing } from "@/components/focus";
import { Field } from "@/components/form";
import { Screen, SectionTitle } from "@/components/screen";
import { Loading, Panel } from "@/components/states";
import { Text } from "@/components/text";
import { WhatsappButton } from "@/components/whatsapp-button";
import { SITE, SITE_URL } from "@/lib/config";
import { formatDateTime, formatNGN, type Order } from "@/lib/domain";
import { useMyOrders, usePlacedOrders } from "@/lib/orders";
import { usePullToRefresh } from "@/lib/refresh";
import {
  signInFailure,
  useMe,
  usePasswordSignIn,
  useSignIn,
  useSignInAvailability,
  useSignOut,
  type PasswordMode,
  type SignInResult,
} from "@/lib/session";
import { color, radius } from "@/theme";

const CREATED = "Account created. Your cart and orders now follow you to the website.";

const STATUS: Record<Order["status"], string> = {
  new: "Waiting for confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Optional account (email and password, or Google), orders, and how to reach the shop. Never needed to buy. */
export default function AccountScreen() {
  const me = useMe();
  const mine = useMyOrders();
  const placed = usePlacedOrders((s) => s.orders);
  const availability = useSignInAvailability();
  const signInWithGoogle = useSignIn();
  const signInWithPassword = usePasswordSignIn();
  const signOut = useSignOut();
  const [mode, setMode] = useState<PasswordMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<{ message: string; detail: string | null } | null>(null);
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { refreshing, onRefresh } = usePullToRefresh(mine.refetch);
  const user = me.data?.user ?? null;
  const signUp = mode === "sign-up";

  // Orders placed on this phone that the account list doesn't already show.
  const accountIds = new Set((mine.data ?? []).map((o) => o.id));
  const onPhone = placed.filter((o) => !accountIds.has(o.id));

  async function run(kind: "password" | "google", attempt: () => Promise<SignInResult>) {
    setBusy(kind);
    setFailure(null);
    try {
      const result = await attempt();
      if (result === "signed-up") setNotice(CREATED);
      // Google signs up and signs in with one flow; the API says whether it made the account.
      else if (result === "signed-in" && kind === "google" && signUp) {
        setNotice("You already had an account with this Google address, so you're signed in.");
      }
      if (result !== "cancelled") setPassword("");
    } catch (error) {
      setFailure(signInFailure(error));
    } finally {
      setBusy(null);
    }
  }

  function withPassword() {
    if (busy !== null) return Promise.resolve();
    return run("password", () => signInWithPassword(mode, email, password));
  }

  function withGoogle() {
    return run("google", signInWithGoogle);
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
      ) : (
        <Panel style={styles.gap}>
          <Text>
            Optional. With an account your orders show here, your cart is the same on this phone and the website,
            and checkout fills in your details.
          </Text>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Password"
            hint={signUp ? "At least 8 characters." : undefined}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signUp ? "new-password" : "current-password"}
            textContentType={signUp ? "newPassword" : "password"}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => void withPassword()}
          />
          <Button onPress={() => void withPassword()} disabled={busy !== null}>
            {busy === "password"
              ? signUp
                ? "Creating account…"
                : "Signing in…"
              : signUp
                ? "Create account"
                : "Sign in"}
          </Button>
          <View style={styles.switch}>
            <Text variant="bodySm">{signUp ? "Already have an account?" : "New here?"}</Text>
            <Button
              variant="link"
              size="sm"
              onPress={() => {
                setMode(signUp ? "sign-in" : "sign-up");
                setFailure(null);
              }}
            >
              {signUp ? "Sign in" : "Create an account"}
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
          {availability.available ? (
            <>
              <Text variant="bodySm" style={styles.or}>
                or
              </Text>
              <Button variant="outline" onPress={() => void withGoogle()} disabled={busy !== null}>
                {busy === "google"
                  ? signUp
                    ? "Signing up…"
                    : "Signing in…"
                  : signUp
                    ? "Sign up with Google"
                    : "Sign in with Google"}
              </Button>
              {__DEV__ && availability.note ? (
                <Text variant="small">Development build only: {availability.note}</Text>
              ) : null}
            </>
          ) : __DEV__ && availability.reason ? (
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
  switch: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 4 },
  or: { textAlign: "center" },
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
