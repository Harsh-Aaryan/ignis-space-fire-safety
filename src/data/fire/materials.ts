import { CALIBRATED_COEFFICIENTS as FIT, thinBurnoutFromSaffireII } from "@/data/fire/parameters";
import { cite, type Cited } from "@/data/fire/sources";
import type { EquipmentType } from "@/data/habitat-interiors";
import type { FuelCategory } from "@/types/domain";

/**
 * Materials database for the fire model.
 *
 * Flammability limits, smoke particle sizes and the Saffire-derived burning
 * calibration come from NASA documents (see sources.ts). Thermophysical
 * properties that NASA flight papers do not tabulate come from standard
 * fire-science handbooks and are tagged "sfpe". Anything tagged "model" is an
 * assumption, not a measurement.
 */

export type FuelForm = "thick" | "thin" | "wire";

export interface FireMaterial {
  id: string;
  name: string;
  /** Where the material shows up in a crewed vehicle. */
  use: string;
  category: FuelCategory;
  form: FuelForm;
  /** Effective heat of combustion, MJ per kg of fuel burned. */
  heatOfCombustionMJkg: Cited;
  /** Piloted ignition temperature, °C. */
  ignitionTempC: Cited;
  /** Thermal inertia kρc, (kW/m²K)² s. Used for thermally thick ignition. */
  thermalInertia: Cited;
  /** Critical heat flux for ignition, kW/m². */
  criticalHeatFluxKwM2: Cited;
  /** Combustible mass per unit of burning surface, kg/m². */
  arealFuelKgM2: Cited;
  /** Specific heat of the solid, kJ/kgK. Used for thermally thin ignition. */
  specificHeatKJkgK: number;
  /** Upward limiting oxygen index in 1 g at 14.7 psia, % O₂. */
  loc1gPct: Cited;
  /** How far below the 1 g limit the material still burns at optimal low flow, % O₂. */
  lowFlowMarginPct: Cited;
  /** kg of CO₂ per kg of fuel. */
  co2Yield: Cited;
  /** kg of CO per kg of fuel in a well-ventilated 1 g flame. */
  coYield1g: Cited;
  /** kg of soot per kg of fuel. */
  sootYield: Cited;
  /** Fraction of heat release leaving as radiation. */
  radiativeFraction: Cited;
  /** Smoke count mean diameter, µm: [fresh, aged 720 s]. */
  smokeCountMeanUm: Cited<[number, number]>;
  /** Smoke diameter of average mass, µm: [fresh, aged 720 s]. */
  smokeMassMeanUm: Cited<[number, number]>;
  /** Burning mass flux at 21 % O₂, 101.325 kPa and 0.2 m/s, g/m²s. Thin fuels: flux in the
   * burning zone behind the spreading front (sets the burnout time). Thick fuels: flux
   * averaged over the involved surface. */
  refMassFluxGm2s: Cited;
  /** Concurrent spread rate at 22 % O₂, 101.325 kPa and 0.2 m/s, mm/s. Thin fuels and wires. */
  refSpreadMmS: Cited | null;
  /** Thick fuels: downstream growth rate of the burning region at 21 % O₂, 101.325 kPa and 0.2 m/s, mm/s. */
  thickSpreadMmS?: Cited;
  /** Molar CO/CO₂ ratio of the products in low-flow microgravity burning. Absent: the 1 g yield is used at every gravity. */
  coCo2LowFlow?: Cited;
  /** Molten, dripping fuel. Matters once there is gravity. */
  drips: boolean;
  /** What NASA testing says about this material. */
  nasaFinding: string;
  nasaSources: string[];
}

const SIBAL_AREAL = 0.1354;
/** Calibrated to the Saffire VI SIBAL burn durations (benchmarks.ts calibrate()). */
const SIBAL_SPREAD = FIT.sibalSpreadMmS.value;
/** Derived from the Saffire-II SIBAL strips: burnout time = burn time − length ÷ spread rate. */
const SIBAL_BURNOUT = thinBurnoutFromSaffireII(SIBAL_AREAL);

