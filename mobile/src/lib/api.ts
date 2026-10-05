import { API_URL } from "./config";
import { getToken } from "./token";

// The only way the app talks to the FastAPI backend. Unlike the website there
// is no server in between: the app sends its own session token, and the API
// decides every price, reservation and validation.

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
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Send the signed-in buyer's session token, if there is one. */
  session?: boolean;
}

// React Native's URL and URLSearchParams are partial, so the query is built by hand.
function queryString(query: Record<string, QueryValue>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    const values = typeof value === "object" ? value : [String(value)];
    for (const item of values) pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
  }
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text; // a proxy's HTML error page, say
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const token = options.session ? getToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}${queryString(options.query ?? {})}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = parse(await res.text());
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
