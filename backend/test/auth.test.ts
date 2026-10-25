// Session tokens and the phone app's browser sign-in codes. No database needed.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appReturnAllowed,
  createAppCode,
  createSessionToken,
  pkceChallenge,
  readSessionToken,
  redeemAppCode,
} from "../src/auth.js";
import { loadSettings } from "../src/config.js";

const SETTINGS = loadSettings({ APP_ENV: "test", SESSION_SECRET: "test-secret-0123456789abcdef0123456789" });
const USER = "a02468ea-0451-4601-97a0-132de1180022";
const VERIFIER = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ";

test("a session token names its account", async () => {
  assert.equal(await readSessionToken(SETTINGS, await createSessionToken(SETTINGS, USER)), USER);
});

test("a token signed with another secret is refused", async () => {
  const other = loadSettings({ APP_ENV: "test", SESSION_SECRET: "another-secret-0123456789abcdef01234567" });
  assert.equal(await readSessionToken(SETTINGS, await createSessionToken(other, USER)), null);
  assert.equal(await readSessionToken(SETTINGS, "not.a.token"), null);
});

test("an app code is never a session token", async () => {
  // It travels in a URL; only the app, holding the verifier, may turn it into a session.
  const code = await createAppCode(SETTINGS, USER, pkceChallenge(VERIFIER), true);
  assert.equal(await readSessionToken(SETTINGS, code), null);
});

test("a session token is never an app code", async () => {
  const token = await createSessionToken(SETTINGS, USER);
  assert.equal(await redeemAppCode(SETTINGS, token, VERIFIER), null);
});

test("an app code redeems only with its own verifier", async () => {
  const code = await createAppCode(SETTINGS, USER, pkceChallenge(VERIFIER), true);
  assert.deepEqual(await redeemAppCode(SETTINGS, code, VERIFIER), { userId: USER, created: true });
  assert.equal(await redeemAppCode(SETTINGS, code, VERIFIER.replace("a", "b")), null);
});

test("the PKCE challenge is unpadded base64url SHA-256 (RFC 7636 appendix B)", () => {
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("a browser sign-in returns only to the app, or Expo Go on a private network in production", () => {
  const production = loadSettings({ APP_ENV: "production", SESSION_SECRET: "x".repeat(32) });
  const development = loadSettings({ APP_ENV: "development" });
  const cases: [string, boolean, boolean][] = [
    // url, allowed in development, allowed in production
    ["decar://auth", true, true],
    ["DECAR://auth", true, true],
    ["exp://192.168.1.20:8081/--/auth", true, true],
    ["exp://10.0.0.5/--/auth", true, true],
    ["exp://8.8.8.8:8081/--/auth", true, false],
    ["exp://192.168.1.20:8081/--/auth/../evil", true, false],
    ["exp://192.168.001.20:8081/--/auth", true, false],
    ["exp://evil.example.com/--/auth", true, false],
    ["https://evil.example.com/auth", false, false],
    ["javascript:alert(1)", false, false],
    ["", false, false],
  ];
  for (const [url, dev, prod] of cases) {
    assert.equal(appReturnAllowed(development, url), dev, `development: ${url}`);
    assert.equal(appReturnAllowed(production, url), prod, `production: ${url}`);
  }
});
