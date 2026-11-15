import { SAFFIRE_BENCHMARKS, type SaffireBenchmark } from "@/data/fire/options";
import { SAFFIRE_VI_NEIGHBOURHOOD, accuracyFor, testCoverage } from "./accuracy";
import { createFireState, stepFire, type FireInput } from "./model";

/**
 * Sensitivity comparisons that the published data can check (model 3.0.0).
 *
 * Only for a run near an actual Saffire VI test (accuracy.ts testCoverage) does the model
 * run ± perturbations of oxygen, pressure and airflow, kept inside that test's
 * neighbourhood. For each input the result says whether a pair of Saffire VI tests can
 * resolve the direction of the change: the pair must differ in that one factor only, and
 * by more than the published data disagree with themselves. Otherwise the answer is "not
 * resolvable from the data" (or "untested" when no pair varies the input at all). Away
 * from Saffire VI the function returns "not supported" and runs nothing.
 */

export type Support = "supported" | "contradicted" | "not resolvable" | "untested";

export interface SensitivityResult {
  parameter: "oxygen" | "pressure" | "airflow";
  label: string;
  unit: string;
  baseline: number;
  low: number | null;
  high: number | null;
  /** Change of peak heat release over the horizon, % of the baseline run. */
  hrrPct: { low: number | null; high: number | null };
  /** Change of cabin CO at the end of the horizon, % of the baseline run. */
  coPct: { low: number | null; high: number | null };
  hrrSupport: Support;
  coSupport: Support;
  evidence: string;
}

export type SensitivityReport =
  | { supported: true; horizonS: number; nearestTest: string; results: SensitivityResult[] }
  | { supported: false; reason: string; results: [] };

function outcome(input: FireInput, horizonS: number) {
  const s = createFireState(input);
  while (s.t < horizonS - 1e-9) stepFire(s, input, Math.min(1, horizonS - s.t));
  return { peak: s.peakHrrW, co: s.coPpm };
}

const change = (value: number, base: number) => (base > 0 ? (value / base - 1) * 100 : null);
const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Factors in which two Saffire VI tests differ beyond the neighbourhood tolerances. */
export function differingFactors(a: SaffireBenchmark, b: SaffireBenchmark) {
  const n = SAFFIRE_VI_NEIGHBOURHOOD;
  const factors: string[] = [];
  if (Math.abs(a.oxygenPct - b.oxygenPct) > n.oxygenPoints / 2) factors.push("oxygen");
  if (Math.abs(a.pressureKpa / b.pressureKpa - 1) > n.pressureFraction) factors.push("pressure");
  if (Math.abs(a.flowMs / b.flowMs - 1) > n.flowFraction) factors.push("airflow");
  if (a.sides !== b.sides && a.materialId === "pmma") factors.push("sides and thickness");
  if (Math.abs(a.widthM / b.widthM - 1) > n.sizeFraction || Math.abs(a.lengthM / b.lengthM - 1) > n.sizeFraction) factors.push("sample size");
  return factors;
}

/** Peak heat release per burning area and CO/CO₂ of a test. */
const perArea = (b: SaffireBenchmark) => (b.peakHeatW ?? b.avgHeatW!) / (b.widthM * b.lengthM * (b.materialId === "pmma" ? b.sides : 1));
const ratio = (b: SaffireBenchmark) => b.coRisePpm / b.co2RisePpm;

interface PairJudgement { support: Support; text: string }

/** Can this pair resolve the direction of `factor`? `modelUp` is the model's change for an
 * increase of the factor; `dataUp` the published change from the lower to the higher test. */
function judgePair(factor: string, lower: SaffireBenchmark, higher: SaffireBenchmark, modelUp: number | null, dataUp: number, bandPct: number, quantity: string): PairJudgement {
  const factors = differingFactors(lower, higher);
  const description = `${lower.id} → ${higher.id}: ${quantity} ${dataUp >= 0 ? "+" : ""}${dataUp.toFixed(0)} %`;
  if (factors.length !== 1 || factors[0] !== factor) return { support: "not resolvable", text: `${description}, but the two tests also differ in ${factors.filter((f) => f !== factor).join(" and ") || "other factors"}.` };
  if (Math.abs(dataUp) < bandPct) return { support: "not resolvable", text: `${description}, smaller than the ±${bandPct.toFixed(0)} % disagreement inside the published data.` };
  if (modelUp === null || Math.abs(modelUp) < 0.5) return { support: "not resolvable", text: `${description}; the model change is too small to compare.` };
  return { support: Math.sign(modelUp) === Math.sign(dataUp) ? "supported" : "contradicted", text: `${description}.` };
}

