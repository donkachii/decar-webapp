import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

/** What the API has switched on. Each flag follows from keys set in backend/.env. */
export interface Features {
  googleSignIn: boolean;
  paystack: boolean;
  demoAdmin: boolean;
}

export function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: () => api<Features>("/features"),
    staleTime: 5 * 60_000,
  });
}