/** Thin-fuel spread scales inversely with fuel loading (de Ris). Reference is the calibrated SIBAL rate. */
function spreadFromAreal(arealKgM2: number): Cited {
  return cite(
    Number(((SIBAL_SPREAD * SIBAL_AREAL) / arealKgM2).toFixed(2)),
    "model",
    "Calibrated SIBAL spread rate scaled inversely with fuel loading.",
  );
}

export const FIRE_MATERIALS: FireMaterial[] = [
  {
    id: "pmma",
    name: "PMMA (cast acrylic)",
    use: "Windows, panels, test samples. The reference thick fuel on Saffire and BASS-II.",
    category: "solid-polymer",
    form: "thick",
    heatOfCombustionMJkg: cite(25.0, "sfpe"),
    ignitionTempC: cite(378, "sfpe"),
    thermalInertia: cite(1.02, "sfpe"),
    criticalHeatFluxKwM2: cite(11, "sfpe"),
    arealFuelKgM2: cite(5.95, "saffire-vi", "5 mm per burning side at 1190 kg/m³ (Saffire VI slabs are 5 mm one-sided, 10 mm two-sided)."),
    specificHeatKJkgK: 1.42,
    loc1gPct: cite(16.0, "bass-ii", "1 g blowoff limit of the rod sample."),
    lowFlowMarginPct: cite(2.4, "bass-ii", "Steady spread at 13.6 % O₂ in microgravity."),
    co2Yield: cite(2.2, "sfpe", "Stoichiometric for C₅H₈O₂. Saffire VI-3 and VI-4 CO₂ rises are consistent with it."),
    coYield1g: cite(0.01, "sfpe"),
    sootYield: cite(0.022, "sfpe"),
    radiativeFraction: cite(0.31, "sfpe"),
    smokeCountMeanUm: cite([0.2, 0.33], "model", "Not measured in SAME. Set inside the 200–400 nm range SAME-2 reports for most smokes."),
    smokeMassMeanUm: cite([0.3, 0.45], "model", "Not measured in SAME."),
    refMassFluxGm2s: cite(FIT.pmmaFluxGm2s.value, "saffire-vi", "Fitted with the growth rate below to VI-3 and VI-4 peak heat release, total heat and CO₂ rise; averaged over the involved surface.", "calibrated"),
    refSpreadMmS: null,
    thickSpreadMmS: cite(FIT.pmmaThickSpreadMmS.value, "saffire-vi", "Fitted to VI-3 and VI-4 with the burning flux; scales with u·p·(O₂ fraction)². Checked against the Saffire-II damage length, not fitted to it.", "calibrated"),
    coCo2LowFlow: cite(FIT.pmmaCoCo2.value, "saffire-vi", "Fitted to the VI-3 and VI-4 CO/CO₂ rise ratio. Checked against BASS-II run-level ratios, not fitted to them.", "calibrated"),
    drips: false,
    nasaFinding:
      "Burned steadily at 13.6 % O₂ in microgravity although it blows off at 16 % in 1 g. On Saffire VI two slabs released 1.5 and 3.1 kW and pushed cabin CO₂ past the 1-hour limit.",
    nasaSources: ["bass-ii", "saffire-vi", "saffire-iv-v", "hirsch-2011"],
  },
  {
    id: "sibal",
    name: "Cotton / fiberglass fabric (SIBAL)",
    use: "Clothing, bedding, stowage bags. 75 % cotton, the Saffire thin fuel.",
    category: "solid-fabric",
    form: "thin",
    heatOfCombustionMJkg: cite(14.7, "saffire-vi", "From the fuel-consumption calorimetry in Table 2: 2.0 MJ per m² of fabric."),
    ignitionTempC: cite(260, "sfpe"),
    thermalInertia: cite(0.25, "sfpe"),
    criticalHeatFluxKwM2: cite(10, "sfpe"),
    arealFuelKgM2: cite(SIBAL_AREAL, "saffire-vi", "75 % of 18.05 mg/cm²."),
    specificHeatKJkgK: 1.3,
    loc1gPct: cite(18.0, "sfpe", "Handbook oxygen index of cotton. BASS-II burned SIBAL at 18.7 % in microgravity."),
    lowFlowMarginPct: cite(2.0, "model", "Sets the limit at the 20 cm/s optimum. The low-flow curvature (parameters.ts) places the quench at 3.3 cm/s for 18.7 % O₂, between the burn at 5 cm/s and the quench at 2.2 cm/s that BASS-II observed."),
    co2Yield: cite(1.63, "saffire-vi", "Cellulose stoichiometry. Reproduces the IV-1 and VI-2 CO₂ rise for the 27.7 g of cotton on the sample."),
    coYield1g: cite(0.004, "sfpe"),
    sootYield: cite(0.015, "sfpe"),
    radiativeFraction: cite(0.3, "sfpe"),
    smokeCountMeanUm: cite([0.128, 0.276], "same-2", "Lamp wick (cellulose)."),
    smokeMassMeanUm: cite([0.258, 0.398], "same-2", "Lamp wick (cellulose)."),
    refMassFluxGm2s: {
      ...cite(Number(SIBAL_BURNOUT.fluxGm2s.toFixed(1)), "psi-saffire-ii", `Burning-zone flux from the Saffire-II SIBAL strips: burnout ${SIBAL_BURNOUT.meanBurnoutS.toFixed(1)} s (burn time minus length over spread rate), 13.54 mg/cm² of cotton. Each row is normalized for oxygen and flow; II-6 uses NASA's corrected 25 cm/s (saffire-i-iii-matrix).`, "derived"),
      uncertainty: `Burnout is a small difference of near-equal times; rounding of the two-figure spread rates alone gives ${SIBAL_BURNOUT.burnoutRangeS[0].toFixed(1)}–${SIBAL_BURNOUT.burnoutRangeS[1].toFixed(1)} s, i.e. ${SIBAL_BURNOUT.fluxRangeGm2s[0].toFixed(0)}–${SIBAL_BURNOUT.fluxRangeGm2s[1].toFixed(0)} g/m²s.`,
    },
    refSpreadMmS: cite(SIBAL_SPREAD, "saffire-vi", "Fitted to the IV-1 and VI-2 burn durations; scales with √(u·p) and O₂ fraction. Saffire-I and Saffire-II spread more slowly (see the model check).", "calibrated"),
    coCo2LowFlow: cite(FIT.sibalCoCo2.value, "saffire-vi", "Fitted to the IV-1 and VI-2 CO/CO₂ rise ratio. Checked against BASS-II SIBAL runs, not fitted to them.", "calibrated"),
    drips: false,
    nasaFinding:
      "Reached a steady spread rate and a limiting flame size in every Saffire flight. Quenched in BASS-II when flow fell from 5 to 2.2 cm/s at 18.7 % O₂.",
    nasaSources: ["saffire-vi", "saffire-iv-v", "saffire-poster", "bass-ii"],
  },
  {
    id: "nomex",
    name: "Nomex HT90-40 (aramid fabric)",
    use: "Flight suits, extinguisher covers, stowage. Chosen for fire resistance.",
    category: "solid-fabric",
    form: "thin",
    heatOfCombustionMJkg: cite(13, "model", "Char-forming. Effective value assumed."),
    ignitionTempC: cite(500, "sfpe"),
    thermalInertia: cite(0.25, "sfpe"),
    criticalHeatFluxKwM2: cite(22, "model"),
    arealFuelKgM2: cite(0.19, "model"),
    specificHeatKJkgK: 1.3,
    loc1gPct: cite(28.5, "sfpe", "Handbook oxygen index of meta-aramid."),
    lowFlowMarginPct: cite(4.0, "olson-2008", "Upper bound reported for Nomex HT90-40, Ultem and Mylar G."),
    co2Yield: cite(1.5, "model"),
    coYield1g: cite(0.02, "model"),
    sootYield: cite(0.03, "model"),
    radiativeFraction: cite(0.3, "model"),
    smokeCountMeanUm: cite([0.2, 0.33], "model", "Not measured in SAME."),
    smokeMassMeanUm: cite([0.3, 0.45], "model", "Not measured in SAME."),
    refMassFluxGm2s: cite(1.6, "model"),
    refSpreadMmS: spreadFromAreal(0.19),
    drips: false,
    nasaFinding:
      "Did not ignite on Saffire VI. In microgravity it burned at up to 4 % less oxygen than the 1 g test limit, and its limit depends strongly on pressure and flow.",
    nasaSources: ["olson-2008", "saffire-vi", "saffire-poster"],
  },
  {
    id: "kapton",
    name: "Kapton HN (polyimide wire insulation)",
    use: "Wire insulation and thermal film.",
    category: "solid-polymer",
    form: "wire",
    heatOfCombustionMJkg: cite(13, "model", "Char-forming. Effective value assumed."),
    ignitionTempC: cite(550, "sfpe"),
    thermalInertia: cite(0.6, "sfpe"),
    criticalHeatFluxKwM2: cite(28, "model"),
    arealFuelKgM2: cite(0.18, "hirsch-2011", "5 mil film at 1420 kg/m³."),
    specificHeatKJkgK: 1.1,
    loc1gPct: cite(27.2, "hirsch-2011", "ULOI, chemical igniter. MOC 26."),
    lowFlowMarginPct: cite(4.0, "model", "Not flight tested. Set to the largest margin Olson et al. report."),
    co2Yield: cite(1.9, "model"),
    coYield1g: cite(0.02, "model"),
    sootYield: cite(0.02, "model"),
    radiativeFraction: cite(0.3, "model"),
    smokeCountMeanUm: cite([0.056, 0.109], "same-2"),
    smokeMassMeanUm: cite([0.101, 0.161], "same-2"),
    refMassFluxGm2s: cite(1.4, "model"),
    refSpreadMmS: spreadFromAreal(0.18),
    drips: false,
    nasaFinding:
      "Overheated Kapton makes the smallest smoke particles SAME-2 measured (56 nm count mean), which light-scattering detectors struggle to see.",
    nasaSources: ["same-2", "hirsch-2011"],
  },
  {
    id: "ptfe",
    name: "PTFE / Teflon (wire insulation)",
    use: "Wire insulation, tubing, tape.",
    category: "solid-polymer",
    form: "wire",
    heatOfCombustionMJkg: cite(4.2, "sfpe"),
    ignitionTempC: cite(560, "sfpe"),
    thermalInertia: cite(1.2, "sfpe"),
    criticalHeatFluxKwM2: cite(38, "sfpe"),
    arealFuelKgM2: cite(0.55, "model", "0.25 mm at 2200 kg/m³."),
    specificHeatKJkgK: 1.0,
    loc1gPct: cite(49, "hirsch-2011", "ULOI. Falls to 40.8 when preheated to 200 °F."),
    lowFlowMarginPct: cite(4.0, "model"),
    co2Yield: cite(0.38, "sfpe"),
    coYield1g: cite(0.09, "sfpe"),
    sootYield: cite(0.003, "sfpe"),
    radiativeFraction: cite(0.2, "model"),
    smokeCountMeanUm: cite([0.101, 0.105], "same-2"),
    smokeMassMeanUm: cite([0.17, 0.232], "same-2"),
    refMassFluxGm2s: cite(0.8, "model"),
    refSpreadMmS: spreadFromAreal(0.55),
    drips: false,
    nasaFinding:
      "The cited PTFE specimen had a high 1 g oxygen limit. This does not establish nonflammability in every atmosphere. Overheated PTFE made fine aerosols in SAME-2; fluorinated combustion chemistry is not modeled.",
    nasaSources: ["same-2", "hirsch-2011"],
  },
  {
    id: "ldpe-wire",
    name: "Polyethylene (LDPE wire insulation)",
    use: "Laboratory and commercial wire insulation, packaging film.",
    category: "solid-polymer",
    form: "wire",
    heatOfCombustionMJkg: cite(43.6, "sfpe"),
    ignitionTempC: cite(363, "sfpe"),
    thermalInertia: cite(0.9, "sfpe"),
    criticalHeatFluxKwM2: cite(15, "sfpe"),
    arealFuelKgM2: cite(0.138, "konno-2023", "0.15 mm insulation (0.5 mm core, 0.8 mm outer) at 920 kg/m³."),
    specificHeatKJkgK: 2.3,
    loc1gPct: cite(18.0, "konno-2023", "Limits sat between 16 and 21 % O₂ depending on core and flow."),
    lowFlowMarginPct: cite(1.5, "model", "Assumed magnitude; Konno supports core-dependent trends, not this extracted numerical margin."),
    co2Yield: cite(2.76, "sfpe"),
    coYield1g: cite(0.024, "sfpe"),
    sootYield: cite(0.06, "sfpe"),
    radiativeFraction: cite(0.43, "sfpe"),
    smokeCountMeanUm: cite([0.2, 0.33], "model", "Not measured in SAME."),
    smokeMassMeanUm: cite([0.3, 0.45], "model", "Not measured in SAME."),
    refMassFluxGm2s: cite(1.3, "model"),
    refSpreadMmS: cite(1.5, "model", "Order of magnitude for thin insulated wire. Konno et al. plot spread rate but the values were not extracted."),
    drips: true,
    nasaFinding:
      "Burned at lunar and Martian gravity in parabolic flight. Molten insulation drips and leaks differently at each gravity level, and the wire core changes the limit.",
    nasaSources: ["konno-2023", "nasa-std-6001b"],
  },
  {
    id: "silicone",
    name: "Silicone rubber (MQ)",
    use: "Seals, gaskets, hoses, potting.",
    category: "solid-polymer",
    form: "thin",
    heatOfCombustionMJkg: cite(14, "model"),
    ignitionTempC: cite(430, "sfpe"),
    thermalInertia: cite(0.7, "sfpe"),
    criticalHeatFluxKwM2: cite(20, "model"),
    arealFuelKgM2: cite(1.1, "hirsch-2011", "40 mil (1 mm) sheet at 1100 kg/m³."),
    specificHeatKJkgK: 1.3,
    loc1gPct: cite(23.4, "hirsch-2011", "ULOI at 40 mil. MOC 22. At 4 mil the ULOI is 17.5."),
    lowFlowMarginPct: cite(3.0, "model"),
    co2Yield: cite(1.2, "model"),
    coYield1g: cite(0.02, "model"),
    sootYield: cite(0.07, "model", "Silica-rich smoke."),
    radiativeFraction: cite(0.3, "model"),
    smokeCountMeanUm: cite([0.196, 0.355], "same-2"),
    smokeMassMeanUm: cite([0.465, 0.619], "same-2"),
    refMassFluxGm2s: cite(1.2, "model"),
    refSpreadMmS: spreadFromAreal(1.1),
    drips: false,
    nasaFinding:
      "Flew on Saffire II as flammability-limit samples. Its smoke is the largest SAME-2 measured, so it gives strong light-scattering signals. Thinner sheet is markedly more flammable.",
    nasaSources: ["hirsch-2011", "same-2", "saffire-poster"],
  },
  {
    id: "pei",
    name: "Ultem 1000 (polyetherimide film)",
    use: "Interior panels, connectors, film.",
    category: "solid-polymer",
    form: "thin",
    heatOfCombustionMJkg: cite(20, "model"),
    ignitionTempC: cite(520, "sfpe"),
    thermalInertia: cite(0.6, "sfpe"),
    criticalHeatFluxKwM2: cite(25, "model"),
    arealFuelKgM2: cite(0.32, "hirsch-2011", "10 mil film at 1270 kg/m³."),
    specificHeatKJkgK: 1.2,
    loc1gPct: cite(26.5, "hirsch-2011", "ULOI at 10.2 psia. MOC 24."),
    lowFlowMarginPct: cite(4.0, "olson-2008"),
    co2Yield: cite(2.6, "model"),
    coYield1g: cite(0.03, "model"),
    sootYield: cite(0.05, "model"),
    radiativeFraction: cite(0.3, "model"),
    smokeCountMeanUm: cite([0.2, 0.33], "model", "Not measured in SAME."),
    smokeMassMeanUm: cite([0.3, 0.45], "model", "Not measured in SAME."),
    refMassFluxGm2s: cite(1.5, "model"),
    refSpreadMmS: spreadFromAreal(0.32),
    drips: false,
    nasaFinding:
      "One of three materials that burned in microgravity at lower oxygen than NASA-STD-6001 Test 1 indicates, by up to 4 % O₂.",
    nasaSources: ["olson-2008", "hirsch-2011"],
  },
  {
    id: "paper",
    name: "Cellulose tissue / paper",
    use: "Wipes, checklists, packaging.",
    category: "paper-cellulose",
    form: "thin",
    heatOfCombustionMJkg: cite(14.7, "saffire-vi", "Same cellulose value as SIBAL."),
    ignitionTempC: cite(260, "sfpe"),
    thermalInertia: cite(0.2, "sfpe"),
    criticalHeatFluxKwM2: cite(10, "sfpe"),
    arealFuelKgM2: cite(0.02, "model", "Laboratory tissue, about 20 g/m²."),
    specificHeatKJkgK: 1.3,
    loc1gPct: cite(16.5, "model", "Thin cellulose. Sacksteder and T'ien found its limit lowest in partial gravity."),
    lowFlowMarginPct: cite(1.5, "model"),
    co2Yield: cite(1.63, "saffire-vi"),
    coYield1g: cite(0.004, "sfpe"),
    coCo2LowFlow: cite(FIT.sibalCoCo2.value, "model", "SIBAL (cotton) low-flow ratio transferred to cellulose tissue."),
    sootYield: cite(0.015, "sfpe"),
    radiativeFraction: cite(0.3, "sfpe"),
    smokeCountMeanUm: cite([0.128, 0.276], "same-2", "Lamp wick (cellulose)."),
    smokeMassMeanUm: cite([0.258, 0.398], "same-2", "Lamp wick (cellulose)."),
    refMassFluxGm2s: cite(Number(SIBAL_BURNOUT.fluxGm2s.toFixed(1)), "model", "SIBAL burning-zone flux transferred to cellulose tissue."),
    refSpreadMmS: spreadFromAreal(0.02),
    drips: false,
    nasaFinding:
      "Thin cellulose tissue is the material in which a flame-spread peak and an oxygen-limit minimum were first seen in partial gravity.",
    nasaSources: ["olson-2008", "ferkul-2026"],
  },
  {
    id: "pyrell",
    name: "Pyrell (polyurethane foam)",
    use: "Acoustic and packing foam, cushions.",
    category: "solid-polymer",
    form: "thin",
    heatOfCombustionMJkg: cite(17.8, "sfpe"),
    ignitionTempC: cite(350, "sfpe"),
    thermalInertia: cite(0.05, "sfpe"),
    criticalHeatFluxKwM2: cite(16, "sfpe"),
    arealFuelKgM2: cite(0.75, "model", "25 mm of 30 kg/m³ foam."),
    specificHeatKJkgK: 1.4,
    loc1gPct: cite(22, "model", "Fire-retarded foam. Not in the retrieved limit tables."),
    lowFlowMarginPct: cite(3.0, "model"),
    co2Yield: cite(1.5, "sfpe"),
    coYield1g: cite(0.02, "sfpe"),
    sootYield: cite(0.13, "sfpe"),
    radiativeFraction: cite(0.4, "sfpe"),
    smokeCountMeanUm: cite([0.204, 0.359], "same-2"),
    smokeMassMeanUm: cite([0.384, 0.539], "same-2"),
    refMassFluxGm2s: cite(2.0, "model"),
    refSpreadMmS: spreadFromAreal(0.75),
    drips: true,
    nasaFinding:
      "In SAME-2 its smoke changed from fractal clusters at 8 cm/s to large spheres with no flow, a morphology unique to microgravity.",
    nasaSources: ["same-2"],
  },
  {
    id: "epoxy-glass",
    name: "Epoxy / glass laminate (G-11 circuit board)",
    use: "Circuit boards and avionics structure.",
    category: "solid-composite",
    form: "thick",
    heatOfCombustionMJkg: cite(10, "model", "Resin fraction only."),
    ignitionTempC: cite(420, "sfpe"),
    thermalInertia: cite(0.9, "sfpe"),
    criticalHeatFluxKwM2: cite(20, "model"),
    arealFuelKgM2: cite(1.0, "hirsch-2011", "0.064 in laminate, roughly one third resin."),
    specificHeatKJkgK: 1.2,
    loc1gPct: cite(23.6, "hirsch-2011", "ULOI, standard 2.5 in sample. MOC 23. A 0.5 in strip burns down to 17.9."),
    lowFlowMarginPct: cite(3.0, "model"),
    co2Yield: cite(1.5, "model"),
    coYield1g: cite(0.04, "model"),
    sootYield: cite(0.1, "model"),
    radiativeFraction: cite(0.35, "model"),
    smokeCountMeanUm: cite([0.2, 0.33], "model", "Not measured in SAME."),
    smokeMassMeanUm: cite([0.3, 0.45], "model", "Not measured in SAME."),
    refMassFluxGm2s: cite(1.0, "model"),
    refSpreadMmS: null,
    drips: false,
    nasaFinding:
      "Narrow strips with exposed edges burned at 17.9 % O₂ against 23.6 % for the standard sample. Configuration matters as much as the material.",
    nasaSources: ["hirsch-2011"],
  },
  {
    id: "nylon",
    name: "Nylon (polyamide)",
    use: "Hook-and-loop fastener, straps, cable ties.",
    category: "solid-polymer",
    form: "thin",
    heatOfCombustionMJkg: cite(27.1, "sfpe"),
    ignitionTempC: cite(450, "sfpe"),
    thermalInertia: cite(0.87, "sfpe"),
    criticalHeatFluxKwM2: cite(15, "sfpe"),
    arealFuelKgM2: cite(0.9, "model", "0.8 mm at 1140 kg/m³."),
    specificHeatKJkgK: 1.7,
    loc1gPct: cite(24.5, "hirsch-2011", "ULOI, Zytel 42, standard sample. MOC 24.1. A 0.5 in strip burns down to 21.6."),
    lowFlowMarginPct: cite(3.0, "model"),
    co2Yield: cite(2.06, "sfpe"),
    coYield1g: cite(0.038, "sfpe"),
    sootYield: cite(0.075, "sfpe"),
    radiativeFraction: cite(0.3, "sfpe"),
    smokeCountMeanUm: cite([0.2, 0.33], "model", "Not measured in SAME."),
    smokeMassMeanUm: cite([0.3, 0.45], "model", "Not measured in SAME."),
    refMassFluxGm2s: cite(1.4, "model"),
    refSpreadMmS: spreadFromAreal(0.9),
    drips: true,
    nasaFinding:
      "White Sands reported configuration-dependent nylon oxygen limits. A grade, width or atmosphere change requires a new applicability assessment.",
    nasaSources: ["hirsch-2011", "iss-fds-2001"],
  },
];

