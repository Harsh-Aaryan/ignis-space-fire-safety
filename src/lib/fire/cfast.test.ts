import { describe, expect, it } from "vitest";
import {
  cfastCase,
  cfastCases,
  cfastChartRows,
  cfastComparison,
  cfastComparisons,
  hasCfastReference,
  type CfastCase,
  type CfastReference,
} from "./cfast";

function fixtureCase(overrides: Partial<CfastCase> = {}): CfastCase {
  return {
    id: "saffire-VI-3-ignis",
    label: "Saffire VI-3 · IGNIS heat release",
    group: "saffire",
    sourceId: "saffire-VI-3",
    hrrSource: "ignis",
    zoneModel: "single-zone",
    bounding: false,
    gravityG: 0,
    atmosphere: { pressureKpa: 54.6, oxygenPct: 30.3, ambientC: 20, o2MassFraction: 0.332 },
    geometry: { volumeM3: 16.7, heightM: 3, widthM: 5.458, depthM: 1.02, surfaceAreaM2: 50, ignisWallAreaM2: 50 },
    fire: {
      material: "PMMA (cast acrylic)",
      materialId: "pmma",
      heatOfCombustionMJkg: 25,
      radiativeFraction: 0.31,
      fireHeightM: 1.5,
      totalHeatKJ: 800,
      peakHrrKw: 1.5,
      durationS: 780,
      tablePoints: 190,
      cfastHeatKJ: 798,
      releasedShare: 0.998,
      throttled: false,
      shape: null,
    },
    cfast: { peakTempRiseC: 6, peakUpperLayerRiseC: null, finalO2DepletionPts: 0.6, finalO2Pct: 29.7, finalCo2RisePpm: 4200, initialO2PctModel: 30.303 },
    ignis: { peakTempRiseC: 1.5, finalO2DepletionPts: 0.55, finalO2Pct: 29.75, finalCo2RisePpm: 4000, totalHeatKJ: 800, finalPhase: "flaming" },
    measured: { maxFarFieldC: 21, maxOutletC: 77, co2RisePpm: 8539, totalHeatKJ: 1280, burnDurationS: 780, assumedInitialC: 20, source: "ICES-2024-365" },
    series: {
      t: [0, 390, 780],
      hrrKw: [0, 1.5, 1.4],
      cfastTempRiseC: [0, 4, 6],
      cfastO2Pct: [30.3, 30, 29.7],
      ignisTempRiseC: [0, 1, 1.5],
      ignisO2Pct: [30.3, 30.02, 29.75],
    },
    notes: [],
    ...overrides,
  };
}

const published = fixtureCase({
  id: "saffire-VI-3-published",
  label: "Saffire VI-3 · published heat release",
  hrrSource: "published-shape",
  ignis: null,
  cfast: { peakTempRiseC: 10.6, peakUpperLayerRiseC: null, finalO2DepletionPts: 0.97, finalO2Pct: 29.33, finalCo2RisePpm: 6845, initialO2PctModel: 30.303 },
  series: { t: [0, 780], hrrKw: [0, 0], cfastTempRiseC: [0, 9], cfastO2Pct: [30.3, 29.33] },
});

const twoZone = fixtureCase({
  id: "moon-lab-two-zone",
  label: "Lunar Habitat · Laboratory · two-zone bound",
  group: "habitat",
  sourceId: "moon-lab",
  zoneModel: "two-zone",
  bounding: true,
  gravityG: 0.165,
  atmosphere: { pressureKpa: 70.3, oxygenPct: 32, ambientC: 22, o2MassFraction: 0.35 },
  cfast: { peakTempRiseC: 6.7, peakUpperLayerRiseC: 9.8, finalO2DepletionPts: 0.69, finalO2Pct: 31.31, finalCo2RisePpm: 4806, initialO2PctModel: 32.003 },
  measured: null,
  series: {
    t: [0, 450, 900],
    hrrKw: [0, 1.5, 1.4],
    cfastTempRiseC: [0, 5, 6.7],
    cfastUpperTempRiseC: [0, 7, 9.8],
    cfastO2Pct: [32, 31.6, 31.31],
    ignisTempRiseC: [0, 2, 2.5],
    ignisO2Pct: [32, 31.7, 31.33],
  },
});

const ok: CfastReference = { schemaVersion: 1, status: "ok", cfastVersion: "CFAST-7.7.7", cases: [fixtureCase(), published, twoZone] };
const notRun: CfastReference = { schemaVersion: 1, status: "not-run", cases: [] };

describe("CFAST reference helpers", () => {
  it("reports no data until the cases have been run", () => {
    expect(hasCfastReference(notRun)).toBe(false);
    expect(cfastCases(notRun)).toEqual([]);
    expect(cfastComparison("saffire-VI-3-ignis", notRun)).toBeNull();
    expect(hasCfastReference({ ...ok, status: "not-run" })).toBe(false);
    expect(hasCfastReference({ ...ok, cases: [] })).toBe(false);
  });

  it("finds cases by id", () => {
    expect(hasCfastReference(ok)).toBe(true);
    expect(cfastCases(ok)).toHaveLength(3);
    expect(cfastCase("moon-lab-two-zone", ok)?.bounding).toBe(true);
    expect(cfastCase("missing", ok)).toBeNull();
  });

  it("compares IGNIS with CFAST on identical heat release", () => {
    const c = cfastComparison("saffire-VI-3-ignis", ok)!;
    expect(c.sameHeatRelease).toBe(true);
    expect(c.cfastPeakRiseC).toBe(6);
    expect(c.ignisPeakRiseC).toBe(1.5);
    expect(c.peakRiseDiffC).toBeCloseTo(-4.5, 10);
    expect(c.o2DepletionDiffPts).toBeCloseTo(-0.05, 10);
    expect(c.cfastPeakC).toBe(26);
    expect(c.measuredFarFieldC).toBe(21);
  });

  it("gives no IGNIS difference when CFAST used the published heat release", () => {
    const c = cfastComparison("saffire-VI-3-published", ok)!;
    expect(c.sameHeatRelease).toBe(false);
    expect(c.ignisPeakRiseC).toBeNull();
    expect(c.peakRiseDiffC).toBeNull();
    expect(c.o2DepletionDiffPts).toBeNull();
    expect(c.cfastO2DepletionPts).toBe(0.97);
  });

  it("keeps the hot-layer bound of a two-zone run", () => {
    const c = cfastComparison("moon-lab-two-zone", ok)!;
    expect(c.zoneModel).toBe("two-zone");
    expect(c.cfastUpperLayerRiseC).toBe(9.8);
    expect(c.measuredFarFieldC).toBeNull();
    expect(cfastComparisons(ok).map((item) => item.caseId)).toEqual(["saffire-VI-3-ignis", "saffire-VI-3-published", "moon-lab-two-zone"]);
  });

  it("builds chart rows with nulls where a series is absent", () => {
    const rows = cfastChartRows(published);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ t: 780, cfastTempRiseC: 9, ignisTempRiseC: null, cfastUpperTempRiseC: null, ignisO2Pct: null });
    expect(cfastChartRows(twoZone)[2]).toMatchObject({ cfastUpperTempRiseC: 9.8, ignisO2Pct: 31.33 });
  });

  it("reads the committed reference without throwing", () => {
    const cases = cfastCases();
    expect(Array.isArray(cases)).toBe(true);
    for (const item of cases) expect(cfastComparison(item.id)).not.toBeNull();
  });
});
