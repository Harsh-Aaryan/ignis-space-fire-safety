import { fuelsAreRelated, OBJECTIVE_MEASUREMENTS, RELATED_OBJECTIVES } from "@/lib/labels";
import type {
  ExperimentalRun,
  GravityRegime,
  Investigation,
  Measurement,
  MissionScenario,
  RankingWeights,
  ResearchObjective,
} from "@/types/domain";

export const DEFAULT_WEIGHTS: RankingWeights = {
  objectiveFuel: 0.3,
  oxygenPressure: 0.25,
  gravityAirflow: 0.2,
  measurementAvailability: 0.15,
  evidenceCompleteness: 0.1,
};

export const WEIGHT_LABELS: Record<keyof RankingWeights, string> = {
  objectiveFuel: "Objective and fuel match",
  oxygenPressure: "Oxygen and pressure similarity",
  gravityAirflow: "Gravity and airflow similarity",
  measurementAvailability: "Measurement availability",
  evidenceCompleteness: "Evidence completeness",
};

const CROSS_REGIME: Record<string, number> = {
  "microgravity|lunar": 0.35,
  "lunar|microgravity": 0.35,
  "microgravity|martian": 0.22,
  "martian|microgravity": 0.22,
  "microgravity|earth": 0.12,
  "earth|microgravity": 0.12,
  "lunar|martian": 0.4,
  "martian|lunar": 0.4,
  "lunar|earth": 0.18,
  "earth|lunar": 0.18,
  "martian|earth": 0.2,
  "earth|martian": 0.2,
  "microgravity|partial-other": 0.3,
  "partial-other|microgravity": 0.3,
  "lunar|partial-other": 0.45,
  "partial-other|lunar": 0.45,
  "martian|partial-other": 0.45,
  "partial-other|martian": 0.45,
  "earth|partial-other": 0.25,
  "partial-other|earth": 0.25,
};

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function gravityRegime(gravity: number | null): GravityRegime | null {
  if (gravity == null || Number.isNaN(gravity)) return null;
  if (gravity < 0.05) return "microgravity";
  if (gravity >= 0.1 && gravity <= 0.25) return "lunar";
  if (gravity >= 0.28 && gravity <= 0.55) return "martian";
  if (gravity >= 0.85) return "earth";
  return "partial-other";
}

export function gravitySimilarity(
  runGravity: number | null,
  scenarioGravity: number,
): number | null {
  const runRegime = gravityRegime(runGravity);
  const scenarioRegime = gravityRegime(scenarioGravity);
  if (runRegime == null || scenarioRegime == null || runGravity == null) return null;
  if (runRegime === scenarioRegime) {
    const span =
      runRegime === "microgravity" ? 0.05 : runRegime === "earth" ? 0.2 : 0.15;
    return clamp01(1 - Math.abs(runGravity - scenarioGravity) / span);
  }
  return CROSS_REGIME[`${runRegime}|${scenarioRegime}`] ?? 0.2;
}

export function oxygenSimilarity(
  runOxygen: number | null,
  scenarioOxygen: number,
): number | null {
  if (runOxygen == null) return null;
  return clamp01(1 - Math.abs(runOxygen - scenarioOxygen) / 15);
}

export function pressureSimilarity(
  runPressure: number | null,
  scenarioPressure: number,
): number | null {
  if (runPressure == null) return null;
  return clamp01(1 - Math.abs(runPressure - scenarioPressure) / 6);
}

export function airflowSimilarity(
  runAir: number | null,
  scenarioAir: number,
): number | null {
  if (runAir == null) return null;
  return clamp01(1 - Math.abs(runAir - scenarioAir) / 0.4);
}

function averagePresent(parts: Array<number | null>): number | null {
  const present = parts.filter((part): part is number => part != null);
  if (!present.length) return null;
  return present.reduce((sum, part) => sum + part, 0) / present.length;
}

function objectiveScore(
  investigation: Investigation,
  objective: ResearchObjective,
): number | null {
  if (!investigation.researchObjectives.length) return null;
  if (investigation.researchObjectives.includes(objective)) return 1;
  if (
    investigation.researchObjectives.some((item) =>
      RELATED_OBJECTIVES[objective].includes(item),
    )
  ) {
    return 0.42;
  }
  return 0;
}

export interface FactorScore {
  key: keyof RankingWeights;
  label: string;
  weight: number;
  effectiveWeight: number;
  score: number | null;
  excluded: boolean;
  notes: string[];
}

export interface RankedRun {
  run: ExperimentalRun;
  investigation: Investigation;
  relevance: number | null;
  factors: FactorScore[];
  matches: string[];
  mismatches: string[];
  limitations: string[];
}

function measurementFactor(
  run: ExperimentalRun,
  objective: ResearchObjective,
): { score: number | null; notes: string[] } {
  const required = OBJECTIVE_MEASUREMENTS[objective];
  const notes: string[] = [];
  let scored = 0;
  let total = 0;
  for (const type of required) {
    const measurement = run.measurements.find((item) => item.type === type);
    if (!measurement) {
      notes.push(
        `${type} is absent from the record and was excluded, not scored as zero.`,
      );
      continue;
    }
    scored += 1;
    if (measurement.status === "present" && measurement.value != null) {
      total += 1;
    } else if (measurement.status === "incomplete") {
      total += 0.4;
      notes.push(
        `${type} is incomplete. The partial credit is not a measured result.`,
      );
    } else {
      notes.push(
        `${type} is explicitly missing. That is a data gap, not a negative experimental result.`,
      );
    }
  }
  if (scored === 0) return { score: null, notes };
  return { score: total / scored, notes };
}

