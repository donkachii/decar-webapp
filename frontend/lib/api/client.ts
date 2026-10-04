import "server-only";

import { cookies } from "next/headers";

// The only way the frontend talks to the FastAPI backend. Server-side only:
// the browser never calls the API directly, so API_URL can stay private and
// the session token never leaves its httpOnly cookie.

export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** httpOnly cookie holding the API session token after Google sign-in. */
export const SESSION_COOKIE = "dcr_session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    path: string,
  ) {
    super(`API ${path} responded ${status}`);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | readonly string[] | null | undefined;

interface ApiOptions {
  method?: "GET" | "POST";
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Send the signed-in user's session token, if there is one. */
  session?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") for (const item of value) url.searchParams.append(key, item);
    else url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.session) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) headers.authorization = `Bearer ${token}`;
  }

  // Stock truth beats everything (rule 5): never serve catalog or orders from a cache.
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data, path);
  return data as T;
}

/** Like api(), but a 404 becomes null. */
export async function apiOrNull<T>(path: string, options: ApiOptions = {}): Promise<T | null> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null;
    throw error;
  }
}
