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

export function readOauthCookie(value: string | undefined): { state: string; next: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { state?: unknown; next?: unknown };
    if (typeof parsed.state !== "string" || typeof parsed.next !== "string") return null;
    const next = parsed.next.startsWith("/") && !parsed.next.startsWith("//") ? parsed.next : "/account";
    return { state: parsed.state, next };
  } catch {
    return null;
  }
}
