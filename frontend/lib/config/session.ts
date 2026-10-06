import { SITE } from "@/lib/config/site";

// Cookies for Google sign-in. The session token itself is opaque here: the API
// issues it and checks it on every request.

/** Holds `state` and the return path while the buyer is at Google. */
export const OAUTH_COOKIE = "dcr_oauth";

const SESSION_DAYS = 30; // matches the API's token lifetime
const secure = SITE.url.startsWith("https://");

export function sessionCookieOptions() {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * SESSION_DAYS };
}

export function oauthCookieOptions() {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/auth", maxAge: 60 * 10 };
}

/**
 * A phone-app sign-in in the browser (app/auth/app): where to hand the app its
 * one-time code (checked by the API) and the PKCE challenge it is bound to.
 */
export interface AppSignIn {
  returnUrl: string;
  challenge: string;
}

export interface OauthCookie {
  state: string;
  next: string;
  app?: AppSignIn;
}

export function readOauthCookie(value: string | undefined): OauthCookie | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { state?: unknown; next?: unknown; app?: { returnUrl?: unknown; challenge?: unknown } };
    if (typeof parsed.state !== "string" || typeof parsed.next !== "string") return null;
    const next = parsed.next.startsWith("/") && !parsed.next.startsWith("//") ? parsed.next : "/account";
    const app = parsed.app;
    if (app && typeof app.returnUrl === "string" && typeof app.challenge === "string") {
      return { state: parsed.state, next, app: { returnUrl: app.returnUrl, challenge: app.challenge } };
    }
    return { state: parsed.state, next };
  } catch {
    return null;
  }
}