export function evidenceCompletenessScore(run: ExperimentalRun): {
  score: number;
  notes: string[];
} {
  const fields = [
    ["oxygen", run.oxygenConcentrationPct],
    ["pressure", run.pressurePsi],
    ["gravity", run.gravityG],
    ["airflow", run.airflowVelocityMs],
    ["material", run.fuelMaterial],
    ["geometry", run.sampleGeometry],
  ] as const;
  const filled = fields.filter(([, value]) => value != null && value !== "").length;
  const present = run.measurements.filter(
    (measurement) =>
      measurement.status === "present" && measurement.uncertainty != null,
  ).length;
  const measurementScore =
    run.measurements.length === 0 ? 0 : present / run.measurements.length;
  const label =
    run.evidenceCompleteness === "complete"
      ? 1
      : run.evidenceCompleteness === "partial"
        ? 0.6
        : 0.3;
  const notes = fields
    .filter(([, value]) => value == null || value === "")
    .map(([name]) => `${name} is unreported and lowers completeness on purpose.`);
  return {
    score: clamp01((filled / fields.length) * 0.5 + measurementScore * 0.3 + label * 0.2),
    notes,
  };
}

export function scoreRun(
  run: ExperimentalRun,
  investigation: Investigation,
  scenario: MissionScenario,
  weights: RankingWeights = DEFAULT_WEIGHTS,
): RankedRun {
  const objective = objectiveScore(investigation, scenario.objective);
  const fuel = fuelsAreRelated(run.fuelCategory, scenario.fuelCategory)
    ? run.fuelCategory === scenario.fuelCategory
      ? 1
      : 0.48
    : 0;
  const objectiveFuel = averagePresent([objective, fuel]);
  const oxygen = oxygenSimilarity(run.oxygenConcentrationPct, scenario.oxygenPct);
  const pressure = pressureSimilarity(run.pressurePsi, scenario.pressurePsi);
  const oxygenPressure = averagePresent([oxygen, pressure]);
  const gravity = gravitySimilarity(run.gravityG, scenario.gravityG);
  const airflow = airflowSimilarity(run.airflowVelocityMs, scenario.airflowMs);
  const gravityAirflow = averagePresent([gravity, airflow]);
  const measurement = measurementFactor(run, scenario.objective);
  const completeness = evidenceCompletenessScore(run);

  const notes: Record<keyof RankingWeights, string[]> = {
    objectiveFuel: [],
    oxygenPressure: [],
    gravityAirflow: [],
    measurementAvailability: measurement.notes,
    evidenceCompleteness: completeness.notes,
  };
  if (objective == null) notes.objectiveFuel.push("Investigation has no objective metadata.");
  if (oxygen == null) {
    notes.oxygenPressure.push(
      "Oxygen concentration is unreported and was excluded from this factor, not scored as 0%.",
    );
  }
  if (pressure == null) {
    notes.oxygenPressure.push(
      "Pressure is unreported and was excluded from this factor, not scored as 0 psi.",
    );
  }
  if (gravity == null) {
    notes.gravityAirflow.push(
      "Gravity is unreported and was excluded, not scored as 0 g.",
    );
  } else if (gravityRegime(run.gravityG) !== gravityRegime(scenario.gravityG)) {
    notes.gravityAirflow.push(
      `Gravity regime mismatch: run is ${gravityRegime(run.gravityG)}, scenario is ${gravityRegime(scenario.gravityG)}. Numerical proximity is not treated as equivalence.`,
    );
  }
  if (airflow == null) {
    notes.gravityAirflow.push(
      "Airflow is unreported and was excluded, not scored as 0 m/s.",
    );
  }

  const raw: Array<[keyof RankingWeights, number | null]> = [
    ["objectiveFuel", objectiveFuel],
    ["oxygenPressure", oxygenPressure],
    ["gravityAirflow", gravityAirflow],
    ["measurementAvailability", measurement.score],
    ["evidenceCompleteness", completeness.score],
  ];
  const includedWeight = raw.reduce(
    (sum, [key, score]) => (score == null ? sum : sum + weights[key]),
    0,
  );
  const factors: FactorScore[] = raw.map(([key, score]) => ({
    key,
    label: WEIGHT_LABELS[key],
    weight: weights[key],
    effectiveWeight:
      score == null || includedWeight === 0 ? 0 : weights[key] / includedWeight,
    score,
    excluded: score == null,
    notes: notes[key],
  }));
  const relevance =
    includedWeight === 0
      ? null
      : raw.reduce(
          (sum, [key, score]) =>
            score == null ? sum : sum + score * weights[key],
          0,
        ) / includedWeight;

  const matches: string[] = [];
  const mismatches: string[] = [];
  if (objective === 1) matches.push("Research objective matches the dossier.");
  else if (objective === 0) mismatches.push("Research objective does not match.");
  else if (objective != null) matches.push("Related research objective only.");
  if (run.fuelCategory === scenario.fuelCategory) matches.push("Fuel category matches.");
  else mismatches.push("Fuel category differs.");
  if (oxygen != null && oxygen >= 0.8) matches.push("Oxygen is close to the scenario.");
  if (oxygen != null && oxygen < 0.5) mismatches.push("Oxygen is far from the scenario.");
  if (gravity != null && gravityRegime(run.gravityG) !== gravityRegime(scenario.gravityG)) {
    mismatches.push("Gravity regime does not match the mission.");
  } else if (gravity != null) matches.push("Gravity regime matches.");
  const limitations = [
    "Relevance is a weighted similarity to the scenario. It is not a fire, ignition, or safety probability.",
    ...run.metadataGaps.map((gap) => `Record gap: ${gap}.`),
  ];
  return { run, investigation, relevance, factors, matches, mismatches, limitations };
}

export function measurementByType(
  run: ExperimentalRun,
  type: Measurement["type"],
): Measurement | undefined {
  return run.measurements.find((measurement) => measurement.type === type);
}
