import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { api, ApiError } from "./api";
import { API_URL, GOOGLE_CLIENT_IDS, SITE_URL } from "./config";
import { useFeatures } from "./features";
import { clearToken, saveToken, useTokenStore } from "./token";

// Google sign-in is optional for buyers: it links orders to an account and
// fills in checkout. It is never required to buy.
//
// Two ways in, one session. Where the build can, Google signs the buyer in on
// the phone and gives the app an ID token (POST /auth/google/id-token).
// Everywhere else (Expo Go, iOS without an iOS OAuth client) the app opens the
// website's Google sign-in in an in-app browser, gets back a one-time code and
// redeems it with a PKCE verifier only it holds (POST /auth/google/app-session).
// Either way the API issues its own 30-day session token, the same one the
// website keeps in a cookie.

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

interface Me {
  user: SessionUser;
  isAdmin: boolean;
}

// Expo Go has no Google sign-in module; a development or store build does.
const nativeModuleAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Native when this build has the module and its OAuth client IDs; the browser otherwise. */
const method: "native" | "browser" =
  nativeModuleAvailable && GOOGLE_CLIENT_IDS.web !== "" && (Platform.OS !== "ios" || GOOGLE_CLIENT_IDS.ios !== "")
    ? "native"
    : "browser";

// Google only sends the browser back to https addresses or localhost, and a
// phone's localhost is the phone itself.
const siteUnreachableForGoogle =
  SITE_URL.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(SITE_URL);

const BROWSER_NOTE = siteUnreachableForGoogle
  ? `Google sign-in opens ${SITE_URL} in a browser, but Google only returns to https addresses or localhost. On a phone, run the website through an https tunnel (mobile/README.md).`
  : "Google sign-in opens the website in a browser: this build has no native sign-in (Expo Go, or no EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID).";

/**
 * Whether to offer Google sign-in and, when not, why. The reason and the note
 * are for developers: the app shows them in development builds only.
 */
export type SignInAvailability =
  | { available: true; note: string | null }
  | { available: false; reason: string | null };

export function useSignInAvailability(): SignInAvailability {
  const features = useFeatures();
  if (features.isError) return { available: false, reason: `Couldn't reach the API at ${API_URL} to read /features.` };
  if (!features.data) return { available: false, reason: null }; // still asking the API
  if (!features.data.googleSignIn) {
    return { available: false, reason: "The API has Google sign-in off: it needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." };
  }
  return { available: true, note: method === "browser" ? BROWSER_NOTE : null };
}

/** Whether to offer "Sign in with Google": the API has it on. */
export function useCanSignIn(): boolean {
  return useSignInAvailability().available;
}

/** The signed-in buyer. Null for guests and for expired sessions. */
export function useMe() {
  const token = useTokenStore((s) => s.token);
  return useQuery({
    queryKey: ["me", token],
    enabled: token !== null,
    queryFn: async (): Promise<Me | null> => {
      try {
        return await api<Me>("/me", { session: true });
      } catch (error) {
        // Expired or revoked: treat as signed out.
        if (error instanceof ApiError && error.status === 401) {
          await clearToken();
          return null;
        }
        throw error;
      }
    },
  });
}

async function googleSignin() {
  const google = await import("@react-native-google-signin/google-signin");
  google.GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_IDS.web,
    iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
  });
  return google;
}

/**
 * Signing up and signing in are the same Google flow: the API makes the
 * account the first time it sees a Google address ("signed-up").
 */
export type SignInResult = "signed-in" | "signed-up" | "cancelled";

const DIDNT_FINISH = "Google sign-in didn't finish. Try again, or carry on without an account.";
const OFFLINE = "We couldn't reach the shop just now. Check your connection and try again.";
const NO_PLAY_SERVICES = "This phone needs Google Play services to sign in with Google. You can still buy without an account.";
// Android's CommonStatusCodes.DEVELOPER_ERROR: Google doesn't know this build's package name and SHA-1.
const DEVELOPER_ERROR = "10";

const ID_TOKEN = "/auth/google/id-token";
const APP_SESSION = "/auth/google/app-session";

