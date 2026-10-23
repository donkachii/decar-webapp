// Email and password accounts: the rules and the words the sign-in forms show.
// Messages follow the copy rules in CLAUDE.md section 8.
//
// An email and password proves nothing about who owns the address, so these
// accounts never pass the admin check (isAdmin in auth.ts) and never take over a
// Google account's address.

import { EMAIL } from "./checkout.js";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const BAD_EMAIL = "Check the email address.";
export const SHORT_PASSWORD = `Use a password of at least ${PASSWORD_MIN} characters.`;
export const LONG_PASSWORD = `Use a password of at most ${PASSWORD_MAX} characters.`;
export const TAKEN = "An account with this email already exists. Sign in instead.";
export const GOOGLE_ACCOUNT = "This email has an account that signs in with Google. Use the Google button instead.";
export const WRONG = "That email and password don't match an account.";

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** What's wrong with a new account's email and password, in the form's words. Null if nothing. */
export function signUpProblem(email: string, password: string): string | null {
  if (!EMAIL.test(email)) return BAD_EMAIL;
  const length = [...password].length;
  if (length < PASSWORD_MIN) return SHORT_PASSWORD;
  if (length > PASSWORD_MAX) return LONG_PASSWORD;
  return null;
}
