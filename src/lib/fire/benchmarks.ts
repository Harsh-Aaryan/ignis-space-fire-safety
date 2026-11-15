import { materialById, type FireMaterial } from "@/data/fire/materials";
import { BASS_II_CO_RATIOS, FLIGHT_OBSERVATIONS, SAFFIRE_BENCHMARKS, SAFFIRE_IV_VI_EMISSION, SAFFIRE_VI3_SMOKE_TIMELINE, type FlightObservation, type SaffireBenchmark } from "@/data/fire/options";
import { cfastComparisons } from "@/lib/fire/cfast";
import { CALIBRATED_COEFFICIENTS } from "@/data/fire/parameters";
import { fuelElements, reactionYields } from "@/lib/fire/chemistry";
import { createFireState, limitingOxygenPct, stepFire, type FireInput } from "@/lib/fire/model";
import { saffireInput } from "@/lib/fire/scenario";
import { GAS_R, mixedStreamTemperatureK } from "@/lib/fire/transport";

/**
 * Model 3.0.0 calibration and held-out evaluation against published flight data.
 *
 * Calibrated coefficients (parameters.ts CALIBRATED_COEFFICIENTS) are fitted here by
 * deterministic routines: golden-section search on log-scaled coefficients, with the
 * PMMA burning flux and both CO/CO₂ ratios solved by fixed-point rescaling (the
 * quantities they control scale in proportion to them). Each coefficient is re-fitted
 * without the row being predicted (leave-one-out), so every Saffire row gets an
 * in-sample and a held-out prediction. Saffire-I, Saffire-II, BASS-II and the Saffire
 * temperatures are never used by any fit and are reported as independent checks.
 */

export interface Coefficients {
  sibalSpreadMmS: number;
  pmmaFluxGm2s: number;
  pmmaThickSpreadMmS: number;
  sibalCoCo2: number;
  pmmaCoCo2: number;
}

export const STORED_COEFFICIENTS: Coefficients = {
  sibalSpreadMmS: CALIBRATED_COEFFICIENTS.sibalSpreadMmS.value,
  pmmaFluxGm2s: CALIBRATED_COEFFICIENTS.pmmaFluxGm2s.value,
  pmmaThickSpreadMmS: CALIBRATED_COEFFICIENTS.pmmaThickSpreadMmS.value,
  sibalCoCo2: CALIBRATED_COEFFICIENTS.sibalCoCo2.value,
  pmmaCoCo2: CALIBRATED_COEFFICIENTS.pmmaCoCo2.value,
};

/** The material profile with a set of calibrated coefficients substituted. */
export function materialWith(id: "sibal" | "pmma", c: Coefficients): FireMaterial {
  const base = materialById(id);
  if (id === "sibal") return { ...base, refSpreadMmS: { ...base.refSpreadMmS!, value: c.sibalSpreadMmS }, coCo2LowFlow: { ...base.coCo2LowFlow!, value: c.sibalCoCo2 } };
  return { ...base, refMassFluxGm2s: { ...base.refMassFluxGm2s, value: c.pmmaFluxGm2s }, thickSpreadMmS: { ...base.thickSpreadMmS!, value: c.pmmaThickSpreadMmS }, coCo2LowFlow: { ...base.coCo2LowFlow!, value: c.pmmaCoCo2 } };
}

/** Inlet temperature of the Saffire duct and initial cabin temperature. Assumed: the
 * publication gives maxima, not starting temperatures. */
export const ASSUMED_INLET_C = 20;
/** Saffire flow duct cross-section, 30 cm × 45 cm (ICES-2024-365). */
export const SAFFIRE_DUCT_AREA_M2 = 0.135;

export interface ModelMetrics {
  /** Basis as published: mean (heat ÷ duration) or peak, W. */
  hrrW: number;
  peakHrrW: number;
  heatKJ: number;
  co2Ppm: number;
  coPpm: number;
  coCo2: number;
  /** Ignition to flame-out, s; null if the flame outlasts three published durations or the material is not timed. */
  durationS: number | null;
  /** Mixed-mean duct outlet rise after the model's fuel/wall losses, K. */
  outletRiseK: number;
  /** Peak rise of the cabin (room-zone) temperature, K. */
  farFieldRiseK: number;
  /** Peak rise of the closed cabin's gas pressure above its initial value within the observation window, mbar. */
  pressureRiseMbar: number;
}

/** Run one Saffire test with the given material profile and read the published quantities
 * at ignition + published duration (CO₂, CO, heat are end-of-test values). */
export function simulateSaffire(reference: SaffireBenchmark, material: FireMaterial = materialById(reference.materialId), options: { timeDuration?: boolean } = {}): ModelMetrics {
  const input: FireInput = { ...saffireInput(reference), material };
  const s = createFireState(input);
  const timeDuration = options.timeDuration ?? reference.materialId === "sibal";
  let outletRiseK = 0, farFieldRiseK = 0, pressureRiseMbar = 0, at: Omit<ModelMetrics, "durationS" | "outletRiseK" | "farFieldRiseK" | "pressureRiseMbar"> | null = null;
  const limit = 3 * reference.burnDurationS;
  const burning = () => s.phase === "heating" || s.phase === "pyrolysis" || s.phase === "flaming";
  while (s.t < limit && burning() || (!at && s.t < limit)) {
    const observationEnd = (s.ignitionTime ?? 0) + reference.burnDurationS;
    stepFire(s, input, Math.min(0.25, limit - s.t, at ? Infinity : observationEnd - s.t));
    if (!at) {
      const outletK = mixedStreamTemperatureK(s.local, s.room, s.transportFlowM3s, s.ventFlowM3s);
      if (outletK !== null) outletRiseK = Math.max(outletRiseK, outletK - (input.ambientC + 273.15));
      farFieldRiseK = Math.max(farFieldRiseK, s.tempC - input.ambientC);
      pressureRiseMbar = Math.max(pressureRiseMbar, (s.pressureKpa - input.pressureKpa) * 10);
    }
    const end = s.ignitionTime === null ? reference.burnDurationS : s.ignitionTime + reference.burnDurationS;
    if (!at && s.t >= end - 1e-9) {
      const co2 = s.co2RisePct * 1e4;
      at = { hrrW: reference.peakHeatW === null ? s.totalHeatJ / reference.burnDurationS : s.peakHrrW, peakHrrW: s.peakHrrW, heatKJ: s.totalHeatJ / 1000, co2Ppm: co2, coPpm: s.coPpm, coCo2: co2 > 0 ? s.coPpm / co2 : 0 };
      if (!timeDuration) break;
    }
  }
  const durationS = timeDuration && s.ignitionTime !== null && s.extinctionTime !== null ? s.extinctionTime - s.ignitionTime : null;
  return { ...at!, durationS, outletRiseK, farFieldRiseK, pressureRiseMbar };
}

