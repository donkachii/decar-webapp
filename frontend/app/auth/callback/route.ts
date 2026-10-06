import { NextResponse, type NextRequest } from "next/server";

import { api, SESSION_COOKIE } from "@/lib/api/client";
import {
  type AppSignIn,
  OAUTH_COOKIE,
  oauthCookieOptions,
  readOauthCookie,
  sessionCookieOptions,
} from "@/lib/config/session";

// Google sends the buyer back here with a one-time code. The API trades it for
// a session token (only the API holds the Google client secret), which lives
// in an httpOnly cookie on this site.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const saved = readOauthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const verified = code !== null && state !== null && saved !== null && saved.state === state;

  if (saved?.app) {
    const response = NextResponse.redirect(await backToApp(saved.app, saved.state, verified ? code : null, searchParams));
    response.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
    return response;
  }

  const next = saved?.next ?? "/account";
  let token: string | null = null;
  if (verified) {
    try {
      token = (await api<{ token: string }>("/auth/google/exchange", { method: "POST", body: { code } })).token;
    } catch (error) {
      console.error("[auth] Google sign-in exchange failed", error);
    }
  }

  const response = NextResponse.redirect(
    token ? `${origin}${next}` : `${origin}/signin?error=google&next=${encodeURIComponent(next)}`,
  );
  response.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions(), maxAge: 0 });
  if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

/**
 * A phone-app sign-in (app/auth/app): the app gets a one-time code it redeems
 * with its PKCE verifier, never the session token, and no cookie is set here.
 */
async function backToApp(app: AppSignIn, state: string, code: string | null, params: URLSearchParams): Promise<URL> {
  const back = new URL(app.returnUrl);
  back.searchParams.set("state", state);
  let appCode: string | null = null;
  if (code) {
    try {
      appCode = (
        await api<{ code: string }>("/auth/google/app-code", {
          method: "POST",
          body: { code, challenge: app.challenge },
        })
      ).code;
    } catch (error) {
      console.error("[auth] app Google sign-in exchange failed", error);
    }
  }
  if (appCode) back.searchParams.set("code", appCode);
  else back.searchParams.set("error", params.get("error") === "access_denied" ? "cancelled" : "google");
  return back;
}
