import { gravityRegime, scoreRun, DEFAULT_WEIGHTS } from "@/lib/ranking/score";
import {
  FUEL_LABEL,
  GAP_LABEL,
  MEASUREMENT_META,
  OBJECTIVE_LABEL,
  OBJECTIVE_MEASUREMENTS,
  REGIME_LABEL,
} from "@/lib/labels";
import type {
  EvidenceGap,
  ExperimentalRun,
  Investigation,
  MissionScenario,
  ResearchRecommendation,
} from "@/types/domain";

const MIN_SEVERITY = 0.35;

function gap(partial: EvidenceGap): EvidenceGap | null {
  if (partial.severity < MIN_SEVERITY) return null;
  return partial;
}

export function discoverGaps(
  scenario: MissionScenario,
  runs: ExperimentalRun[],
): EvidenceGap[] {
  const regime = gravityRegime(scenario.gravityG);
  const fuelRuns = runs.filter((run) => run.fuelCategory === scenario.fuelCategory);
  const regimeRuns = fuelRuns.filter((run) => gravityRegime(run.gravityG) === regime);
  const oxygenRuns = fuelRuns.filter(
    (run) =>
      run.oxygenConcentrationPct != null &&
      Math.abs(run.oxygenConcentrationPct - scenario.oxygenPct) <= 2,
  );
  const pressureRuns = fuelRuns.filter(
    (run) =>
      run.pressurePsi != null &&
      Math.abs(run.pressurePsi - scenario.pressurePsi) <= 1.2,
  );
  const airflowRuns = fuelRuns.filter(
    (run) =>
      run.airflowVelocityMs != null &&
      Math.abs(run.airflowVelocityMs - scenario.airflowMs) <= 0.1,
  );
  const found: Array<EvidenceGap | null> = [];
  const regimeLabel = regime ? REGIME_LABEL[regime] : "the selected gravity";
  found.push(
    gap({
      id: `gap-gravity-${regime ?? "unknown"}`,
      title: `No direct ${regimeLabel} measurements for ${FUEL_LABEL[scenario.fuelCategory]}`,
      dimension: "gravity",
      severity: regimeRuns.length === 0 ? 1 : regimeRuns.length < 3 ? 0.55 : 0,
      evidenceCount: regimeRuns.length,
      explanation:
        regimeRuns.length === 0
          ? `No ${regimeLabel} combustion rows for this fuel are in the catalog. Microgravity and Earth records cannot establish behavior at ${scenario.gravityG} g.`
          : `${regimeRuns.length} ${regimeLabel} rows exist for this fuel. The cell is thin relative to a 3-run reference.`,
      rule: "Severity is 1 when the fuel has zero runs in the scenario gravity regime, 0.55 when fewer than 3, otherwise no gap. Missing gravity is not counted as 0 g.",
      distinguishesMissingFromNegative:
        "An empty gravity cell means the condition was not represented. It does not mean a test showed the condition to be safe or unsafe.",
    }),
  );
  found.push(
    gap({
      id: "gap-oxygen-window",
      title: `Sparse oxygen coverage near ${scenario.oxygenPct.toFixed(1)}%`,
      dimension: "oxygen",
      severity: oxygenRuns.length === 0 ? 0.85 : oxygenRuns.length < 3 ? 0.5 : 0,
      evidenceCount: oxygenRuns.length,
      explanation: `${oxygenRuns.length} ${FUEL_LABEL[scenario.fuelCategory]} runs sit within 2 percentage points of ${scenario.oxygenPct.toFixed(1)}% oxygen. Runs with unreported oxygen are excluded from this count.`,
      rule: "Severity is 0.85 at zero nearby runs and 0.5 below 3 runs. Unreported oxygen is not treated as 0%.",
      distinguishesMissingFromNegative:
        "A sparse oxygen window is missing coverage, not a measured non-flammable result.",
    }),
  );
  found.push(
    gap({
      id: "gap-pressure-window",
      title: `Sparse pressure coverage near ${scenario.pressurePsi.toFixed(1)} psi`,
      dimension: "pressure",
      severity: pressureRuns.length === 0 ? 0.7 : pressureRuns.length < 3 ? 0.4 : 0,
      evidenceCount: pressureRuns.length,
      explanation: `${pressureRuns.length} runs of this fuel are within 1.2 psi of the scenario. Unreported pressure is excluded.`,
      rule: "Severity is 0.7 at zero nearby runs and 0.4 below 3 runs.",
      distinguishesMissingFromNegative:
        "Missing pressure metadata is not a result at 0 psi.",
    }),
  );
  found.push(
    gap({
      id: "gap-airflow-window",
      title: `Sparse airflow coverage near ${scenario.airflowMs.toFixed(2)} m/s`,
      dimension: "airflow",
      severity: airflowRuns.length === 0 ? 0.65 : airflowRuns.length < 3 ? 0.38 : 0,
      evidenceCount: airflowRuns.length,
      explanation: `${airflowRuns.length} runs of this fuel are within 0.1 m/s. Unreported airflow is excluded, not counted as still air.`,
      rule: "Severity is 0.65 at zero nearby runs and 0.38 below 3 runs.",
      distinguishesMissingFromNegative:
        "Unreported velocity is a metadata gap, not a quiescent-burn result.",
    }),
  );
  found.push(
    gap({
      id: `gap-fuel-${scenario.fuelCategory}`,
      title: `${FUEL_LABEL[scenario.fuelCategory]} is underrepresented`,
      dimension: "fuel",
      severity: fuelRuns.length < 4 ? 0.8 : fuelRuns.length < 8 ? 0.45 : 0,
      evidenceCount: fuelRuns.length,
      explanation: `${fuelRuns.length} synthetic runs use ${FUEL_LABEL[scenario.fuelCategory]}. The reference for a represented fuel is 8 runs.`,
      rule: "Severity is 0.8 below 4 runs and 0.45 below 8 runs.",
      distinguishesMissingFromNegative:
        "A small fuel count means the catalog barely includes it. It is not a pass/fail material rating.",
    }),
  );
  for (const type of OBJECTIVE_MEASUREMENTS[scenario.objective]) {
    const available = fuelRuns.filter((run) =>
      run.measurements.some(
        (measurement) =>
          measurement.type === type &&
          measurement.status === "present" &&
          measurement.value != null,
      ),
    );
    const fraction = fuelRuns.length === 0 ? 0 : available.length / fuelRuns.length;
    found.push(
      gap({
        id: `gap-measurement-${type}`,
        title: `${MEASUREMENT_META[type].label} is thinly recorded`,
        dimension: "measurement",
        severity: fraction < 0.35 ? 0.75 : fraction < 0.55 ? 0.4 : 0,
        evidenceCount: available.length,
        explanation: `${available.length} of ${fuelRuns.length} ${FUEL_LABEL[scenario.fuelCategory]} runs report ${MEASUREMENT_META[type].label} as present. Explicitly missing entries stay missing; they are not zeros.`,
        rule: "Severity is 0.75 when fewer than 35% of fuel runs report the measurement, and 0.4 below 55%.",
        distinguishesMissingFromNegative: `A missing ${MEASUREMENT_META[type].label} is not a measured value of zero ${MEASUREMENT_META[type].unit}.`,
      }),
    );
  }
  const messy = fuelRuns.filter((run) => run.metadataGaps.length > 0);
  const messyFraction = fuelRuns.length === 0 ? 0 : messy.length / fuelRuns.length;
  found.push(
    gap({
      id: "gap-metadata",
      title: "Incomplete condition metadata",
      dimension: "metadata",
      severity: messyFraction > 0.45 ? 0.6 : messyFraction > 0.25 ? 0.36 : 0,
      evidenceCount: messy.length,
      explanation: `${messy.length} of ${fuelRuns.length} ${FUEL_LABEL[scenario.fuelCategory]} runs have at least one unreported field or incomplete measurement.`,
      rule: "Severity is 0.6 above 45% incomplete rows and 0.36 above 25%.",
      distinguishesMissingFromNegative:
        "Incomplete metadata is unknown information, not a negative test outcome.",
    }),
  );
  return found
    .filter((item): item is EvidenceGap => item != null)
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
}

