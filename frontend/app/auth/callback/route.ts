import { NextResponse, type NextRequest } from "next/server";

import { api, SESSION_COOKIE } from "@/lib/api/client";
import { OAUTH_COOKIE, oauthCookieOptions, readOauthCookie, sessionCookieOptions } from "@/lib/config/session";

// Google sends the buyer back here with a one-time code. The API trades it for
// a session token (only the API holds the Google client secret), which lives
// in an httpOnly cookie on this site.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const saved = readOauthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const next = saved?.next ?? "/account";

  let token: string | null = null;
  if (code && state && saved && saved.state === state) {
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
