// Listing filters live in the URL (?type=headlight,foglamp&condition=belgium-a)
// so a link pasted into WhatsApp shows the recipient the same results.

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseList<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] {
  const raw = first(value);
  if (!raw) return [];
  const wanted = raw.split(",").map((v) => v.trim());
  return allowed.filter((a) => wanted.includes(a));
}

function toQuery(params: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v) query.set(key, v);
  }
  return query;
}

function withQuery(pathname: string, query: URLSearchParams): string {
  const s = query.toString();
  return s ? `${pathname}?${s.replaceAll("%2C", ",")}` : pathname;
}

/** Href that toggles one value in a comma-separated filter. */
export function toggleHref(pathname: string, params: SearchParams, key: string, value: string): string {
  const query = toQuery(params);
  const current = (query.get(key) ?? "").split(",").filter(Boolean);
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  if (next.length) query.set(key, next.join(","));
  else query.delete(key);
  return withQuery(pathname, query);
}

/** Href with `key` set to `value`, or removed when value is null. */
export function setHref(pathname: string, params: SearchParams, key: string, value: string | null): string {
  const query = toQuery(params);
  if (value === null) query.delete(key);
  else query.set(key, value);
  return withQuery(pathname, query);
}

/** Href with only the given keys kept. */
export function keepHref(pathname: string, params: SearchParams, keep: string[]): string {
  const query = toQuery(params);
  for (const key of [...query.keys()]) if (!keep.includes(key)) query.delete(key);
  return withQuery(pathname, query);
}
