import { NextResponse, type NextRequest } from "next/server";

import { api } from "@/lib/api/client";
import { OAUTH_COOKIE, oauthCookieOptions, type OauthCookie } from "@/lib/config/session";

// The phone app's Google sign-in for builds without the native module (Expo
// Go, iOS without an iOS OAuth client). The app opens this in an in-app
// browser; /auth/callback hands it back a one-time code that only the app can
// redeem, because it kept the PKCE verifier for `challenge`.
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const state = searchParams.get("state") ?? "";
  const challenge = searchParams.get("challenge") ?? "";
  const returnUrl = searchParams.get("return") ?? "";
  const failed = NextResponse.redirect(`${origin}/signin?error=google`);
  if (state.length < 16 || state.length > 200 || !CHALLENGE.test(challenge) || !returnUrl) return failed;

  // The API refuses a return address that isn't the app, so this can't hand codes to anyone else.
  let url: string | null = null;
  try {
    url = (await api<{ url: string }>("/auth/google/url", { query: { state, appReturn: returnUrl } })).url;
  } catch (error) {
    console.error("[auth] could not start the app's Google sign-in", error);
  }
  if (!url) return failed;

  const saved: OauthCookie = { state, next: "/account", app: { returnUrl, challenge } };
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(saved), oauthCookieOptions());
  return response;
}
