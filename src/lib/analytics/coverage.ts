import { gravityRegime } from "@/lib/ranking/score";
import { FUEL_LABEL, OBJECTIVE_MEASUREMENTS } from "@/lib/labels";
import type {
  ExperimentalRun,
  FuelCategory,
  Investigation,
  MissionScenario,
} from "@/types/domain";

export interface CoverageContribution {
  axis: string;
  weight: number;
  score: number;
  detail: string;
}

export interface CoverageReport {
  percent: number;
  formula: string;
  notASafetyProbability: true;
  contributions: CoverageContribution[];
  outOfDistribution: string[];
}

export interface HeatmapBin {
  id: string;
  label: string;
}

export interface HeatmapCell {
  x: string;
  y: string;
  xLabel: string;
  yLabel: string;
  count: number;
  completeCount: number;
  incompleteCount: number;
  status: "covered" | "partial" | "missing";
}

export interface Heatmap {
  xAxis: string;
  yAxis: string;
  xBins: HeatmapBin[];
  yBins: HeatmapBin[];
  cells: HeatmapCell[];
  unreported: number;
}

export const OXYGEN_BINS: Array<HeatmapBin & { min: number; max: number }> = [
  { id: "o2-21", label: "21%", min: 0, max: 22.5 },
  { id: "o2-24", label: "24%", min: 22.5, max: 25.5 },
  { id: "o2-27", label: "27%", min: 25.5, max: 28.5 },
  { id: "o2-30", label: "30%", min: 28.5, max: 31 },
  { id: "o2-32", label: "32%", min: 31, max: 33 },
  { id: "o2-34", label: "34%", min: 33, max: 36 },
  { id: "o2-38", label: "38%+", min: 36, max: 100 },
];

export const PRESSURE_BINS: Array<HeatmapBin & { min: number; max: number }> = [
  { id: "p-8", label: "≤9 psi", min: 0, max: 9.2 },
  { id: "p-10", label: "~10.2 psi", min: 9.2, max: 12 },
  { id: "p-14", label: "≥12 psi", min: 12, max: 100 },
];

export const AIRFLOW_BINS: Array<HeatmapBin & { min: number; max: number }> = [
  { id: "a-0", label: "0 m/s", min: -0.001, max: 0.02 },
  { id: "a-05", label: "0.05 m/s", min: 0.02, max: 0.1 },
  { id: "a-15", label: "0.15 m/s", min: 0.1, max: 0.22 },
  { id: "a-30", label: "0.30 m/s", min: 0.22, max: 0.4 },
  { id: "a-50", label: "≥0.40 m/s", min: 0.4, max: 10 },
];

const GRAVITY_BINS: HeatmapBin[] = [
  { id: "microgravity", label: "ISS ~0 g" },
  { id: "lunar", label: "Moon 0.165 g" },
  { id: "martian", label: "Mars 0.38 g" },
  { id: "earth", label: "Earth 1 g" },
];

function fuelRuns(runs: ExperimentalRun[], fuel: FuelCategory) {
  return runs.filter((run) => run.fuelCategory === fuel);
}

function complete(run: ExperimentalRun): boolean {
  return run.evidenceCompleteness === "complete";
}

export function computeCoverage(
  scenario: MissionScenario,
  runs: ExperimentalRun[],
): CoverageReport {
  const scoped = fuelRuns(runs, scenario.fuelCategory);
  const regime = gravityRegime(scenario.gravityG);
  const gravityHits = scoped.filter(
    (run) => gravityRegime(run.gravityG) === regime && complete(run),
  );
  const oxygenHits = scoped.filter(
    (run) =>
      run.oxygenConcentrationPct != null &&
      Math.abs(run.oxygenConcentrationPct - scenario.oxygenPct) <= 2 &&
      complete(run),
  );
  const pressureHits = scoped.filter(
    (run) =>
      run.pressurePsi != null &&
      Math.abs(run.pressurePsi - scenario.pressurePsi) <= 1.2 &&
      complete(run),
  );
  const airflowHits = scoped.filter(
    (run) =>
      run.airflowVelocityMs != null &&
      Math.abs(run.airflowVelocityMs - scenario.airflowMs) <= 0.1 &&
      complete(run),
  );
  const required = OBJECTIVE_MEASUREMENTS[scenario.objective];
  const measurementScores = required.map((type) => {
    const hits = scoped.filter((run) =>
      run.measurements.some(
        (measurement) =>
          measurement.type === type &&
          measurement.status === "present" &&
          measurement.value != null,
      ),
    );
    return Math.min(1, hits.length / 8);
  });
  const measurementScore = measurementScores.length
    ? measurementScores.reduce((sum, score) => sum + score, 0) /
      measurementScores.length
    : 0;
  const contributions: CoverageContribution[] = [
    {
      axis: "Gravity regime",
      weight: 0.35,
      score: Math.min(1, gravityHits.length / 4),
      detail: `${gravityHits.length} complete ${scenario.fuelCategory} runs in ${regime}. Target reference is 4. Unreported gravity is not counted as 0 g.`,
    },
    {
      axis: "Oxygen window (±2%)",
      weight: 0.25,
      score: Math.min(1, oxygenHits.length / 5),
      detail: `${oxygenHits.length} complete runs within 2 percentage points. Target reference is 5.`,
    },
    {
      axis: "Pressure window (±1.2 psi)",
      weight: 0.15,
      score: Math.min(1, pressureHits.length / 5),
      detail: `${pressureHits.length} complete runs within 1.2 psi. Target reference is 5.`,
    },
    {
      axis: "Airflow window (±0.1 m/s)",
      weight: 0.1,
      score: Math.min(1, airflowHits.length / 4),
      detail: `${airflowHits.length} complete runs within 0.1 m/s. Unreported airflow is excluded, not treated as still air.`,
    },
    {
      axis: "Required measurements",
      weight: 0.15,
      score: measurementScore,
      detail: `Mean availability of ${required.join(", ")} on ${scenario.fuelCategory} runs. Explicitly missing measurements are not negative results.`,
    },
  ];
  const percent =
    contributions.reduce((sum, item) => sum + item.weight * item.score, 0) * 100;
  const reportedOxygen = runs
    .map((run) => run.oxygenConcentrationPct)
    .filter((value): value is number => value != null);
  const reportedPressure = runs
    .map((run) => run.pressurePsi)
    .filter((value): value is number => value != null);
  const outOfDistribution: string[] = [];
  if (
    reportedOxygen.length &&
    (scenario.oxygenPct < Math.min(...reportedOxygen) ||
      scenario.oxygenPct > Math.max(...reportedOxygen))
  ) {
    outOfDistribution.push(
      "Scenario oxygen is outside the oxygen values reported in the synthetic catalog.",
    );
  }
  if (
    reportedPressure.length &&
    (scenario.pressurePsi < Math.min(...reportedPressure) ||
      scenario.pressurePsi > Math.max(...reportedPressure))
  ) {
    outOfDistribution.push(
      "Scenario pressure is outside the pressure values reported in the synthetic catalog.",
    );
  }
  if (regime === "lunar" || regime === "martian") {
    outOfDistribution.push(
      `No direct ${regime} combustion rows exist in this catalog. Microgravity and Earth rows do not fill that cell.`,
    );
  }
  return {
    percent,
    formula:
      "Envelope coverage = 100 × (0.35 gravity + 0.25 oxygen + 0.15 pressure + 0.10 airflow + 0.15 measurement availability), each term capped at 1. This is not a fire-safety probability.",
    notASafetyProbability: true,
    contributions,
    outOfDistribution,
  };
}

