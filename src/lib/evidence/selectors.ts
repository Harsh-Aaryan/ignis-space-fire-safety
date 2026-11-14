import { analyzeApplicability, illustrativeOxygenSketch } from "@/lib/analytics/applicability";
import { buildHeatmap, computeCoverage, type Heatmap } from "@/lib/analytics/coverage";
import { buildRecommendations, discoverGaps } from "@/lib/analytics/gaps";
import { EMPTY_FILTERS, filterRuns, filtersActive } from "@/lib/evidence/filters";
import { DEFAULT_WEIGHTS, scoreRun, type RankedRun } from "@/lib/ranking/score";
import type {
  EvidenceGap,
  ExperimentalRun,
  ExplorerFilters,
  Investigation,
  MissionScenario,
  RankingWeights,
  ResearchRecommendation,
  SortKey,
} from "@/types/domain";

export interface RankedInvestigation {
  investigation: Investigation;
  runs: RankedRun[];
  relevance: number | null;
  completeRuns: number;
  partialRuns: number;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function rankInvestigations(
  runs: ExperimentalRun[],
  investigations: Investigation[],
  scenario: MissionScenario,
  weights: RankingWeights = DEFAULT_WEIGHTS,
  filters: ExplorerFilters,
  includeMissing = false,
  sort: SortKey = "relevance",
): { rows: RankedInvestigation[]; withheldForMissing: number } {
  const filtered = filterRuns(runs, investigations, filters, includeMissing);
  const byId = new Map(investigations.map((item) => [item.id, item]));
  const groups = new Map<string, RankedRun[]>();
  for (const run of filtered.runs) {
    const investigation = byId.get(run.investigationId);
    if (!investigation) continue;
    const ranked = scoreRun(run, investigation, scenario, weights);
    const list = groups.get(investigation.id) ?? [];
    list.push(ranked);
    groups.set(investigation.id, list);
  }
  const rows = [...groups.entries()].map(([id, rankedRuns]) => {
    const investigation = byId.get(id)!;
    rankedRuns.sort(
      (a, b) =>
        (b.relevance ?? -1) - (a.relevance ?? -1) ||
        a.run.id.localeCompare(b.run.id),
    );
    return {
      investigation,
      runs: rankedRuns,
      relevance: rankedRuns[0]?.relevance ?? null,
      completeRuns: rankedRuns.filter((item) => item.run.evidenceCompleteness === "complete")
        .length,
      partialRuns: rankedRuns.filter((item) => item.run.evidenceCompleteness !== "complete")
        .length,
    };
  });
  rows.sort((a, b) => compareRows(a, b, sort));
  return { rows, withheldForMissing: filtered.withheldForMissing };
}

function compareRows(a: RankedInvestigation, b: RankedInvestigation, sort: SortKey): number {
  if (sort === "family") {
    return (
      a.investigation.family.localeCompare(b.investigation.family) ||
      a.investigation.title.localeCompare(b.investigation.title)
    );
  }
  if (sort === "runCount") return b.runs.length - a.runs.length || a.investigation.id.localeCompare(b.investigation.id);
  if (sort === "completeness") {
    return b.completeRuns - a.completeRuns || a.investigation.id.localeCompare(b.investigation.id);
  }
  return (b.relevance ?? -1) - (a.relevance ?? -1) || a.investigation.id.localeCompare(b.investigation.id);
}

export interface MissionAnalysis {
  ranked: RankedInvestigation[];
  withheldForMissing: number;
  coverage: ReturnType<typeof computeCoverage>;
  heatmap: Heatmap;
  gaps: EvidenceGap[];
  recommendations: ResearchRecommendation[];
  applicability: ReturnType<typeof analyzeApplicability>;
  sketch: ReturnType<typeof illustrativeOxygenSketch>;
  relevantCount: number;
  filterActive: boolean;
}

export function analyzeMission(input: {
  runs: ExperimentalRun[];
  investigations: Investigation[];
  scenario: MissionScenario;
  weights?: RankingWeights;
  filters: ExplorerFilters;
  includeMissing?: boolean;
  sort?: SortKey;
  heatmapAxes?: { x: "gravity" | "oxygen" | "pressure" | "airflow" | "fuel"; y: "gravity" | "oxygen" | "pressure" | "airflow" | "fuel" };
}): MissionAnalysis {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const ranked = rankInvestigations(
    input.runs,
    input.investigations,
    input.scenario,
    weights,
    input.filters,
    input.includeMissing ?? false,
    input.sort ?? "relevance",
  );
  const fullRanked = rankInvestigations(
    input.runs,
    input.investigations,
    input.scenario,
    weights,
    EMPTY_FILTERS,
  );
  const filtered = filterRuns(
    input.runs,
    input.investigations,
    input.filters,
    input.includeMissing ?? false,
  );
  const active = filtersActive(input.filters);
  const axes = input.heatmapAxes ?? { x: "oxygen" as const, y: "gravity" as const };
  const gaps = discoverGaps(input.scenario, input.runs);
  return {
    ranked: ranked.rows,
    withheldForMissing: ranked.withheldForMissing,
    coverage: computeCoverage(input.scenario, input.runs),
    heatmap: buildHeatmap(filtered.runs, axes.x, axes.y),
    gaps,
    recommendations: buildRecommendations(
      input.scenario,
      input.runs,
      input.investigations,
      gaps,
    ),
    applicability: analyzeApplicability(
      input.scenario,
      filtered.runs,
      input.investigations,
      weights,
    ),
    sketch: illustrativeOxygenSketch(input.runs, input.scenario),
    relevantCount: fullRanked.rows.filter((row) => (row.relevance ?? 0) >= 0.55).length,
    filterActive: active,
  };
}

export const RELEVANCE_THRESHOLD = 0.55;
