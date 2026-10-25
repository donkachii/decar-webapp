// Part photos on Cloudinary. On only when CLOUDINARY_URL is set.
//
// Uploads are signed with the API secret, so only the backend can add photos.
// The site only reads the public delivery URLs stored in each part's `images`.
// Every asset lives under the `decar/` folder.

import { createHash } from "node:crypto";

const API = "https://api.cloudinary.com/v1_1";
export const ROOT = "decar";

// Phone photos run to 4000 px and several MB. Cap what's stored; uploads are
// also stored as JPEG so HEIC photos work in browsers, next/image and OG images.
const INCOMING_TRANSFORMATION = "c_limit,w_2000,h_2000";
const TIMEOUT_MS = 120_000;

export class CloudinaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudinaryError";
  }
}

export interface Account {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Reads cloudinary://<api_key>:<api_secret>@<cloud_name>, as the console shows it. */
export function parseCloudinaryUrl(raw: string): Account {
  let url = raw.trim();
  if (url.startsWith("CLOUDINARY_URL=")) url = url.slice("CLOUDINARY_URL=".length);
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)/.exec(url);
  const netloc = match?.[2] ?? "";
  const at = netloc.lastIndexOf("@");
  const credentials = at === -1 ? "" : netloc.slice(0, at);
  const cloudName = at === -1 ? netloc : netloc.slice(at + 1);
  const colon = credentials.indexOf(":");
  const apiKey = colon === -1 ? credentials : credentials.slice(0, colon);
  const apiSecret = colon === -1 ? "" : credentials.slice(colon + 1);
  if (match?.[1]?.toLowerCase() !== "cloudinary" || !(cloudName && apiKey && apiSecret)) {
    throw new CloudinaryError("CLOUDINARY_URL should look like cloudinary://<api_key>:<api_secret>@<cloud_name>");
  }
  if (apiSecret.startsWith("<") || apiSecret.includes("*")) {
    throw new CloudinaryError("CLOUDINARY_URL still holds the placeholder secret; copy the real one.");
  }
  return { cloudName, apiKey: decode(apiKey), apiSecret: decode(apiSecret) };
}

/**
 * Cloudinary's request signature: name=value pairs sorted by name, joined with &,
 * the API secret appended, then SHA-1.
 */
export function sign(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join("&");
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

/**
 * The URL stored in a part's images. A new version (photo replaced) is a new
 * URL, so no cache ever serves the old photo.
 */
export function deliveryUrl(account: Account, publicId: string, version: number): string {
  return `https://res.cloudinary.com/${account.cloudName}/image/upload/v${version}/${publicId}.jpg`;
}

async function body(res: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await res.json();
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function errorText(res: Response, parsed: Record<string, unknown>): string {
  const error = parsed.error;
  const message = typeof error === "object" && error !== null && "message" in error ? error.message : undefined;
  return typeof message === "string" ? message : `HTTP ${res.status}`;
}

/** Uploads one photo to publicId, replacing any photo already there. Returns its version. */
export async function upload(
  account: Account,
  photo: { publicId: string; filename: string; data: Buffer },
): Promise<number> {
  const params: Record<string, string> = {
    public_id: photo.publicId,
    // Places the photo in the Media Library folder on accounts in dynamic
    // folder mode; fixed-folder accounts take folders from the public_id.
    asset_folder: photo.publicId.slice(0, Math.max(photo.publicId.lastIndexOf("/"), 0)),
    format: "jpg",
    transformation: INCOMING_TRANSFORMATION,
    overwrite: "true",
    invalidate: "true",
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const form = new FormData();
  for (const [name, value] of Object.entries(params)) form.append(name, value);
  form.append("api_key", account.apiKey);
  form.append("signature", sign(params, account.apiSecret));
  form.append("file", new Blob([new Uint8Array(photo.data)]), photo.filename);

  const res = await fetch(`${API}/${account.cloudName}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const parsed = await body(res);
  if (!res.ok || typeof parsed.version !== "number") {
    throw new CloudinaryError(`Upload ${photo.publicId}: ${errorText(res, parsed)}`);
  }
  return parsed.version;
}

/** publicId → version for every photo already under decar/. */
export async function uploadedVersions(account: Account): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  const auth = `Basic ${Buffer.from(`${account.apiKey}:${account.apiSecret}`).toString("base64")}`;
  let cursor: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ prefix: `${ROOT}/`, max_results: "500" });
    if (cursor) query.set("next_cursor", cursor);
    const res = await fetch(`${API}/${account.cloudName}/resources/image/upload?${query.toString()}`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const parsed = await body(res);
    const resources = parsed.resources;
    if (!res.ok || !Array.isArray(resources)) throw new CloudinaryError(`Listing photos: ${errorText(res, parsed)}`);
    for (const r of resources as unknown[]) {
      if (typeof r !== "object" || r === null) continue;
      const { public_id: publicId, version } = r as Record<string, unknown>;
      if (typeof publicId === "string" && typeof version === "number") found.set(publicId, version);
    }
    if (typeof parsed.next_cursor !== "string") return found;
    cursor = parsed.next_cursor;
  }
}
