"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api, SESSION_COOKIE } from "@/lib/api/client";
import { OAUTH_COOKIE, oauthCookieOptions } from "@/lib/config/session";
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

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
