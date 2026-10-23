// Password hashes for email and password accounts.
//
// scrypt from node:crypto, so there is no extra dependency. Stored as
// scrypt$<n>$<r>$<p>$<salt>$<hash> (base64), so the cost can rise later without
// breaking old hashes. The format and parameters are the ones the Python backend
// used, so its hashes still verify. Hashing is deliberately slow, runs on libuv's
// thread pool, not the event loop, and runs two at a time.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

// About 32 MiB and a tenth of a second per hash on a small server.
const N = 2 ** 15;
const R = 8;
const P = 1;
const MAX_MEMORY = 64 * 1024 * 1024;
const KEY_LENGTH = 32;

/** Runs at most `slots` tasks at once; the rest wait their turn in order. */
export function limiter(slots: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (running < slots) running += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      // Hand the slot straight to the next in line, so a newcomer can't slip in between.
      const next = waiting.shift();
      if (next) next();
      else running -= 1;
    }
  };
}

// Anyone can ask for a hash and the API has 512 MB, so at most two run at once
// (64 MiB) and the rest wait here. libuv's pool has four threads, so file and DNS
// work keeps the other two.
const hashing = limiter(2);

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  // NFKC, so the same password typed on different keyboards hashes the same.
  const secret = password.normalize("NFKC");
  return new Promise((resolve, reject) => {
    try {
      scryptCallback(secret, salt, KEY_LENGTH, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error))); // bad parameters in a stored hash
    }
  });
}

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verify(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [scheme, n, r, p, salt, digest] = parts as [string, string, string, string, string, string];
  if (scheme !== "scrypt" || ![n, r, p].every((v) => /^\d+$/.test(v))) return false;
  try {
    const actual = await scrypt(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
    const expected = Buffer.from(digest, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** The hash and check, swappable in tests. */
export const internals = { hash, verify };

let decoyHash: Promise<string> | undefined;

/**
 * A real hash to check when the email has no account. Then a wrong email takes
 * as long as a wrong password, and timing doesn't tell which emails have accounts.
 */
function decoy(): Promise<string> {
  decoyHash ??= internals.hash(randomBytes(16).toString("base64url"));
  return decoyHash;
}

export function hashPassword(password: string): Promise<string> {
  return hashing(() => internals.hash(password));
}

export function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // The decoy is made inside the slot, so its first hash is counted too.
  return hashing(async () => (await internals.verify(password, stored || (await decoy()))) && stored !== null);
}