const MISSION_RELEVANCE: Record<EvidenceGap["dimension"], number> = {
  gravity: 1,
  measurement: 0.9,
  oxygen: 0.85,
  fuel: 0.8,
  pressure: 0.7,
  airflow: 0.65,
  metadata: 0.4,
};

const USEFULNESS: Record<EvidenceGap["dimension"], number> = {
  gravity: 0.95,
  measurement: 0.82,
  oxygen: 0.74,
  fuel: 0.7,
  pressure: 0.62,
  airflow: 0.6,
  metadata: 0.45,
};

const FEASIBILITY: Record<EvidenceGap["dimension"], number> = {
  gravity: 0.46,
  measurement: 0.78,
  oxygen: 0.72,
  fuel: 0.58,
  pressure: 0.7,
  airflow: 0.68,
  metadata: 0.84,
};

function relatedInvestigations(
  gapItem: EvidenceGap,
  scenario: MissionScenario,
  investigations: Investigation[],
  runs: ExperimentalRun[],
): string[] {
  return investigations
    .map((investigation) => {
      const own = runs.filter((run) => run.investigationId === investigation.id);
      const best = own.reduce<number>((max, run) => {
        const score = scoreRun(run, investigation, scenario, DEFAULT_WEIGHTS).relevance ?? 0;
        return Math.max(max, score);
      }, 0);
      const fuel = investigation.fuelCategories.includes(scenario.fuelCategory) ? 0.2 : 0;
      const objective = investigation.researchObjectives.includes(scenario.objective)
        ? 0.3
        : 0;
      const gravityBoost = gapItem.dimension === "gravity" ? 0.1 : 0;
      return { id: investigation.id, score: best + fuel + objective + gravityBoost };
    })
    .filter((item) => item.score > 0.2)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((item) => item.id);
}

