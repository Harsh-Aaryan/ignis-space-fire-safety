import { VERIFIED_CITATIONS, type VerifiedCitation } from "@/data/verified";
import { gravityRegime } from "@/lib/ranking/score";
import { OBJECTIVE_MEASUREMENTS } from "@/lib/labels";
import type { ExperimentalRun, MissionScenario, ResearchObjective } from "@/types/domain";

export type EvidenceClass =
  | "no-matching-experiment"
  | "measurement-unavailable"
  | "not-comparable"
  | "partial-or-extrapolation";

const OBJECTIVE_HINTS: Record<ResearchObjective, string[]> = {
  "solid-material-flammability": ["Saffire", "BASS-II", "ACME-BRE"],
  "flame-spread": ["Saffire", "BASS-II", "ACME-BRE"],
  "extinction-suppression": ["FLEX", "cool-flame"],
  "smoke-detection": ["SAME", "DAFT", "smoke-detection"],
  "detector-aerosol": ["SAME", "DAFT", "smoke-detection"],
  "oxygen-enriched-atmospheres": ["Saffire", "BASS-II"],
  "droplet-combustion": ["cool-flame", "FLEX"],
  "habitat-fire-safety": ["Saffire", "BASS-II", "FLEX", "SAME", "DAFT", "ACME", "ACME-BRE", "smoke-detection"],
};

export function citationMatchesObjective(citation: VerifiedCitation, objective: ResearchObjective): boolean {
  return OBJECTIVE_HINTS[objective].some(
    (token) => citation.indexHint === token || citation.indexHint.startsWith(`${token}`),
  );
}

export interface IndexedAssessment {
  klass: "no-matching-experiment" | "measurement-unavailable";
  summary: string;
  citations: VerifiedCitation[];
  caveat: string;
}

export function assessIndexedMetadata(
  scenario: MissionScenario,
  citations: VerifiedCitation[] = VERIFIED_CITATIONS,
): IndexedAssessment {
  const citationsForObjective = citations.filter((item) =>
    citationMatchesObjective(item, scenario.objective),
  );
  const caveat =
    "This describes the records indexed in IGNIS. It does not say NASA has never studied the question. PSI dataset files were not downloaded.";
  if (citationsForObjective.length === 0) {
    return {
      klass: "no-matching-experiment",
      summary: "No matching experiment is represented in the indexed subset.",
      citations: [],
      caveat,
    };
  }
  const extracted = citationsForObjective.filter((item) => item.measurementsExtracted);
  if (extracted.length === 0) {
    return {
      klass: "measurement-unavailable",
      summary: "An experiment exists but its required measurement is unavailable.",
      citations: citationsForObjective,
      caveat,
    };
  }
  return {
    klass: "measurement-unavailable",
    summary: "Extracted measurements are still incomplete for this scenario.",
    citations: citationsForObjective,
    caveat,
  };
}

function presentMeasurement(run: ExperimentalRun, objective: ResearchObjective): boolean {
  return OBJECTIVE_MEASUREMENTS[objective].some((type) =>
    run.measurements.some(
      (measurement) =>
        measurement.type === type && measurement.status === "present" && measurement.value != null,
    ),
  );
}

export function classifySyntheticRuns(
  scenario: MissionScenario,
  runs: ExperimentalRun[],
): { klass: EvidenceClass; summary: string } {
  const fuelRuns = runs.filter((run) => run.fuelCategory === scenario.fuelCategory);
  if (fuelRuns.length === 0) {
    return {
      klass: "no-matching-experiment",
      summary: "No matching experiment is represented in the indexed subset.",
    };
  }
  const withMeasurement = fuelRuns.filter((run) => presentMeasurement(run, scenario.objective));
  if (withMeasurement.length === 0) {
    return {
      klass: "measurement-unavailable",
      summary: "An experiment exists but its required measurement is unavailable.",
    };
  }
  const regime = gravityRegime(scenario.gravityG);
  const sameRegime = withMeasurement.filter((run) => gravityRegime(run.gravityG) === regime);
  const oxygenClose = (run: ExperimentalRun) =>
    run.oxygenConcentrationPct != null && Math.abs(run.oxygenConcentrationPct - scenario.oxygenPct) <= 2;
  if (sameRegime.length === 0) {
    const nearOxygen = withMeasurement.filter(oxygenClose);
    if (nearOxygen.length === 0) {
      return {
        klass: "not-comparable",
        summary: "Evidence exists but conditions are not comparable.",
      };
    }
    return {
      klass: "partial-or-extrapolation",
      summary: "Evidence is partial or involves extrapolation.",
    };
  }
  return {
    klass: "partial-or-extrapolation",
    summary:
      sameRegime.some(oxygenClose)
        ? "Evidence is partial or involves extrapolation."
        : "Evidence is partial or involves extrapolation.",
  };
}
