import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { materialById } from "@/data/fire/materials";
import { BASS_II_CO_RATIOS, FLIGHT_OBSERVATIONS, SAFFIRE_BENCHMARKS } from "@/data/fire/options";
import { CALIBRATED_COEFFICIENTS, FIRE_CLOSURES, thinBurnoutFromSaffireII, thinQuenchCurvatureFromBass } from "@/data/fire/parameters";
import { FIRE_SOURCES } from "@/data/fire/sources";
import { ACCURACY_SUMMARY, EVALUATION_SNAPSHOT, accuracyCue, cfastTemperatureGap, significantFigures, testCoverage } from "@/lib/fire/accuracy";
import { STORED_COEFFICIENTS, calibrate, compareSaffireSummaries, evaluateModel, goldenMinimize, heatFixedByFuel, summarizeAccuracy, type ModelEvaluation } from "@/lib/fire/benchmarks";
import { reactionYields } from "@/lib/fire/chemistry";
import { parsePsiCsv } from "@/lib/fire/psi-data";
import { genericFireInput, saffireInput } from "@/lib/fire/scenario";

const csv = (name: string) => parsePsiCsv(readFileSync(`public/data/nasa-psi/${name}`, "utf8"));
const num = (cell: string) => (/^-?\d+(\.\d+)?$/.test(cell.trim()) ? Number(cell) : NaN);

describe("transcribed flight observations match the original PSI tables", () => {
  it("Saffire-I S1 and S2", () => {
    const { rows } = csv("PSI-98_Experimental table_SAFFIRE-1.csv");
    const s1 = rows.find((r) => r[0].trim() === "S1")!, s2 = rows.find((r) => r[0].trim() === "S2")!;
    const o1 = FLIGHT_OBSERVATIONS.find((r) => r.id === "Saffire-I S1")!, o2 = FLIGHT_OBSERVATIONS.find((r) => r.id === "Saffire-I S2")!;
    // Length and width cells are read as swapped (see the source registry note).
    expect([Number(s1[4]) / 100, Number(s1[3]) / 100]).toEqual([o1.lengthM, o1.widthM]);
    expect(Number(s1[5]) / 100).toBe(o1.flowMs);
    expect(s1[6]).toBe("21.5 - 21.7");
    expect(o1.oxygenPct).toBeCloseTo((21.5 + 21.7) / 2, 10);
    expect(Number(s1[9])).toBe(o1.burnTimeS);
    expect(Number(s2[9])).toBe(o2.burnTimeS);
    expect([s1[10].trim(), s2[10].trim()]).toEqual(["Concurrent", "Opposed"]);
  });

  it("Saffire-II SIBAL, PMMA and silicone rows", () => {
    const { rows } = csv("PSI-99_Experimental table_SAFFIRE-2.csv");
    const row = (id: string) => rows.find((r) => r[0].trim() === id)!;
    for (const [id, obs] of [["2-5", "Saffire-II 2-5"], ["2-6", "Saffire-II 2-6"]] as const) {
      const r = row(id), o = FLIGHT_OBSERVATIONS.find((x) => x.id === obs)!;
      expect(r[9]).toBe(`${o.burnTimeS} s`);
      expect(r[12]).toBe(`${o.spreadMmS!.toFixed(1)} mm/s`);
      expect([r[3], r[4], r[5]]).toEqual(["29 cm", "5 cm", "20 cm/s"]);
      expect(r[6]).toBe("~ 22.1");
    }
    expect(row("2-8")[9]).toBe("600 s");
    expect(row("2-9")[9]).toBe("900 s");
    expect(row("2-9")[2]).toBe("1 cm");
    for (const id of ["2-1", "2-2", "2-3", "2-4"]) { expect(row(id)[1]).toBe("Silicone"); expect(row(id)[9]).toBe("Insignificant"); expect(row(id)[11]).toBe("~ 0"); }
    expect(rows.some((r) => r[0].includes("0.01 to 0.04 mm/s"))).toBe(true);
  });

  it("BASS-II CO/CO₂ summaries follow the stated selection rule", () => {
    const { rows } = csv("PSI-25_Experimental table_BASS-II.csv");
    const groups: Record<"pmma" | "sibal", { o2: number; ratio: number }[]> = { pmma: [], sibal: [] };
    for (const r of rows) {
      const mat = r[5].toLowerCase();
      const kind = /sibal/.test(mat) ? "sibal" : /pmma|rod/.test(mat) && !/spher/.test(mat) ? "pmma" : null;
      if (!kind) continue;
      const [o2, c2i, c2f, coi, cof] = [r[11], r[13], r[14], r[15], r[16]].map(num);
      if ([o2, c2i, c2f, coi, cof].some(Number.isNaN)) continue;
      const dco2 = Math.round((c2f - c2i) * 1e4), dco = cof - coi;
      if (dco2 < (kind === "pmma" ? 3000 : 500) || dco < 0) continue;
      groups[kind].push({ o2, ratio: dco / dco2 });
    }
    const quantile = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
    const check = (items: { o2: number; ratio: number }[], expected: { runs: number; median: number; q1: number; q3: number; oxygenRange: readonly [number, number] }) => {
      const r = items.map((x) => x.ratio);
      expect(items).toHaveLength(expected.runs);
      expect(quantile(r, 0.5)).toBeCloseTo(expected.median, 4);
      expect(quantile(r, 0.25)).toBeCloseTo(expected.q1, 4);
      expect(quantile(r, 0.75)).toBeCloseTo(expected.q3, 4);
      expect([Math.min(...items.map((x) => x.o2)), Math.max(...items.map((x) => x.o2))]).toEqual([...expected.oxygenRange]);
    };
    check(groups.pmma.filter((x) => x.o2 >= 20.5), BASS_II_CO_RATIOS.pmmaHighOxygen);
    const low = groups.pmma.filter((x) => x.o2 <= 17.5);
    check(low, BASS_II_CO_RATIOS.pmmaLowOxygen);
    expect(quantile(low.map((x) => x.o2), 0.5)).toBeCloseTo(BASS_II_CO_RATIOS.pmmaLowOxygen.medianOxygenPct, 6);
    check(groups.sibal, BASS_II_CO_RATIOS.sibal);
  });
});

