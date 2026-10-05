import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

// The API session token from Google sign-in, kept in the phone's keychain or
// keystore. Opaque here: the API issues it and checks it on every request.

const KEY = "dcr_session";

interface TokenState {
  token: string | null;
  /** False until the keychain has been read at launch. */
  ready: boolean;
}

export const useTokenStore = create<TokenState>(() => ({ token: null, ready: false }));

export function getToken(): string | null {
  return useTokenStore.getState().token;
}

export async function loadToken(): Promise<void> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(KEY);
  } catch {
    token = null; // keychain unavailable: start signed out
  }
  useTokenStore.setState({ token, ready: true });
}

export async function saveToken(token: string): Promise<void> {
  useTokenStore.setState({ token });
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  useTokenStore.setState({ token: null });
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}
