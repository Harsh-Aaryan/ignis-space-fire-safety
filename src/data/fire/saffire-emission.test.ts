import { describe, expect, it } from "vitest";
import { HAZARD_LIMITS, SAFFIRE_BENCHMARKS, SAFFIRE_IV_VI_EMISSION, SAFFIRE_IV_VI_EMISSION_META, type SaffireEmissionTest } from "@/data/fire/options";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import { FIRE_SOURCES } from "@/data/fire/sources";

/**
 * Table 1 of ICES-2026-577 (NTRS 20260001992), transcribed column by column below as plain arrays so a typo in
 * options.ts and a typo here cannot both pass unless they agree with the paper.
 * Column order: IV-2, V-3, VI-3, VI-4, IV-1, V-2, VI-2. null is the paper's NA.
 */
const IDS = ["IV-2", "V-3", "VI-3", "VI-4", "IV-1", "V-2", "VI-2"] as const;
const PAPER = {
  material: ["PMMA", "PMMA", "PMMA", "PMMA", "SIBAL", "Cotton", "SIBAL"],
  sidesBurning: [2, 1, 2, 1, 2, 2, 2],
  pressureMbar: [1000, 745, 544, 550, 980, 741, 541],
  oxygenMolFraction: [0.22, 0.26, 0.3, 0.29, 0.23, 0.28, 0.31],
  freeVolumeM3: [17.9, 19, 16.7, 16.7, 17.9, 19, 16.7],
  ignitionDurationS: [60, 120, 60, 120, 8, 8, 8],
  initialFlowDurationS: [535, 480, 480, 900, 200, 200, 300],
  flameGrowthRateMmS: [0.22, 0.26, 0.38, 0.27, null, null, null],
  flameSpreadRateMmS: [null, null, null, null, 3.6, 3.4, 4.05],
  maxFlameLengthMm: [90.8, 118, 89.9, 93.3, null, null, null],
  peakHrrW: [null, null, 3240, 1487, null, null, 3376],
  maxCo2RiseMmHg: [1.78, 0.78, 3.66, 3.39, 0.97, 0.81, 1.46],
  maxCoRisePpm: [110, 55.5, 338, 309, 77.4, 74.3, 122],
  pressureRiseMbar: [1.31, 0.25, 0.34, 0.25, 0.33, 0.3, 0.31],
  maxTemperatureRiseC: [0.23, 0.04, 0.5, 0.25, 0.25, 0.25, 0.29],
  timeToAlarmS: [1083, 1117, 1037, 1603, 92, 146, 201],
  flameLengthAtAlarmMm: [74, 114, 73.95, 66.9, null, null, null],
  hrrAtAlarmW: [null, null, 2500, 623, null, null, 3180],
  co2RiseAtAlarmMmHg: [1.28, 0.49, 1.43, 3.09, 0, 0, 0.04],
  coRiseAtAlarmPpm: [63.2, 28.1, 105, 283, 7.9, 11.9, 57.1],
} satisfies Record<string, ReadonlyArray<string | number | null>>;

const byId = (id: string): SaffireEmissionTest => SAFFIRE_IV_VI_EMISSION.find((row) => row.id === id)!;