/** Comparison with published Saffire summaries using the stored (in-sample) coefficients. */
export function compareSaffireSummaries() {
  return SAFFIRE_BENCHMARKS.map((reference) => {
    const m = simulateSaffire(reference);
    return {
      id: reference.id,
      hrrBasis: reference.peakHeatW === null ? "mean" as const : "peak" as const,
      measuredHrrW: reference.peakHeatW ?? reference.avgHeatW!,
      modelHrrW: m.hrrW,
      measuredHeatKJ: reference.totalHeatKJ,
      modelHeatKJ: m.heatKJ,
      measuredCo2Ppm: reference.co2RisePpm,
      modelCo2Ppm: m.co2Ppm,
      measuredCoPpm: reference.coRisePpm,
      modelCoPpm: m.coPpm,
    };
  });
}

/** Deterministic golden-section minimisation on [lo, hi]. */
export function goldenMinimize(f: (x: number) => number, lo: number, hi: number, iterations = 24) {
  const r = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - r * (b - a), d = a + r * (b - a), fc = f(c), fd = f(d);
  for (let i = 0; i < iterations; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - r * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + r * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}

const ln = Math.log;
const measuredHrr = (row: SaffireBenchmark) => row.peakHeatW ?? row.avgHeatW!;
const measuredRatio = (row: SaffireBenchmark) => row.coRisePpm / row.co2RisePpm;

/** SIBAL: spread rate from the published burn durations (squared log error). */
function fitSibalSpread(rows: SaffireBenchmark[], c: Coefficients) {
  const error = (logV: number) => rows.reduce((sum, row) => {
    const d = simulateSaffire(row, materialWith("sibal", { ...c, sibalSpreadMmS: Math.exp(logV) })).durationS ?? 3 * row.burnDurationS;
    return sum + ln(d / row.burnDurationS) ** 2;
  }, 0);
  return Math.exp(goldenMinimize(error, ln(1), ln(12), 22));
}

const PMMA_WEIGHTS = { peak: 1, heat: 0.5, co2: 0.5 };
/** Relative change below which a fixed point or an alternating fit counts as converged. */
const FIT_TOLERANCE = 1e-3;
/** PMMA: alternating fit to tolerance. (1) Fixed-point flux: rescale by the weighted mean
 * log error until it is below tolerance (heat release, heat and CO₂ are close to
 * proportional to the flux). (2) Growth rate by golden section on the residual shape with
 * that mean removed. Repeat until both change by less than FIT_TOLERANCE. The residual
 * shape is not exactly flux-independent (near-fire oxygen depletion and the feedback cap
 * are nonlinear), which is why one pass from an arbitrary seed is not enough. */
function fitPmma(rows: SaffireBenchmark[], c: Coefficients) {
  const residuals = (cc: Coefficients) => rows.flatMap((row) => {
    const m = simulateSaffire(row, materialWith("pmma", cc));
    return [[PMMA_WEIGHTS.peak, ln(m.peakHrrW / measuredHrr(row))], [PMMA_WEIGHTS.heat, ln(m.heatKJ / row.totalHeatKJ)], [PMMA_WEIGHTS.co2, ln(m.co2Ppm / row.co2RisePpm)]] as [number, number][];
  });
  const meanError = (r: [number, number][]) => r.reduce((s, [w, e]) => s + w * e, 0) / r.reduce((s, [w]) => s + w, 0);
  const fixedFlux = (flux: number, spread: number) => {
    for (let i = 0; i < 12; i++) {
      const step = Math.exp(-meanError(residuals({ ...c, pmmaFluxGm2s: flux, pmmaThickSpreadMmS: spread })));
      flux *= step;
      if (Math.abs(step - 1) < FIT_TOLERANCE / 4) break;
    }
    return flux;
  };
  let spread = c.pmmaThickSpreadMmS, flux = fixedFlux(c.pmmaFluxGm2s, spread);
  let lo = ln(0.02), hi = ln(3), iterations = 20;
  for (let pass = 0; pass < 10; pass++) {
    const previous = { flux, spread };
    const objective = (logS: number) => {
      const r = residuals({ ...c, pmmaFluxGm2s: flux, pmmaThickSpreadMmS: Math.exp(logS) });
      const shift = meanError(r);
      return r.reduce((s, [w, e]) => s + w * (e - shift) ** 2, 0);
    };
    spread = Math.exp(goldenMinimize(objective, lo, hi, iterations));
    flux = fixedFlux(flux, spread);
    if (pass > 0 && Math.abs(spread / previous.spread - 1) < FIT_TOLERANCE && Math.abs(flux / previous.flux - 1) < FIT_TOLERANCE) break;
    // Later passes search a factor of two either side of the current growth rate.
    lo = ln(spread / 2); hi = ln(spread * 2); iterations = 16;
  }
  return { pmmaFluxGm2s: flux, pmmaThickSpreadMmS: spread };
}

/** CO/CO₂ ratio: fixed-point rescaling to the geometric mean of the published ratios,
 * iterated until the step is below tolerance. */
function fitCoRatio(id: "sibal" | "pmma", rows: SaffireBenchmark[], c: Coefficients) {
  const key = id === "sibal" ? "sibalCoCo2" : "pmmaCoCo2";
  let ratio = c[key];
  for (let i = 0; i < 12; i++) {
    const errors = rows.map((row) => ln(simulateSaffire(row, materialWith(id, { ...c, [key]: ratio }), { timeDuration: false }).coCo2 / measuredRatio(row)));
    const step = Math.exp(-errors.reduce((s, e) => s + e, 0) / errors.length);
    ratio *= step;
    if (Math.abs(step - 1) < FIT_TOLERANCE / 4) break;
  }
  return ratio;
}

/** Fit every calibrated coefficient to the given Saffire rows. A material with no row in
 * the set keeps its coefficients from `start`. The CO/CO₂ ratio is fitted first: it barely
 * depends on the burning coefficients, but it moves carbon between CO and CO₂ and so
 * shifts the CO₂ residual the PMMA fit uses. The ratio is then re-fitted and the burning
 * fit repeated until the ratio changes by less than FIT_TOLERANCE, so the result does not
 * depend on the starting values. */
export function calibrate(rows: SaffireBenchmark[] = SAFFIRE_BENCHMARKS, start: Coefficients = STORED_COEFFICIENTS): Coefficients {
  const c = { ...start };
  const sibal = rows.filter((row) => row.materialId === "sibal"), pmma = rows.filter((row) => row.materialId === "pmma");
  const fitMaterial = (id: "sibal" | "pmma", own: SaffireBenchmark[]) => {
    const key = id === "sibal" ? "sibalCoCo2" : "pmmaCoCo2";
    c[key] = fitCoRatio(id, own, c);
    for (let round = 0; round < 4; round++) {
      if (id === "sibal") c.sibalSpreadMmS = fitSibalSpread(own, c);
      else Object.assign(c, fitPmma(own, c));
      const previous = c[key];
      c[key] = fitCoRatio(id, own, c);
      if (Math.abs(c[key] / previous - 1) < FIT_TOLERANCE) break;
    }
  };
  if (sibal.length) fitMaterial("sibal", sibal);
  if (pmma.length) fitMaterial("pmma", pmma);
  return c;
}

export interface EvaluationRow {
  id: string;
  materialId: "sibal" | "pmma";
  hrrBasis: "mean" | "peak";
  measured: { hrrW: number; heatKJ: number; co2Ppm: number; coPpm: number; coCo2: number; durationS: number | null; outletRiseK: number; farFieldRiseK: number };
  inSample: ModelMetrics;
  heldOut: ModelMetrics;
  /** Coefficients fitted without this row. */
  heldOutCoefficients: Coefficients;
  /** The published heat (and a mean heat release derived from it) equals the sample's fuel
   * mass × ΔHc, and ΔHc comes from the same table, so any model that burns the whole
   * sample reproduces it. Such rows are shown but excluded from the heat statistics. */
  fixedByFuel: boolean;
}

/** True when a test's published heat is the sample's combustible mass × a heat of
 * combustion taken from the same Saffire table (within 2 %). */
export function heatFixedByFuel(row: SaffireBenchmark) {
  const m = materialById(row.materialId);
  if (m.heatOfCombustionMJkg.source !== "saffire-vi") return false;
  const inventoryKJ = m.arealFuelKgM2.value * row.widthM * row.lengthM * (m.form === "thick" ? row.sides : 1) * m.heatOfCombustionMJkg.value * 1000;
  return Math.abs(inventoryKJ / row.totalHeatKJ - 1) < 0.02;
}

export interface IndependentCheck {
  id: string;
  source: string;
  quantity: string;
  unit: string;
  measured: string;
  model: string;
  /** Model ÷ measured − 1 where a number is comparable, else null. */
  errorPct: number | null;
  verdict: "agrees" | "partly agrees" | "disagrees" | "uninformative";
  note: string;
  /** What the comparison can establish. Absent means held out of every fit (the original checks).
   * "in-sample consistency": the quantity is constrained by a calibration target, so agreement is not a test.
   * "context": published value shown without a model comparison. */
  basis?: "held-out" | "in-sample consistency" | "context";
}

/** Mean front speed of a thin-fuel Saffire sample between 30 % and 80 % of its length, mm/s. */
function thinFrontSpeedMmS(row: SaffireBenchmark, material: FireMaterial) {
  const input: FireInput = { ...saffireInput(row), material };
  const marks: (number | null)[] = [null, null];
  runUntil(input, 3 * row.burnDurationS, (s) => {
    if (marks[0] === null && s.pyroLengthM >= 0.3 * row.lengthM) marks[0] = s.t;
    if (marks[1] === null && s.pyroLengthM >= 0.8 * row.lengthM) marks[1] = s.t;
  });
  return marks[0] !== null && marks[1] !== null ? 0.5 * row.lengthM / (marks[1] - marks[0]) * 1000 : 0;
}

/** Seconds after flame ignition at which the modeled smoke first reaches 1 and 2 mg/m³, averaged over the
 * cabin and at the modeled far-field detector. Null where the level is not reached before the cutoff. */
export function smokeAlarmTiming(row: SaffireBenchmark, material: FireMaterial, cutoffS = 1500) {
  const input: FireInput = { ...saffireInput(row), material };
  const s = createFireState(input);
  const first: Record<"room1" | "room2" | "detector1" | "detector2", number | null> = { room1: null, room2: null, detector1: null, detector2: null };
  while (s.t < cutoffS && first.detector2 === null && s.phase !== "no-ignition") {
    stepFire(s, input, 0.25);
    if (first.room1 === null && s.smokeMgM3 >= 1) first.room1 = s.t;
    if (first.room2 === null && s.smokeMgM3 >= 2) first.room2 = s.t;
    if (first.detector1 === null && s.detectorSmokeMgM3 >= 1) first.detector1 = s.t;
    if (first.detector2 === null && s.detectorSmokeMgM3 >= 2) first.detector2 = s.t;
  }
  const afterIgnition = (t: number | null) => (t === null || s.ignitionTime === null ? null : t - s.ignitionTime);
  return {
    ignitionS: s.ignitionTime,
    room1S: afterIgnition(first.room1), room2S: afterIgnition(first.room2),
    detector1S: afterIgnition(first.detector1), detector2S: afterIgnition(first.detector2),
  };
}

/** The model's growth of the involved length on a thick PMMA sample against the flame-length growth NASA measured. */
export interface ThickGrowthCheck {
  id: string;
  sampleLengthMm: number;
  /** Mean pyrolysis-length growth between 20 % and 80 % of the sample, mm/s. */
  modelRateMmS: number;
  /** Rate over the second half of that interval ÷ rate over the first half. 1 is linear; above 1 accelerates. */
  accelerationRatio: number;
  /** Seconds after ignition at which the modeled pyrolysis reaches the end of the sample, or null. */
  reachesSampleEndS: number | null;
  /** Linear fit to the visible flame length, ICES-2026-577 Table 1. */
  measuredGrowthMmS: number;
  measuredMaxFlameLengthMm: number;
}

/** Thick-fuel growth of the two Saffire VI PMMA tests with the given coefficients. Reported as a documented
 * gap: the model tracks the length of burning surface, the paper tracks the visible flame, and neither is a
 * fitted target of the other. */
export function thickGrowthChecks(c: Coefficients = STORED_COEFFICIENTS): ThickGrowthCheck[] {
  const pmma = materialWith("pmma", c);
  return ["VI-3", "VI-4"].map((id) => {
    const row = SAFFIRE_BENCHMARKS.find((b) => b.id === id)!;
    const paper = SAFFIRE_IV_VI_EMISSION.find((t) => t.id === id)!;
    const input: FireInput = { ...saffireInput(row), material: pmma };
    const marks = { a: null as number | null, b: null as number | null, c: null as number | null, end: null as number | null };
    const ignition = { t: null as number | null };
    runUntil(input, 1500, (s) => {
      ignition.t = s.ignitionTime;
      const f = s.pyroLengthM / row.lengthM;
      if (marks.a === null && f >= 0.2) marks.a = s.t;
      if (marks.b === null && f >= 0.5) marks.b = s.t;
      if (marks.c === null && f >= 0.8) marks.c = s.t;
      if (marks.end === null && f >= 0.999) marks.end = s.t;
    });
    const L = row.lengthM * 1000;
    const rate = (from: number | null, to: number | null, fraction: number) => from !== null && to !== null && to > from ? fraction * L / (to - from) : 0;
    const first = rate(marks.a, marks.b, 0.3), second = rate(marks.b, marks.c, 0.3);
    return {
      id, sampleLengthMm: L,
      modelRateMmS: rate(marks.a, marks.c, 0.6),
      accelerationRatio: first > 0 ? second / first : 0,
      reachesSampleEndS: marks.end === null || ignition.t === null ? null : marks.end - ignition.t,
      measuredGrowthMmS: paper.flameGrowthRateMmS!,
      measuredMaxFlameLengthMm: paper.maxFlameLengthMm!,
    };
  });
}

function flightInput(row: FlightObservation, material: FireMaterial, sides: 1 | 2 = 1): FireInput {
  const base = saffireInput(SAFFIRE_BENCHMARKS[0]);
  return { ...base, material, oxygenPct: row.oxygenPct, pressureKpa: row.pressureKpa, ventilationMs: row.reproduction?.flowMs ?? row.flowMs, flowOrientation: row.flow, fuel: { widthM: row.widthM, lengthM: row.reproduction?.lengthM ?? row.lengthM, sides, enclosed: false } };
}

function runUntil(input: FireInput, maxS: number, onStep?: (s: ReturnType<typeof createFireState>) => void) {
  const s = createFireState(input);
  while (s.t < maxS && (s.phase === "heating" || s.phase === "pyrolysis" || s.phase === "flaming")) { stepFire(s, input, 0.25); onStep?.(s); }
  return s;
}

const pct = (model: number, measured: number) => (model / measured - 1) * 100;
const verdictFor = (errorPct: number, band: number) => Math.abs(errorPct) <= band ? "agrees" as const : Math.abs(errorPct) <= 2 * band ? "partly agrees" as const : "disagrees" as const;

/** Checks against data never used by any fit. */
export function independentChecks(c: Coefficients = STORED_COEFFICIENTS, heldOutCoefficients: Record<string, Coefficients> = {}): IndependentCheck[] {
  const sibal = materialWith("sibal", c), pmma = materialWith("pmma", c);
  const obs = (id: string) => FLIGHT_OBSERVATIONS.find((row) => row.id === id)!;
  const checks: IndependentCheck[] = [];

  const s1 = obs("Saffire-I S1");
  const r1 = runUntil(flightInput(s1, sibal), 3 * s1.burnTimeS!);
  const d1 = r1.extinctionTime !== null && r1.ignitionTime !== null ? r1.extinctionTime - r1.ignitionTime : null;
  checks.push({ id: s1.id, source: s1.source, quantity: "Burn time, 94 cm SIBAL, concurrent", unit: "s", measured: `${s1.burnTimeS}`, model: d1 === null ? "not finished" : d1.toFixed(0), errorPct: d1 === null ? null : pct(d1, s1.burnTimeS!), verdict: d1 === null ? "disagrees" : verdictFor(pct(d1, s1.burnTimeS!), 25), note: "Model spread is calibrated to Saffire VI IV-1 and VI-2, which imply a faster front than Saffire-I at nearly the same oxygen, pressure and flow." });

  const s2 = obs("Saffire-I S2");
  const r2 = runUntil(flightInput(s2, sibal), 2000);
  const d2 = r2.extinctionTime !== null && r2.ignitionTime !== null ? r2.extinctionTime - r2.ignitionTime : null;
  checks.push({ id: s2.id, source: s2.reproduction!.source, quantity: "Burn time, remaining ~10 cm SIBAL, opposed flow", unit: "s", measured: `${s2.burnTimeS}`, model: d2 === null ? "> 2000" : d2.toFixed(0), errorPct: d2 === null ? null : pct(d2, s2.burnTimeS!), verdict: d2 === null ? "disagrees" : verdictFor(pct(d2, s2.burnTimeS!), 25), note: "NASA's test matrix specifies approximately 10 cm of remaining fuel for the second ignition. The earlier 94 cm comparison used the original sheet size. The opposed/concurrent spread ratio (0.65) remains assumed." });

  for (const id of ["Saffire-II 2-5", "Saffire-II 2-6"]) {
    const row = obs(id);
    // Steady front speed between 30 % and 80 % of the strip length.
    const marks: (number | null)[] = [null, null];
    runUntil(flightInput(row, sibal), 3 * row.burnTimeS!, (s) => {
      if (marks[0] === null && s.pyroLengthM >= 0.3 * row.lengthM) marks[0] = s.t;
      if (marks[1] === null && s.pyroLengthM >= 0.8 * row.lengthM) marks[1] = s.t;
    });
    const spread = marks[0] !== null && marks[1] !== null ? 0.5 * row.lengthM / (marks[1] - marks[0]) * 1000 : 0;
    checks.push({ id, source: row.source, quantity: "Mean concurrent spread rate, 5 cm SIBAL strip", unit: "mm/s", measured: row.spreadMmS!.toFixed(1), model: spread.toFixed(2), errorPct: pct(spread, row.spreadMmS!), verdict: verdictFor(pct(spread, row.spreadMmS!), 25), note: "Narrow strip: side losses can slow the real flame; the model has no width effect. The same rows' burn time minus travel time sets the thin-fuel burnout flux, so their burn time is not an independent check." });
  }

  for (const id of ["Saffire-II 2-8", "Saffire-II 2-9"]) {
    const row = obs(id);
    const input = flightInput(row, pmma, 2);
    const s = createFireState(input);
    while ((s.ignitionTime === null || s.t < s.ignitionTime + row.burnTimeS!) && s.t < row.burnTimeS! + 60 && s.phase !== "extinguished" && s.phase !== "no-ignition") stepFire(s, input, 0.25);
    const lengthCm = s.pyroLengthM * 100;
    checks.push({ id, source: row.source, quantity: `Involved length after ${row.burnTimeS} s, PMMA`, unit: "cm", measured: "~10", model: lengthCm.toFixed(1), errorPct: pct(lengthCm, 10), verdict: verdictFor(pct(lengthCm, 10), 30), note: "Tests the calibrated thick-fuel growth law at 22 % O₂ and about 101 kPa, outside the Saffire VI fitting conditions (29–30 % O₂, 55 kPa). Damage length is approximate and taken as the involved length." });
  }

  const sil = obs("Saffire-II 2-1 to 2-4");
  const silicone = materialById("silicone");
  const rs = runUntil({ ...flightInput(sil, silicone), material: silicone }, 120);
  const loc = limitingOxygenPct(silicone, 0.2, sil.pressureKpa);
  checks.push({ id: sil.id, source: sil.source, quantity: "Sustained flame on thin silicone", unit: "", measured: "insignificant burn", model: rs.ignitionTime === null && rs.totalHeatJ === 0 ? "no flame" : `flame, ${(rs.totalHeatJ / 1000).toFixed(1)} kJ`, errorPct: null, verdict: "uninformative", note: `Consistent, but for the wrong reason: silicone flaming chemistry is withheld in the model. Its modelled oxygen limit at 20 cm/s (${loc.toFixed(1)} %) is below the 21.5–22.1 % flight oxygen, so the limit alone would allow burning.` });

  const molarRatio = (m: FireMaterial, o2: number) => { const y = reactionYields(m, o2, { gravityG: 0 }); return (y.co / 28) / (y.co2 / 44); };
  const bp = BASS_II_CO_RATIOS.pmmaHighOxygen, bs = BASS_II_CO_RATIOS.sibal;
  const pmmaRatio = molarRatio(pmma, 21.7);
  checks.push({ id: "BASS-II PMMA", source: BASS_II_CO_RATIOS.source, quantity: `CO/CO₂ molar ratio, ${bp.label} (${bp.runs} runs)`, unit: "%", measured: `${(bp.median * 100).toFixed(2)} (IQR ${(bp.q1 * 100).toFixed(2)}–${(bp.q3 * 100).toFixed(2)})`, model: (pmmaRatio * 100).toFixed(2), errorPct: pct(pmmaRatio, bp.median), verdict: pmmaRatio >= bp.q1 && pmmaRatio <= bp.q3 ? "agrees" : verdictFor(pct(pmmaRatio, bp.median), 20), note: "Small glovebox samples at 1 atm. The low-oxygen BASS-II runs set the CO starvation gain and are not counted here." });
  const sibalRatio = molarRatio(sibal, 18.75);
  checks.push({ id: "BASS-II SIBAL", source: BASS_II_CO_RATIOS.source, quantity: `CO/CO₂ molar ratio, ${bs.label} (${bs.runs} runs)`, unit: "%", measured: `${(bs.median * 100).toFixed(2)} (IQR ${(bs.q1 * 100).toFixed(2)}–${(bs.q3 * 100).toFixed(2)})`, model: (sibalRatio * 100).toFixed(2), errorPct: pct(sibalRatio, bs.median), verdict: sibalRatio >= bs.q1 && sibalRatio <= bs.q3 ? "agrees" : verdictFor(pct(sibalRatio, bs.median), 20), note: "Evaluated at the runs' median initial oxygen (18.75 %). Four runs with 500–700 ppm CO₂ rises: ±15–20 % quantisation per run." });

  // ICES-2026-577 (source saffire-iv-vi-emission). Each comparison below says what it can establish.
  const emission = (id: string) => SAFFIRE_IV_VI_EMISSION.find((t) => t.id === id)!;
  const benchmark = (id: string) => SAFFIRE_BENCHMARKS.find((b) => b.id === id)!;
  const source = "saffire-iv-vi-emission";

  // Thin-fuel spread rate. The burn duration of the same two tests sets the model's SIBAL spread rate, and
  // 50 cm ÷ burn duration is a spread rate, so agreement is consistency with the calibration, not a test.
  for (const id of ["IV-1", "VI-2"]) {
    const row = benchmark(id), paper = emission(id);
    const speed = thinFrontSpeedMmS(row, sibal);
    const held = heldOutCoefficients[id];
    const heldNote = held ? ` Re-fitted without this test (the other SIBAL test only) the model gives ${thinFrontSpeedMmS(row, materialWith("sibal", held)).toFixed(2)} mm/s.` : "";
    checks.push({
      id: `${id} spread rate`, source, quantity: "Mean thin-fuel spread rate, SIBAL", unit: "mm/s",
      measured: paper.flameSpreadRateMmS!.toFixed(2), model: speed.toFixed(2), errorPct: pct(speed, paper.flameSpreadRateMmS!),
      verdict: verdictFor(pct(speed, paper.flameSpreadRateMmS!), 25), basis: "in-sample consistency",
      note: `The SIBAL spread rate was calibrated to the burn durations of IV-1 and VI-2 (${row.burnDurationS} s over 50 cm, an average ${(500 / row.burnDurationS).toFixed(1)} mm/s including burnout), so agreement with this table is expected and is not an independent test.${heldNote}`,
    });
  }
  const cotton = emission("V-2");
  checks.push({
    id: "V-2 spread rate", source, quantity: "Thin-fuel spread rate, cotton t-shirt fabric (context)", unit: "mm/s",
    measured: cotton.flameSpreadRateMmS!.toFixed(2), model: "not modelled", errorPct: null, verdict: "uninformative", basis: "context",
    note: "Cotton t-shirt fabric is not SIBAL (a cotton/fiberglass blend) and has no material profile, so it is excluded from the model and shown as published context.",
  });

  // Cabin pressure and far-field temperature rise at the FFD in the four tests the model reproduces. Neither was fitted.
  const rises = SAFFIRE_BENCHMARKS.map((row) => ({ row, paper: emission(row.id), m: simulateSaffire(row, materialWith(row.materialId, c)) }));
  const list = (values: number[], digits: number) => values.map((v) => v.toFixed(digits)).join(" / ");
  const order = rises.map((r) => r.row.id).join(" / ");
  const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const pressureErrors = rises.map((r) => pct(r.m.pressureRiseMbar, r.paper.pressureRiseMbar));
  checks.push({
    id: "IV-1 / VI-2 / VI-3 / VI-4 pressure rise", source, quantity: `Cabin pressure rise (${order})`, unit: "mbar",
    measured: list(rises.map((r) => r.paper.pressureRiseMbar), 2), model: list(rises.map((r) => r.m.pressureRiseMbar), 1), errorPct: median(pressureErrors),
    verdict: verdictFor(median(pressureErrors), 50), basis: "held-out",
    note: "Maximum pressure increase in the cabin (a single value, not a point-sensor reading). The model treats the cabin as a sealed gas volume whose only heat sink is an assumed lumped wall; the flight cabin held cargo bags and trash that may absorb heat, and its leakage is unknown. Error is the median over the four tests.",
  });
  const cfastRise = rises.map((r) => cfastComparisons().find((x) => x.caseId === `saffire-${r.row.id}-ignis`)?.cfastPeakRiseC ?? null);
  const cfastNote = cfastRise.every((v): v is number => v !== null) ? ` NIST CFAST on the same heat release gives ${Math.min(...cfastRise).toFixed(1)}–${Math.max(...cfastRise).toFixed(1)} K.` : "";
  const tempErrors = rises.map((r) => pct(r.m.farFieldRiseK, r.paper.maxTemperatureRiseC));
  checks.push({
    id: "IV-1 / VI-2 / VI-3 / VI-4 temperature rise", source, quantity: `Far-field temperature rise (${order})`, unit: "K",
    measured: list(rises.map((r) => r.paper.maxTemperatureRiseC), 2), model: list(rises.map((r) => r.m.farFieldRiseK), 1), errorPct: median(tempErrors),
    verdict: verdictFor(median(tempErrors), 50), basis: "held-out",
    note: `The measurement is a point reading at the Far Field Diagnostics beside the air intake, a rise of 0.25–0.50 K; the model value is a cabin-average peak and the wall heat transfer is assumed.${cfastNote} Error is the median over the four tests.`,
  });

  // Smoke timing, VI-3. The PMMA soot yield is a handbook value, not a calibrated coefficient, so this is held out.
  const vi3 = benchmark("VI-3"), timeline = SAFFIRE_VI3_SMOKE_TIMELINE;
  const smoke = smokeAlarmTiming(vi3, pmma);
  const smokeNote = (level: string, roomS: number | null, measuredS: number, detectorS: number | null) =>
    `Experiment clock: ignition at ${timeline.ignitionS} s (NASA ICES-2024 presentation), alarm at ${timeline.ignitionS + measuredS} s. The model's cabin-average concentration reaches ${level} ${roomS === null ? "not within the run" : `${roomS.toFixed(0)} s`} after ignition, at its far-field detector ${detectorS === null ? "not within the run" : `${detectorS.toFixed(0)} s`}. Soot yield (${pmma.sootYield.value}) is a handbook value, not fitted to any Saffire test. ${detectorS === null ? "" : detectorS < measuredS ? "The model reaches the level sooner than flight, so its alarm time is not conservative for detection." : "The model reaches the level later than flight."} The presentation does not say whether its ignition time marks heater start or flame; the 60 s ignition period bounds the difference.`;
  const alarm2 = timeline.alarm2MgM3S - timeline.ignitionS, alarm1 = timeline.alarm1MgM3S - timeline.ignitionS;
  for (const [level, measuredS, source2, detectorS, roomS] of [["2 mg/m³", alarm2, source, smoke.detector2S, smoke.room2S], ["1 mg/m³", alarm1, "saffire-vi", smoke.detector1S, smoke.room1S]] as const) {
    checks.push({
      id: `VI-3 smoke alarm ${level}`, source: source2, quantity: `Time from ignition to ${level} total particulate at the far-field detector, VI-3`, unit: "s",
      measured: `${measuredS}`, model: detectorS === null ? "not reached" : detectorS.toFixed(0), errorPct: detectorS === null ? null : pct(detectorS, measuredS),
      verdict: detectorS === null ? "disagrees" : verdictFor(pct(detectorS, measuredS), 25), basis: "held-out",
      note: smokeNote(level, roomS, measuredS, detectorS),
    });
  }
  return checks;
}

/** Two independent estimates of the same heat release per Saffire test: the published
 * value and a carbon balance on the published CO₂ and CO rises (ideal gas at the test
 * pressure and an assumed 20 °C, fuel carbon fraction from chemistry.ts, ΔHc from
 * materials.ts). For VI-2 the paper also gives 409 kJ by fuel consumption. */
export function dataConsistency() {
  const rows = SAFFIRE_BENCHMARKS.map((row) => {
    const m = materialById(row.materialId);
    const moles = row.pressureKpa * 1000 * row.freeVolumeM3 / (GAS_R * (ASSUMED_INLET_C + 273.15));
    const carbonKg = (row.co2RisePpm + row.coRisePpm) * 1e-6 * moles * 0.012;
    const carbonHeatKJ = carbonKg / fuelElements(m).c * m.heatOfCombustionMJkg.value * 1000;
    return { id: row.id, publishedHeatKJ: row.totalHeatKJ, carbonHeatKJ, ratio: carbonHeatKJ / row.totalHeatKJ, co2PpmPerKJ: row.co2RisePpm / row.totalHeatKJ };
  });
  const disagreement = rows.map((row) => Math.abs(row.ratio - 1) * 100).sort((a, b) => a - b);
  const median = (disagreement[1] + disagreement[2]) / 2;
  return {
    rows,
    vi2FuelConsumptionKJ: 409,
    /** Median disagreement between the two heat estimates, %. Used as the data band for heat release, heat and CO₂. */
    heatBandPct: median,
    heatRangePct: [disagreement[0], disagreement[3]] as [number, number],
    /** Spread of published CO/CO₂ between the two tests of each material, %. Used as the CO band. */
    coBandPct: Math.max(...(["sibal", "pmma"] as const).map((id) => {
      const r = SAFFIRE_BENCHMARKS.filter((row) => row.materialId === id).map(measuredRatio);
      return (Math.max(...r) / Math.min(...r) - 1) * 100 / 2;
    })),
  };
}

export interface ModelEvaluation {
  inSampleCoefficients: Coefficients;
  rows: EvaluationRow[];
  independent: IndependentCheck[];
  consistency: ReturnType<typeof dataConsistency>;
  /** Thick-PMMA growth of the involved length against the measured flame growth (documented gap, not pass/fail). */
  thickGrowth: ThickGrowthCheck[];
}

/** Full calibration, leave-one-out prediction and independent checks. About 30–60 s. */
export function evaluateModel(): ModelEvaluation {
  const inSampleCoefficients = calibrate(SAFFIRE_BENCHMARKS);
  const rows = SAFFIRE_BENCHMARKS.map((row): EvaluationRow => {
    const others = SAFFIRE_BENCHMARKS.filter((other) => other.id !== row.id && other.materialId === row.materialId);
    const heldOutCoefficients = calibrate(others, inSampleCoefficients);
    return {
      id: row.id, materialId: row.materialId, hrrBasis: row.peakHeatW === null ? "mean" : "peak",
      measured: { hrrW: measuredHrr(row), heatKJ: row.totalHeatKJ, co2Ppm: row.co2RisePpm, coPpm: row.coRisePpm, coCo2: measuredRatio(row), durationS: row.materialId === "sibal" ? row.burnDurationS : null, outletRiseK: row.maxOutletC - ASSUMED_INLET_C, farFieldRiseK: row.maxFarFieldC - ASSUMED_INLET_C },
      inSample: simulateSaffire(row, materialWith(row.materialId, inSampleCoefficients)),
      heldOut: simulateSaffire(row, materialWith(row.materialId, heldOutCoefficients)),
      heldOutCoefficients,
      fixedByFuel: heatFixedByFuel(row),
    };
  });
  return { inSampleCoefficients, rows, independent: independentChecks(inSampleCoefficients, Object.fromEntries(rows.map((r) => [r.id, r.heldOutCoefficients]))), consistency: dataConsistency(), thickGrowth: thickGrowthChecks(inSampleCoefficients) };
}

export type AccuracyMetric = "hrr" | "heat" | "co2" | "co" | "coRatio" | "duration" | "farField" | "outlet";

export interface MetricAccuracy {
  metric: AccuracyMetric;
  label: string;
  /** "%" for relative error, "K" for absolute temperature error. */
  unit: "%" | "K";
  inSample: { medianAbs: number; maxAbs: number; n: number };
  heldOut: { medianAbs: number; maxAbs: number; n: number };
  /** Approximate spread of the published data themselves, same unit. */
  dataBand: number | null;
  fitted: boolean;
  /** False when the comparison cannot establish accuracy: the reference is disputed or the
   * model disagrees with it beyond any stated band. The interface then shows no error bar. */
  established: boolean;
  /** Rows left out of the statistics, with the reason. */
  excluded: string[];
  applicability: string;
  note: string;
}

const medianOf = (values: number[]) => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const stats = (values: number[]) => ({ medianAbs: medianOf(values.map(Math.abs)), maxAbs: Math.max(...values.map(Math.abs)), n: values.length });

/** Per-metric error summary of an evaluation. Relative errors are model ÷ published − 1.
 * Heat release and total heat leave out rows whose published heat is fixed by fuel mass ×
 * ΔHc (heatFixedByFuel): reproducing them tests nothing. */
export function summarizeAccuracy(e: ModelEvaluation): MetricAccuracy[] {
  type Which = "inSample" | "heldOut";
  const rel = (pick: (m: ModelMetrics) => number | null, measured: (r: EvaluationRow) => number | null, which: Which, rows = e.rows) =>
    rows.flatMap((r) => { const m = pick(r[which]), d = measured(r); return m === null || d === null ? [] : [pct(m, d)]; });
  const abs = (pick: (m: ModelMetrics) => number, measured: (r: EvaluationRow) => number, which: Which) => e.rows.map((r) => pick(r[which]) - measured(r));
  const tested = e.rows.filter((r) => !r.fixedByFuel);
  const excludedHeat = e.rows.filter((r) => r.fixedByFuel).map((r) => `${r.id}: published heat and mean heat release equal fuel mass × ΔHc, and ΔHc comes from the same table, so the comparison is fixed, not a test.`);
  const zeroG = "0 g; SIBAL 41 cm × 50 cm and PMMA 41 cm × 18 cm; near the oxygen and pressure of a Saffire VI test; matching concurrent-flow history. VI-4 airflow history remains incomplete.";
  const band = e.consistency.heatBandPct, coBand = e.consistency.coBandPct;
  const metric = (m: AccuracyMetric, label: string, unit: "%" | "K", values: (which: Which) => number[], extra: Partial<MetricAccuracy> & { dataBand: number | null; fitted: boolean }): MetricAccuracy =>
    ({ metric: m, label, unit, inSample: stats(values("inSample")), heldOut: stats(values("heldOut")), established: true, excluded: [], applicability: zeroG, note: "", ...extra });
  const outlet = e.rows.map((r) => r.inSample.outletRiseK / r.measured.outletRiseK);
  return [
    metric("hrr", "Heat release rate", "%", (w) => rel((m) => m.hrrW, (r) => r.measured.hrrW, w, tested), { dataBand: band, fitted: true, excluded: excludedHeat, note: "Peak or mean heat release as published." }),
    metric("heat", "Total heat", "%", (w) => rel((m) => m.heatKJ, (r) => r.measured.heatKJ, w, tested), { dataBand: band, fitted: true, excluded: excludedHeat, note: "Heat at the published duration." }),
    metric("co2", "CO₂ rise", "%", (w) => rel((m) => m.co2Ppm, (r) => r.measured.co2Ppm, w), { dataBand: band, fitted: true, note: "Cabin CO₂ rise at the published duration." }),
    metric("co", "CO rise", "%", (w) => rel((m) => m.coPpm, (r) => r.measured.coPpm, w), { dataBand: Math.hypot(band, coBand), fitted: true, note: "Cabin CO rise at the published duration." }),
    metric("coRatio", "CO/CO₂ ratio", "%", (w) => rel((m) => m.coCo2, (r) => r.measured.coCo2, w), { dataBand: coBand, fitted: true, note: "Ratio fitted to the four Saffire VI tests; BASS-II glovebox runs agree independently." }),
    metric("duration", "SIBAL burn duration", "%", (w) => rel((m) => m.durationS, (r) => r.measured.durationS, w), { dataBand: null, fitted: true, applicability: "0 g SIBAL, 41 cm × 50 cm samples (IV-1, VI-2).", note: "Ignition to flame-out." }),
    metric("farField", "Cabin temperature rise", "K", (w) => abs((m) => m.farFieldRiseK, (r) => r.measured.farFieldRiseK, w), {
      dataBand: 1, fitted: false, established: false,
      applicability: "Saffire far-field maxima, 1 °C resolution, starting temperature assumed 20 °C.",
      note: "Not established. The flight signals are 0–5 K point readings against an assumed 20 °C start, and NIST CFAST gives several times the IGNIS cabin rise on identical heat release (src/data/fire/cfast-reference.json). Wall heat transfer is assumed. ICES-2026-577 reports the rises directly (0.25–0.50 K at the far-field detector for these four tests) and both models give larger rises; see the independent checks.",
    }),
    metric("outlet", "Duct outlet temperature rise", "%", (w) => rel((m) => m.outletRiseK, (r) => r.measured.outletRiseK, w), {
      dataBand: null, fitted: false, established: false,
      applicability: "Molar-flow-weighted source/bypass mixing after modeled fuel and wall losses; a point thermocouple need not read the mixed mean. Duct geometry is unresolved.",
      note: `Not established: source/bypass mixing after modeled wall losses gives ${Math.min(...outlet).toFixed(1)}–${Math.max(...outlet).toFixed(1)} times the measured outlet rise. Duct geometry and sensor position remain unresolved.`,
    }),
  ];
}
