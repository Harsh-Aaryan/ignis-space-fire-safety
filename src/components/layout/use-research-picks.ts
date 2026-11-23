"use client";

import { useSyncExternalStore } from "react";
import { useResearchBriefStore } from "@/stores/research-brief-store";

const subscribeToHydration = () => () => {};

/**
 * How many investigations are picked for comparison. Zero on the server and during
 * hydration: the picks live in this browser's storage, so reading them earlier would make
 * the first client render disagree with the server's markup.
 */
export function useResearchPickCount(): number {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const count = useResearchBriefStore((state) => state.selectedIds.length);
  return hydrated ? count : 0;
}
