"use client";

import { useMemo } from "react";
import { runs as syntheticRuns, investigations as syntheticInvestigations } from "@/data/mock";
import { VERIFIED_CITATIONS } from "@/data/verified";
import { assessIndexedMetadata, classifySyntheticRuns } from "@/lib/analytics/gap-class";
import { analyzeMission } from "@/lib/evidence/selectors";
import { assessVerifiedPrediction, syntheticFlameSpreadDemo } from "@/lib/predict/baseline";
import { getServices } from "@/services";
import { useMissionStore } from "@/stores/mission-store";

export function useAnalysis() {
  const scenario = useMissionStore((state) => state.scenario);
  const weights = useMissionStore((state) => state.weights);
  const filters = useMissionStore((state) => state.filters);
  const includeMissing = useMissionStore((state) => state.includeMissingInFilters);
  const sort = useMissionStore((state) => state.sort);
  const heatmapX = useMissionStore((state) => state.heatmapX);
  const heatmapY = useMissionStore((state) => state.heatmapY);
  const dataMode = useMissionStore((state) => state.dataMode);
  return useMemo(() => {
    getServices();
    const hideSyntheticNumbers = dataMode === "verified";
    const base = analyzeMission({
      runs: hideSyntheticNumbers ? [] : syntheticRuns,
      investigations: hideSyntheticNumbers ? [] : syntheticInvestigations,
      scenario,
      weights,
      filters,
      includeMissing,
      sort,
      heatmapAxes: { x: heatmapX, y: heatmapY },
    });
    return {
      ...base,
      dataMode,
      citations: VERIFIED_CITATIONS,
      indexed: assessIndexedMetadata(scenario),
      syntheticClass: classifySyntheticRuns(scenario, syntheticRuns),
      verifiedPrediction: assessVerifiedPrediction(VERIFIED_CITATIONS),
      syntheticDemo: syntheticFlameSpreadDemo(syntheticRuns, scenario.oxygenPct),
    };
  }, [scenario, weights, filters, includeMissing, sort, heatmapX, heatmapY, dataMode]);
}