describe("derived closures reproduce from their stated formulas", () => {
  it("thin-fuel burnout flux from Saffire-II", () => {
    const b = thinBurnoutFromSaffireII(0.1354);
    expect(b.burnoutS[0]).toBeCloseTo(145 - 0.29 / 0.0021, 6);
    expect(b.burnoutS[1]).toBeCloseTo(115 - 0.29 / 0.0026, 6);
    expect(materialById("sibal").refMassFluxGm2s.value).toBeCloseTo(b.fluxGm2s, 1);
    expect(materialById("sibal").refMassFluxGm2s.evidence).toBe("derived");
    // Normalize each test's burnout time to the reference flow and oxygen.
    const normalized = ((145 - 0.29 / 0.0021) + (115 - 0.29 / 0.0026) * Math.sqrt(0.25 / 0.2)) / 2 * (22.1 / 21);
    expect(b.fluxGm2s).toBeCloseTo(0.1354 / normalized * 1000, 10);
    // Spread-rate rounding still spans about 2.4–7.8 s before normalization.
    expect(b.burnoutRangeS[0]).toBeCloseTo(2.4, 1);
    expect(b.burnoutRangeS[1]).toBeCloseTo(7.84, 2);
    expect(b.fluxRangeGm2s[0]).toBeGreaterThan(15);
    expect(b.fluxRangeGm2s[1]).toBeLessThan(55);
    expect(materialById("sibal").refMassFluxGm2s.uncertainty).toContain(`${b.fluxRangeGm2s[0].toFixed(0)}–${b.fluxRangeGm2s[1].toFixed(0)} g/m²s`);
  });
  it("thick local flux, CO starvation gain and thin quench curvature", () => {
    expect(FIRE_CLOSURES.thickLocalBurningFluxKgM2s.value).toBeCloseTo(0.01 / 1000 * 1190, 10);
    const { pmmaHighOxygen: h, pmmaLowOxygen: l } = BASS_II_CO_RATIOS;
    expect(FIRE_CLOSURES.coStarvationGain.value).toBeCloseTo((l.median / h.median - 1) / ((21 - l.medianOxygenPct) / 12), 3);
    const sibal = materialById("sibal");
    expect(thinQuenchCurvatureFromBass(sibal.loc1gPct.value - sibal.lowFlowMarginPct.value)).toBeCloseTo(FIRE_CLOSURES.thinQuenchCurvature.value, 3);
  });
  it("every closure and calibrated coefficient names a registered source and an evidence class", () => {
    for (const c of [...Object.values(FIRE_CLOSURES), ...Object.values(CALIBRATED_COEFFICIENTS)]) {
      expect(FIRE_SOURCES.some((s) => s.id === c.source)).toBe(true);
      expect(["measured", "derived", "calibrated", "assumed"]).toContain(c.evidence);
    }
    for (const c of Object.values(CALIBRATED_COEFFICIENTS)) expect(c.evidence).toBe("calibrated");
  });
  it("low-flow CO/CO₂ yields close carbon and give the calibrated molar ratio when not starved", () => {
    for (const id of ["pmma", "sibal"]) {
      const m = materialById(id), y = reactionYields(m, 25, { gravityG: 0 });
      expect((y.co / 28) / (y.co2 / 44)).toBeCloseTo(m.coCo2LowFlow!.value, 10);
      expect(y.co2 * 12 / 44 + y.co * 12 / 28 + y.soot).toBeCloseTo(y.elements.c, 12);
      // 1 g recovers the handbook yield; partial gravity lies between.
      expect(reactionYields(m, 25, { gravityG: 1 }).co).toBeCloseTo(m.coYield1g.value, 12);
      const lunar = reactionYields(m, 25, { gravityG: 0.165 }).co;
      expect(lunar).toBeLessThan(y.co);
      expect(lunar).toBeGreaterThan(m.coYield1g.value);
    }
  });
  it("golden-section search is deterministic and finds a minimum", () => {
    expect(goldenMinimize((x) => (x - 1.3) ** 2, -5, 5, 40)).toBeCloseTo(1.3, 6);
  });
});

