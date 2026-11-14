import type { VerifiedCitation } from "@/data/verified";
import type { ExperimentalRun } from "@/types/domain";

export interface RegressionPoint {
  x: number;
  y: number;
  group: string;
}

export interface Interval {
  low: number;
  high: number;
  estimate: number;
}

export interface RegressionFit {
  intercept: number;
  slope: number;
  n: number;
  residualStd: number;
  rSquared: number;
  groups: string[];
}

export type PredictionStatus = "insufficient" | "baseline";

export interface PredictionReport {
  status: PredictionStatus;
  message: string;
  method: string | null;
  target: string;
  fit: RegressionFit | null;
  confidenceInterval: Interval | null;
  predictionInterval: Interval | null;
  holdoutMae: number | null;
  holdoutGroup: string | null;
  synthetic: boolean;
  outsideObservedRange: boolean;
}

const INSUFFICIENT = "Insufficient experimental evidence for reliable prediction.";

/** Two-sided 97.5% Student-t critical values, df = n - 2. */
const T_975: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  12: 2.179,
  15: 2.131,
  20: 2.086,
  30: 2.042,
  60: 2.0,
  120: 1.98,
};

export function studentT975(df: number): number {
  if (df <= 0) return Number.POSITIVE_INFINITY;
  if (T_975[df]) return T_975[df];
  const keys = Object.keys(T_975)
    .map(Number)
    .sort((a, b) => a - b);
  const lower = [...keys].reverse().find((key) => key <= df);
  const upper = keys.find((key) => key >= df);
  if (lower == null) return T_975[keys[0]];
  if (upper == null || upper === lower) return T_975[lower];
  const span = (df - lower) / (upper - lower);
  return T_975[lower] + (T_975[upper] - T_975[lower]) * span;
}

export function fitLine(points: RegressionPoint[]): RegressionFit | null {
  if (points.length < 3) return null;
  const n = points.length;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / n;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const point of points) {
    sxx += (point.x - xMean) ** 2;
    sxy += (point.x - xMean) * (point.y - yMean);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  let sst = 0;
  for (const point of points) {
    const fitted = intercept + slope * point.x;
    sse += (point.y - fitted) ** 2;
    sst += (point.y - yMean) ** 2;
  }
  const df = n - 2;
  const residualStd = Math.sqrt(sse / df);
  return {
    intercept,
    slope,
    n,
    residualStd,
    rSquared: sst === 0 ? 1 : 1 - sse / sst,
    groups: [...new Set(points.map((point) => point.group))],
  };
}

export function meanConfidenceInterval(fit: RegressionFit, points: RegressionPoint[], x0: number): Interval {
  const estimate = fit.intercept + fit.slope * x0;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const sxx = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  const leverage = 1 / fit.n + (sxx === 0 ? 0 : (x0 - xMean) ** 2 / sxx);
  const half = studentT975(fit.n - 2) * fit.residualStd * Math.sqrt(leverage);
  return { estimate, low: estimate - half, high: estimate + half };
}

export function observationPredictionInterval(
  fit: RegressionFit,
  points: RegressionPoint[],
  x0: number,
): Interval {
  const mean = meanConfidenceInterval(fit, points, x0);
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const sxx = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  const leverage = 1 + 1 / fit.n + (sxx === 0 ? 0 : (x0 - xMean) ** 2 / sxx);
  const half = studentT975(fit.n - 2) * fit.residualStd * Math.sqrt(leverage);
  return { estimate: mean.estimate, low: mean.estimate - half, high: mean.estimate + half };
}

export function holdOutGroup(points: RegressionPoint[], group: string): {
  train: RegressionPoint[];
  test: RegressionPoint[];
} {
  return {
    train: points.filter((point) => point.group !== group),
    test: points.filter((point) => point.group === group),
  };
}

export function meanAbsoluteError(fit: RegressionFit, points: RegressionPoint[]): number | null {
  if (!points.length) return null;
  const total = points.reduce((sum, point) => {
    const predicted = fit.intercept + fit.slope * point.x;
    return sum + Math.abs(predicted - point.y);
  }, 0);
  return total / points.length;
}

export function assessVerifiedPrediction(citations: VerifiedCitation[]): PredictionReport {
  const extracted = citations.filter((item) => item.measurementsExtracted);
  return {
    status: "insufficient",
    message: INSUFFICIENT,
    method: null,
    target: "none",
    fit: null,
    confidenceInterval: null,
    predictionInterval: null,
    holdoutMae: null,
    holdoutGroup: null,
    synthetic: false,
    outsideObservedRange: true,
    ...(extracted.length === 0
      ? {}
      : {
          message: `${INSUFFICIENT} Indexed records still do not form one compatible numeric series.`,
        }),
  };
}

function reportFromPoints(
  points: RegressionPoint[],
  x0: number,
  target: string,
): PredictionReport {
  const groups = [...new Set(points.map((point) => point.group))];
  if (points.length < 8 || groups.length < 2) {
    return {
      status: "insufficient",
      message: INSUFFICIENT,
      method: null,
      target,
      fit: null,
      confidenceInterval: null,
      predictionInterval: null,
      holdoutMae: null,
      holdoutGroup: null,
      synthetic: true,
      outsideObservedRange: true,
    };
  }
  const holdoutGroupId = groups[groups.length - 1];
  const split = holdOutGroup(points, holdoutGroupId);
  const fit = fitLine(split.train);
  if (!fit || fit.groups.includes(holdoutGroupId)) {
    return {
      status: "insufficient",
      message: INSUFFICIENT,
      method: null,
      target,
      fit: null,
      confidenceInterval: null,
      predictionInterval: null,
      holdoutMae: null,
      holdoutGroup: holdoutGroupId,
      synthetic: true,
      outsideObservedRange: true,
    };
  }
  const xs = split.train.map((point) => point.x);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return {
    status: "baseline",
    message:
      "Synthetic demonstration only. These flame-spread numbers were generated for the mock catalog. A tight fit is not a NASA result.",
    method: "Ordinary least squares of synthetic flame-spread rate on oxygen, with one investigation held out.",
    target,
    fit,
    confidenceInterval: meanConfidenceInterval(fit, split.train, x0),
    predictionInterval: observationPredictionInterval(fit, split.train, x0),
    holdoutMae: meanAbsoluteError(fit, split.test),
    holdoutGroup: holdoutGroupId,
    synthetic: true,
    outsideObservedRange: x0 < min || x0 > max,
  };
}

export function syntheticFlameSpreadDemo(runs: ExperimentalRun[], oxygenPct: number): PredictionReport {
  const points: RegressionPoint[] = [];
  for (const run of runs) {
    if (run.provenance !== "synthetic-demonstration") continue;
    if (run.oxygenConcentrationPct == null) continue;
    if (run.fuelCategory !== "solid-polymer") continue;
    const measurement = run.measurements.find(
      (item) => item.type === "flame-spread-rate" && item.status === "present" && item.value != null,
    );
    if (!measurement || measurement.value == null) continue;
    points.push({
      x: run.oxygenConcentrationPct,
      y: measurement.value,
      group: run.investigationId,
    });
  }
  return reportFromPoints(points, oxygenPct, "synthetic flame-spread rate");
}

export const INSUFFICIENT_PREDICTION = INSUFFICIENT;
