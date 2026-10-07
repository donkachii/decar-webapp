"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api, ApiError, SESSION_COOKIE } from "@/lib/api/client";
import { OAUTH_COOKIE, oauthCookieOptions, sessionCookieOptions } from "@/lib/config/session";
import { getFeatures } from "@/lib/features";

/** Only same-site paths, so the sign-in flow can't be used as an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/account";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const back = (error: string) => `/signin?error=${error}&next=${encodeURIComponent(next)}`;
  if (!(await getFeatures()).googleSignIn) redirect(back("not-configured"));

  // `state` ties Google's answer to this browser; /auth/callback checks it.
  const state = crypto.randomUUID();
  let url: string | null = null;
  try {
    url = (await api<{ url: string }>("/auth/google/url", { query: { state } })).url;
  } catch (error) {
    console.error("[auth] could not start Google sign-in", error);
  }
  if (!url) redirect(back("google"));

  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state, next }), oauthCookieOptions());
  redirect(url);
}

export type PasswordMode = "sign-in" | "sign-up";

export interface PasswordState {
  mode: PasswordMode;
  error: string | null;
  /** Typed back into the form after a refusal; the password never is. */
  email: string;
}

/**
 * Email and password: signs in, or makes the account and signs it in. The
 * API's refusals are already in the form's words (backend app/domain/accounts.py).
 */
export async function passwordAuth(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const next = safeNext(formData.get("next"));
  const mode: PasswordMode = formData.get("mode") === "sign-up" ? "sign-up" : "sign-in";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let token: string;
  try {
    token = (await api<{ token: string }>(`/auth/password/${mode}`, { method: "POST", body: { email, password } }))
      .token;
  } catch (error) {
    const detail = error instanceof ApiError ? (error.body as { detail?: unknown } | null)?.detail : undefined;
    if (error instanceof ApiError && error.status < 500) {
      return { mode, email, error: typeof detail === "string" ? detail : "Check the email address and password." };
    }
    console.error("[auth] password sign-in failed", error);
    return { mode, email, error: "We couldn't reach the shop just now. Try again." };
  }

  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(next);
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
