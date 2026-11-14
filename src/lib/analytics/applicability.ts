import { gravityRegime, scoreRun } from "@/lib/ranking/score";
import { FUEL_LABEL, MEASUREMENT_META, REGIME_LABEL } from "@/lib/labels";
import type {
  ExperimentalRun,
  Investigation,
  MissionScenario,
  RankingWeights,
} from "@/types/domain";

export interface NearestRun {
  run: ExperimentalRun;
  investigation: Investigation;
  distance: number;
  excludedDimensions: string[];
  relevance: number | null;
}

export interface ApplicabilityReport {
  nearest: NearestRun[];
  outside: string[];
  gravityMismatch: string;
  missingMeasurements: string[];
  transferLimits: string[];
}

function dimensionDistance(
  label: string,
  value: number | null,
  target: number,
  scale: number,
): { distance: number | null; missing: boolean } {
  if (value == null) return { distance: null, missing: true };
  return { distance: Math.abs(value - target) / scale, missing: false };
}

export function analyzeApplicability(
  scenario: MissionScenario,
  runs: ExperimentalRun[],
  investigations: Investigation[],
  weights: RankingWeights,
): ApplicabilityReport {
  const byId = new Map(investigations.map((item) => [item.id, item]));
  const nearest = runs
    .map((run) => {
      const investigation = byId.get(run.investigationId);
      if (!investigation) return null;
      const parts = [
        dimensionDistance("oxygen", run.oxygenConcentrationPct, scenario.oxygenPct, 15),
        dimensionDistance("pressure", run.pressurePsi, scenario.pressurePsi, 6),
        dimensionDistance("airflow", run.airflowVelocityMs, scenario.airflowMs, 0.4),
      ];
      const gravity = gravityRegime(run.gravityG);
      const scenarioRegime = gravityRegime(scenario.gravityG);
      const excludedDimensions: string[] = [];
      if (run.oxygenConcentrationPct == null) excludedDimensions.push("oxygen");
      if (run.pressurePsi == null) excludedDimensions.push("pressure");
      if (run.airflowVelocityMs == null) excludedDimensions.push("airflow");
      if (run.gravityG == null) excludedDimensions.push("gravity");
      const numeric = parts
        .map((part) => part.distance)
        .filter((part): part is number => part != null);
      const gravityDistance =
        gravity == null || scenarioRegime == null
          ? null
          : gravity === scenarioRegime
            ? 0
            : 1;
      if (gravityDistance != null) numeric.push(gravityDistance);
      if (!numeric.length) return null;
      const distance = numeric.reduce((sum, part) => sum + part, 0) / numeric.length;
      const relevance = scoreRun(run, investigation, scenario, weights).relevance;
      return {
        run,
        investigation,
        distance,
        excludedDimensions,
        relevance,
      } satisfies NearestRun;
    })
    .filter((item): item is NearestRun => item != null)
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        (b.relevance ?? -1) - (a.relevance ?? -1) ||
        a.run.id.localeCompare(b.run.id),
    )
    .slice(0, 5);

  const fuelRuns = runs.filter((run) => run.fuelCategory === scenario.fuelCategory);
  const oxygen = fuelRuns
    .map((run) => run.oxygenConcentrationPct)
    .filter((value): value is number => value != null);
  const pressure = fuelRuns
    .map((run) => run.pressurePsi)
    .filter((value): value is number => value != null);
  const airflow = fuelRuns
    .map((run) => run.airflowVelocityMs)
    .filter((value): value is number => value != null);
  const outside: string[] = [];
  if (oxygen.length && (scenario.oxygenPct < Math.min(...oxygen) || scenario.oxygenPct > Math.max(...oxygen))) {
    outside.push(
      `Oxygen ${scenario.oxygenPct}% is outside the ${FUEL_LABEL[scenario.fuelCategory]} range in the catalog (${Math.min(...oxygen)}–${Math.max(...oxygen)}%).`,
    );
  }
  if (pressure.length && (scenario.pressurePsi < Math.min(...pressure) || scenario.pressurePsi > Math.max(...pressure))) {
    outside.push(
      `Pressure ${scenario.pressurePsi} psi is outside the reported ${FUEL_LABEL[scenario.fuelCategory]} range (${Math.min(...pressure)}–${Math.max(...pressure)} psi).`,
    );
  }
  if (airflow.length && (scenario.airflowMs < Math.min(...airflow) || scenario.airflowMs > Math.max(...airflow))) {
    outside.push(
      `Airflow ${scenario.airflowMs} m/s is outside the reported range (${Math.min(...airflow)}–${Math.max(...airflow)} m/s).`,
    );
  }
  const regime = gravityRegime(scenario.gravityG);
  const regimeCount = fuelRuns.filter((run) => gravityRegime(run.gravityG) === regime).length;
  const gravityMismatch =
    regimeCount === 0
      ? `No ${regime ? REGIME_LABEL[regime] : "matching"} rows exist for ${FUEL_LABEL[scenario.fuelCategory]}. The nearest rows come from a different gravity regime and do not transfer automatically.`
      : `${regimeCount} rows share the ${regime ? REGIME_LABEL[regime] : "scenario"} regime for this fuel.`;
  const requiredTypes = new Map<string, number>();
  for (const item of nearest) {
    for (const measurement of item.run.measurements) {
      if (measurement.status !== "present" || measurement.value == null) {
        requiredTypes.set(
          measurement.type,
          (requiredTypes.get(measurement.type) ?? 0) + 1,
        );
      }
    }
  }
  const missingMeasurements = [...requiredTypes.entries()].map(
    ([type, count]) =>
      `${MEASUREMENT_META[type as keyof typeof MEASUREMENT_META]?.label ?? type} is explicitly missing or incomplete on ${count} of the nearest rows. That is not a zero measurement.`,
  );
  return {
    nearest,
    outside,
    gravityMismatch,
    missingMeasurements,
    transferLimits: [
      "Closest rows are a condition match inside the synthetic catalog, not a validated scaling law.",
      "Partial-gravity behavior is not interpolated from ISS and Earth rows.",
      ...outside,
    ],
  };
}

