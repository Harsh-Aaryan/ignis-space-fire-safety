import { describe, expect, it } from "vitest";
import { SAFFIRE_BENCHMARKS, SAFFIRE_IV_VI_EMISSION, SAFFIRE_VI3_SMOKE_TIMELINE, peakHrrAnalyses } from "@/data/fire/options";
import { ACCURACY_SUMMARY, EVALUATION_SNAPSHOT, accuracyCue, peakHrrRangeStatus } from "@/lib/fire/accuracy";
import { STORED_COEFFICIENTS, independentChecks, thickGrowthChecks } from "@/lib/fire/benchmarks";
import { saffireInput } from "@/lib/fire/scenario";

/**
 * Where ICES-2026-577 is compared with the model, and what each comparison can establish.
 * The calibration set (SAFFIRE_BENCHMARKS, ICES-2024-365) and the calibrated coefficients are not changed by it.
 */

describe("calibration is untouched by ICES-2026-577", () => {
  it("keeps the ICES-2024-365 peak heat release as the calibration value", () => {
    expect(SAFFIRE_BENCHMARKS.map((b) => [b.id, b.peakHeatW])).toEqual([["IV-1", null], ["VI-2", 3217], ["VI-3", 3080], ["VI-4", 1507]]);
    for (const row of EVALUATION_SNAPSHOT.rows.filter((r) => r.hrrBasis === "peak")) {
      expect(row.measured.hrrW).toBe(SAFFIRE_BENCHMARKS.find((b) => b.id === row.id)!.peakHeatW);
    }
  });

  it("keeps the stored coefficients at their calibrated values", () => {
    expect(STORED_COEFFICIENTS.sibalSpreadMmS).toBeCloseTo(4.6842, 3);
    expect(STORED_COEFFICIENTS.pmmaFluxGm2s).toBeCloseTo(0.82102, 4);
    expect(STORED_COEFFICIENTS.pmmaThickSpreadMmS).toBeCloseTo(0.55719, 4);
    expect(STORED_COEFFICIENTS.sibalCoCo2).toBeCloseTo(0.046455, 5);
    expect(STORED_COEFFICIENTS.pmmaCoCo2).toBeCloseTo(0.037699, 5);
  });
});

describe("peak heat release measured range", () => {
  it("spans the two NASA analyses for VI-2, VI-3 and VI-4 and exists nowhere else", () => {
    expect(peakHrrAnalyses("VI-2")).toEqual({ ices2024W: 3217, ices2026W: 3376, lowW: 3217, highW: 3376 });
    expect(peakHrrAnalyses("VI-3")).toEqual({ ices2024W: 3080, ices2026W: 3240, lowW: 3080, highW: 3240 });
    expect(peakHrrAnalyses("VI-4")).toEqual({ ices2024W: 1507, ices2026W: 1487, lowW: 1487, highW: 1507 });
    for (const id of ["IV-1", "IV-2", "V-2", "V-3", "unknown"]) expect(peakHrrAnalyses(id), id).toBeNull();
  });

  it("reports whether the committed model peak falls inside the range, without moving any threshold", () => {
    const status = peakHrrRangeStatus(EVALUATION_SNAPSHOT.rows);
    expect(status.map((s) => s.id)).toEqual(["VI-2", "VI-3", "VI-4"]);
    for (const s of status) {
      const row = EVALUATION_SNAPSHOT.rows.find((r) => r.id === s.id)!;
      expect(s.inSampleInside).toBe(row.inSample.peakHrrW >= s.lowW && row.inSample.peakHrrW <= s.highW);
      expect(s.heldOutInside).toBe(row.heldOut.peakHrrW >= s.lowW && row.heldOut.peakHrrW <= s.highW);
    }
    // The statistics still use the single ICES-2024 value.
    expect(ACCURACY_SUMMARY.find((m) => m.metric === "hrr")!.dataBand).not.toBeNull();
  });

  it("states the two-analysis range in the accuracy cue of a VI-3 run, beside the error against the ICES-2024 value", () => {
    const cue = accuracyCue("hrr", saffireInput(SAFFIRE_BENCHMARKS.find((b) => b.id === "VI-3")!));
    expect(cue.long).toContain("3080–3240 W");
    expect(cue.long).toContain("ICES-2024 value of 3080 W");
  });
});

