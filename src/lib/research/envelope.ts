import {
  GRAVITY_REGIMES,
  INVESTIGATIONS,
  type GravityRegime,
  type InvestigationRecord,
} from "@/data/research/investigations";
import { runPressureKpa, runsForRecord, type ExperimentRun } from "@/data/research/runs";
import {
  GEOMETRY_SHORT,
  fuelsMatching,
  hasSpecificFuels,
  listJoin,
  materialTerm,
  recordGeometry,
  type SpecimenGeometry,
} from "@/lib/research/materials";

/**
 * Compares a cabin's atmosphere with the conditions a record actually tested.
 * Pure and deterministic: no scores, no weighting.
 *
 * Two levels:
 *  - range level (compareWithRecord): is each cabin value inside each published range? Ranges are
 *    checked one at a time, so this alone never shows that a combination was tested;
 *  - run level (evidenceMatch): does one tabulated run match the cabin's oxygen, pressure, airflow
 *    and gravity together, within the tolerances in RUN_TOLERANCE?
 */

export interface CabinConditions {
  oxygenPct: number;
  pressureKpa: number;
  /** Airflow in cm/s. */
  flowCmS: number;
  gravityG: number;
}

export type RangeStatus = "inside" | "below" | "above" | "not-tabulated";

export interface RangeCheck {
  status: RangeStatus;
  value: number;
  range: [number, number] | null;
}

export interface GravityCheck {
  /** The regime the cabin's gravity corresponds to, or null when it lies between tested regimes. */
  regime: GravityRegime | null;
  tested: boolean;
}

export type Dimension = "oxygen" | "pressure" | "airflow" | "gravity";

export interface EnvelopeComparison {
  recordId: string;
  oxygen: RangeCheck;
  pressure: RangeCheck;
  airflow: RangeCheck;
  gravity: GravityCheck;
  /** Dimensions with a tabulated range or a gravity regime that the cabin falls outside of. */
  outside: Dimension[];
  /** Dimensions the record does not tabulate. */
  notTabulated: Dimension[];
  /** Cabin values that are not finite numbers. They are neither inside nor outside a range. */
  cabinUnknown: Dimension[];
}

export const DIMENSION_LABEL: Record<Dimension, string> = {
  oxygen: "oxygen",
  pressure: "pressure",
  airflow: "airflow",
  gravity: "gravity",
};

/** Values are compared after rounding away floating-point noise. */
const EPSILON = 1e-6;

/** How close a gravity level must be to a regime to count as that regime, in g. */
const GRAVITY_TOLERANCE = 0.03;

/** A cabin value that is not a finite number (NaN, ±Infinity) cannot be placed inside or outside anything. */
function known(value: number): boolean {
  return Number.isFinite(value);
}

export function checkRange(value: number, range: [number, number] | undefined): RangeCheck {
  if (!range || !known(value)) return { status: "not-tabulated", value, range: null };
  const [low, high] = range[0] <= range[1] ? range : [range[1], range[0]];
  if (value < low - EPSILON) return { status: "below", value, range: [low, high] };
  if (value > high + EPSILON) return { status: "above", value, range: [low, high] };
  return { status: "inside", value, range: [low, high] };
}