export function materialById(id: string): FireMaterial {
  const material = FIRE_MATERIALS.find((item) => item.id === id);
  if (!material) throw new Error(`Unknown fire material ${id}`);
  return material;
}

/** The burnable item a piece of habitat equipment stands for. Dimensions are conceptual. */
export interface FuelPackage {
  label: string;
  materialId: string;
  /** Extent across the spread direction, m. */
  widthM: number;
  /** Extent along the spread direction, m. */
  lengthM: number;
  sides: 1 | 2;
  /** Behind a panel or inside a rack: limits air supply and line of sight. */
  enclosed: boolean;
  /** Height of the fuel above the object's base, as a fraction of object height. */
  heightFraction: number;
  defaultIgnitionId: string;
}

export const FUEL_PACKAGES: Record<EquipmentType, FuelPackage> = {
  rack: { label: "Avionics boards inside the rack", materialId: "epoxy-glass", widthM: 0.4, lengthM: 0.5, sides: 2, enclosed: true, heightFraction: 0.55, defaultIgnitionId: "overload-wire" },
  cabinet: { label: "Fabric stowage inside the cabinet", materialId: "sibal", widthM: 0.41, lengthM: 0.5, sides: 2, enclosed: true, heightFraction: 0.5, defaultIgnitionId: "overheated-component" },
  duct: { label: "Silicone duct seal", materialId: "silicone", widthM: 0.2, lengthM: 1.2, sides: 1, enclosed: false, heightFraction: 0.5, defaultIgnitionId: "overload-wire" },
  filter: { label: "Filter media and foam", materialId: "pyrell", widthM: 0.5, lengthM: 0.6, sides: 1, enclosed: true, heightFraction: 0.5, defaultIgnitionId: "overload-wire" },
  detector: { label: "Detector wiring", materialId: "ptfe", widthM: 0.02, lengthM: 0.4, sides: 1, enclosed: false, heightFraction: 0.5, defaultIgnitionId: "short-circuit" },
  oxygen: { label: "Panel wire harness", materialId: "kapton", widthM: 0.03, lengthM: 0.6, sides: 1, enclosed: true, heightFraction: 0.5, defaultIgnitionId: "short-circuit" },
  extinguisher: { label: "Nylon restraint straps", materialId: "nylon", widthM: 0.05, lengthM: 0.4, sides: 2, enclosed: false, heightFraction: 0.6, defaultIgnitionId: "hot-wire" },
  bench: { label: "PMMA sample on the bench", materialId: "pmma", widthM: 0.41, lengthM: 0.18, sides: 2, enclosed: false, heightFraction: 0.62, defaultIgnitionId: "hot-wire" },
  samples: { label: "Polymer coupons in the rack", materialId: "pmma", widthM: 0.3, lengthM: 0.4, sides: 2, enclosed: false, heightFraction: 0.55, defaultIgnitionId: "hot-wire" },
  bed: { label: "Bedding fabric", materialId: "sibal", widthM: 0.41, lengthM: 0.94, sides: 1, enclosed: false, heightFraction: 0.55, defaultIgnitionId: "battery-runaway" },
  emergency: { label: "Panel wiring", materialId: "ldpe-wire", widthM: 0.03, lengthM: 0.6, sides: 1, enclosed: true, heightFraction: 0.5, defaultIgnitionId: "overload-wire" },
  door: { label: "Hatch seal", materialId: "silicone", widthM: 0.03, lengthM: 3.0, sides: 1, enclosed: false, heightFraction: 0.5, defaultIgnitionId: "short-circuit" },
  light: { label: "Power connection wiring", materialId: "ldpe-wire", widthM: 0.03, lengthM: 1.0, sides: 1, enclosed: false, heightFraction: 0.5, defaultIgnitionId: "overload-wire" },
};
