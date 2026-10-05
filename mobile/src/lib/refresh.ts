import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

/**
 * Re-reads a screen's data when the buyer comes back to it (rule 5: a unit
 * sold while they looked at another screen must not still show as available).
 * Skips the first focus, when the query has just loaded.
 */
export function useRefreshOnFocus(refetch: () => unknown): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}

/** Pull-to-refresh state for a ScrollView's RefreshControl. */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, onRefresh };
}