describe("ICES-2026-577 Table 1 transcription", () => {
  it("holds the seven tests in the paper's column order", () => {
    expect(SAFFIRE_IV_VI_EMISSION.map((row) => row.id)).toEqual([...IDS]);
  });

  for (const [field, values] of Object.entries(PAPER)) {
    it(`${field} matches the table for every test`, () => {
      IDS.forEach((id, index) => {
        expect(byId(id)[field as keyof SaffireEmissionTest], `${id} ${field}`).toBe(values[index]);
      });
    });
  }

  it("keeps NA as null exactly where the paper prints NA", () => {
    const naFields = ["flameGrowthRateMmS", "flameSpreadRateMmS", "maxFlameLengthMm", "peakHrrW", "flameLengthAtAlarmMm", "hrrAtAlarmW"] as const;
    for (const field of naFields) {
      IDS.forEach((id, index) => expect(byId(id)[field] === null, `${id} ${field}`).toBe(PAPER[field][index] === null));
    }
    for (const row of SAFFIRE_IV_VI_EMISSION) {
      for (const field of ["pressureMbar", "oxygenMolFraction", "freeVolumeM3", "maxCo2RiseMmHg", "maxCoRisePpm", "timeToAlarmS", "co2RiseAtAlarmMmHg", "coRiseAtAlarmPpm"] as const) {
        expect(Number.isFinite(row[field]), `${row.id} ${field}`).toBe(true);
      }
    }
  });

  it("reports growth rate and flame length only for PMMA, spread rate only for thin fuels", () => {
    for (const row of SAFFIRE_IV_VI_EMISSION) {
      const thick = row.material === "PMMA";
      expect(row.flameGrowthRateMmS !== null, row.id).toBe(thick);
      expect(row.maxFlameLengthMm !== null, row.id).toBe(thick);
      expect(row.flameLengthAtAlarmMm !== null, row.id).toBe(thick);
      expect(row.flameSpreadRateMmS !== null, row.id).toBe(!thick);
    }
  });

  it("gives heat release only for the Saffire VI tests (not measured on flights IV and V)", () => {
    for (const row of SAFFIRE_IV_VI_EMISSION) {
      expect(row.peakHrrW !== null, row.id).toBe(row.id.startsWith("VI-"));
      expect(row.hrrAtAlarmW !== null, row.id).toBe(row.id.startsWith("VI-"));
    }
  });
});

describe("ICES-2026-577 invariants", () => {
  it("never reports a value at alarm above the maximum", () => {
    for (const row of SAFFIRE_IV_VI_EMISSION) {
      expect(row.coRiseAtAlarmPpm, row.id).toBeLessThanOrEqual(row.maxCoRisePpm);
      expect(row.co2RiseAtAlarmMmHg, row.id).toBeLessThanOrEqual(row.maxCo2RiseMmHg);
      if (row.hrrAtAlarmW !== null) expect(row.hrrAtAlarmW, row.id).toBeLessThanOrEqual(row.peakHrrW!);
      if (row.flameLengthAtAlarmMm !== null) expect(row.flameLengthAtAlarmMm, row.id).toBeLessThanOrEqual(row.maxFlameLengthMm!);
    }
  });

  it("uses a registered source and a material profile that exists, or none for cotton", () => {
    expect(FIRE_SOURCES.some((source) => source.id === SAFFIRE_IV_VI_EMISSION_META.source)).toBe(true);
    expect(SAFFIRE_IV_VI_EMISSION_META.alarmThresholdMgM3.value).toBe(2);
    for (const row of SAFFIRE_IV_VI_EMISSION) {
      if (row.materialId) expect(FIRE_MATERIALS.some((m) => m.id === row.materialId), row.id).toBe(true);
    }
    // Cotton t-shirt fabric is not SIBAL (cotton/fiberglass) and no cotton profile exists.
    expect(byId("V-2").materialId).toBeNull();
    expect(byId("IV-1").materialId).toBe("sibal");
    expect(byId("VI-2").materialId).toBe("sibal");
  });

  it("states the timeline reference of every time to alarm", () => {
    expect(SAFFIRE_IV_VI_EMISSION_META.timeReference).toMatch(/timeline start/);
    expect(SAFFIRE_IV_VI_EMISSION_META.timeReference).toMatch(/before ignition/);
  });

  it("records concurrent flow although the paper's caption says opposed", () => {
    expect(SAFFIRE_IV_VI_EMISSION_META.flow.direction).toBe("Concurrent");
    expect(SAFFIRE_IV_VI_EMISSION_META.flow.captionSays).toBe("opposed");
  });

  it("reproduces the paper's statements about the limits", () => {
    const co24 = HAZARD_LIMITS.co24hPpm.value, co1 = HAZARD_LIMITS.co1hPpm.value, co2 = HAZARD_LIMITS.co2MmHg.value;
    expect([co24, co1, co2]).toEqual([100, 425, 3]);
    // Maximum rise: CO₂ above 3 mmHg for both VI PMMA tests; CO above the 24-hour SMAC for IV-2, both VI PMMA tests and VI-2.
    expect(SAFFIRE_IV_VI_EMISSION.filter((row) => row.maxCoRisePpm > co24).map((row) => row.id)).toEqual(["IV-2", "VI-3", "VI-4", "VI-2"]);
    expect(SAFFIRE_IV_VI_EMISSION.filter((row) => row.maxCo2RiseMmHg > co2).map((row) => row.id)).toEqual(["VI-3", "VI-4"]);
    expect(SAFFIRE_IV_VI_EMISSION.every((row) => row.maxCoRisePpm < co1)).toBe(true);
    // At alarm: both VI PMMA tests exceed 100 ppm; VI-4 approaches, and stays below, the 1-hour SMAC.
    expect(SAFFIRE_IV_VI_EMISSION.filter((row) => row.coRiseAtAlarmPpm > co24).map((row) => row.id)).toEqual(["VI-3", "VI-4"]);
    expect(byId("VI-4").coRiseAtAlarmPpm).toBeLessThan(co1);
  });
});