export function supportedSensitivities(input: FireInput, horizonS = 300): SensitivityReport {
  const coverage = testCoverage(input);
  if (coverage.kind !== "saffire-vi") {
    const reason = coverage.kind === "flight" ? `Conditions match flight test ${coverage.checkId}, which the model does not reproduce` : `${coverage.reason[0].toUpperCase()}${coverage.reason.slice(1)}`;
    return { supported: false, reason: `${reason}, so no published test pair can check a sensitivity here.`, results: [] };
  }
  const n = SAFFIRE_VI_NEIGHBOURHOOD;
  const row = SAFFIRE_BENCHMARKS.find((b) => b.id === coverage.rowId)!;
  const base = outcome(input, horizonS);
  const perturb = (key: "oxygenPct" | "pressureKpa" | "ventilationMs", lo: number, hi: number, step: number, relative: boolean) => {
    const value = input[key];
    const down = clampTo(relative ? value * (1 - step) : value - step, lo, hi), up = clampTo(relative ? value * (1 + step) : value + step, lo, hi);
    const run = (v: number) => (Math.abs(v - value) < 1e-9 ? null : outcome({ ...input, [key]: v }, horizonS));
    const a = run(down), b = run(up);
    return {
      low: a ? down : null, high: b ? up : null,
      hrrPct: { low: a ? change(a.peak, base.peak) : null, high: b ? change(b.peak, base.peak) : null },
      coPct: { low: a ? change(a.co, base.co) : null, high: b ? change(b.co, base.co) : null },
    };
  };
  const upward = (p: { low: number | null; high: number | null }) => p.high ?? (p.low === null ? null : -p.low);
  const hrrBand = accuracyFor("hrr").dataBand ?? 0, coBand = accuracyFor("coRatio").dataBand ?? 0;
  const sameMaterial = SAFFIRE_BENCHMARKS.filter((b) => b.materialId === row.materialId).sort((a, b) => a.oxygenPct - b.oxygenPct);
  const [lowerO2, higherO2] = [sameMaterial[0], sameMaterial[sameMaterial.length - 1]];
  const results: SensitivityResult[] = [];

  const o2 = perturb("oxygenPct", row.oxygenPct - n.oxygenPoints, row.oxygenPct + n.oxygenPoints, n.oxygenPoints, false);
  const o2Hrr = judgePair("oxygen", lowerO2, higherO2, upward(o2.hrrPct), (perArea(higherO2) / perArea(lowerO2) - 1) * 100, hrrBand, "peak heat release per burning area");
  const o2Co = judgePair("oxygen", lowerO2, higherO2, upward(o2.coPct), (ratio(higherO2) / ratio(lowerO2) - 1) * 100, coBand, "CO/CO₂");
  results.push({ parameter: "oxygen", label: "Oxygen", unit: "% O₂", baseline: input.oxygenPct, ...o2, hrrSupport: o2Hrr.support, coSupport: o2Co.support,
    evidence: `${o2Hrr.text} ${o2Co.text} The model holds CO/CO₂ constant above 21 % O₂, so its CO follows the burning rate.` });

  const p = perturb("pressureKpa", row.pressureKpa * (1 - n.pressureFraction), row.pressureKpa * (1 + n.pressureFraction), n.pressureFraction, true);
  const byPressure = [...sameMaterial].sort((a, b) => a.pressureKpa - b.pressureKpa);
  const pressureVaries = Math.abs(byPressure[byPressure.length - 1].pressureKpa / byPressure[0].pressureKpa - 1) > n.pressureFraction;
  const pHrr = pressureVaries ? judgePair("pressure", byPressure[0], byPressure[byPressure.length - 1], upward(p.hrrPct), (perArea(byPressure[byPressure.length - 1]) / perArea(byPressure[0]) - 1) * 100, hrrBand, "peak heat release per burning area") : null;
  results.push({ parameter: "pressure", label: "Pressure", unit: "kPa", baseline: input.pressureKpa, ...p, hrrSupport: pHrr?.support ?? "untested", coSupport: pHrr ? "not resolvable" : "untested",
    evidence: pHrr ? pHrr.text : `Both ${row.materialId === "pmma" ? "PMMA" : "SIBAL"} tests ran at nearly the same pressure; no published pair varies it.` });

  const u = perturb("ventilationMs", n.flowMs * (1 - n.flowFraction), n.flowMs * (1 + n.flowFraction), n.flowFraction, true);
  results.push({ parameter: "airflow", label: "Airflow", unit: "m/s", baseline: input.ventilationMs, ...u, hrrSupport: "untested", coSupport: "untested",
    evidence: "Every Saffire VI test started at 20 cm/s. BASS-II varied flow on 1–2 cm samples but reports no heat release, so the airflow sensitivity is not checked at cabin scale." });

  return { supported: true, horizonS, nearestTest: row.id, results };
}