export class SignInError extends Error {
  constructor(
    message: string,
    /** The cause, for developers. */
    readonly detail: string,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

/** What to show when sign-in fails: words for the buyer, plus the cause in development builds. */
export function signInFailure(error: unknown): { message: string; detail: string | null } {
  if (error instanceof SignInError) return { message: error.message, detail: __DEV__ ? error.detail : null };
  return { message: DIDNT_FINISH, detail: __DEV__ ? String(error) : null };
}

function apiProblem(path: string, error: ApiError): string {
  switch (error.status) {
    case 404:
      return `${API_URL} has no POST ${path}. Deploy the current backend, or point EXPO_PUBLIC_API_URL at one that has it.`;
    case 400:
      return path === ID_TOKEN
        ? "The API refused Google's ID token: its audience must be GOOGLE_CLIENT_ID or one of GOOGLE_MOBILE_CLIENT_IDS."
        : `The API refused the sign-in code: it expired, or the website at ${SITE_URL} talks to a different API than ${API_URL}.`;
    case 503:
      return "The API has Google sign-in off: it needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
    default:
      return `The API answered ${error.status} to POST ${path}.`;
  }
}

interface Session {
  token: string;
  created?: boolean;
}

async function createSession(path: string, body: object): Promise<Session> {
  try {
    return await api<Session>(path, { method: "POST", body });
  } catch (error) {
    if (error instanceof ApiError) throw new SignInError(DIDNT_FINISH, apiProblem(path, error));
    throw new SignInError(OFFLINE, `Couldn't reach the API at ${API_URL}.`);
  }
}

/** Sign-in on the phone. "browser" when Google doesn't recognise this build: the browser still works. */
async function nativeSignIn(): Promise<Session | "cancelled" | "browser"> {
  const google = await googleSignin();
  let idToken: string | null;
  try {
    if (Platform.OS === "android") await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await google.GoogleSignin.signIn();
    if (!google.isSuccessResponse(response)) return "cancelled";
    idToken = response.data.idToken;
  } catch (error) {
    if (google.isErrorWithCode(error)) {
      if (error.code === google.statusCodes.IN_PROGRESS) return "cancelled";
      if (error.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new SignInError(NO_PLAY_SERVICES, "Google Play services is missing or out of date.");
      }
      if (error.code === DEVELOPER_ERROR) {
        if (__DEV__) {
          console.warn(
            "Google sign-in: DEVELOPER_ERROR, so using the browser. For native sign-in, add an Android OAuth client for com.decarrevolutionist.shop with this build's SHA-1 (eas credentials).",
          );
        }
        return "browser";
      }
    }
    throw new SignInError(DIDNT_FINISH, error instanceof Error ? error.message : String(error));
  }
  if (!idToken) throw new SignInError(DIDNT_FINISH, "Google returned no ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  return createSession(ID_TOKEN, { idToken });
}

// PKCE verifier characters: 64 of RFC 7636's unreserved set, so a random byte maps evenly.
const VERIFIER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * The website's Google sign-in in an in-app browser. It comes back to
 * decar://auth (exp://…/--/auth in Expo Go) with a one-time code; the verifier
 * never goes through the browser, so the code is no use to anyone else.
 */
async function browserSignIn(): Promise<Session | "cancelled"> {
  const verifier = Array.from(Crypto.getRandomBytes(64), (byte) => VERIFIER_CHARS[byte & 63]).join("");
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const state = Crypto.randomUUID();
  const returnUrl = Linking.createURL("auth");
  const start = `${SITE_URL}/auth/app?state=${state}&challenge=${challenge}&return=${encodeURIComponent(returnUrl)}`;

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(start, returnUrl);
  } catch (error) {
    throw new SignInError(DIDNT_FINISH, `Couldn't open the browser: ${String(error)}`);
  }
  if (result.type !== "success") return "cancelled";

  const { queryParams } = Linking.parse(result.url);
  const param = (key: string) => {
    const value = queryParams?.[key];
    return typeof value === "string" ? value : null;
  };
  if (param("state") !== state) throw new SignInError(DIDNT_FINISH, "The browser came back from a different sign-in.");
  if (param("error") === "cancelled") return "cancelled";
  const code = param("code");
  if (!code) {
    throw new SignInError(DIDNT_FINISH, `The website at ${SITE_URL} couldn't finish Google sign-in; its server log says why.`);
  }
  return createSession(APP_SESSION, { code, verifier });
}

export function useSignIn() {
  const client = useQueryClient();
  return async (): Promise<SignInResult> => {
    let session = method === "native" ? await nativeSignIn() : await browserSignIn();
    if (session === "browser") session = await browserSignIn();
    if (session === "cancelled") return "cancelled";
    await saveToken(session.token);
    await client.invalidateQueries({ queryKey: ["me"] });
    return session.created ? "signed-up" : "signed-in";
  };
}

export function useSignOut() {
  const client = useQueryClient();
  return async () => {
    await clearToken();
    client.removeQueries({ queryKey: ["me"] });
    client.removeQueries({ queryKey: ["my-orders"] });
    if (method === "native") {
      const google = await googleSignin().catch(() => null);
      await google?.GoogleSignin.signOut().catch(() => undefined);
    }
  };
}
