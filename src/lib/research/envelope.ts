import {
  GRAVITY_REGIMES,
  INVESTIGATIONS,
  type GravityRegime,
  type InvestigationRecord,
} from "@/data/research/investigations";

/**
 * Compares a cabin's atmosphere with the conditions a record actually tested.
 * Pure and deterministic: no scores, no weighting, only inside / outside / not tabulated.
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

export function checkRange(value: number, range: [number, number] | undefined): RangeCheck {
  if (!range) return { status: "not-tabulated", value, range: null };
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
  if (!gravity.tested) outside.push("gravity");
  const notTabulated = ranges.filter(([, check]) => check.status === "not-tabulated").map(([dimension]) => dimension);

  return { recordId: record.id, oxygen, pressure, airflow, gravity, outside, notTabulated };
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
