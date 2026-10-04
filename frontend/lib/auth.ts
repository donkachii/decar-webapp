import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { api, ApiError, SESSION_COOKIE } from "@/lib/api/client";
import { getFeatures } from "@/lib/features";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

interface Me {
  user: SessionUser;
  isAdmin: boolean;
}

/** The session behind the cookie, checked by the API once per request. */
const getMe = cache(async (): Promise<Me | null> => {
  if (!(await cookies()).has(SESSION_COOKIE)) return null;
  try {
    return await api<Me>("/me", { session: true });
  } catch (error) {
    // Expired or revoked: treat as signed out.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/** The signed-in buyer or owner. Null for guests. */
export async function getUser(): Promise<SessionUser | null> {
  return (await getMe())?.user ?? null;
}

export type AdminAccess =
  | { allowed: true; user: SessionUser | null; demo: boolean }
  | { allowed: false; reason: "signed-out" | "not-allowed" | "not-configured"; user: SessionUser | null };

/**
 * The owner signs in with Google; only emails in the API's ADMIN_EMAILS get
 * in. Without Google keys, a development API opens admin in demo mode so it can
 * be tried locally. The API enforces this on every admin call; this only
 * decides what the page shows.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  const features = await getFeatures();
  if (features.demoAdmin) return { allowed: true, user: await getUser(), demo: true };
  if (!features.googleSignIn) return { allowed: false, reason: "not-configured", user: null };
  const me = await getMe();
  if (!me) return { allowed: false, reason: "signed-out", user: null };
  if (!me.isAdmin) return { allowed: false, reason: "not-allowed", user: me.user };
  return { allowed: true, user: me.user, demo: false };
}
