import reference from "@/data/fire/cfast-reference.json";

/**
 * NIST CFAST cross-check of cabin gas temperature and oxygen.
 *
 * scripts/cfast/run_cases.py drives CFAST 7.7 with the same heat-release
 * history as IGNIS (or with a shape constrained by the published Saffire heat
 * release) and writes src/data/fire/cfast-reference.json. Until it has run, the
 * file holds `status: "not-run"` and every helper here reports no data.
 */

export type CfastZoneModel = "single-zone" | "two-zone";
export type CfastHrrSource = "published-shape" | "ignis";

export interface CfastSeries {
  t: number[];
  hrrKw: number[];
  cfastTempRiseC: number[];
  cfastO2Pct: number[];
  /** Two-zone runs only: upper (hot) layer temperature rise. */
  cfastUpperTempRiseC?: number[];
  ignisTempRiseC?: number[];
  ignisO2Pct?: number[];
}

export interface CfastCase {
  id: string;
  label: string;
  group: "saffire" | "habitat";
  /** The exported IGNIS input the case was built from (Saffire row or habitat room). */
  sourceId: string;
  hrrSource: CfastHrrSource;
  zoneModel: CfastZoneModel;
  /** A partial-gravity two-zone run: 1 g correlations, so it only bounds the hot layer. */
  bounding: boolean;
  gravityG: number;
  atmosphere: { pressureKpa: number; oxygenPct: number; ambientC: number; o2MassFraction: number };
  geometry: { volumeM3: number; heightM: number; widthM: number; depthM: number; surfaceAreaM2: number; ignisWallAreaM2: number };
  fire: {
    material: string;
    materialId: string;
    heatOfCombustionMJkg: number;
    radiativeFraction: number;
    fireHeightM: number;
    totalHeatKJ: number;
    peakHrrKw: number;
    durationS: number;
    tablePoints: number;
    cfastHeatKJ: number;
    releasedShare: number;
    throttled: boolean;
    shape: { peakKw: number; growthS: number; steadyS: number; endS: number; basis: string } | null;
  };
  cfast: {
    peakTempRiseC: number;
    peakUpperLayerRiseC: number | null;
    finalO2DepletionPts: number;
    finalO2Pct: number;
    finalCo2RisePpm: number | null;
    initialO2PctModel: number;
  };
  ignis: {
    peakTempRiseC: number;
    finalO2DepletionPts: number;
    finalO2Pct: number;
    finalCo2RisePpm: number;
    totalHeatKJ: number;
    finalPhase: string;
  } | null;
  measured: {
    maxFarFieldC: number;
    maxOutletC: number;
    co2RisePpm: number;
    totalHeatKJ: number;
    burnDurationS: number;
    assumedInitialC: number;
    source: string;
  } | null;
  series: CfastSeries;
  notes: string[];
}

export interface CfastReference {
  schemaVersion: 1;
  status: "ok" | "not-run";
  generatedAt?: string;
  cfastVersion?: string | null;
  pycfastVersion?: string;
  ignisModelVersion?: string | null;
  ignisExportedAt?: string | null;
  method?: { summary: string; notes: string[]; lowerOxygenLimitMassFraction: number; relativeHumidityPct: number; walls: unknown[] };
  cases: CfastCase[];
}

/** The committed reference. A JSON import is typed by its contents, so cast once here. */
export const CFAST_REFERENCE = reference as unknown as CfastReference;

export function hasCfastReference(ref: CfastReference = CFAST_REFERENCE): boolean {
  return ref.schemaVersion === 1 && ref.status === "ok" && Array.isArray(ref.cases) && ref.cases.length > 0;
}

export function cfastCases(ref: CfastReference = CFAST_REFERENCE): CfastCase[] {
  return hasCfastReference(ref) ? ref.cases : [];
}

export function cfastCase(caseId: string, ref: CfastReference = CFAST_REFERENCE): CfastCase | null {
  return cfastCases(ref).find((item) => item.id === caseId) ?? null;
}

export interface CfastComparison {
  caseId: string;
  label: string;
  hrrSource: CfastHrrSource;
  zoneModel: CfastZoneModel;
  bounding: boolean;
  gravityG: number;
  /** True when CFAST was driven by the IGNIS heat release for this case. */
  sameHeatRelease: boolean;
  totalHeatKJ: number;
  cfastPeakRiseC: number;
  /** Two-zone runs: the hot-layer bound. */
  cfastUpperLayerRiseC: number | null;
  cfastO2DepletionPts: number;
  /** Null when the case was not driven by the IGNIS heat release. */
  ignisPeakRiseC: number | null;
  ignisO2DepletionPts: number | null;
  /** IGNIS minus CFAST, K. */
  peakRiseDiffC: number | null;
  /** IGNIS minus CFAST, mole-fraction points. */
  o2DepletionDiffPts: number | null;
  /** CFAST peak cabin temperature from the assumed initial temperature, °C. */
  cfastPeakC: number;
  /** Saffire far-field maximum, °C, measured in flight. */
  measuredFarFieldC: number | null;
}

/** IGNIS against CFAST for one case: peak temperature rise and final O₂ depletion. */
export function cfastComparison(caseId: string, ref: CfastReference = CFAST_REFERENCE): CfastComparison | null {
  const item = cfastCase(caseId, ref);
  if (!item) return null;
  const same = item.hrrSource === "ignis" && item.ignis !== null;
  const ignisRise = same ? item.ignis!.peakTempRiseC : null;
  const ignisO2 = same ? item.ignis!.finalO2DepletionPts : null;
  return {
    caseId: item.id,
    label: item.label,
    hrrSource: item.hrrSource,
    zoneModel: item.zoneModel,
    bounding: item.bounding,
    gravityG: item.gravityG,
    sameHeatRelease: same,
    totalHeatKJ: item.fire.totalHeatKJ,
    cfastPeakRiseC: item.cfast.peakTempRiseC,
    cfastUpperLayerRiseC: item.cfast.peakUpperLayerRiseC,
    cfastO2DepletionPts: item.cfast.finalO2DepletionPts,
    ignisPeakRiseC: ignisRise,
    ignisO2DepletionPts: ignisO2,
    peakRiseDiffC: ignisRise === null ? null : ignisRise - item.cfast.peakTempRiseC,
    o2DepletionDiffPts: ignisO2 === null ? null : ignisO2 - item.cfast.finalO2DepletionPts,
    cfastPeakC: item.atmosphere.ambientC + item.cfast.peakTempRiseC,
    measuredFarFieldC: item.measured?.maxFarFieldC ?? null,
  };
}

export function cfastComparisons(ref: CfastReference = CFAST_REFERENCE): CfastComparison[] {
  return cfastCases(ref).map((item) => cfastComparison(item.id, ref)!);
}

/** One row per chart point, for plotting CFAST against IGNIS. */
export function cfastChartRows(item: CfastCase) {
  const s = item.series;
  return s.t.map((t, i) => ({
    t,
    hrrKw: s.hrrKw[i],
    cfastTempRiseC: s.cfastTempRiseC[i],
    cfastUpperTempRiseC: s.cfastUpperTempRiseC?.[i] ?? null,
    ignisTempRiseC: s.ignisTempRiseC?.[i] ?? null,
    cfastO2Pct: s.cfastO2Pct[i],
    ignisO2Pct: s.ignisO2Pct?.[i] ?? null,
  }));
}
