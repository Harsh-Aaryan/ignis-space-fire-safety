import { describe, expect, it } from "vitest";
import type { FireSample } from "@/lib/fire/model";
import type { SensitivityResult } from "@/lib/fire/sensitivity";
import {
  CO_REFERENCES,
  FUEL_BAR_MIN_SHARE,
  axisPlan,
  chartRows,
  fuelBudget,
  runMarkers,
  shareLabel,
  signedPct,
  summarizeSeries,
  timeTicks,
  tornadoDomain,
  tornadoRows,
} from "@/lib/fire/run-chart-data";

const sample = (t: number, over: Partial<FireSample> = {}): FireSample => ({
  t, hrrW: 0, o2Pct: 21, tempC: 22, coPpm: 0, co2RiseMmHg: 0, smokeMgM3: 0, detectorSmokeMgM3: 0, layerHeightM: 2, ...over,
});

describe("chartRows", () => {
  it("orders by time, drops non-finite rows and keeps the later of duplicate instants", () => {
    const rows = chartRows([sample(4), sample(2, { hrrW: 5 }), sample(Number.NaN), sample(2, { hrrW: 7 })]);
    expect(rows.map((r) => r.t)).toEqual([2, 4]);
    expect(rows[0].hrrW).toBe(7);
  });
  it("copes with an empty history", () => expect(chartRows([])).toEqual([]));
});

describe("runMarkers", () => {
  it("keeps only the moments that happened inside the plotted range", () => {
    const markers = runMarkers({ ignitionTime: 30, firstAlarmTime: null, extinctionTime: 500 }, 300);
    expect(markers.map((m) => m.kind)).toEqual(["ignition"]);
    expect(runMarkers({ ignitionTime: null, firstAlarmTime: null, extinctionTime: null }, 300)).toEqual([]);
    expect(runMarkers({ ignitionTime: 0, firstAlarmTime: 12, extinctionTime: 300 }, 300).map((m) => m.t)).toEqual([0, 12, 300]);
  });
});

describe("axisPlan", () => {
  it("draws a reference level only when it is within or just above the data", () => {
    const near = axisPlan([0, 60, 110], { zeroBase: true, references: CO_REFERENCES });
    expect(near.shown.map((r) => r.value)).toEqual([100]);
    expect(near.offScale.map((r) => r.value)).toEqual([425]);
    expect(near.domain[0]).toBe(0);
    expect(near.domain[1]).toBeGreaterThanOrEqual(110);
  });
  it("does not flatten a small curve to reach a distant reference", () => {
    const small = axisPlan([0, 8, 20], { zeroBase: true, references: CO_REFERENCES });
    expect(small.shown).toEqual([]);
    expect(small.offScale).toHaveLength(2);
    expect(small.domain[1]).toBeLessThan(40);
  });
  it("gives an all-zero series a usable range and hides references", () => {
    const flat = axisPlan([0, 0, 0], { zeroBase: true, references: CO_REFERENCES });
    expect(flat.domain).toEqual([0, 1]);
    expect(flat.shown).toEqual([]);
  });
  it("pads a flat non-zero series so the line is not on the frame", () => {
    const flat = axisPlan([21, 21, 21], { zeroBase: false });
    expect(flat.domain[0]).toBeLessThan(21);
    expect(flat.domain[1]).toBeGreaterThan(21);
  });
  it("returns evenly spaced ticks that start and end on the domain", () => {
    const plan = axisPlan([29.1, 30.3], { zeroBase: false });
    expect(plan.ticks[0]).toBe(plan.domain[0]);
    expect(plan.ticks[plan.ticks.length - 1]).toBe(plan.domain[1]);
    const gaps = plan.ticks.slice(1).map((t, i) => Math.round((t - plan.ticks[i]) * 1e6));
    expect(new Set(gaps).size).toBe(1);
    expect(plan.ticks.length).toBeLessThanOrEqual(8);
  });
  it("keeps a padded axis at least minSpan wide so tiny changes stay small", () => {
    const plan = axisPlan([31.99, 32.01], { zeroBase: false, minSpan: 1 });
    expect(plan.domain[1] - plan.domain[0]).toBeGreaterThanOrEqual(1);
    expect(plan.domain[0]).toBeLessThan(31.99);
    expect(plan.domain[1]).toBeGreaterThan(32.01);
  });
  it("leaves the requested headroom above the highest value", () => {
    const plan = axisPlan([0, 909], { zeroBase: true, headroom: 1.3 });
    expect(plan.domain[1]).toBeGreaterThanOrEqual(909 * 1.3);
    expect(axisPlan([0, 909], { zeroBase: true }).domain[1]).toBeLessThan(plan.domain[1] + 1);
  });
  it("handles no values", () => expect(axisPlan([], { zeroBase: false }).domain.every(Number.isFinite)).toBe(true));
});

