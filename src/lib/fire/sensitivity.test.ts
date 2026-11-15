import { describe, expect, it } from "vitest";
import { SAFFIRE_BENCHMARKS } from "@/data/fire/options";
import { genericFireInput, saffireInput } from "@/lib/fire/scenario";
import { differingFactors, supportedSensitivities } from "@/lib/fire/sensitivity";

const row = (id: string) => SAFFIRE_BENCHMARKS.find((b) => b.id === id)!;

describe("supported sensitivity comparisons", () => {
  it("runs perturbations inside the matched Saffire VI neighbourhood", () => {
    const report = supportedSensitivities(saffireInput(row("VI-3")), 240);
    expect(report.supported).toBe(true);
    if (!report.supported) return;
    expect(report.nearestTest).toBe("VI-3");
    expect(report.results.map((r) => r.parameter)).toEqual(["oxygen", "pressure", "airflow"]);
    const oxygen = report.results[0];
    expect(oxygen.low).toBeCloseTo(29.3, 6);
    expect(oxygen.high).toBeCloseTo(31.3, 6);
    expect(oxygen.hrrPct.low).toBeLessThan(0);
    for (const r of report.results) for (const v of [r.hrrPct.low, r.hrrPct.high, r.coPct.low, r.coPct.high]) if (v !== null) expect(Number.isFinite(v)).toBe(true);
  }, 60_000);

  it("does not claim support from pairs that differ in several factors or by less than the data band", () => {
    // VI-4 → VI-3 changes oxygen and also sides/thickness; the per-area peak changes by about 2 %.
    expect(differingFactors(row("VI-4"), row("VI-3"))).toEqual(["oxygen", "sides and thickness"]);
    expect(differingFactors(row("IV-1"), row("VI-2"))).toEqual(["oxygen", "pressure"]);
    const pmma = supportedSensitivities(saffireInput(row("VI-3")), 120);
    const sibal = supportedSensitivities(saffireInput(row("IV-1")), 150);
    for (const report of [pmma, sibal]) {
      expect(report.supported).toBe(true);
      if (!report.supported) continue;
      for (const r of report.results) {
        expect(["not resolvable", "untested"]).toContain(r.hrrSupport);
        expect(["not resolvable", "untested"]).toContain(r.coSupport);
      }
    }
  }, 60_000);

  it("refuses away from Saffire VI without running the model", () => {
    const lunar = genericFireInput({ gravityG: 0.165, oxygenPct: 32, pressurePsi: 10.2, airflowMs: 0.05 }, "pmma", "hot-wire");
    expect(supportedSensitivities(lunar)).toEqual({ supported: false, reason: expect.stringMatching(/^Untested at this gravity/), results: [] });
    const nylon = supportedSensitivities({ ...saffireInput(row("VI-3")), material: genericFireInput({ gravityG: 0, oxygenPct: 21, pressurePsi: 14.7, airflowMs: 0.2 }, "nylon", "hot-wire").material });
    expect(nylon.supported).toBe(false);
  });
});