describe("independent checks against ICES-2026-577", () => {
  const checks = independentChecks();
  const byId = (id: string) => checks.find((c) => c.id === id)!;

  it("labels thin-fuel spread rate as in-sample consistency, with cotton as context only", () => {
    for (const [id, paper] of [["IV-1", 3.6], ["VI-2", 4.05]] as const) {
      const c = byId(`${id} spread rate`);
      expect(c.basis).toBe("in-sample consistency");
      expect(c.source).toBe("saffire-iv-vi-emission");
      expect(Number(c.measured)).toBe(paper);
      expect(Math.abs(c.errorPct!)).toBeLessThan(25);
    }
    expect(SAFFIRE_IV_VI_EMISSION.find((t) => t.id === "V-2")!.flameSpreadRateMmS).toBe(3.4);
    expect(byId("V-2 spread rate")).toMatchObject({ basis: "context", model: "not modelled", verdict: "uninformative", errorPct: null, measured: "3.40" });
  });

  it("compares cabin pressure and far-field temperature rises, which were never fitted", () => {
    const pressure = byId("IV-1 / VI-2 / VI-3 / VI-4 pressure rise"), temperature = byId("IV-1 / VI-2 / VI-3 / VI-4 temperature rise");
    expect(pressure.measured).toBe("0.33 / 0.31 / 0.34 / 0.25");
    expect(temperature.measured).toBe("0.25 / 0.29 / 0.50 / 0.25");
    for (const c of [pressure, temperature]) {
      expect(c.basis).toBe("held-out");
      expect(c.model.split(" / ")).toHaveLength(4);
      expect(c.model.split(" / ").every((v) => Number(v) > 0)).toBe(true);
      expect(c.errorPct!).toBeGreaterThan(100);
      expect(c.verdict).toBe("disagrees");
    }
    expect(temperature.note).toContain("point reading");
  });

  it("compares VI-3 smoke alarm timing from ignition, and does not invent timelines for other tests", () => {
    const t = SAFFIRE_VI3_SMOKE_TIMELINE;
    expect(t.alarm2MgM3S).toBe(SAFFIRE_IV_VI_EMISSION.find((x) => x.id === "VI-3")!.timeToAlarmS);
    expect(byId("VI-3 smoke alarm 2 mg/m³").measured).toBe("400");
    expect(byId("VI-3 smoke alarm 1 mg/m³").measured).toBe("344");
    for (const id of ["VI-3 smoke alarm 2 mg/m³", "VI-3 smoke alarm 1 mg/m³"]) {
      const c = byId(id);
      expect(c.basis).toBe("held-out");
      expect(Number(c.model)).toBeGreaterThan(0);
      expect(c.note).toContain("handbook value");
    }
    expect(checks.filter((c) => /smoke alarm/.test(c.id)).map((c) => c.id.slice(0, 4))).toEqual(["VI-3", "VI-3"]);
    // The model reaches 1 mg/m³ before 2 mg/m³.
    expect(Number(byId("VI-3 smoke alarm 1 mg/m³").model)).toBeLessThan(Number(byId("VI-3 smoke alarm 2 mg/m³").model));
  });

  it("is present in the committed snapshot with the same verdicts", () => {
    for (const c of checks.filter((x) => x.source === "saffire-iv-vi-emission" || /smoke alarm/.test(x.id))) {
      const snap = EVALUATION_SNAPSHOT.independent.find((s) => s.id === c.id);
      expect(snap, c.id).toBeDefined();
      expect(snap!.verdict, c.id).toBe(c.verdict);
      expect(snap!.basis, c.id).toBe(c.basis);
    }
  });
});

describe("thick-fuel growth against measured flame growth", () => {
  const growth = thickGrowthChecks();

  it("does not accelerate for VI-3 and VI-4", () => {
    expect(growth.map((g) => g.id)).toEqual(["VI-3", "VI-4"]);
    for (const g of growth) expect(g.accelerationRatio, g.id).toBeLessThanOrEqual(1.1);
  });

  it("reports the model's rate beside the measured flame growth rate as a gap", () => {
    for (const g of growth) {
      const paper = SAFFIRE_IV_VI_EMISSION.find((t) => t.id === g.id)!;
      expect(g.measuredGrowthMmS).toBe(paper.flameGrowthRateMmS);
      expect(g.measuredMaxFlameLengthMm).toBe(paper.maxFlameLengthMm);
      expect(g.modelRateMmS / g.measuredGrowthMmS, g.id).toBeGreaterThan(1.3);
      expect(g.modelRateMmS / g.measuredGrowthMmS, g.id).toBeLessThan(2.2);
    }
  });

  it("matches the committed evaluation snapshot", () => {
    for (const [i, g] of growth.entries()) {
      const snap = EVALUATION_SNAPSHOT.thickGrowth[i];
      expect(snap.id).toBe(g.id);
      expect(Math.abs(snap.modelRateMmS - g.modelRateMmS)).toBeLessThan(0.02);
      expect(Math.abs(snap.accelerationRatio - g.accelerationRatio)).toBeLessThan(0.03);
    }
  });
});