type Axis = "gravity" | "oxygen" | "pressure" | "airflow" | "fuel";

function binsFor(axis: Axis, runs: ExperimentalRun[]): HeatmapBin[] {
  if (axis === "gravity") return GRAVITY_BINS;
  if (axis === "oxygen") return OXYGEN_BINS;
  if (axis === "pressure") return PRESSURE_BINS;
  if (axis === "airflow") return AIRFLOW_BINS;
  const present = [...new Set(runs.map((run) => run.fuelCategory))];
  return present.map((fuel) => ({ id: fuel, label: FUEL_LABEL[fuel] }));
}

function locate(axis: Axis, run: ExperimentalRun): string | null {
  if (axis === "gravity") return gravityRegime(run.gravityG);
  if (axis === "fuel") return run.fuelCategory;
  const value =
    axis === "oxygen"
      ? run.oxygenConcentrationPct
      : axis === "pressure"
        ? run.pressurePsi
        : run.airflowVelocityMs;
  if (value == null) return null;
  const bins =
    axis === "oxygen" ? OXYGEN_BINS : axis === "pressure" ? PRESSURE_BINS : AIRFLOW_BINS;
  const bin = bins.find((item) => value >= item.min && value < item.max);
  return bin?.id ?? null;
}

export function buildHeatmap(
  runs: ExperimentalRun[],
  xAxis: Axis,
  yAxis: Axis,
): Heatmap {
  const xBins = binsFor(xAxis, runs);
  const yBins = binsFor(yAxis, runs);
  const cells: HeatmapCell[] = [];
  let unreported = 0;
  for (const y of yBins) {
    for (const x of xBins) {
      const matching = runs.filter((run) => {
        const xId = locate(xAxis, run);
        const yId = locate(yAxis, run);
        if (xId == null || yId == null) return false;
        return xId === x.id && yId === y.id;
      });
      const completeCount = matching.filter(complete).length;
      const incompleteCount = matching.length - completeCount;
      cells.push({
        x: x.id,
        y: y.id,
        xLabel: x.label,
        yLabel: y.label,
        count: matching.length,
        completeCount,
        incompleteCount,
        status:
          completeCount >= 2 ? "covered" : matching.length > 0 ? "partial" : "missing",
      });
    }
  }
  for (const run of runs) {
    if (locate(xAxis, run) == null || locate(yAxis, run) == null) unreported += 1;
  }
  return { xAxis, yAxis, xBins, yBins, cells, unreported };
}

export function highlightCell(
  scenario: MissionScenario,
  xAxis: Axis,
  yAxis: Axis,
): { x: string | null; y: string | null } {
  const probe = {
    gravityG: scenario.gravityG,
    oxygenConcentrationPct: scenario.oxygenPct,
    pressurePsi: scenario.pressurePsi,
    airflowVelocityMs: scenario.airflowMs,
    fuelCategory: scenario.fuelCategory,
  } as ExperimentalRun;
  return { x: locate(xAxis, probe), y: locate(yAxis, probe) };
}

export function investigationsTouching(
  investigations: Investigation[],
  runs: ExperimentalRun[],
): Investigation[] {
  const ids = new Set(runs.map((run) => run.investigationId));
  return investigations.filter((investigation) => ids.has(investigation.id));
}
