// Email and password accounts: who gets into /admin, and the password hashes.
//
// No database needed: pnpm test

import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { isAdmin } from "../src/auth.js";
import { loadSettings } from "../src/config.js";
import { hashPassword, internals, verifyPassword } from "../src/services/passwords.js";

const OWNER = "owner@example.com";
// No .env, so a developer's own settings can't change the answers.
const SETTINGS = loadSettings({ APP_ENV: "test", ADMIN_EMAILS: OWNER });

afterEach(() => mock.restoreAll());

test("a password account with the owner's email is not admin", () => {
  // Anyone can sign up with any email: a password proves nothing about who owns it.
  assert.equal(isAdmin(SETTINGS, { email: OWNER, googleSub: null }), false);
});

test("a Google account with the owner's email is admin", () => {
  assert.equal(isAdmin(SETTINGS, { email: "Owner@Example.com", googleSub: "google-subject" }), true);
});

test("a password matches its own hash only", async () => {
  const stored = await hashPassword("correct horse");
  assert.equal(await verifyPassword("correct horse", stored), true);
  assert.equal(await verifyPassword("correct horsf", stored), false);
  // Salted: the same password never hashes the same twice.
  assert.notEqual(stored, await hashPassword("correct horse"));
});

test("a hash the Python backend made still verifies", async () => {
  const fromPython = "scrypt$32768$8$1$t4BspBO2lA6rbfIb/mx6zA==$pBN5Ft9VV4UP5tHsFHRaPT8DY59dlP8lsuYgddlVLpc=";
  assert.equal(await verifyPassword("correct horse", fromPython), true);
  assert.equal(await verifyPassword("correct horsf", fromPython), false);
});

test("the same password typed on another keyboard matches", async () => {
  const stored = await hashPassword("password1");
  assert.equal(await verifyPassword("password\u{FF11}", stored), true); // FULLWIDTH DIGIT ONE
});

test("an email without an account never matches", async () => {
  // Not even if the decoy hash did.
  mock.method(internals, "verify", () => Promise.resolve(true));
  assert.equal(await verifyPassword("anything", null), false);
});

test("a damaged hash never matches", async () => {
  for (const stored of ["", "garbage", "bcrypt$1$2$3$4$5", "scrypt$x$8$1$AAAA$AAAA", "scrypt$3$8$1$AAAA$AAAA"]) {
    assert.equal(await verifyPassword("anything", stored), false, stored);
  }
});

test("at most two hashes run at once", async () => {
  // Each real hash holds 32 MiB and the API has 512 MB. Sign-ups and sign-ins share the two.
  let running = 0;
  let peak = 0;
  const slow = async (): Promise<never> => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 50));
    running -= 1;
    return "" as never; // an empty hash, and no match
  };
  mock.method(internals, "hash", slow);
  mock.method(internals, "verify", slow);
  await Promise.all(
    Array.from({ length: 5 }, () => [hashPassword("new password"), verifyPassword("guess", "stored")]).flat(),
  );
  assert.equal(peak, 2);
});