describe("accuracy cues", () => {
  const row = (id: string) => SAFFIRE_BENCHMARKS.find((b) => b.id === id)!;
  const flight = (id: string) => FLIGHT_OBSERVATIONS.find((o) => o.id === id)!;
  const like = (id: string, materialId: "sibal" | "pmma", sides: 1 | 2 = 1) => {
    const o = flight(id);
    return { ...saffireInput(row(materialId === "sibal" ? "IV-1" : "VI-3")), ventilationSchedule: undefined, material: materialById(materialId), oxygenPct: o.oxygenPct, pressureKpa: o.pressureKpa, ventilationMs: o.reproduction?.flowMs ?? o.flowMs, flowOrientation: o.flow, fuel: { widthM: o.widthM, lengthM: o.reproduction?.lengthM ?? o.lengthM, sides, enclosed: false } };
  };

  it("apply the held-out error only near an actual Saffire VI test", () => {
    const vi3 = saffireInput(row("VI-3"));
    expect(testCoverage(vi3)).toEqual({ kind: "saffire-vi", rowId: "VI-3" });
    expect(accuracyCue("hrr", vi3)).toMatchObject({ tested: true });
    expect(accuracyCue("hrr", vi3).short).toMatch(/^±\d+\s%$/);
    expect(accuracyCue("hrr", vi3).long).toContain("VI-3");
    // The review's counter-examples: none may carry the Saffire VI error.
    expect(testCoverage(like("Saffire-II 2-5", "sibal"))).toMatchObject({ kind: "flight", checkId: "Saffire-II 2-5", verdict: "disagrees" });
    expect(testCoverage(like("Saffire-II 2-9", "pmma", 2))).toMatchObject({ kind: "flight", checkId: expect.stringMatching(/^Saffire-II 2-[89]$/) });
    expect(testCoverage(like("Saffire-I S1", "sibal"))).toMatchObject({ kind: "flight", checkId: "Saffire-I S1" });
    expect(testCoverage(like("Saffire-I S2", "sibal"))).toMatchObject({ kind: "flight", checkId: "Saffire-I S2" });
    expect(testCoverage({ ...like("Saffire-I S1", "sibal"), flowOrientation: "opposed" }).kind).toBe("extrapolated");
    expect(testCoverage({ ...saffireInput(row("IV-1")), oxygenPct: 31 })).toEqual({ kind: "extrapolated", reason: "no Saffire VI test at this oxygen and pressure" });
    expect(testCoverage({ ...vi3, fuel: { ...vi3.fuel, widthM: 2, lengthM: 2 } })).toEqual({ kind: "extrapolated", reason: "sample size differs from the Saffire VI samples" });
    expect(testCoverage({ ...vi3, fuel: { ...vi3.fuel, sides: 1 } })).toEqual({ kind: "extrapolated", reason: "no Saffire VI test at this oxygen and pressure" });
    expect(testCoverage({ ...vi3, flowOrientation: "opposed" })).toEqual({ kind: "extrapolated", reason: "untested in opposed or cross flow" });
    expect(testCoverage({ ...vi3, material: materialById("nylon") })).toEqual({ kind: "extrapolated", reason: "untested for this material" });
    for (const input of [like("Saffire-II 2-5", "sibal"), like("Saffire-I S1", "sibal"), { ...saffireInput(row("IV-1")), oxygenPct: 31 }]) {
      expect(accuracyCue("hrr", input).tested).toBe(false);
      expect(accuracyCue("hrr", input).short).not.toMatch(/±/);
    }
    const lunar = genericFireInput({ gravityG: 0.165, oxygenPct: 32, pressurePsi: 10.2, airflowMs: 0.05 }, "pmma", "hot-wire");
    expect(accuracyCue("co", lunar)).toMatchObject({ tested: false, short: "extrapolated", relative: null });
    expect(accuracyCue("co", lunar).long).toMatch(/^Untested at this gravity/);
    expect(significantFigures(0.1)).toBe(2);
    expect(significantFigures(0.5)).toBe(1);
  });

  it("never claims an established cabin temperature error", () => {
    const vi3 = saffireInput(row("VI-3"));
    expect(accuracyCue("temperature", vi3)).toMatchObject({ tested: false, short: "not established", relative: null });
    const gap = cfastTemperatureGap();
    if (gap) expect(accuracyCue("temperature", vi3).long).toContain("CFAST");
    expect(ACCURACY_SUMMARY.find((m) => m.metric === "farField")!.established).toBe(false);
  });

  it("excludes the fuel-fixed IV-1 heat from the heat statistics", () => {
    expect(SAFFIRE_BENCHMARKS.map((b) => [b.id, heatFixedByFuel(b)])).toEqual([["IV-1", true], ["VI-2", false], ["VI-3", false], ["VI-4", false]]);
    for (const metric of ["hrr", "heat"]) {
      const m = ACCURACY_SUMMARY.find((x) => x.metric === metric)!;
      expect(m.heldOut.n).toBe(3);
      expect(m.excluded.join(" ")).toContain("IV-1");
    }
    expect(ACCURACY_SUMMARY.find((x) => x.metric === "co2")!.heldOut.n).toBe(4);
  });
});

