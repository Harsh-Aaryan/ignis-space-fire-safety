import { BASS_II_CO_RATIOS, FLIGHT_OBSERVATIONS, SAFFIRE_II_PMMA_BASE_REGRESSION_MMS } from "./options";
import { FIRE_MODEL_VERSION, sourceById, type Cited, type EvidenceKind } from "./sources";
import type { FireMaterial } from "./materials";

/**
 * Model 3.0.0 closure constants and calibrated coefficients, in one place.
 *
 * Every entry states its evidence class:
 * - measured: read directly from a source table;
 * - derived: computed from published values by a stated formula (the formula is
 *   in the code below, so it can be re-run);
 * - calibrated: fitted to published results by the routine in
 *   src/lib/fire/benchmarks.ts (calibrate()); the held-out error of each fit is
 *   reported in src/lib/fire/accuracy.ts and VALIDATION.md;
 * - assumed: a modelling choice with no direct measurement.
 */
export interface ClosureConstant {
  value: number;
  units: string;
  evidence: EvidenceKind;
  source: string;
  note: string;
}

const closure = (value: number, units: string, evidence: EvidenceKind, source: string, note: string): ClosureConstant => ({ value, units, evidence, source, note });

/** PMMA density used by the solid model, kg/m³ (src/lib/fire/thermal.ts). */
const PMMA_DENSITY = 1190;

/** Thin-fuel burnout: t_b = burn time − length ÷ spread rate for the Saffire-II SIBAL strips,
 * then normalise each burnout time to 21 % O₂, 0.2 m/s and 101.325 kPa using
 * the model's flux ∝ √(u·p) × O₂ scaling. II-6 used 25 cm/s in NASA's matrix. */
export function thinBurnoutFromSaffireII(arealKgM2: number) {
  const rows = FLIGHT_OBSERVATIONS.filter((row) => row.materialId === "sibal" && row.spreadMmS !== null && row.burnTimeS !== null);
  const scale = (row: typeof rows[number]) => Math.sqrt((row.reproduction?.flowMs ?? row.flowMs) / 0.2 * row.pressureKpa / 101.325) * row.oxygenPct / 21;
  const burnout = (spreadOffsetMmS: number) => rows.map((row) => row.burnTimeS! - row.lengthM / ((row.spreadMmS! + spreadOffsetMmS) / 1000));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const normalizedBurnout = (offset: number) => mean(burnout(offset).map((t, i) => t * scale(rows[i])));
  const flux = (burnoutS: number) => (arealKgM2 / burnoutS) * 1000;
  const burnoutS = burnout(0), meanBurnoutS = mean(burnoutS);
  // The burnout is a small difference of two near-equal times (about 5 s out of 115–145 s).
  // The spread rates are published to two significant figures, so each may lie ±0.05 mm/s
  // from its printed value; that rounding alone spans the range below. Rounding of the burn
  // times would widen it further.
  const burnoutRangeS: [number, number] = [mean(burnout(-0.05)), mean(burnout(0.05))].sort((a, b) => a - b) as [number, number];
  return { rows: rows.map((row) => row.id), burnoutS, meanBurnoutS, fluxGm2s: flux(normalizedBurnout(0)), burnoutRangeS, fluxRangeGm2s: [flux(normalizedBurnout(0.05)), flux(normalizedBurnout(-0.05))] as [number, number] };
}

/** CO starvation gain: BASS-II PMMA median CO/CO₂ at low oxygen over the median at ≥ 20.5 %,
 * expressed per unit of the model's starvation variable (21 − O₂)/12 at the low-oxygen median. */
function starvationGainFromBassII() {
  const { pmmaHighOxygen: high, pmmaLowOxygen: low } = BASS_II_CO_RATIOS;
  const starved = (21 - low.medianOxygenPct) / 12;
  return (low.median / high.median - 1) / starved;
}

/** Low-flow curvature of the thin-fuel oxygen limit. The ISS thin-sample test (BASS-II /
 * Saffire overview) burned SIBAL at 18.7 % O₂ and 5 cm/s and quenched it at 2.2 cm/s, so the
 * quench flow is taken at their geometric mean. With the SIBAL limit at its 20 cm/s optimum
 * (18.0 − 2.0 = 16 %, materials.ts) the curvature c solves 18.7 = 16 + c·ln²(u_q / 0.2). */
export function thinQuenchCurvatureFromBass(minimumLocPct = 16, optimumMs = 0.2) {
  const quenchMs = Math.sqrt(0.022 * 0.05);
  return (18.7 - minimumLocPct) / Math.log(quenchMs / optimumMs) ** 2;
}