/** The gravity regime a level belongs to. 0.16 g and 0.165 g are both lunar; 0.6 g is no indexed regime. */
export function gravityRegimeFor(gravityG: number): GravityRegime | null {
  let best: GravityRegime | null = null;
  let bestDistance = Infinity;
  for (const [id, regime] of Object.entries(GRAVITY_REGIMES) as Array<[GravityRegime, { g: number }]>) {
    const distance = Math.abs(gravityG - regime.g);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return bestDistance <= GRAVITY_TOLERANCE + EPSILON ? best : null;
}

/** A gravity regime in running text: "microgravity", "lunar gravity (0.165 g)". */
export function regimeText(regime: GravityRegime): string {
  const g = GRAVITY_REGIMES[regime].g;
  return { "0g": "microgravity", lunar: `lunar gravity (${g} g)`, mars: `Martian gravity (${g} g)`, "1g": `Earth gravity (${g} g)` }[regime];
}

export function hasTabulatedRanges(record: InvestigationRecord): boolean {
  const { oxygenPct, pressureKpa, flowCmS } = record.conditions;
  return Boolean(oxygenPct || pressureKpa || flowCmS);
}

export function compareWithRecord(record: InvestigationRecord, cabin: CabinConditions): EnvelopeComparison {
  const oxygen = checkRange(cabin.oxygenPct, record.conditions.oxygenPct);
  const pressure = checkRange(cabin.pressureKpa, record.conditions.pressureKpa);
  const airflow = checkRange(cabin.flowCmS, record.conditions.flowCmS);
  const regime = gravityRegimeFor(cabin.gravityG);
  const gravity: GravityCheck = { regime, tested: regime !== null && record.gravity.includes(regime) };

  const ranges: Array<[Dimension, RangeCheck]> = [
    ["oxygen", oxygen],
    ["pressure", pressure],
    ["airflow", airflow],
  ];
  const outside = ranges.filter(([, check]) => check.status === "below" || check.status === "above").map(([dimension]) => dimension);
  const cabinUnknown = (
    [
      ["oxygen", cabin.oxygenPct],
      ["pressure", cabin.pressureKpa],
      ["airflow", cabin.flowCmS],
      ["gravity", cabin.gravityG],
    ] as Array<[Dimension, number]>
  )
    .filter(([, value]) => !known(value))
    .map(([dimension]) => dimension);
  if (!gravity.tested && !cabinUnknown.includes("gravity")) outside.push("gravity");
  const notTabulated = ranges
    .filter(([dimension, check]) => check.status === "not-tabulated" && !cabinUnknown.includes(dimension))
    .map(([dimension]) => dimension);

  return { recordId: record.id, oxygen, pressure, airflow, gravity, outside, notTabulated, cabinUnknown };
}

/** Every indexed record that tabulates at least one numeric range, compared with the cabin. */
export function compareCabinWithIndex(
  cabin: CabinConditions,
  records: InvestigationRecord[] = INVESTIGATIONS,
): Array<{ record: InvestigationRecord; comparison: EnvelopeComparison }> {
  return records
    .filter(hasTabulatedRanges)
    .map((record) => ({ record, comparison: compareWithRecord(record, cabin) }));
}

/* ------------------------------------------------------------------ */
/* Run-level matching                                                  */
/* ------------------------------------------------------------------ */

/**
 * How close a tabulated run must be to the cabin to count as the same condition.
 * These tolerances are IGNIS choices, stated so the match can be checked; the sources do not set them.
 */
export const RUN_TOLERANCE = {
  /** Percentage points of O₂ by volume. */
  oxygenPct: 0.5,
  pressureKpa: 2,
  flowCmS: 2,
} as const;

export const RUN_TOLERANCE_TEXT =
  "A run matches when its O₂ is within ±0.5 percentage points, its pressure within ±2 kPa and its airflow within ±2 cm/s of the cabin, at the same gravity regime (±0.03 g), in an oxygen–nitrogen atmosphere. These tolerances are IGNIS choices, not values from the sources.";

export type RunDimensionStatus = "match" | "differs" | "not-reported";

export interface RunMatch {
  run: ExperimentRun;
  oxygen: RunDimensionStatus;
  pressure: RunDimensionStatus;
  airflow: RunDimensionStatus;
  /** "not-reported" only when the cabin gravity is not a finite number. */
  gravity: RunDimensionStatus;
  /** The run's atmosphere carries CO₂ or helium as well as nitrogen (FLEX), unlike an oxygen–nitrogen cabin. */
  diluentDiffers: boolean;
  /** Every dimension matches within tolerance and the atmosphere is oxygen–nitrogen. */
  matches: boolean;
  missing: Dimension[];
  differs: Dimension[];
  /** Sum of the reported differences, each divided by its tolerance. For choosing the nearest run only. */
  distance: number;
}

function intervalGap(value: number, low: number, high: number): number {
  if (value < low) return low - value;
  if (value > high) return value - high;
  return 0;
}

export function matchRun(run: ExperimentRun, cabin: CabinConditions): RunMatch {
  const missing: Dimension[] = [];
  const differs: Dimension[] = [];
  let distance = 0;

  let oxygen: RunDimensionStatus = "not-reported";
  if (run.oxygenPct && known(cabin.oxygenPct)) {
    const gap = intervalGap(cabin.oxygenPct, run.oxygenPct[0], run.oxygenPct[1]);
    oxygen = gap <= RUN_TOLERANCE.oxygenPct + EPSILON ? "match" : "differs";
    distance += gap / RUN_TOLERANCE.oxygenPct;
  }
  const kpa = runPressureKpa(run);
  let pressure: RunDimensionStatus = "not-reported";
  if (kpa !== null && known(cabin.pressureKpa)) {
    const gap = Math.abs(cabin.pressureKpa - kpa);
    pressure = gap <= RUN_TOLERANCE.pressureKpa + EPSILON ? "match" : "differs";
    distance += gap / RUN_TOLERANCE.pressureKpa;
  }
  let airflow: RunDimensionStatus = "not-reported";
  if (run.flowCmS !== null && known(cabin.flowCmS)) {
    const gap = Math.abs(cabin.flowCmS - run.flowCmS);
    airflow = gap <= RUN_TOLERANCE.flowCmS + EPSILON ? "match" : "differs";
    distance += gap / RUN_TOLERANCE.flowCmS;
  }
  const gravity: RunDimensionStatus = !known(cabin.gravityG) ? "not-reported" : gravityRegimeFor(cabin.gravityG) === run.gravity ? "match" : "differs";
  if (gravity === "differs") distance += 10;

  for (const [dimension, status] of [
    ["oxygen", oxygen],
    ["pressure", pressure],
    ["airflow", airflow],
    ["gravity", gravity],
  ] as Array<[Dimension, RunDimensionStatus]>) {
    if (status === "not-reported") missing.push(dimension);
    if (status === "differs") differs.push(dimension);
  }
  const diluentDiffers = Boolean(run.diluents && (run.diluents.co2 > 0 || run.diluents.he > 0));
  const matches = missing.length === 0 && differs.length === 0 && !diluentDiffers;
  return { run, oxygen, pressure, airflow, gravity, diluentDiffers, matches, missing, differs, distance };
}

/* ------------------------------------------------------------------ */
/* Evidence match: four statuses                                       */
/* ------------------------------------------------------------------ */

export type EvidenceMatchStatus = "matching-run" | "within-ranges" | "insufficient" | "outside";

export const EVIDENCE_MATCH_LABEL: Record<EvidenceMatchStatus, string> = {
  "matching-run": "Matching experimental run",
  "within-ranges": "Within reported ranges",
  insufficient: "Insufficient information",
  outside: "Outside tested conditions",
};

export const EVIDENCE_MATCH_HINT: Record<EvidenceMatchStatus, string> = {
  "matching-run": "A specific tabulated run matches this cabin's oxygen, pressure, airflow and gravity together, within the stated tolerances.",
  "within-ranges": "Each reported dimension covers this cabin's value, but no single tabulated run is shown to match the combination.",
  insufficient: "One or more of oxygen, pressure and airflow is not reported for this record, so coverage cannot be established.",
  outside: "At least one reported dimension, or the gravity regime, excludes this cabin.",
};

/** What the cabin burns, when it is known: a material key from MATERIAL_TERMS and a specimen geometry. */
export interface CabinSpecimen {
  materialId: string | null;
  geometry: SpecimenGeometry | null;
}

export interface MaterialCheck {
  status: "same" | "different" | "not-itemized";
  /** The record's tested fuels, as the index lists them. */
  tested: string[];
  detail: string;
}

export interface GeometryCheck {
  status: "same" | "different" | "not-reported";
  tested: SpecimenGeometry[];
  detail: string;
}

export interface EvidenceMatch {
  recordId: string;
  status: EvidenceMatchStatus;
  label: string;
  comparison: EnvelopeComparison;
  /** Tabulated runs IGNIS holds for the record. */
  runsHeld: number;
  matchingRuns: RunMatch[];
  /** The closest run when none matches; null when no run is held. */
  nearestRun: RunMatch | null;
  /** Oxygen, pressure or airflow not reported for the record. */
  missing: Dimension[];
  outside: Dimension[];
  material: MaterialCheck | null;
  geometry: GeometryCheck | null;
  /** Plain sentences explaining the status, most important first. */
  reasons: string[];
}

const UNIT: Record<Exclude<Dimension, "gravity">, string> = { oxygen: "% O₂", pressure: "kPa", airflow: "cm/s" };

function rangeWords(check: RangeCheck, dimension: Exclude<Dimension, "gravity">): string {
  if (!check.range) return "not reported";
  const [low, high] = check.range;
  const join = dimension === "oxygen" ? "" : " ";
  return low === high ? `${low}${join}${UNIT[dimension]}` : `${low}–${high}${join}${UNIT[dimension]}`;
}

function round(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

export function describeRun(run: ExperimentRun): string {
  const parts: string[] = [];
  if (run.oxygenPct) {
    const [low, high] = run.oxygenPct;
    parts.push(`${run.oxygenApprox ? "~" : ""}${low === high ? round(low, 2) : `${round(low, 2)}–${round(high, 2)}`}% O₂`);
  }
  const kpa = runPressureKpa(run);
  if (run.pressure && kpa !== null) parts.push(run.pressure.unit === "kPa" ? `${run.pressure.value} kPa` : `${run.pressure.value} mmHg (${round(kpa)} kPa)`);
  if (run.flowCmS !== null) parts.push(`${run.flowCmS} cm/s`);
  return parts.join(", ") || "no tabulated conditions";
}

/** How a run differs from the cabin, in words: "O₂ 1.2 points off", "pressure not reported". */
export function runDifferences(match: RunMatch, cabin: CabinConditions): string[] {
  const out: string[] = [];
  const { run } = match;
  if (match.oxygen === "differs" && run.oxygenPct) out.push(`O₂ ${round(intervalGap(cabin.oxygenPct, run.oxygenPct[0], run.oxygenPct[1]))} points off`);
  const kpa = runPressureKpa(run);
  if (match.pressure === "differs" && kpa !== null) out.push(`pressure ${round(Math.abs(cabin.pressureKpa - kpa))} kPa off`);
  if (match.airflow === "differs" && run.flowCmS !== null) out.push(`airflow ${round(Math.abs(cabin.flowCmS - run.flowCmS))} cm/s off`);
  if (match.gravity === "differs") out.push(`flown in ${regimeText(run.gravity)}`);
  const cabinValue: Record<Dimension, number> = { oxygen: cabin.oxygenPct, pressure: cabin.pressureKpa, airflow: cabin.flowCmS, gravity: cabin.gravityG };
  for (const dimension of match.missing) out.push(known(cabinValue[dimension]) ? `${DIMENSION_LABEL[dimension]} not reported` : `cabin ${DIMENSION_LABEL[dimension]} not set`);
  if (match.diluentDiffers) out.push("atmosphere includes CO₂ or helium");
  return out.length ? out : ["within tolerance"];
}

function materialCheck(record: InvestigationRecord, specimen: CabinSpecimen | undefined): MaterialCheck | null {
  if (!specimen?.materialId) return null;
  const term = materialTerm(specimen.materialId);
  if (!term) return null;
  const tested = record.conditions.fuels;
  if (!hasSpecificFuels(record)) {
    return { status: "not-itemized", tested, detail: `Tested materials not itemized: ${tested.join("; ")}.` };
  }
  const same = fuelsMatching(record, term);
  if (same.length) return { status: "same", tested, detail: `Same material: tested ${same.join("; ")}.` };
  return { status: "different", tested, detail: `Different material: tested ${tested.join("; ")}; not ${term.label}.` };
}

function geometryCheck(record: InvestigationRecord, specimen: CabinSpecimen | undefined): GeometryCheck | null {
  if (!specimen?.geometry) return null;
  const tested = recordGeometry(record);
  if (!tested.length) return { status: "not-reported", tested, detail: "Specimen geometry not stated in the index." };
  if (tested.includes(specimen.geometry)) return { status: "same", tested, detail: `Includes ${GEOMETRY_SHORT[specimen.geometry]} specimens.` };
  return {
    status: "different",
    tested,
    detail: `Different geometry: tested ${listJoin(tested.map((item) => GEOMETRY_SHORT[item]))} specimens, not ${GEOMETRY_SHORT[specimen.geometry]}.`,
  };
}

/**
 * The evidence status of one record for one cabin:
 *  - "matching-run": a tabulated run matches O₂, pressure, airflow and gravity together, within RUN_TOLERANCE;
 *  - "outside": a reported range, or the gravity regime, excludes the cabin;
 *  - "insufficient": nothing excludes the cabin, but O₂, pressure or airflow is not reported;
 *  - "within-ranges": every dimension is reported and includes the cabin, but no run-level match is established.
 * Material and geometry never change the status; they are reported beside it.
 */
export function evidenceMatch(record: InvestigationRecord, cabin: CabinConditions, specimen?: CabinSpecimen): EvidenceMatch {
  const comparison = compareWithRecord(record, cabin);
  const runs = runsForRecord(record.id).map((run) => matchRun(run, cabin));
  const matchingRuns = runs.filter((item) => item.matches);
  const nearestRun = matchingRuns.length ? null : runs.reduce<RunMatch | null>((best, item) => (!best || item.distance < best.distance ? item : best), null);
  const missing = comparison.notTabulated;
  const outside = comparison.outside;
  const reasons: string[] = [];

  let status: EvidenceMatchStatus;
  if (matchingRuns.length) {
    status = "matching-run";
    const names = matchingRuns.slice(0, 3).map((item) => `${item.run.label} (${describeRun(item.run)})`);
    const regime = regimeText(matchingRuns[0].run.gravity);
    reasons.push(
      matchingRuns.length === 1
        ? `${names[0]} matches this cabin in ${regime}.`
        : `${matchingRuns.length} tabulated runs match this cabin in ${regime}, including ${listJoin(names)}.`,
    );
  } else if (outside.length) {
    status = "outside";
    for (const dimension of outside) {
      if (dimension === "gravity") {
        const tested = listJoin(record.gravity.map(regimeText));
        reasons.push(
          comparison.gravity.regime
            ? `Not tested in ${regimeText(comparison.gravity.regime)}; tested in ${tested}.`
            : `Cabin gravity lies between the indexed regimes; tested in ${tested}.`,
        );
      } else {
        const check = comparison[dimension];
        reasons.push(`Cabin ${DIMENSION_LABEL[dimension]} is ${check.status} the tested ${rangeWords(check, dimension)}.`);
      }
    }
  } else if (missing.length || comparison.cabinUnknown.length) {
    status = "insufficient";
    if (comparison.cabinUnknown.length) {
      reasons.push(`Cabin ${listJoin(comparison.cabinUnknown.map((item) => DIMENSION_LABEL[item]))} not set to a number, so coverage cannot be established.`);
    }
    if (missing.length) reasons.push(`${listJoin(missing.map((item) => DIMENSION_LABEL[item]))} not reported for this record${missing.length === 3 ? "" : "; the reported ranges cover this cabin's values"}.`.replace(/^./, (c) => c.toUpperCase()));
  } else {
    status = "within-ranges";
    reasons.push(
      runs.length
        ? `Each reported range covers this cabin's value, but none of the ${runs.length} tabulated runs matches the combination within tolerance.`
        : "Each reported range covers this cabin's value, but IGNIS holds no run-level table for this record, so the combination is not shown to have been tested.",
    );
  }

  if (status !== "matching-run" && nearestRun) {
    reasons.push(`Nearest tabulated run: ${nearestRun.run.label} (${describeRun(nearestRun.run)}); ${listJoin(runDifferences(nearestRun, cabin))}.`);
  }

  const material = materialCheck(record, specimen);
  const geometry = geometryCheck(record, specimen);
  if (material && material.status !== "same") reasons.push(material.detail);
  if (geometry && geometry.status === "different") reasons.push(geometry.detail);

  return {
    recordId: record.id,
    status,
    label: EVIDENCE_MATCH_LABEL[status],
    comparison,
    runsHeld: runs.length,
    matchingRuns,
    nearestRun,
    missing,
    outside,
    material,
    geometry,
    reasons,
  };
}

/** Every record that tabulates a range or holds runs, with its evidence status for the cabin. */
export function matchCabinWithIndex(
  cabin: CabinConditions,
  specimen?: CabinSpecimen,
  records: InvestigationRecord[] = INVESTIGATIONS,
): Array<{ record: InvestigationRecord; match: EvidenceMatch }> {
  return records
    .filter((record) => hasTabulatedRanges(record) || runsForRecord(record.id).length > 0)
    .map((record) => ({ record, match: evidenceMatch(record, cabin, specimen) }));
}

export const EVIDENCE_MATCH_ORDER: EvidenceMatchStatus[] = ["matching-run", "within-ranges", "insufficient", "outside"];

export function countByStatus(matches: EvidenceMatch[]): Record<EvidenceMatchStatus, number> {
  const counts: Record<EvidenceMatchStatus, number> = { "matching-run": 0, "within-ranges": 0, insufficient: 0, outside: 0 };
  for (const match of matches) counts[match.status] += 1;
  return counts;
}