export interface OxygenSketch {
  withheld: boolean;
  reason: string;
  assumptions: string[];
  microgravity: { slope: number; intercept: number; n: number } | null;
  earth: { slope: number; intercept: number; n: number } | null;
  withheldBlend: number | null;
}

function fit(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return null;
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, n };
}

export function illustrativeOxygenSketch(
  runs: ExperimentalRun[],
  scenario: MissionScenario,
): OxygenSketch {
  const points = (regime: "microgravity" | "earth") =>
    runs
      .filter((run) => gravityRegime(run.gravityG) === regime)
      .map((run) => {
        const spread = run.measurements.find(
          (measurement) => measurement.type === "flame-spread-rate",
        );
        if (
          run.oxygenConcentrationPct == null ||
          !spread ||
          spread.status !== "present" ||
          spread.value == null
        ) {
          return null;
        }
        return { x: run.oxygenConcentrationPct, y: spread.value };
      })
      .filter((point): point is { x: number; y: number } => point != null);
  const microgravity = fit(points("microgravity"));
  const earth = fit(points("earth"));
  const regime = gravityRegime(scenario.gravityG);
  const withheld = regime === "lunar" || regime === "martian" || regime === "partial-other";
  let withheldBlend: number | null = null;
  if (microgravity && earth) {
    const y0 = microgravity.slope * scenario.oxygenPct + microgravity.intercept;
    const y1 = earth.slope * scenario.oxygenPct + earth.intercept;
    withheldBlend = (y0 + y1) / 2;
  }
  return {
    withheld,
    reason: withheld
      ? "No anchor points exist in the scenario gravity regime. A line drawn through the gap would be an unsupported extrapolation, so the numeric blend is withheld from use."
      : "The scenario gravity is represented. The fit still describes only the synthetic spread index, not a combustion model.",
    assumptions: [
      "Ordinary least squares on synthetic flame-spread rate versus oxygen.",
      "Microgravity and Earth are fit separately.",
      "Null and explicitly missing spread values are dropped, not filled with zero.",
      "The fit is a statistical illustration of this catalog.",
    ],
    microgravity,
    earth,
    withheldBlend: withheld ? withheldBlend : null,
  };
}
