import type { FireSample, FireState } from "./model";
import type { SensitivityResult } from "./sensitivity";

/**
 * Pure data shaping for the run charts on the Results page. Nothing here invents a value:
 * every number is taken from the run history, the final state or the sensitivity output.
 */

/** History rows ready to plot: finite, in time order, one row per instant (the later row wins). */
export function chartRows(history: readonly FireSample[]): FireSample[] {
  const clean = history.filter((row) => Number.isFinite(row.t)).sort((a, b) => a.t - b.t);
  const rows: FireSample[] = [];
  for (const row of clean) {
    if (rows.length && rows[rows.length - 1].t === row.t) rows[rows.length - 1] = row;
    else rows.push(row);
  }
  return rows;
}

export type MarkerKind = "ignition" | "alarm" | "flameOut";
export interface RunMarker { kind: MarkerKind; label: string; t: number }

/** Ignition, first alarm and flame-out times that fall inside the plotted time range. */
export function runMarkers(
  state: Pick<FireState, "ignitionTime" | "firstAlarmTime" | "extinctionTime">,
  tMax: number,
): RunMarker[] {
  const candidates: Array<[MarkerKind, string, number | null]> = [
    ["ignition", "Ignition", state.ignitionTime],
    ["alarm", "First alarm", state.firstAlarmTime],
    ["flameOut", "Flame out", state.extinctionTime],
  ];
  return candidates.flatMap(([kind, label, t]) => (t !== null && Number.isFinite(t) && t >= 0 && t <= tMax + 1e-9 ? [{ kind, label, t }] : []));
}

/** A fixed level the model code already compares against. These are reference crossings, never verdicts. */
export interface ReferenceLevel { value: number; label: string }

export const CO_REFERENCES: ReferenceLevel[] = [
  { value: 100, label: "100 ppm (24 h reference)" },
  { value: 425, label: "425 ppm (1 h reference)" },
];
export const CO2_REFERENCES: ReferenceLevel[] = [{ value: 3, label: "3 mmHg (1 h reference)" }];

/** Reference lines count as "near" the data while they sit no higher than this multiple of the series maximum. */
export const REFERENCE_REACH = 1.25;

/** Smallest "nice" step (1, 2, 5 × 10^k) that is at least `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * magnitude;
}

export interface AxisPlan {
  domain: [number, number];
  /** Evenly spaced tick values from the bottom to the top of the domain. */
  ticks: number[];
  /** Reference levels that are drawn. */
  shown: ReferenceLevel[];
  /** Reference levels left off because they sit far above the data; the caption names them instead. */
  offScale: ReferenceLevel[];
  min: number;
  max: number;
}

/**
 * The y range for one series. Quantities that start at zero keep zero as the floor; temperature and
 * oxygen use a padded range. A reference level is drawn only if it is within or just above the data
 * (see REFERENCE_REACH), so a small CO curve is not flattened by a distant line.
 */
function evenTicks(lo: number, hi: number, step: number): number[] {
  const ticks: number[] = [];
  for (let i = 0; lo + i * step <= hi + step * 1e-9; i++) ticks.push(Math.round((lo + i * step) * 1e9) / 1e9);
  return ticks;
}

export function axisPlan(values: readonly number[], options: { zeroBase: boolean; references?: readonly ReferenceLevel[]; minSpan?: number; headroom?: number }): AxisPlan {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 0;
  const refs = options.references ?? [];
  const shown = refs.filter((ref) => max > 0 && ref.value <= max * REFERENCE_REACH);
  const offScale = refs.filter((ref) => !shown.includes(ref));
  const top = Math.max(max, ...shown.map((ref) => ref.value));

  if (options.zeroBase) {
    if (!(top > 0)) return { domain: [0, 1], ticks: [0, 0.5, 1], shown, offScale, min, max };
    // Space above the highest value, so a label can sit beside the peak inside the plot.
    const ceiling = top * (options.headroom ?? 1.08);
    const step = niceStep(ceiling / 4);
    const hi = Math.round(Math.ceil(ceiling / step) * step * 1e9) / 1e9;
    return { domain: [0, hi], ticks: evenTicks(0, hi, step), shown, offScale, min, max };
  }
  // A padded range never shrinks below minSpan, so a change of a few hundredths does not look like a swing.
  const minSpan = options.minSpan ?? 0;
  const lift = top - min < minSpan ? (minSpan - (top - min)) / 2 : 0;
  const span = Math.max(top - min, minSpan);
  const pad = span > 1e-9 ? span * 0.1 : Math.max(0.5, Math.abs(min) * 0.01);
  const step = niceStep((span + 2 * pad) / 4);
  const lo = Math.round(Math.floor((min - lift - pad) / step) * step * 1e9) / 1e9;
  const hi = Math.round(Math.ceil((top + lift + pad) / step) * step * 1e9) / 1e9;
  return { domain: [lo, hi], ticks: evenTicks(lo, hi, step), shown, offScale, min, max };
}

