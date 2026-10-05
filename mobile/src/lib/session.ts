import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { api, ApiError } from "./api";
import { API_URL, GOOGLE_CLIENT_IDS } from "./config";
import { useFeatures } from "./features";
import { clearToken, saveToken, useTokenStore } from "./token";

// Google sign-in is optional for buyers: it links orders to an account and
// fills in checkout. It is never required to buy.
//
// Google signs the buyer in on the phone and gives the app an ID token; the
// API checks it (POST /auth/google/id-token) and issues its own 30-day
// session token, the same one the website keeps in a cookie.

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

/**
 * Whether to offer Google sign-in and, when not, why. The reason is for
 * developers: the app shows it in development builds only.
 */
export type SignInAvailability = { available: true } | { available: false; reason: string | null };

export function useSignInAvailability(): SignInAvailability {
  const features = useFeatures();
  if (!nativeModuleAvailable) {
    return {
      available: false,
      reason:
        "Expo Go can't run Google sign-in (it needs native code). Install a development build (eas build --profile development) and open the app in that instead.",
    };
  }
  if (GOOGLE_CLIENT_IDS.web === "") {
    return { available: false, reason: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is empty. Set it in mobile/.env and restart pnpm start." };
  }
  if (Platform.OS === "ios" && GOOGLE_CLIENT_IDS.ios === "") {
    return {
      available: false,
      reason: "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is empty. Add the iOS OAuth client (mobile/README.md), then rebuild.",
    };
  }
  if (features.isError) return { available: false, reason: `Couldn't reach the API at ${API_URL} to read /features.` };
  if (!features.data) return { available: false, reason: null }; // still asking the API
  if (!features.data.googleSignIn) {
    return { available: false, reason: "The API has Google sign-in off: it needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." };
  }
  return { available: true };
}

/** Whether to offer "Sign in with Google": the API has it on and this build can do it. */
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

function apiProblem(error: ApiError): string {
  switch (error.status) {
    case 404:
      return `${API_URL} has no POST /auth/google/id-token. Deploy the current backend, or point EXPO_PUBLIC_API_URL at one that has it.`;
    case 400:
      return "The API refused Google's ID token: its audience must be GOOGLE_CLIENT_ID or one of GOOGLE_MOBILE_CLIENT_IDS.";
    case 503:
      return "The API has Google sign-in off: it needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
    default:
      return `The API answered ${error.status} to POST /auth/google/id-token.`;
  }
}

export function useSignIn() {
  const client = useQueryClient();
  return async (): Promise<SignInResult> => {
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
          throw new SignInError(
            DIDNT_FINISH,
            "DEVELOPER_ERROR: Google doesn't recognise this build. Add an Android OAuth client for com.decarrevolutionist.shop with this build's SHA-1 (eas credentials).",
          );
        }
      }
      throw new SignInError(DIDNT_FINISH, error instanceof Error ? error.message : String(error));
    }
    if (!idToken) throw new SignInError(DIDNT_FINISH, "Google returned no ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");

    let session: { token: string; created?: boolean };
    try {
      session = await api<{ token: string; created?: boolean }>("/auth/google/id-token", {
        method: "POST",
        body: { idToken },
      });
    } catch (error) {
      if (error instanceof ApiError) throw new SignInError(DIDNT_FINISH, apiProblem(error));
      throw new SignInError(OFFLINE, `Couldn't reach the API at ${API_URL}.`);
    }
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
    if (nativeModuleAvailable) {
      const google = await googleSignin().catch(() => null);
      await google?.GoogleSignin.signOut().catch(() => undefined);
    }
  };
}