describe("ICES-2026-577 against ICES-2024-365 (SAFFIRE_BENCHMARKS)", () => {
  const shared = ["IV-1", "VI-2", "VI-3", "VI-4"];

  it("leaves the calibration set untouched", () => {
    expect(SAFFIRE_BENCHMARKS.map((row) => row.id)).toEqual(shared);
    expect(SAFFIRE_BENCHMARKS.map((row) => row.peakHeatW)).toEqual([null, 3217, 3080, 1507]);
  });

  it("agrees on free volume for every shared test", () => {
    for (const id of shared) expect(byId(id).freeVolumeM3, id).toBe(SAFFIRE_BENCHMARKS.find((row) => row.id === id)!.freeVolumeM3);
  });

  it("agrees on pressure and oxygen for VI-2, VI-3 and VI-4 within rounding (1 mbar = 0.1 kPa)", () => {
    for (const id of ["VI-2", "VI-3", "VI-4"]) {
      const reference = SAFFIRE_BENCHMARKS.find((row) => row.id === id)!;
      expect(Math.abs(byId(id).pressureMbar / 10 - reference.pressureKpa), `${id} pressure`).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(Math.abs(byId(id).oxygenMolFraction * 100 - reference.oxygenPct), `${id} oxygen`).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it("documents that IV-1 conditions differ between the papers (98.0 kPa, 23 % against 100.0 kPa, 22.0 %)", () => {
    const reference = SAFFIRE_BENCHMARKS.find((row) => row.id === "IV-1")!;
    expect(byId("IV-1").pressureMbar / 10).toBeCloseTo(98.0, 9);
    expect(reference.pressureKpa).toBe(100.0);
    expect(byId("IV-1").oxygenMolFraction * 100).toBeCloseTo(23, 9);
    expect(reference.oxygenPct).toBe(22.0);
  });

  it("documents the peak heat release discrepancy so the two papers are not harmonised", () => {
    const pairs = Object.fromEntries(
      ["VI-2", "VI-3", "VI-4"].map((id) => [id, [byId(id).peakHrrW, SAFFIRE_BENCHMARKS.find((row) => row.id === id)!.peakHeatW]]),
    );
    expect(pairs).toEqual({ "VI-2": [3376, 3217], "VI-3": [3240, 3080], "VI-4": [1487, 1507] });
    for (const [emission, benchmark] of Object.values(pairs) as [number, number][]) expect(emission).not.toBe(benchmark);
  });

  it("documents that far-field maxima differ from the calibration CO and CO₂ rises", () => {
    // mmHg partial pressure to ppm of the cabin total: mmHg / (mbar x 0.750062) x 1e6.
    const ppm = (row: SaffireEmissionTest) => (row.maxCo2RiseMmHg / (row.pressureMbar * 0.750062)) * 1e6;
    for (const id of shared) {
      const reference = SAFFIRE_BENCHMARKS.find((row) => row.id === id)!;
      const row = byId(id);
      expect(ppm(row) / reference.co2RisePpm, `${id} CO₂`).toBeGreaterThan(0.9);
      expect(ppm(row) / reference.co2RisePpm, `${id} CO₂`).toBeLessThan(1.4);
      expect(row.maxCoRisePpm, `${id} CO`).not.toBe(reference.coRisePpm);
    }
  });

  it("uses a 2 mg/m³ alarm threshold where ICES-2024-365 used 1 mg/m³", () => {
    expect(SAFFIRE_IV_VI_EMISSION_META.alarmThresholdMgM3.value).toBe(2);
    expect(HAZARD_LIMITS.smokeAlarmMgM3.value).toBe(1);
  });
});