describe("summarizeSeries", () => {
  const rows = [sample(0, { o2Pct: 21 }), sample(10, { o2Pct: 19.5 }), sample(20, { o2Pct: 20 })];
  it("finds the lowest value and the last sample", () => {
    expect(summarizeSeries(rows, "o2Pct", "min")).toEqual({ peak: 19.5, peakAtS: 10, final: 20 });
  });
  it("returns null for no rows", () => expect(summarizeSeries([], "hrrW")).toBeNull());
});

describe("timeTicks", () => {
  it("places about five ticks at round clock times", () => {
    expect(timeTicks(290)).toEqual([0, 60, 120, 180, 240]);
    expect(timeTicks(100)).toEqual([0, 30, 60, 90]);
  });
  it("is safe for a zero range", () => expect(timeTicks(0)).toEqual([0]));
});

const result = (over: Partial<SensitivityResult>): SensitivityResult => ({
  parameter: "oxygen", label: "Oxygen", unit: "% O₂", baseline: 30.3, low: 29.3, high: 31.3,
  hrrPct: { low: -12.4, high: 9.6 }, coPct: { low: -8, high: null }, hrrSupport: "untested", coSupport: "untested", evidence: "", ...over,
});

describe("tornado helpers", () => {
  it("builds one row per input with the perturbed input values", () => {
    const rows = tornadoRows([result({}), result({ parameter: "airflow", label: "Airflow", unit: "m/s", low: 0.16, high: null })], "hrr");
    expect(rows[0]).toMatchObject({ label: "Oxygen", low: -12.4, high: 9.6, lowText: "29.3 % O₂", highText: "31.3 % O₂" });
    expect(rows[1]).toMatchObject({ lowText: "0.160 m/s", highText: "" });
  });
  it("reads CO values for the CO metric and keeps missing runs null", () => {
    expect(tornadoRows([result({})], "co")[0]).toMatchObject({ low: -8, high: null });
  });
  it("uses a symmetric range with room for labels, and a floor for tiny changes", () => {
    const [lo, hi] = tornadoDomain(tornadoRows([result({})], "hrr"));
    expect(hi).toBe(-lo);
    expect(hi).toBeGreaterThan(12.4);
    expect(tornadoDomain([])).toEqual([-5, 5]);
  });
  it("formats signed percentages", () => {
    expect(signedPct(9.6)).toBe("+10 %");
    expect(signedPct(-12.4)).toBe("-12 %");
    expect(signedPct(null)).toBe("–");
  });
});

describe("shareLabel", () => {
  it("rounds, and does not show a small non-zero share as zero", () => {
    expect(shareLabel(0.4)).toBe("40");
    expect(shareLabel(0.002)).toBe("<1");
    expect(shareLabel(0)).toBe("0");
  });
});

describe("fuelBudget", () => {
  it("splits total fuel into pyrolysed and remaining grams", () => {
    expect(fuelBudget({ fuelTotalKg: 0.03, fuelPyrolysedKg: 0.012 })).toMatchObject({ totalG: 30, usedG: 12, remainingG: 18, usedFraction: 0.4 });
  });
  it("marks small shares as too thin for a bar", () => {
    const small = fuelBudget({ fuelTotalKg: 0.878, fuelPyrolysedKg: 0.0014 })!;
    expect(small.usedFraction).toBeLessThan(FUEL_BAR_MIN_SHARE);
    expect(fuelBudget({ fuelTotalKg: 1, fuelPyrolysedKg: 0.2 })!.usedFraction).toBeGreaterThanOrEqual(FUEL_BAR_MIN_SHARE);
  });
  it("clamps over-consumption and returns null without fuel", () => {
    expect(fuelBudget({ fuelTotalKg: 0.01, fuelPyrolysedKg: 0.02 })?.remainingG).toBe(0);
    expect(fuelBudget({ fuelTotalKg: 0, fuelPyrolysedKg: 0 })).toBeNull();
  });
});