describe("calibration and held-out evaluation (model 3.0.0)", () => {
  let evaluation: ModelEvaluation;
  beforeAll(() => { evaluation = evaluateModel(); }, 240_000);

  it("re-fits the stored calibrated coefficients within 1 %", () => {
    for (const [key, stored] of Object.entries(STORED_COEFFICIENTS)) {
      const fitted = evaluation.inSampleCoefficients[key as keyof typeof STORED_COEFFICIENTS];
      expect(Math.abs(stored / fitted - 1), key).toBeLessThan(0.01);
    }
  });

  it("reaches the same PMMA and CO coefficients from distant starting values", () => {
    const pmma = SAFFIRE_BENCHMARKS.filter((b) => b.materialId === "pmma");
    for (const seed of [{ pmmaFluxGm2s: 0.45, pmmaThickSpreadMmS: 0.12, pmmaCoCo2: 0.015 }, { pmmaFluxGm2s: 1.6, pmmaThickSpreadMmS: 0.7, pmmaCoCo2: 0.09 }]) {
      const fit = calibrate(pmma, { ...STORED_COEFFICIENTS, ...seed });
      for (const key of ["pmmaFluxGm2s", "pmmaThickSpreadMmS", "pmmaCoCo2"] as const) expect(Math.abs(fit[key] / STORED_COEFFICIENTS[key] - 1), `${key} from ${JSON.stringify(seed)}`).toBeLessThan(0.01);
    }
  }, 240_000);

  it("matches the committed evaluation snapshot", () => {
    const close = (a: number | null, b: number | null, label: string) => {
      if (a === null || b === null) { expect(a, label).toBe(b); return; }
      expect(Math.abs(a - b), label).toBeLessThanOrEqual(Math.max(0.6, 0.005 * Math.abs(b)));
    };
    for (const [i, row] of evaluation.rows.entries()) {
      const snap = EVALUATION_SNAPSHOT.rows[i];
      expect(snap.id).toBe(row.id);
      for (const which of ["inSample", "heldOut"] as const) for (const [k, v] of Object.entries(row[which])) close(v as number | null, snap[which][k as keyof typeof snap.inSample] as number | null, `${row.id} ${which} ${k}`);
    }
    expect(evaluation.independent.map((c) => [c.id, c.verdict])).toEqual(EVALUATION_SNAPSHOT.independent.map((c) => [c.id, c.verdict]));
    const summary = summarizeAccuracy(evaluation);
    for (const [i, m] of summary.entries()) {
      const s = ACCURACY_SUMMARY[i];
      expect(s.metric).toBe(m.metric);
      for (const which of ["inSample", "heldOut"] as const) {
        expect(Math.abs(s[which].medianAbs - m[which].medianAbs), `${m.metric} ${which} median`).toBeLessThan(0.6);
        expect(Math.abs(s[which].maxAbs - m[which].maxAbs), `${m.metric} ${which} max`).toBeLessThan(0.6);
        expect(s[which].n).toBe(m[which].n);
      }
    }
  });

  it("holds out every row from its own fit", () => {
    for (const row of evaluation.rows) {
      const key = row.materialId === "sibal" ? "sibalSpreadMmS" : "pmmaThickSpreadMmS";
      expect(row.heldOutCoefficients[key]).not.toBeCloseTo(evaluation.inSampleCoefficients[key], 4);
    }
  });

  it("keeps the UI comparison consistent with the stored coefficients", () => {
    const rows = compareSaffireSummaries();
    expect(rows.map((r) => r.id)).toEqual(SAFFIRE_BENCHMARKS.map((b) => b.id));
    for (const r of rows) {
      const inSample = evaluation.rows.find((x) => x.id === r.id)!.inSample;
      expect(Math.abs(r.modelHrrW / inSample.hrrW - 1)).toBeLessThan(0.02);
      expect(Math.abs(r.modelCoPpm / inSample.coPpm - 1)).toBeLessThan(0.02);
    }
  });
});