export const FIRE_CLOSURES = {
  // Cabin wall heat transfer. These set cabin and far-field temperature and are the
  // constants to compare with the NIST CFAST reference (src/data/fire/cfast-reference.json).
  wallHeatCapacityJm2K: closure(12000, "J/(m² K)", "assumed", "model", "Areal heat capacity of the cabin wall layer that exchanges heat with the gas, about 5 mm of aluminium-equivalent."),
  wallFilmBaseWm2K: closure(3, "W/(m² K)", "assumed", "model", "Gas-to-wall convection coefficient with no flow (h = base + coefficient × √u)."),
  wallFilmVelocityCoeff: closure(10, "W/(m² K) per √(m/s)", "assumed", "model", "Forced-flow part of the gas-to-wall convection coefficient."),
  wallAmbientCouplingWm2K: closure(0.3, "W/(m² K)", "assumed", "model", "Loss from the wall layer to the vehicle structure and thermal control system."),
  wallShareLocal: closure(0.05, "fraction", "assumed", "model", "Share of wall area in contact with the near-fire zone."),
  wallShareRoom: closure(0.7, "fraction", "assumed", "model", "Share of wall area in contact with the room zone."),
  wallShareRest: closure(0.25, "fraction", "assumed", "model", "Share of wall area in contact with the connected habitat volume."),
  // Fuel surface and flame closures.
  solidFilmBaseWm2K: closure(2, "W/(m² K)", "assumed", "model", "Convection between the fuel surface and cabin gas with no flow."),
  solidFilmVelocityCoeff: closure(6, "W/(m² K) per √(m/s)", "assumed", "model", "Forced-flow part of the fuel-surface convection coefficient."),
  gasificationHeatJkg: closure(1.6e6, "J/kg", "assumed", "model", "Effective heat to gasify the solid at its pyrolysis temperature."),
  flameFeedbackEfficiency: closure(0.55, "fraction of chemical HRR", "assumed", "model", "Upper bound on the heat the flame can return to the fuel surface."),
  thickLocalBurningFluxKgM2s: closure(
    SAFFIRE_II_PMMA_BASE_REGRESSION_MMS.value[0] / 1000 * PMMA_DENSITY,
    "kg/(m² s)",
    "derived",
    "psi-saffire-ii",
    "Lower end of the 0.01–0.04 mm/s regression rate at the anchored base of the Saffire-II PMMA flames × 1190 kg/m³ (range 11.9–47.6 g/m²s). It sizes the flame-attached area over which feedback and surface losses act and does not set the heat release. The low end gives the largest attached area and so the largest surface losses, the more demanding energy balance; the Saffire VI peak heat release and total heat change by less than 0.01 % across the whole range.",
  ),
  coStarvationGain: closure(
    Number(starvationGainFromBassII().toFixed(3)),
    "per unit of (21 − O₂)/12",
    "derived",
    "psi-bass-ii",
    "CO/CO₂ rises from 3.40 % (PMMA, ≥ 20.5 % O₂) to 5.08 % (≤ 17.5 % O₂, median 16.15 %) across BASS-II runs. Replaces the assumed gain of 5 used up to model 2.1.0. Low-oxygen runs are mostly rods, high-oxygen runs mostly slabs.",
  ),
  thinQuenchCurvature: closure(
    Number(thinQuenchCurvatureFromBass().toFixed(3)),
    "% O₂ per ln²(u / u_opt)",
    "derived",
    "saffire-poster",
    "Thin fuels and wires below their optimum flow. Places the SIBAL quench at 3.3 cm/s for 18.7 % O₂, between the 5 cm/s burn and 2.2 cm/s quench of the ISS thin-sample test. Up to model 2.1.0 the value 2.0 put the quench at 6.3 cm/s, contradicting that observation.",
  ),
  limitRampPct: closure(0.5, "% O₂", "assumed", "model", "Burning rate ramps from 5 % to full over this band of near-fire oxygen above the limiting concentration, instead of switching. Numerical regularisation of a near-limit flame; no measurement sets its width."),
  fanTimeConstantS: closure(8, "s", "assumed", "model", "First-order spin-up and spin-down of cabin fans."),
} as const;

export interface CalibratedCoefficient extends ClosureConstant {
  /** Published rows the value was fitted to. */
  fittedTo: string[];
  /** What the routine minimises. */
  objective: string;
}

/**
 * Coefficients fitted by calibrate() in src/lib/fire/benchmarks.ts and stored rounded.
 * src/lib/fire/benchmarks.test.ts re-runs the fit and fails if a stored value drifts
 * more than 1 % from the result.
 */
