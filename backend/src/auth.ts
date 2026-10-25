// Sessions and access checks.
//
// After any sign-in the API issues its own session token (a signed JWT). The
// website keeps it in an httpOnly cookie and the phone app in SecureStore; both
// send it back as a Bearer token. Buyers never need one to check out; the owner
// needs one, with an email in ADMIN_EMAILS, for every /admin route.

import { createHash, timingSafeEqual } from "node:crypto";

import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";

import { type Settings, signingSecret } from "./config.js";
import { prisma, type User } from "./db.js";
import { HttpError, parseUuid } from "./http.js";

const SESSION_DAYS = 30;
const ISSUER = "dcr-api";

function key(settings: Settings): Uint8Array {
  return new TextEncoder().encode(signingSecret(settings));
}

export function createSessionToken(settings: Settings, userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key(settings));
}

/** The account a session token names. Null for an expired, forged or wrong kind of token. */
export async function readSessionToken(settings: Settings, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(settings), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      requiredClaims: ["sub", "iss", "exp"],
    });
    // Session tokens carry no audience. One that has one is an app code (below),
    // which must never pass as a session.
    if (payload.aud !== undefined) return null;
    return parseUuid(String(payload.sub));
  } catch {
    return null;
  }
}

// --- Phone-app sign-in through the browser ---------------------------------
//
// Builds without native Google sign-in (Expo Go, iOS without an iOS OAuth
// client) sign in on the website in an in-app browser. The website's callback
// sends the app a short-lived code rather than the session token, and only the
// app can redeem it: the code is bound to the PKCE challenge of a verifier the
// app never sends through the browser.

const APP_SCHEME = "decar"; // mobile/app.config.ts
const APP_CODE_AUDIENCE = "dcr-app-sign-in"; // session tokens carry no audience, so neither passes as the other
const APP_CODE_MINUTES = 5;

// Expo Go's return address on a laptop's network: exp://<IPv4>:<port>/--/auth.
// Matched whole, so the website's URL parser can't read another host out of it.
const EXPO_GO_LAN_RETURN = /^exps?:\/\/(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?\/--\/auth$/;

/** A URL's scheme, lowercased, read the way Python's urllib does ("" if there is none). */
function urlScheme(url: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/^[\u0000- ]+/, "").replace(/[\t\r\n]/g, "");
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(cleaned);
  return match?.[1]?.toLowerCase() ?? "";
}

// Private, loopback, link-local and reserved IPv4 ranges: Python's is_private
// list, which the Python backend used.
const PRIVATE_IPV4: [network: string, bits: number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 29],
  ["192.0.0.170", 31],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32],
];

function ipv4ToNumber(address: string): number | null {
  const octets = address.split(".");
  if (octets.length !== 4) return null;
  let value = 0;
  for (const octet of octets) {
    // No leading zeros: "010" could be read as octal elsewhere.
    if (!/^(0|[1-9]\d{0,2})$/.test(octet) || Number(octet) > 255) return null;
    value = value * 256 + Number(octet);
  }
  return value;
}

function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  if (value === null) return false;
  return PRIVATE_IPV4.some(([network, bits]) => {
    const size = 2 ** (32 - bits);
    return Math.floor(value / size) === Math.floor((ipv4ToNumber(network) ?? 0) / size);
  });
}

/**
 * Where a browser sign-in may hand its code.
 *
 * Always the app (decar://). Expo Go (exp://) anywhere outside production; in
 * production only on a private network address, so a code sent there by a
 * crafted link would need a machine on the buyer's own network to catch it.
 */
export function appReturnAllowed(settings: Settings, url: string): boolean {
  const scheme = urlScheme(url);
  if (scheme === APP_SCHEME) return true;
  if (scheme !== "exp" && scheme !== "exps") return false;
  if (settings.appEnv !== "production") return true;
  const match = EXPO_GO_LAN_RETURN.exec(url);
  return match?.[1] !== undefined && isPrivateIpv4(match[1]);
}

/** S256: unpadded base64url of the verifier's SHA-256. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function createAppCode(settings: Settings, userId: string, challenge: string, created: boolean) {
  return new SignJWT({ chal: challenge, created })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(APP_CODE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${APP_CODE_MINUTES}m`)
    .sign(key(settings));
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The account and whether the sign-in made it. Null for a forged, expired or stolen code. */
export async function redeemAppCode(
  settings: Settings,
  code: string,
  verifier: string,
): Promise<{ userId: string; created: boolean } | null> {
  try {
    const { payload } = await jwtVerify(code, key(settings), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: APP_CODE_AUDIENCE,
      requiredClaims: ["sub", "iss", "aud", "exp", "chal"],
    });
    const userId = parseUuid(String(payload.sub));
    if (userId === null || !sameText(String(payload.chal), pkceChallenge(verifier))) return null;
    return { userId, created: payload.created === true };
  } catch {
    return null;
  }
}

/** Google accounts only: anyone can sign up with a password and the owner's email. */
export function isAdmin(settings: Settings, user: Pick<User, "email" | "googleSub"> | null): boolean {
  return user !== null && user.googleSub !== null && settings.adminEmailSet.has(user.email.toLowerCase());
}

/** The Bearer token, if the request carries one. */
function bearerToken(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) return null;
  const space = header.indexOf(" ");
  if (space === -1) return null;
  const scheme = header.slice(0, space);
  const token = header.slice(space + 1);
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}

/** The signed-in buyer or owner. Null for guests and for expired or forged tokens. */
export async function currentUser(req: Request, settings: Settings): Promise<User | null> {
  const token = bearerToken(req);
  const userId = token ? await readSessionToken(settings, token) : null;
  return userId ? prisma.user.findUnique({ where: { id: userId } }) : null;
}

export async function requireUser(req: Request, settings: Settings): Promise<User> {
  const user = await currentUser(req, settings);
  if (user === null) throw new HttpError(401, "Sign in first.");
  return user;
}

/** The owner. In local dev without Google sign-in, anyone (demo mode). */
export async function requireAdmin(req: Request, settings: Settings): Promise<User | null> {
  const user = await currentUser(req, settings);
  if (settings.demoAdmin) return user;
  if (user === null) throw new HttpError(401, "Sign in first.");
  if (!isAdmin(settings, user)) throw new HttpError(403, "Not allowed to manage stock.");
  return user;
}
