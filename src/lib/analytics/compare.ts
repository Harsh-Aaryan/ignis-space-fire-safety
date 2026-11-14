import { gravityRegime } from "@/lib/ranking/score";
import type { ExperimentalRun, MeasurementType } from "@/types/domain";

export type ComparisonStatus = "unresolved" | "consistent" | "review";

export interface ComparisonResult {
  status: ComparisonStatus;
  reason: string;
  delta: number | null;
}

function measurementValue(run: ExperimentalRun, type: MeasurementType) {
  return run.measurements.find((item) => item.type === type);
}

/** Compare one measurement only when fuel, gravity regime, oxygen, and pressure are all reported and close. */
export function compareMeasurement(
  left: ExperimentalRun,
  right: ExperimentalRun,
  type: MeasurementType,
): ComparisonResult {
  if (left.fuelCategory !== right.fuelCategory) {
    return {
      status: "unresolved",
      reason: "Fuel categories differ, so the measurements are not compared.",
      delta: null,
    };
  }
  const leftGravity = gravityRegime(left.gravityG);
  const rightGravity = gravityRegime(right.gravityG);
  if (left.gravityG == null || right.gravityG == null || leftGravity == null || rightGravity == null) {
    return {
      status: "unresolved",
      reason: "Gravity is unreported on at least one row. It is not filled in as 0 g.",
      delta: null,
    };
  }
  if (leftGravity !== rightGravity) {
    return {
      status: "unresolved",
      reason: "Gravity regimes differ. A numeric gap would not show a contradiction.",
      delta: null,
    };
  }
  if (left.oxygenConcentrationPct == null || right.oxygenConcentrationPct == null) {
    return {
      status: "unresolved",
      reason: "Oxygen is unreported on at least one row.",
      delta: null,
    };
  }
  if (Math.abs(left.oxygenConcentrationPct - right.oxygenConcentrationPct) > 2) {
    return {
      status: "unresolved",
      reason: "Oxygen differs by more than 2 percentage points.",
      delta: null,
    };
  }
  if (left.pressurePsi == null || right.pressurePsi == null) {
    return {
      status: "unresolved",
      reason: "Pressure is unreported on at least one row.",
      delta: null,
    };
  }
  if (Math.abs(left.pressurePsi - right.pressurePsi) > 1.2) {
    return {
      status: "unresolved",
      reason: "Total pressure differs by more than 1.2 psi.",
      delta: null,
    };
  }
  const leftMeasurement = measurementValue(left, type);
  const rightMeasurement = measurementValue(right, type);
  if (
    !leftMeasurement ||
    !rightMeasurement ||
    leftMeasurement.value == null ||
    rightMeasurement.value == null ||
    leftMeasurement.status !== "present" ||
    rightMeasurement.status !== "present"
  ) {
    return {
      status: "unresolved",
      reason: "One or both measurements are missing. Missing is not a value of zero.",
      delta: null,
    };
  }
  if (leftMeasurement.uncertainty == null || rightMeasurement.uncertainty == null) {
    return {
      status: "unresolved",
      reason: "A reported uncertainty is missing, so the rows are not called contradictory.",
      delta: Math.abs(leftMeasurement.value - rightMeasurement.value),
    };
  }
  const delta = Math.abs(leftMeasurement.value - rightMeasurement.value);
  const band = leftMeasurement.uncertainty + rightMeasurement.uncertainty;
  if (delta > band) {
    return {
      status: "review",
      reason:
        "The values differ by more than the sum of the reported uncertainties under similar fuel, gravity, oxygen, and pressure. Flagged for review, not declared a contradiction.",
      delta,
    };
  }
  return {
    status: "consistent",
    reason: "The difference sits inside the combined reported uncertainty.",
    delta,
  };
}