export const CALIBRATED_COEFFICIENTS = {
  sibalSpreadMmS: {
    ...closure(4.684228, "mm/s at 22 % O₂, 101.325 kPa, 0.2 m/s", "calibrated", "saffire-vi", "Concurrent spread rate over SIBAL. Scales with √(u·p) and O₂ fraction (assumed laminar boundary-layer form)."),
    fittedTo: ["IV-1", "VI-2"],
    objective: "Sum of squared log errors of the burn duration (ignition to flame-out).",
  },
  pmmaFluxGm2s: {
    ...closure(0.821020, "g/(m² s) at 21 % O₂, 101.325 kPa, 0.2 m/s", "calibrated", "saffire-vi", "Burning flux averaged over the involved PMMA surface. Scales with √(u·p) and O₂ fraction. VI-3 follows the published fan timeline; VI-4 airflow history is incomplete."),
    fittedTo: ["VI-3", "VI-4"],
    objective: "Squared log error of peak heat release (weight 1) plus total heat and CO₂ rise (weight ½ each), jointly with pmmaThickSpreadMmS.",
  },
  pmmaThickSpreadMmS: {
    ...closure(0.557193, "mm/s at 21 % O₂, 101.325 kPa, 0.2 m/s", "calibrated", "saffire-vi", "Rate at which the burning region of thick PMMA grows downstream. Scales with u·p·(O₂ fraction)², the square of a boundary-layer flame heat flux (assumed form). Sensitive to incomplete VI-4 flow history; overpredicts earlier Saffire-II damage lengths."),
    fittedTo: ["VI-3", "VI-4"],
    objective: "Fitted jointly with pmmaFluxGm2s; total heat and CO₂ rise carry the growth information.",
  },
  sibalCoCo2: {
    ...closure(0.04645535, "mol CO per mol CO₂", "calibrated", "saffire-vi", "Low-flow microgravity CO/CO₂ ratio of SIBAL products."),
    fittedTo: ["IV-1", "VI-2"],
    objective: "Squared log error of the modelled cabin CO/CO₂ rise ratio.",
  },
  pmmaCoCo2: {
    ...closure(0.03769931, "mol CO per mol CO₂", "calibrated", "saffire-vi", "Low-flow microgravity CO/CO₂ ratio of PMMA products."),
    fittedTo: ["VI-3", "VI-4"],
    objective: "Squared log error of the modelled cabin CO/CO₂ rise ratio.",
  },
} satisfies Record<string, CalibratedCoefficient>;

/** Export rows for the closures, in the same shape as the material records. */
export function closureParameterRecords() {
  return [...Object.entries(FIRE_CLOSURES), ...Object.entries(CALIBRATED_COEFFICIENTS)].map(([parameter, c]) => ({
    parameter, value: c.value, units: c.units, evidence: c.evidence, source: sourceById(c.source).url, locator: c.note,
    fittedTo: "fittedTo" in c ? c.fittedTo : null, modelVersion: FIRE_MODEL_VERSION,
  }));
}

const UNITS: Record<string,string> = {
  heatOfCombustionMJkg:"MJ/kg", ignitionTempC:"°C", thermalInertia:"(kW/m² K)² s", criticalHeatFluxKwM2:"kW/m²",
  arealFuelKgM2:"kg/m²", loc1gPct:"vol % O₂", lowFlowMarginPct:"percentage points", co2Yield:"kg/kg", coYield1g:"kg/kg", sootYield:"kg/kg", radiativeFraction:"fraction", smokeCountMeanUm:"µm", smokeMassMeanUm:"µm", refMassFluxGm2s:"g/(m² s)", refSpreadMmS:"mm/s",
  coCo2LowFlow:"mol/mol", thickSpreadMmS:"mm/s",
};
export function materialParameterRecords(m: FireMaterial) {
  const records = Object.entries(m).filter(([,value])=>value&&typeof value==="object"&&"source" in value).map(([key,value])=>{
    const v=value as Cited<unknown>;
    return { parameter:key,value:v.value,units:UNITS[key]??"unspecified",evidence:v.evidence??"assumed",source:sourceById(v.source).url,
      locator:v.locator,uncertainty:v.uncertainty,specimen:m.name,configuration:m.form,
      referencePressureKpa:key==="loc1gPct"?m.id==="pei"?70.3:101.325:null,
      conditions: v.source === "same-2" ? "Microgravity, below ignition, fresh versus aged 720 s; source airflow must be matched" : v.source === "bass-ii" ? "PMMA rod observation; not a slab or wire qualification" : v.source === "saffire-vi" ? "Microgravity, 0.2 m/s initial concurrent duct flow; original atmosphere/geometry in Tables 1–2" : v.source === "psi-saffire-ii" ? "Microgravity, 5 cm wide Saffire-II strips at 20 cm/s and about 22 % O₂" : "Refer to specimen-specific source; application transfer is not verified",
      applicability:"Source specimen and method required; arbitrary habitat transfer is exploratory",modelVersion:FIRE_MODEL_VERSION };
  });
  return [...records,{parameter:"specificHeatKJkgK",value:m.specificHeatKJkgK,units:"kJ/(kg K)",evidence:"assumed",source:null,locator:"Nominal value; primary table not verified",uncertainty:"Not quantified",specimen:m.name,configuration:m.form,referencePressureKpa:null,applicability:"Exploratory",modelVersion:FIRE_MODEL_VERSION}];
}