function titleFor(gapItem: EvidenceGap, scenario: MissionScenario): string {
  const regime = gravityRegime(scenario.gravityG);
  const solid =
    scenario.fuelCategory === "solid-polymer" ||
    scenario.fuelCategory === "solid-fabric" ||
    scenario.fuelCategory === "solid-composite" ||
    scenario.fuelCategory === "paper-cellulose";
  if (gapItem.dimension === "gravity" && regime === "lunar" && solid) {
    return "Oxygen-Enriched Solid-Material Flammability Under Lunar Gravity";
  }
  if (gapItem.dimension === "gravity" && regime === "martian") {
    return "Partial-Gravity Combustion Behavior for a Martian Habitat Atmosphere";
  }
  if (gapItem.dimension === "gravity" && regime === "lunar") {
    return "Lunar-Gravity Evidence for the Selected Fuel and Objective";
  }
  if (
    gapItem.dimension === "measurement" &&
    scenario.objective === "smoke-detection"
  ) {
    return "Smoke Measurement Coverage for a Spacecraft Atmosphere";
  }
  return `${GAP_LABEL[gapItem.dimension]} gap for ${OBJECTIVE_LABEL[scenario.objective]}`;
}

function questionFor(gapItem: EvidenceGap, scenario: MissionScenario): string {
  const regime = gravityRegime(scenario.gravityG);
  if (
    gapItem.dimension === "gravity" &&
    regime === "lunar" &&
    (scenario.fuelCategory === "solid-polymer" ||
      scenario.fuelCategory === "solid-fabric" ||
      scenario.fuelCategory === "solid-composite")
  ) {
    return "How does oxygen-enriched solid-material flammability at lunar gravity differ from the microgravity and Earth rows already represented?";
  }
  if (gapItem.dimension === "gravity" && regime === "martian") {
    return "Which partial-gravity measurements would be required before Martian habitat atmospheres can be compared with the existing catalog?";
  }
  return `What new ${GAP_LABEL[gapItem.dimension].toLowerCase()} records would make ${OBJECTIVE_LABEL[scenario.objective].toLowerCase()} comparable to this scenario?`;
}

