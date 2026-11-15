import { describe, expect, it } from "vitest";
import type { InvestigationRecord } from "@/data/research/investigations";
import { INVESTIGATIONS } from "@/data/research/investigations";
import {
  checkRange,
  compareCabinWithIndex,
  compareWithRecord,
  gravityRegimeFor,
  hasTabulatedRanges,
  type CabinConditions,
} from "./envelope";

function record(overrides: Partial<InvestigationRecord> = {}): InvestigationRecord {
  return {
    id: "test-record",
    name: "Test record",
    title: "Test record",
    kind: "flight-experiment",
    organization: "Test",
    platform: "Test",
    period: "Test",
    summary: "Test",
    findings: [],
    pillars: ["crew-environments"],
    topics: ["flammability-limits"],
    gravity: ["0g"],
    conditions: { oxygenPct: [20, 30], pressureKpa: [50, 100], flowCmS: [5, 20], fuels: [] },
    environments: [],
    modelUse: [],
    controlsUse: [],
    holdings: [],
    links: { psi: [], ntrs: [], sources: [] },
    ...overrides,
  };
}

const inside: CabinConditions = { oxygenPct: 25, pressureKpa: 70, flowCmS: 10, gravityG: 0 };

describe("checkRange", () => {
  it("treats range ends as inside", () => {
    expect(checkRange(20, [20, 30]).status).toBe("inside");
    expect(checkRange(30, [20, 30]).status).toBe("inside");
  });
  it("reports below and above", () => {
    expect(checkRange(19.9, [20, 30]).status).toBe("below");
    expect(checkRange(30.1, [20, 30]).status).toBe("above");
  });
  it("reports a missing range as not tabulated", () => {
    expect(checkRange(25, undefined)).toEqual({ status: "not-tabulated", value: 25, range: null });
  });
  it("accepts a single-value range", () => {
    expect(checkRange(20, [20, 20]).status).toBe("inside");
    expect(checkRange(21, [20, 20]).status).toBe("above");
  });
});

describe("gravityRegimeFor", () => {
  it("maps the four indexed regimes", () => {
    expect(gravityRegimeFor(0)).toBe("0g");
    expect(gravityRegimeFor(0.165)).toBe("lunar");
    expect(gravityRegimeFor(0.38)).toBe("mars");
    expect(gravityRegimeFor(1)).toBe("1g");
  });
  it("accepts small differences such as 0.16 g and 0.378 g", () => {
    expect(gravityRegimeFor(0.16)).toBe("lunar");
    expect(gravityRegimeFor(0.378)).toBe("mars");
    expect(gravityRegimeFor(0.001)).toBe("0g");
  });
  it("returns null between regimes", () => {
    expect(gravityRegimeFor(0.6)).toBeNull();
    expect(gravityRegimeFor(0.27)).toBeNull();
  });
});

describe("compareWithRecord", () => {
  it("finds a cabin inside every tested range", () => {
    const result = compareWithRecord(record(), inside);
    expect(result.outside).toEqual([]);
    expect(result.notTabulated).toEqual([]);
    expect(result.gravity).toEqual({ regime: "0g", tested: true });
  });
  it("names oxygen when only oxygen falls outside", () => {
    const result = compareWithRecord(record(), { ...inside, oxygenPct: 32 });
    expect(result.oxygen.status).toBe("above");
    expect(result.outside).toEqual(["oxygen"]);
  });
  it("names pressure when only pressure falls outside", () => {
    const result = compareWithRecord(record(), { ...inside, pressureKpa: 40 });
    expect(result.pressure.status).toBe("below");
    expect(result.outside).toEqual(["pressure"]);
  });
  it("names airflow when only airflow falls outside", () => {
    const result = compareWithRecord(record(), { ...inside, flowCmS: 25 });
    expect(result.airflow.status).toBe("above");
    expect(result.outside).toEqual(["airflow"]);
  });
  it("names gravity when the regime was not tested", () => {
    const result = compareWithRecord(record(), { ...inside, gravityG: 0.165 });
    expect(result.gravity).toEqual({ regime: "lunar", tested: false });
    expect(result.outside).toEqual(["gravity"]);
  });
  it("matches lunar, Martian and Earth gravity against the record's regimes", () => {
    const all = record({ gravity: ["0g", "lunar", "mars", "1g"] });
    for (const gravityG of [0, 0.165, 0.38, 1]) {
      expect(compareWithRecord(all, { ...inside, gravityG }).gravity.tested).toBe(true);
    }
    const earthOnly = record({ gravity: ["1g"] });
    expect(compareWithRecord(earthOnly, { ...inside, gravityG: 1 }).gravity.tested).toBe(true);
    expect(compareWithRecord(earthOnly, { ...inside, gravityG: 0.38 }).gravity.tested).toBe(false);
  });
  it("treats gravity between regimes as untested", () => {
    const all = record({ gravity: ["0g", "lunar", "mars", "1g"] });
    const result = compareWithRecord(all, { ...inside, gravityG: 0.6 });
    expect(result.gravity).toEqual({ regime: null, tested: false });
    expect(result.outside).toContain("gravity");
  });
  it("reports missing ranges as not tabulated, never as inside or outside", () => {
    const partial = record({ conditions: { oxygenPct: [20, 30], fuels: [] } });
    const result = compareWithRecord(partial, { ...inside, pressureKpa: 500, flowCmS: 500 });
    expect(result.pressure.status).toBe("not-tabulated");
    expect(result.airflow.status).toBe("not-tabulated");
    expect(result.notTabulated).toEqual(["pressure", "airflow"]);
    expect(result.outside).toEqual([]);
  });
});

describe("compareCabinWithIndex", () => {
  it("only includes records with at least one numeric range", () => {
    const rows = compareCabinWithIndex(inside);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(({ record: item }) => hasTabulatedRanges(item))).toBe(true);
    const skipped = INVESTIGATIONS.filter((item) => !hasTabulatedRanges(item));
    expect(rows.length + skipped.length).toBe(INVESTIGATIONS.length);
  });
  it("places a 32 % O₂, 10.2 psi lunar cabin outside the Saffire VI oxygen range", () => {
    const rows = compareCabinWithIndex({ oxygenPct: 32, pressureKpa: 10.2 * 6.894757293168361, flowCmS: 5, gravityG: 0.165 });
    const saffire = rows.find(({ record: item }) => item.id === "saffire-vi");
    expect(saffire?.comparison.oxygen.status).toBe("above");
    expect(saffire?.comparison.outside).toContain("gravity");
  });
});
