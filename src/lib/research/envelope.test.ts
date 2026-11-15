import { describe, expect, it } from "vitest";
import type { InvestigationRecord } from "@/data/research/investigations";
import { INVESTIGATIONS } from "@/data/research/investigations";
import { EXPERIMENT_RUNS, runPressureKpa } from "@/data/research/runs";
import {
  RUN_TOLERANCE,
  checkRange,
  compareCabinWithIndex,
  compareWithRecord,
  countByStatus,
  evidenceMatch,
  gravityRegimeFor,
  hasTabulatedRanges,
  matchCabinWithIndex,
  matchRun,
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
  it("never places a value that is not a finite number inside or outside a range", () => {
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      expect(checkRange(value, [20, 30]).status).toBe("not-tabulated");
    }
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

describe("matchRun", () => {
  const vi3 = EXPERIMENT_RUNS.find((run) => run.id === "saffire-vi-paper:VI-3")!;
  const atVi3: CabinConditions = { oxygenPct: 30.3, pressureKpa: 54.6, flowCmS: 20, gravityG: 0 };
  it("matches a run at its own conditions", () => {
    const result = matchRun(vi3, atVi3);
    expect(result.matches).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.differs).toEqual([]);
  });
  it("applies the stated tolerances at their edges", () => {
    expect(matchRun(vi3, { ...atVi3, oxygenPct: 30.3 + RUN_TOLERANCE.oxygenPct }).oxygen).toBe("match");
    expect(matchRun(vi3, { ...atVi3, oxygenPct: 30.3 + RUN_TOLERANCE.oxygenPct + 0.1 }).oxygen).toBe("differs");
    expect(matchRun(vi3, { ...atVi3, pressureKpa: 54.6 - RUN_TOLERANCE.pressureKpa }).pressure).toBe("match");
    expect(matchRun(vi3, { ...atVi3, pressureKpa: 54.6 - RUN_TOLERANCE.pressureKpa - 0.1 }).pressure).toBe("differs");
    expect(matchRun(vi3, { ...atVi3, flowCmS: 20 + RUN_TOLERANCE.flowCmS + 0.1 }).airflow).toBe("differs");
    expect(matchRun(vi3, { ...atVi3, gravityG: 0.165 }).gravity).toBe("differs");
  });
  it("never matches a run that does not report a dimension", () => {
    const saffireI = EXPERIMENT_RUNS.find((run) => run.id === "PSI-98:S1")!;
    const result = matchRun(saffireI, { oxygenPct: 21.6, pressureKpa: 101.3, flowCmS: 20, gravityG: 0 });
    expect(result.oxygen).toBe("match");
    expect(result.airflow).toBe("match");
    expect(result.pressure).toBe("not-reported");
    expect(result.matches).toBe(false);
  });
  it("does not treat a CO₂- or helium-diluted FLEX atmosphere as an oxygen–nitrogen cabin", () => {
    const diluted = EXPERIMENT_RUNS.find((run) => run.table === "PSI-69" && run.diluents && run.diluents.co2 > 0)!;
    const result = matchRun(diluted, { oxygenPct: diluted.oxygenPct![0], pressureKpa: runPressureKpa(diluted)!, flowCmS: 0, gravityG: 0 });
    expect(result.diluentDiffers).toBe(true);
    expect(result.matches).toBe(false);
  });
});

describe("evidenceMatch", () => {
  const saffireVi = INVESTIGATIONS.find((item) => item.id === "saffire-vi")!;
  const saffireI = INVESTIGATIONS.find((item) => item.id === "saffire-i-iii")!;
  const flex = INVESTIGATIONS.find((item) => item.id === "flex")!;
  const wires = INVESTIGATIONS.find((item) => item.id === "partial-gravity-wires")!;

  it("reports a matching experimental run when one tabulated run matches the combination", () => {
    const result = evidenceMatch(saffireVi, { oxygenPct: 30.2, pressureKpa: 55.0, flowCmS: 20, gravityG: 0 });
    expect(result.status).toBe("matching-run");
    expect(result.label).toBe("Matching experimental run");
    expect(result.matchingRuns.map((item) => item.run.id)).toEqual(["saffire-vi-paper:VI-3"]);
    expect(result.reasons[0]).toContain("Test VI-3");
  });

  it("reports within reported ranges when each range includes the cabin but no run matches", () => {
    // 26 % O₂ and 70 kPa each lie inside Saffire VI's 22–31 % and 54.1–100 kPa, but no test ran there.
    const result = evidenceMatch(saffireVi, { oxygenPct: 26, pressureKpa: 70, flowCmS: 20, gravityG: 0 });
    expect(result.comparison.outside).toEqual([]);
    expect(result.comparison.notTabulated).toEqual([]);
    expect(result.status).toBe("within-ranges");
    expect(result.label).toBe("Within reported ranges");
    expect(result.matchingRuns).toEqual([]);
    expect(result.nearestRun).not.toBeNull();
    expect(result.reasons.join(" ")).toContain("none of the 4 tabulated runs");
  });

  it("reports within reported ranges, without a run table, for a record that holds none", () => {
    const result = evidenceMatch(record(), inside);
    expect(result.status).toBe("within-ranges");
    expect(result.runsHeld).toBe(0);
    expect(result.reasons[0]).toContain("no run-level table");
  });

  it("reports insufficient information when a needed dimension is not reported", () => {
    const result = evidenceMatch(saffireI, { oxygenPct: 21.6, pressureKpa: 101.3, flowCmS: 20, gravityG: 0 });
    expect(result.status).toBe("insufficient");
    expect(result.label).toBe("Insufficient information");
    expect(result.missing).toEqual(["pressure"]);
    expect(result.reasons[0]).toMatch(/^Pressure not reported/);
    expect(result.nearestRun?.missing).toContain("pressure");
  });

  it("reports insufficient information for FLEX, whose table has no airflow", () => {
    const result = evidenceMatch(flex, { oxygenPct: 21, pressureKpa: 101.325, flowCmS: 5, gravityG: 0 });
    expect(result.status).toBe("insufficient");
    expect(result.missing).toEqual(["pressure", "airflow"]);
    expect(result.matchingRuns).toEqual([]);
  });

  it("reports outside when a reported range or the gravity regime excludes the cabin", () => {
    const lunar = { oxygenPct: 32, pressureKpa: 10.2 * 6.894757293168361, flowCmS: 5, gravityG: 0.165 };
    const result = evidenceMatch(saffireVi, lunar);
    expect(result.status).toBe("outside");
    expect(result.outside).toEqual(expect.arrayContaining(["oxygen", "gravity"]));
    expect(result.reasons.some((reason) => reason.startsWith("Not tested in lunar gravity (0.165 g); tested in microgravity"))).toBe(true);
  });

  it("takes outside over insufficient when both apply", () => {
    const result = evidenceMatch(saffireI, { oxygenPct: 30, pressureKpa: 70, flowCmS: 20, gravityG: 0 });
    expect(result.missing).toEqual(["pressure"]);
    expect(result.status).toBe("outside");
  });

  it("names a different material and geometry without changing the status", () => {
    const cabin = { oxygenPct: 30.5, pressureKpa: 55.0, flowCmS: 20, gravityG: 0 };
    const plain = evidenceMatch(saffireVi, cabin);
    const kapton = evidenceMatch(saffireVi, cabin, { materialId: "kapton", geometry: "wire" });
    expect(kapton.status).toBe(plain.status);
    expect(kapton.material?.status).toBe("different");
    expect(kapton.material?.detail).toBe(
      "Different material: tested Cotton–fiberglass fabric (SIBAL); Cast acrylic (PMMA) slabs; not Kapton (polyimide).",
    );
    expect(kapton.geometry?.status).toBe("different");
    expect(kapton.geometry?.detail).toContain("tested thin and thick specimens");
    const pmma = evidenceMatch(saffireVi, cabin, { materialId: "pmma", geometry: "thick" });
    expect(pmma.material?.status).toBe("same");
    expect(pmma.geometry?.status).toBe("same");
    expect(evidenceMatch(wires, cabin, { materialId: "wire", geometry: "wire" }).material?.status).toBe("same");
  });

  it("returns insufficient information, never a match, when a cabin value is not a number", () => {
    const atVi3 = { oxygenPct: 30.2, pressureKpa: 55.0, flowCmS: 20, gravityG: 0 };
    for (const patch of [{ oxygenPct: Number.NaN }, { pressureKpa: Number.NaN }, { flowCmS: Infinity }, { gravityG: Number.NaN }]) {
      const result = evidenceMatch(saffireVi, { ...atVi3, ...patch });
      expect(result.status, JSON.stringify(patch)).toBe("insufficient");
      expect(result.matchingRuns).toEqual([]);
      expect(result.comparison.cabinUnknown).toHaveLength(1);
      expect(result.outside).toEqual([]);
      expect(result.reasons[0]).toMatch(/^Cabin (oxygen|pressure|airflow|gravity) not set to a number/);
    }
    const vi3 = EXPERIMENT_RUNS.find((run) => run.id === "saffire-vi-paper:VI-3")!;
    const nan = matchRun(vi3, { ...atVi3, oxygenPct: Number.NaN });
    expect(nan.oxygen).toBe("not-reported");
    expect(nan.matches).toBe(false);
    expect(Number.isFinite(nan.distance)).toBe(true);
    // A real exclusion still wins over an unknown value.
    expect(evidenceMatch(saffireVi, { ...atVi3, oxygenPct: Number.NaN, gravityG: 0.165 }).status).toBe("outside");
  });

  it("says when a record does not itemize its materials", () => {
    const generic = record({ conditions: { oxygenPct: [20, 30], pressureKpa: [50, 100], flowCmS: [5, 20], fuels: ["Any candidate spacecraft material"] } });
    expect(evidenceMatch(generic, inside, { materialId: "pmma", geometry: null }).material?.status).toBe("not-itemized");
  });
});

describe("matchCabinWithIndex", () => {
  it("covers every record with a range or a run table and counts each status", () => {
    const rows = matchCabinWithIndex({ oxygenPct: 21, pressureKpa: 101.3, flowCmS: 20, gravityG: 0 });
    expect(rows.length).toBe(compareCabinWithIndex(inside).length);
    const counts = countByStatus(rows.map((row) => row.match));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(rows.length);
    // No held run tabulates this ISS-like combination.
    expect(counts["matching-run"]).toBe(0);
  });
});