export interface SeriesSummary { peak: number; peakAtS: number; final: number }

/** Largest (or smallest) value of a series, when it occurs, and the value at the last sample. */
export function summarizeSeries(rows: readonly FireSample[], key: keyof Omit<FireSample, "t">, extreme: "max" | "min" = "max"): SeriesSummary | null {
  if (!rows.length) return null;
  let best = rows[0];
  for (const row of rows) if (extreme === "max" ? row[key] > best[key] : row[key] < best[key]) best = row;
  return { peak: best[key], peakAtS: best.t, final: rows[rows.length - 1][key] };
}

/** "+12 %" / "−3 %" rounded to whole percent; "–" when the run was not made. */
export function signedPct(value: number | null): string {
  if (value === null) return "–";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} %`;
}

export interface TornadoRow {
  parameter: SensitivityResult["parameter"];
  label: string;
  /** % change when the input is lowered / raised; null where that run does not exist. */
  low: number | null;
  high: number | null;
  lowText: string;
  highText: string;
}

function inputText(value: number | null, result: SensitivityResult): string {
  return value === null ? "" : `${value.toFixed(result.parameter === "airflow" ? 3 : 1)} ${result.unit}`;
}

export function tornadoRows(results: readonly SensitivityResult[], metric: "hrr" | "co"): TornadoRow[] {
  return results.map((result) => {
    const change = metric === "hrr" ? result.hrrPct : result.coPct;
    return {
      parameter: result.parameter,
      label: result.label,
      low: change.low,
      high: change.high,
      lowText: inputText(result.low, result),
      highText: inputText(result.high, result),
    };
  });
}

/** A symmetric x range around zero with room for the value labels at the bar tips. */
export function tornadoDomain(rows: readonly TornadoRow[]): [number, number] {
  const widest = Math.max(0, ...rows.flatMap((row) => [row.low, row.high]).filter((v): v is number => v !== null && Number.isFinite(v)).map(Math.abs));
  const raw = widest * 1.8;
  const step = niceStep(raw / 2);
  const bound = Math.max(5, Math.ceil(raw / step) * step);
  return [-bound, bound];
}

/** Whole percent, with "<1" for a share that is above zero but rounds to it. */
export function shareLabel(fraction: number): string {
  const pct = fraction * 100;
  return pct > 0 && pct < 1 ? "<1" : String(Math.round(pct));
}

/** Below this share of the fuel the bar would be a sliver, so the figures are given as a line instead. */
export const FUEL_BAR_MIN_SHARE = 0.05;

export interface FuelBudget { totalG: number; usedG: number; remainingG: number; usedFraction: number }

/** Fuel pyrolysed against what is left, in grams. Null when the run has no fuel mass. */
export function fuelBudget(state: Pick<FireState, "fuelTotalKg" | "fuelPyrolysedKg">): FuelBudget | null {
  const totalG = state.fuelTotalKg * 1000;
  if (!(totalG > 0) || !Number.isFinite(totalG)) return null;
  const usedG = Math.min(totalG, Math.max(0, state.fuelPyrolysedKg * 1000));
  return { totalG, usedG, remainingG: totalG - usedG, usedFraction: usedG / totalG };
}

const TIME_STEPS_S = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400];

/** Tick positions at round clock times (every 30 s, 1 min, 5 min…), about five across the range. */
export function timeTicks(tMax: number): number[] {
  if (!(tMax > 0) || !Number.isFinite(tMax)) return [0];
  const step = TIME_STEPS_S.find((s) => tMax / s <= 5) ?? TIME_STEPS_S[TIME_STEPS_S.length - 1];
  const ticks: number[] = [];
  for (let t = 0; t <= tMax + 1e-9; t += step) ticks.push(t);
  return ticks;
}
