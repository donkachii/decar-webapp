import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { api, ApiError, SESSION_COOKIE } from "@/lib/api/client";
import { parseCartLines } from "@/lib/cart/server";
import type { CartLine } from "@/lib/cart/types";

// The cart saved to the signed-in buyer's account, which the phone app shows
// too. The browser never calls the API, so this passes the session cookie on.
// 401 when signed out.

const notSignedIn = () => NextResponse.json({ error: "Not signed in" }, { status: 401 });

async function savedCart(method: "GET" | "PUT" | "POST", path: string, lines?: CartLine[]) {
  if (!(await cookies()).has(SESSION_COOKIE)) return notSignedIn();
  try {
    const cart = await api<{ lines: CartLine[] }>(path, {
      method,
      session: true,
      body: lines === undefined ? undefined : { lines },
    });
    return NextResponse.json(cart, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return notSignedIn();
    throw error;
  }
}

async function readLines(request: NextRequest): Promise<CartLine[] | null> {
  try {
    const body: unknown = await request.json();
    return parseCartLines((body as { lines?: unknown } | null)?.lines);
  } catch {
    return null;
  }
}

const badRequest = () => NextResponse.json({ error: "Expected JSON" }, { status: 400 });

export async function GET() {
  return savedCart("GET", "/me/cart");
}

/** Replaces the saved cart after a change here. */
export async function PUT(request: NextRequest) {
  const lines = await readLines(request);
  return lines ? savedCart("PUT", "/me/cart", lines) : badRequest();
}

/** Merges this browser's guest cart into the account's at sign-in. */
export async function POST(request: NextRequest) {
  const lines = await readLines(request);
  return lines ? savedCart("POST", "/me/cart/merge", lines) : badRequest();
}
