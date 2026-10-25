// Google sign-in (OpenID Connect).
//
// Website: the frontend sends the buyer to authorizationUrl(); Google redirects
// back to the frontend's /auth/callback, which hands the code to exchangeCode()
// here. Only the API holds the client secret.
//
// Phone app: Google signs the buyer in on the phone and gives the app an ID
// token, which verifyIdToken() checks against the configured client IDs.
// Builds without native sign-in use the website's flow in an in-app browser
// instead and get a one-time app code back (auth.ts, /auth/google/app-code).

import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

import type { Settings } from "../config.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export class GoogleSignInError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GoogleSignInError";
  }
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

// Fetched once and cached; refetched when Google rotates its keys.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export function authorizationUrl(settings: Settings, state: string): string {
  const query = new URLSearchParams({
    client_id: settings.googleClientId,
    redirect_uri: settings.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${query.toString()}`;
}

export async function verifyIdToken(settings: Settings, idToken: string): Promise<GoogleIdentity> {
  jwks ??= createRemoteJWKSet(new URL(JWKS_URL));
  let claims: JWTPayload;
  try {
    ({ payload: claims } = await jwtVerify(idToken, jwks, {
      algorithms: ["RS256"],
      audience: [...settings.googleAudiences],
      requiredClaims: ["iss", "sub", "aud", "exp"],
    }));
  } catch (error) {
    throw new GoogleSignInError("Invalid ID token", { cause: error });
  }
  if (!ISSUERS.includes(String(claims.iss))) throw new GoogleSignInError("Unexpected issuer");
  const { email, email_verified: verified, name } = claims;
  if (typeof email !== "string" || verified !== true) {
    throw new GoogleSignInError("Google account has no verified email");
  }
  return { sub: String(claims.sub), email: email.toLowerCase(), name: typeof name === "string" ? name : null };
}

export async function exchangeCode(settings: Settings, code: string): Promise<GoogleIdentity> {
  let res: Response;
  let body: unknown;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        code,
        client_id: settings.googleClientId,
        client_secret: settings.googleClientSecret,
        redirect_uri: settings.googleRedirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new GoogleSignInError("Could not reach Google", { cause: error });
  }
  const idToken = typeof body === "object" && body !== null && "id_token" in body ? body.id_token : undefined;
  if (!res.ok || typeof idToken !== "string") throw new GoogleSignInError(`Google rejected the code: ${res.status}`);
  return verifyIdToken(settings, idToken);
}
