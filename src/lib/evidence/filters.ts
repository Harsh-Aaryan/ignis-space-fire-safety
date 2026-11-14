import { gravityRegime } from "@/lib/ranking/score";
import type {
  Completeness,
  ExperimentalRun,
  ExplorerFilters,
  FuelCategory,
  Investigation,
  MeasurementType,
} from "@/types/domain";

export const EMPTY_FILTERS: ExplorerFilters = {
  query: "",
  fuelCategories: [],
  gravityRegimes: [],
  oxygenMin: null,
  oxygenMax: null,
  pressureMin: null,
  pressureMax: null,
  airflowMin: null,
  airflowMax: null,
  hardware: [],
  objectives: [],
  measurementTypes: [],
  completeness: [],
  families: [],
};

export function filtersActive(filters: ExplorerFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.fuelCategories.length > 0 ||
    filters.gravityRegimes.length > 0 ||
    filters.oxygenMin != null ||
    filters.oxygenMax != null ||
    filters.pressureMin != null ||
    filters.pressureMax != null ||
    filters.airflowMin != null ||
    filters.airflowMax != null ||
    filters.hardware.length > 0 ||
    filters.objectives.length > 0 ||
    filters.measurementTypes.length > 0 ||
    filters.completeness.length > 0 ||
    filters.families.length > 0
  );
}

function inRange(
  value: number | null,
  min: number | null,
  max: number | null,
): "pass" | "fail" | "missing" {
  if (min == null && max == null) return "pass";
  if (value == null) return "missing";
  if (min != null && value < min) return "fail";
  if (max != null && value > max) return "fail";
  return "pass";
}

function hasMeasurement(run: ExperimentalRun, type: MeasurementType): boolean {
  return run.measurements.some(
    (measurement) =>
      measurement.type === type &&
      measurement.status === "present" &&
      measurement.value != null,
  );
}

export interface FilterResult {
  runs: ExperimentalRun[];
  withheldForMissing: number;
}

export function filterRuns(
  runs: ExperimentalRun[],
  investigations: Investigation[],
  filters: ExplorerFilters,
  includeMissing = false,
): FilterResult {
  const byId = new Map(investigations.map((item) => [item.id, item]));
  const query = filters.query.trim().toLowerCase();
  let withheldForMissing = 0;
  const filtered = runs.filter((run) => {
    const investigation = byId.get(run.investigationId);
    if (!investigation) return false;
    if (
      filters.families.length &&
      !filters.families.includes(investigation.family)
    ) {
      return false;
    }
    if (
      filters.hardware.length &&
      !filters.hardware.some((item) => investigation.hardware.includes(item))
    ) {
      return false;
    }
    if (
      filters.objectives.length &&
      !filters.objectives.some((item) =>
        investigation.researchObjectives.includes(item),
      )
    ) {
      return false;
    }
    if (
      filters.fuelCategories.length &&
      !filters.fuelCategories.includes(run.fuelCategory)
    ) {
      return false;
    }
    if (filters.gravityRegimes.length) {
      const regime = gravityRegime(run.gravityG);
      if (!regime || !filters.gravityRegimes.includes(regime)) return false;
    }
    if (filters.completeness.length && !filters.completeness.includes(run.evidenceCompleteness)) {
      return false;
    }
    if (
      filters.measurementTypes.length &&
      !filters.measurementTypes.every((type) => hasMeasurement(run, type))
    ) {
      return false;
    }
    const ranges = [
      inRange(run.oxygenConcentrationPct, filters.oxygenMin, filters.oxygenMax),
      inRange(run.pressurePsi, filters.pressureMin, filters.pressureMax),
      inRange(run.airflowVelocityMs, filters.airflowMin, filters.airflowMax),
    ];
    if (ranges.includes("fail")) return false;
    if (ranges.includes("missing")) {
      withheldForMissing += 1;
      if (!includeMissing) return false;
    }
    if (!query) return true;
    const haystack = [
      investigation.title,
      investigation.family,
      investigation.description,
      investigation.id,
      run.id,
      run.fuelMaterial,
      run.sampleGeometry,
      ...investigation.hardware,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
  return { runs: filtered, withheldForMissing };
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function catalogFacets(investigations: Investigation[], runs: ExperimentalRun[]) {
  return {
    families: uniqueSorted(investigations.map((item) => item.family)),
    hardware: uniqueSorted(investigations.flatMap((item) => item.hardware)),
    fuels: uniqueSorted(runs.map((run) => run.fuelCategory)) as FuelCategory[],
    completeness: ["complete", "partial", "sparse"] as Completeness[],
  };
}
