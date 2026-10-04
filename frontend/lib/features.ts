import "server-only";

import { cache } from "react";

import { api } from "@/lib/api/client";

/** What the API has switched on. Each flag follows from keys set in backend/.env. */
export interface Features {
  googleSignIn: boolean;
  paystack: boolean;
  /** Local dev without Google sign-in: /admin opens without signing in. */
  demoAdmin: boolean;
}

export const getFeatures = cache((): Promise<Features> => api<Features>("/features"));