export function buildRecommendations(
  scenario: MissionScenario,
  runs: ExperimentalRun[],
  investigations: Investigation[],
  gaps: EvidenceGap[] = discoverGaps(scenario, runs),
): ResearchRecommendation[] {
  return gaps.slice(0, 5).map((gapItem) => {
    const related = relatedInvestigations(gapItem, scenario, investigations, runs);
    const existingRelated = Math.min(1, related.length / 3);
    const factors = [
      {
        key: "gapSize",
        label: "Gap size",
        score: gapItem.severity,
        weight: 0.3,
        note: `Taken from the coverage rule for ${gapItem.dimension}. Evidence count: ${gapItem.evidenceCount}.`,
      },
      {
        key: "missionRelevance",
        label: "Mission relevance",
        score: MISSION_RELEVANCE[gapItem.dimension],
        weight: 0.25,
        note: "Gravity gaps outrank metadata gaps because the mission gravity is not represented.",
      },
      {
        key: "scientificUsefulness",
        label: "Scientific usefulness",
        score: USEFULNESS[gapItem.dimension],
        weight: 0.2,
        note: "Higher when the missing cell blocks comparison for this objective.",
      },
      {
        key: "existingRelated",
        label: "Existing related research",
        score: existingRelated,
        weight: 0.15,
        note: `${related.length} nearby dossiers can anchor a follow-on study. They do not close the gap.`,
      },
      {
        key: "feasibility",
        label: "Feasibility",
        score: FEASIBILITY[gapItem.dimension],
        weight: 0.1,
        note:
          gapItem.dimension === "gravity"
            ? "Partial-gravity tests need a facility beyond the represented drop/ISS-style rows. This is a consideration, not a cost estimate."
            : "Adjacent conditions already appear in the synthetic hardware stand-ins.",
      },
    ];
    const priorityScore = factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0,
    );
    const lunarSolid =
      gapItem.dimension === "gravity" &&
      gravityRegime(scenario.gravityG) === "lunar" &&
      (scenario.fuelCategory === "solid-polymer" ||
        scenario.fuelCategory === "solid-fabric" ||
        scenario.fuelCategory === "solid-composite");
    return {
      id: `rec-${gapItem.id}`,
      title: titleFor(gapItem, scenario),
      researchQuestion: questionFor(gapItem, scenario),
      suggestedConditions: `${scenario.oxygenPct.toFixed(1)}% oxygen, ${scenario.pressurePsi.toFixed(1)} psi, ${scenario.gravityG} g, airflow ${scenario.airflowMs.toFixed(2)} m/s, fuel ${FUEL_LABEL[scenario.fuelCategory]}.`,
      gapExplanation: lunarSolid
        ? "Available microgravity investigations inform solid-material combustion behavior, but direct partial-gravity measurements are missing from the represented evidence. Additional experiments under lunar gravity and selected oxygen-enriched conditions could help characterize differences."
        : gapItem.explanation,
      relatedInvestigationIds: related,
      expectedValue: lunarSolid
        ? "A lunar-gravity series would show whether the oxygen trend in the synthetic microgravity rows still holds at 0.165 g. It would not, by itself, certify a habitat."
        : `Closing this ${gapItem.dimension} gap would make the ${OBJECTIVE_LABEL[scenario.objective].toLowerCase()} comparison less dependent on cross-regime inference.`,
      feasibilityNote: factors[4].note,
      priorityScore,
      factors,
      limitations:
        "Proposed experiment only. Priority is a transparent heuristic over synthetic gaps. It is not a safety ranking and not a funded research plan.",
      synthetic: true,
      gapId: gapItem.id,
    };
  });
}
