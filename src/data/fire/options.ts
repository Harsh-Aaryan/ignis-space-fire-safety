import { cite, type Cited } from "@/data/fire/sources";

/** Stage 1: what starts the fire. Flux, duration and area set the ignition delay. */
export interface IgnitionSource {
  id: string;
  name: string;
  description: string;
  /** Heat flux onto the fuel surface, kW/m². */
  heatFluxKwM2: Cited;
  /** Seconds the source stays on. null means it runs until power is removed. */
  durationS: Cited<number | null>;
  /** Heated spot, m². Sets the size of the initial flame. */
  areaM2: number;
  /** Removing rack power stops it. */
  electrical: boolean;
  /** Heat the source itself releases while active, W. */
  ownHeatW: number;
  electricalModel?: { currentA: number; resistanceOhm: number };
  /** Applied to a thin or tapered edge, the way NASA rigs light thick samples. */
  edge?: boolean;
  sources: string[];
}

export const IGNITION_SOURCES: IgnitionSource[] = [
  {
    id: "overload-wire",
    name: "Overloaded electrical wire",
    description:
      "A conductor carrying more than its rating heats its insulation steadily. It keeps heating until power is removed, so thick fuels have time to reach ignition.",
    heatFluxKwM2: cite(30, "model", "Sustained ohmic heating of the insulation and what it touches."),
    durationS: cite(null, "model"),
    areaM2: 0.0015,
    electrical: true,
    ownHeatW: 60,
    electricalModel: { currentA: 20, resistanceOhm: 0.15 },
    sources: ["konno-2023", "nasa-std-6001b", "iss-fds-2001"],
  },
  {
    id: "short-circuit",
    name: "Short-circuit arc",
    description:
      "A brief, very intense arc. Whether it ignites a fuel depends on deposited energy, duration, geometry and heat losses.",
    heatFluxKwM2: cite(150, "model", "Arc flux is far above any critical heat flux; duration is what limits it."),
    durationS: cite(1.5, "model"),
    areaM2: 0.0004,
    electrical: true,
    ownHeatW: 300,
    sources: ["konno-2023"],
  },
  {
    id: "hot-wire",
    name: "Hot-wire igniter (NASA test igniter)",
    description:
      "The igniter used in NASA flammability rigs: a coiled resistance wire held against the sample for a few seconds.",
    heatFluxKwM2: cite(75, "model", "A 94 W coil in the DIAMONDS rig (Konno et al.). Flux onto the sample is assumed."),
    durationS: cite(12, "model", "8 s on wires and films (Konno et al., White Sands). Held a little longer here for the tapered edge of a slab."),
    areaM2: 0.0012,
    electrical: true,
    ownHeatW: 94,
    edge: true,
    sources: ["konno-2023", "hirsch-2011", "bass-ii"],
  },
  {
    id: "battery-runaway",
    name: "Lithium-ion battery thermal runaway",
    description:
      "A laptop or camcorder cell venting flame onto nearby material. One of the five ISS fire scenarios used to qualify the water-mist extinguisher.",
    heatFluxKwM2: cite(60, "model"),
    durationS: cite(45, "model"),
    areaM2: 0.004,
    electrical: false,
    ownHeatW: 2500,
    sources: ["fwm-pfe"],
  },
  {
    id: "overheated-component",
    name: "Overheated component (pre-fire)",
    description:
      "A failing part that runs hot without arcing. Often it only smoulders and makes smoke, which is the event the SAME experiments characterised.",
    heatFluxKwM2: cite(18, "model", "Above the critical heat flux of the easily ignited fuels, below that of Kapton and PTFE."),
    durationS: cite(null, "model"),
    areaM2: 0.002,
    electrical: true,
    ownHeatW: 40,
    sources: ["same-2"],
  },
];

export function ignitionById(id: string): IgnitionSource {
  const source = IGNITION_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown ignition source ${id}`);
  return source;
}

/** Stage 4a: sensors. */
export type SensorId = "photoelectric" | "ionization" | "two-moment" | "uv-ir" | "gas-co";

export interface FireSensor {
  id: SensorId;
  name: string;
  principle: string;
  /** Alarm threshold in the sensor's own unit. */
  threshold: Cited;
  unit: string;
  /** First-order response time, s. */
  responseS: number;
  heritage: string;
  sources: string[];
}

export const FIRE_SENSORS: FireSensor[] = [
  {
    id: "photoelectric",
    name: "Photoelectric smoke detector",
    principle:
      "Laser light scattered by particles in the ventilation return. Strong on large particles, weak below about 0.3 µm.",
    threshold: cite(1.0, "model", "Illustrative threshold selected in the Saffire VI discussion; not a measured photoelectric transfer function."),
    unit: "mg/m³ equivalent",
    responseS: 5,
    heritage: "ISS U.S. segment, mounted on the ventilation filter intake ducts.",
    sources: ["iss-fds-2001", "same-2", "saffire-vi"],
  },
  {
    id: "ionization",
    name: "Ionization smoke detector",
    principle:
      "Ion current reduced by particles. Signal follows number times diameter, so it favours many small particles.",
    threshold: cite(1.0, "model", "Expressed on the same mass-equivalent scale at 0.2 µm."),
    unit: "mg/m³ equivalent",
    responseS: 5,
    heritage: "Space Shuttle; also the far-field reference detector on Saffire VI.",
    sources: ["same-2", "saffire-vi"],
  },
  {
    id: "two-moment",
    name: "Two-moment aerosol sensor",
    principle:
      "Two scattering angles give two moments of the size distribution, so it responds across particle sizes and rejects dust.",
    threshold: cite(0.6, "model"),
    unit: "mg/m³ equivalent",
    responseS: 4,
    heritage: "MPASS prototype flown on SAME-2; the approach SAME recommends for next-generation detectors.",
    sources: ["same-2"],
  },
  {
    id: "uv-ir",
    name: "UV / IR flame detector",
    principle:
      "Sees flame radiation directly. Needs line of sight, so a fire behind a panel is invisible to it. Blind to smouldering.",
    threshold: cite(0.4, "model", "Irradiance at the sensor."),
    unit: "W/m²",
    responseS: 3,
    heritage: "Skylab carried about 30 UV fire detectors.",
    sources: ["same-2"],
  },
  {
    id: "gas-co",
    name: "Carbon monoxide gas sensor",
    principle:
      "Electrochemical cell reading CO in the return air. Sees combustion gases even when the smoke is too fine to scatter light.",
    threshold: cite(15, "model", "Rise above background."),
    unit: "ppm",
    responseS: 30,
    heritage: "Saffire measured CO at the far-field unit; gas rose before the smoke alarm level was reached.",
    sources: ["saffire-vi"],
  },
];

export function sensorById(id: SensorId): FireSensor {
  return FIRE_SENSORS.find((item) => item.id === id)!;
}

/** Stage 4b: suppression. */
export type SuppressionId = "power-off" | "vent-off" | "co2" | "water-mist" | "halon";

export interface SuppressionAction {
  id: SuppressionId;
  name: string;
  mechanism: string;
  /** kg of agent released, if any. */
  agentKg: Cited | null;
  /** Discharge time, s. */
  dischargeS: Cited | null;
  caution: string;
  heritage: string;
  sources: string[];
}

export const SUPPRESSION_ACTIONS: SuppressionAction[] = [
  {
    id: "power-off",
    name: "Remove power",
    mechanism: "Stops an electrical ignition source. It does nothing to a flame that is already self-sustaining.",
    agentKg: null,
    dischargeS: null,
    caution: "First step of the ISS response.",
    heritage: "ISS alarm response step 1: remove power to racks to isolate ignition sources.",
    sources: ["iss-fds-2001"],
  },
  {
    id: "vent-off",
    name: "Stop ventilation and isolate",
    mechanism:
      "Shuts cabin fans and intermodule valves. Reduces forced oxygen transport. Diffusion, thermal expansion and hot fuel remain; shutdown does not guarantee extinction. In partial gravity, buoyancy can continue.",
    agentKg: null,
    dischargeS: null,
    caution: "Smoke stops reaching the detectors, and thick fuels can keep burning for minutes.",
    heritage: "ISS alarm response step 2: close intermodule ventilation valves and cabin fans.",
    sources: ["iss-fds-2001", "saffire-iv-v", "bass-ii"],
  },
  {
    id: "co2",
    name: "CO₂ extinguisher",
    mechanism: "Displaces oxygen around the fuel and blows the flame off during the first seconds of discharge.",
    agentKg: cite(2.72, "iss-fds-2001", "6 lb at 850 psi."),
    dischargeS: cite(45, "iss-fds-2001", "About 3 lb leaves in the first 10 s."),
    caution: "Raises cabin CO₂. Crew need supplied oxygen because the masks do not filter CO₂.",
    heritage: "ISS U.S. segment portable extinguisher.",
    sources: ["iss-fds-2001", "fwm-pfe"],
  },
  {
    id: "water-mist",
    name: "Fine water mist extinguisher",
    mechanism: "Droplets evaporate in the flame, absorbing heat and diluting oxygen with steam. Mist stays suspended without gravity.",
    agentKg: cite(2.72, "fwm-pfe", "6 lb of water driven by 1.2 lb of nitrogen at about 1270 psia."),
    dischargeS: cite(30, "model", "Discharge time is not given in the paper."),
    caution: "Slower behind panels: about 60 s in the enclosed-rack standard against 1 s in the open cabin.",
    heritage: "ISS fine water mist extinguisher, developed to replace eight CO₂ units.",
    sources: ["fwm-pfe"],
  },
  {
    id: "halon",
    name: "Halon 1301 (chemical agent)",
    mechanism: "Bromine radicals interrupt the flame chemistry at a few percent by volume.",
    agentKg: cite(1.1, "model", "Portable bottle size assumed."),
    dischargeS: cite(10, "model"),
    caution: "Decomposes into hydrogen fluoride and bromide in the flame, which the cabin then has to scrub.",
    heritage: "Space Shuttle heritage. Values are handbook and assumed, not from the NASA papers retrieved.",
    sources: ["sfpe"],
  },
];

export function suppressionById(id: SuppressionId): SuppressionAction {
  return SUPPRESSION_ACTIONS.find((item) => item.id === id)!;
}

/** Crew exposure limits shown in the telemetry. */
export const HAZARD_LIMITS = {
  co1hPpm: cite(425, "jsc-smac", "Duration-specific CO reference; atmosphere applicability must be checked."),
  co24hPpm: cite(100, "jsc-smac", "24-hour CO reference, not an instantaneous alarm threshold."),
  co2MmHg: cite(3, "nasa-std-3001", "Nominal one-hour average TOTAL partial pressure, not fire-generated rise or an emergency threshold."),
  smokeAlarmMgM3: cite(1, "saffire-vi"),
  /** Exploratory low-oxygen reference, not an exposure or medical assessment. */
  o2LowKpa: cite(16, "model"),
} as const;

/** A prescribed fan command, timed from flame ignition rather than heater start. */
export interface VentilationStep { afterIgnitionS: number; speedMs: number; }

/** Measured Saffire tests the model is checked against. */
export interface SaffireBenchmark {
  id: string;
  material: string;
  materialId: "sibal" | "pmma";
  sides: 1 | 2;
  widthM: number;
  lengthM: number;
  flowMs: number;
  ventilationSchedule?: readonly VentilationStep[];
  pressureKpa: number;
  oxygenPct: number;
  freeVolumeM3: number;
  burnDurationS: number;
  peakHeatW: number | null;
  avgHeatW: number | null;
  totalHeatKJ: number;
  co2RisePpm: number;
  coRisePpm: number;
  maxOutletC: number;
  maxFarFieldC: number;
}

/** Table 1 and Table 2 of ICES-2024-365. */
export const SAFFIRE_BENCHMARKS: SaffireBenchmark[] = [
  { id: "IV-1", material: "SIBAL cloth", materialId: "sibal", sides: 2, widthM: 0.41, lengthM: 0.5, flowMs: 0.2, pressureKpa: 100.0, oxygenPct: 22.0, freeVolumeM3: 17.9, burnDurationS: 130, peakHeatW: null, avgHeatW: 3150, totalHeatKJ: 409, co2RisePpm: 1390, coRisePpm: 80, maxOutletC: 45, maxFarFieldC: 25 },
  { id: "VI-2", material: "SIBAL cloth", materialId: "sibal", sides: 2, widthM: 0.41, lengthM: 0.5, flowMs: 0.2, pressureKpa: 54.1, oxygenPct: 31.0, freeVolumeM3: 16.7, burnDurationS: 112, peakHeatW: 3217, avgHeatW: 3650, totalHeatKJ: 580, co2RisePpm: 2800, coRisePpm: 120, maxOutletC: 48, maxFarFieldC: 20 },
  // NASA ICES-2024 presentation, slides 16–18: ignition 637 s, flow reduction
  // 1120 s, stop 1420 s. Table 2 rounds the burn duration to 780 s.
  { id: "VI-3", material: "Two-sided PMMA, 1 cm", materialId: "pmma", sides: 2, widthM: 0.41, lengthM: 0.18, flowMs: 0.2, ventilationSchedule: [{ afterIgnitionS: 483, speedMs: 0.05 }, { afterIgnitionS: 783, speedMs: 0 }], pressureKpa: 54.6, oxygenPct: 30.3, freeVolumeM3: 16.7, burnDurationS: 780, peakHeatW: 3080, avgHeatW: null, totalHeatKJ: 1280, co2RisePpm: 8539, coRisePpm: 308, maxOutletC: 77, maxFarFieldC: 21 },
  { id: "VI-4", material: "One-sided PMMA, 0.5 cm", materialId: "pmma", sides: 1, widthM: 0.41, lengthM: 0.18, flowMs: 0.2, pressureKpa: 55.2, oxygenPct: 28.8, freeVolumeM3: 16.7, burnDurationS: 1200, peakHeatW: 1507, avgHeatW: null, totalHeatKJ: 830, co2RisePpm: 8117, coRisePpm: 320, maxOutletC: 57, maxFarFieldC: 21 },
];

/**
 * Table 1 of ICES-2026-577, "Heat and Smoke Emission from Tests on the SAFFIRE IV-VI Experiments".
 *
 * Units are kept as published (mbar, mole fraction, mmHg, ppm, °C, s, mm, W). null means the paper
 * prints NA; nothing is estimated. This is a separate dataset from SAFFIRE_BENCHMARKS and must stay
 * separate: SAFFIRE_BENCHMARKS is the ICES-2024-365 set the model coefficients were fitted to, and
 * the two papers disagree for the same tests (peak heat release; CO and CO₂ maxima, which here are
 * maxima at the Far Field Diagnostics). saffire-emission.test.ts records the differences.
 *
 * Gas and temperature values are rises above a pre-existing baseline (no CO removal on board), not
 * absolute levels. Times to alarm are referenced to the experiment timeline start, about 10 minutes
 * before ignition, not to ignition.
 */
export interface SaffireEmissionTest {
  /** Flight and test, as printed in the table header. */
  id: "IV-2" | "V-3" | "VI-3" | "VI-4" | "IV-1" | "V-2" | "VI-2";
  /** Material as printed. */
  material: "PMMA" | "SIBAL" | "Cotton";
  /** Material profile in src/data/fire/materials.ts, or null where none is the same material. Cotton t-shirt fabric is not SIBAL (a cotton/fiberglass blend). */
  materialId: "pmma" | "sibal" | null;
  sidesBurning: 1 | 2;
  pressureMbar: number;
  /** Mole fraction, not percent. */
  oxygenMolFraction: number;
  freeVolumeM3: number;
  ignitionDurationS: number;
  initialFlowDurationS: number;
  /** PMMA only. */
  flameGrowthRateMmS: number | null;
  /** Thin fuels only. */
  flameSpreadRateMmS: number | null;
  /** PMMA only. */
  maxFlameLengthMm: number | null;
  /** Not measured on flights IV and V. */
  peakHrrW: number | null;
  /** Maximum rise at the FFD. */
  maxCo2RiseMmHg: number;
  maxCoRisePpm: number;
  pressureRiseMbar: number;
  maxTemperatureRiseC: number;
  /** Time at which total particulate at the FFD reached 2 mg/m³, s. See timeReference. */
  timeToAlarmS: number;
  flameLengthAtAlarmMm: number | null;
  hrrAtAlarmW: number | null;
  co2RiseAtAlarmMmHg: number;
  coRiseAtAlarmPpm: number;
}

export const SAFFIRE_IV_VI_EMISSION: readonly SaffireEmissionTest[] = [
  { id: "IV-2", material: "PMMA", materialId: "pmma", sidesBurning: 2, pressureMbar: 1000, oxygenMolFraction: 0.22, freeVolumeM3: 17.9, ignitionDurationS: 60, initialFlowDurationS: 535, flameGrowthRateMmS: 0.22, flameSpreadRateMmS: null, maxFlameLengthMm: 90.8, peakHrrW: null, maxCo2RiseMmHg: 1.78, maxCoRisePpm: 110, pressureRiseMbar: 1.31, maxTemperatureRiseC: 0.23, timeToAlarmS: 1083, flameLengthAtAlarmMm: 74, hrrAtAlarmW: null, co2RiseAtAlarmMmHg: 1.28, coRiseAtAlarmPpm: 63.2 },
  { id: "V-3", material: "PMMA", materialId: "pmma", sidesBurning: 1, pressureMbar: 745, oxygenMolFraction: 0.26, freeVolumeM3: 19, ignitionDurationS: 120, initialFlowDurationS: 480, flameGrowthRateMmS: 0.26, flameSpreadRateMmS: null, maxFlameLengthMm: 118, peakHrrW: null, maxCo2RiseMmHg: 0.78, maxCoRisePpm: 55.5, pressureRiseMbar: 0.25, maxTemperatureRiseC: 0.04, timeToAlarmS: 1117, flameLengthAtAlarmMm: 114, hrrAtAlarmW: null, co2RiseAtAlarmMmHg: 0.49, coRiseAtAlarmPpm: 28.1 },
  { id: "VI-3", material: "PMMA", materialId: "pmma", sidesBurning: 2, pressureMbar: 544, oxygenMolFraction: 0.30, freeVolumeM3: 16.7, ignitionDurationS: 60, initialFlowDurationS: 480, flameGrowthRateMmS: 0.38, flameSpreadRateMmS: null, maxFlameLengthMm: 89.9, peakHrrW: 3240, maxCo2RiseMmHg: 3.66, maxCoRisePpm: 338, pressureRiseMbar: 0.34, maxTemperatureRiseC: 0.50, timeToAlarmS: 1037, flameLengthAtAlarmMm: 73.95, hrrAtAlarmW: 2500, co2RiseAtAlarmMmHg: 1.43, coRiseAtAlarmPpm: 105 },
  { id: "VI-4", material: "PMMA", materialId: "pmma", sidesBurning: 1, pressureMbar: 550, oxygenMolFraction: 0.29, freeVolumeM3: 16.7, ignitionDurationS: 120, initialFlowDurationS: 900, flameGrowthRateMmS: 0.27, flameSpreadRateMmS: null, maxFlameLengthMm: 93.3, peakHrrW: 1487, maxCo2RiseMmHg: 3.39, maxCoRisePpm: 309, pressureRiseMbar: 0.25, maxTemperatureRiseC: 0.25, timeToAlarmS: 1603, flameLengthAtAlarmMm: 66.9, hrrAtAlarmW: 623, co2RiseAtAlarmMmHg: 3.09, coRiseAtAlarmPpm: 283 },
  { id: "IV-1", material: "SIBAL", materialId: "sibal", sidesBurning: 2, pressureMbar: 980, oxygenMolFraction: 0.23, freeVolumeM3: 17.9, ignitionDurationS: 8, initialFlowDurationS: 200, flameGrowthRateMmS: null, flameSpreadRateMmS: 3.6, maxFlameLengthMm: null, peakHrrW: null, maxCo2RiseMmHg: 0.97, maxCoRisePpm: 77.4, pressureRiseMbar: 0.33, maxTemperatureRiseC: 0.25, timeToAlarmS: 92, flameLengthAtAlarmMm: null, hrrAtAlarmW: null, co2RiseAtAlarmMmHg: 0.00, coRiseAtAlarmPpm: 7.9 },
  { id: "V-2", material: "Cotton", materialId: null, sidesBurning: 2, pressureMbar: 741, oxygenMolFraction: 0.28, freeVolumeM3: 19, ignitionDurationS: 8, initialFlowDurationS: 200, flameGrowthRateMmS: null, flameSpreadRateMmS: 3.4, maxFlameLengthMm: null, peakHrrW: null, maxCo2RiseMmHg: 0.81, maxCoRisePpm: 74.3, pressureRiseMbar: 0.30, maxTemperatureRiseC: 0.25, timeToAlarmS: 146, flameLengthAtAlarmMm: null, hrrAtAlarmW: null, co2RiseAtAlarmMmHg: 0.00, coRiseAtAlarmPpm: 11.9 },
  { id: "VI-2", material: "SIBAL", materialId: "sibal", sidesBurning: 2, pressureMbar: 541, oxygenMolFraction: 0.31, freeVolumeM3: 16.7, ignitionDurationS: 8, initialFlowDurationS: 300, flameGrowthRateMmS: null, flameSpreadRateMmS: 4.05, maxFlameLengthMm: null, peakHrrW: 3376, maxCo2RiseMmHg: 1.46, maxCoRisePpm: 122, pressureRiseMbar: 0.31, maxTemperatureRiseC: 0.29, timeToAlarmS: 201, flameLengthAtAlarmMm: null, hrrAtAlarmW: 3180, co2RiseAtAlarmMmHg: 0.04, coRiseAtAlarmPpm: 57.1 },
];

/** Provenance and caveats of SAFFIRE_IV_VI_EMISSION. */
export const SAFFIRE_IV_VI_EMISSION_META = {
  source: "saffire-iv-vi-emission",
  /** Reference for every time in the table. Not ignition. */
  timeReference: "Experiment timeline start, about 10 minutes before ignition",
  /** Alarm criterion used by the paper: total particulate at the FFD (DustTrak DRX). */
  alarmThresholdMgM3: cite(2, "saffire-iv-vi-emission", "Total particulate matter at the Far Field Diagnostics. ICES-2024-365 used 1 mg/m³."),
  /** The Table 1 caption says "opposed flow"; ICES-2024-365 and the paper's own text describe concurrent flow. IGNIS records concurrent. */
  flow: { direction: "Concurrent", captionSays: "opposed", speedCmS: 20, widthCm: 40 },
  pmmaLengthCm: 18,
  pmmaThicknessMm: { oneSided: 5, twoSided: 10 },
  thinFuelLengthCm: 50,
  gasBasis: "Rise above a pre-existing baseline at the Far Field Diagnostics; no CO removal on board.",
} as const;

/**
 * Peak heat release of one test as reported by the two NASA analyses: ICES-2024-365 (the calibration
 * value, SAFFIRE_BENCHMARKS) and ICES-2026-577 (SAFFIRE_IV_VI_EMISSION). Null where either analysis
 * has no peak (flights IV and V did not measure heat release). Neither is declared the true peak.
 */
export function peakHrrAnalyses(id: string): { ices2024W: number; ices2026W: number; lowW: number; highW: number } | null {
  const a = SAFFIRE_BENCHMARKS.find((row) => row.id === id)?.peakHeatW ?? null;
  const b = SAFFIRE_IV_VI_EMISSION.find((row) => row.id === id)?.peakHrrW ?? null;
  if (a === null || b === null) return null;
  return { ices2024W: a, ices2026W: b, lowW: Math.min(a, b), highW: Math.max(a, b) };
}

/**
 * Saffire VI-3 smoke timeline on the experiment clock. Ignition at 637 s is from the NASA ICES-2024
 * presentation (source saffire-vi-timeline, slides 16–18); 981 s is the 1 mg/m³ far-field alarm of
 * ICES-2024-365 (saffire-vi); 1037 s is the 2 mg/m³ alarm of ICES-2026-577 Table 1
 * (saffire-iv-vi-emission). Offsets from ignition are not published for IV-2, V-3 or VI-4, so none is
 * given for them.
 */
export const SAFFIRE_VI3_SMOKE_TIMELINE = { test: "VI-3", ignitionS: 637, alarm1MgM3S: 981, alarm2MgM3S: 1037 } as const;

/**
 * Independent flight observations from the NASA PSI tables (model 3.0.0). None
 * of these rows is used to fit the Saffire VI calibration; where a row informs
 * another closure, `use` says so. Cells are transcribed from the original CSVs in
 * public/data/nasa-psi; `src/lib/fire/benchmarks.test.ts` re-reads those files and
 * checks every value here.
 */
export interface FlightObservation {
  id: string;
  source: string;
  materialId: "sibal" | "pmma" | "silicone";
  flow: "concurrent" | "opposed";
  /** Along the flow, m. */
  lengthM: number;
  /** Across the flow, m. */
  widthM: number;
  flowMs: number;
  oxygenPct: number;
  pressureKpa: number;
  /** "assumed" where the table gives no pressure. */
  pressureEvidence: "measured" | "assumed";
  /** Reported burn time, s, or null when the table gives none. */
  burnTimeS: number | null;
  /** Reported concurrent spread rate, mm/s. */
  spreadMmS: number | null;
  /** Reported length of fuel with significant visible damage, m. */
  damagedLengthM: number | null;
  /** Reported microgravity burn length, m (0 for "~ 0"). */
  burnLengthM: number | null;
  use: "held-out" | "derives the thin-fuel burnout flux; spread rate held out" | "qualitative";
  /** Corrections from the investigators' test matrix; the PSI transcription stays intact. */
  reproduction?: { source: string; lengthM?: number; flowMs?: number; note: string };
  note: string;
}

export const FLIGHT_OBSERVATIONS: FlightObservation[] = [
  { id: "Saffire-I S1", source: "psi-saffire-i", materialId: "sibal", flow: "concurrent", lengthM: 0.94, widthM: 0.406, flowMs: 0.2, oxygenPct: 21.6, pressureKpa: 99.8, pressureEvidence: "measured", burnTimeS: 420, spreadMmS: null, damagedLengthM: null, burnLengthM: null, use: "held-out", note: "O₂ 21.5–21.7 % (midpoint used). Length and width cells read as swapped (see source). Pressure from the PCM cabin telemetry." },
  { id: "Saffire-I S2", source: "psi-saffire-i", materialId: "sibal", flow: "opposed", lengthM: 0.94, widthM: 0.406, flowMs: 0.2, oxygenPct: 21.5, pressureKpa: 99.8, pressureEvidence: "measured", burnTimeS: 70, spreadMmS: null, damagedLengthM: null, burnLengthM: null, use: "held-out", reproduction: { source: "saffire-i-iii-matrix", lengthM: 0.10, note: "The investigators' test matrix gives approximately 10 cm of remaining fuel for I-2, rather than the original 94 cm sheet." }, note: "PSI lists the original sheet dimensions; the second ignition burned the remaining approximately 10 cm (NASA test matrix, slides 30–31)." },
  { id: "Saffire-II 2-5", source: "psi-saffire-ii", materialId: "sibal", flow: "concurrent", lengthM: 0.29, widthM: 0.05, flowMs: 0.2, oxygenPct: 22.1, pressureKpa: 101.325, pressureEvidence: "assumed", burnTimeS: 145, spreadMmS: 2.1, damagedLengthM: null, burnLengthM: 0.29, use: "derives the thin-fuel burnout flux; spread rate held out", note: "5 cm wide strip; edge losses can slow spread relative to the 41 cm Saffire VI samples." },
  { id: "Saffire-II 2-6", source: "psi-saffire-ii", materialId: "sibal", flow: "concurrent", lengthM: 0.29, widthM: 0.05, flowMs: 0.2, oxygenPct: 22.1, pressureKpa: 101.325, pressureEvidence: "assumed", burnTimeS: 115, spreadMmS: 2.6, damagedLengthM: null, burnLengthM: 0.29, use: "derives the thin-fuel burnout flux; spread rate held out", reproduction: { source: "saffire-i-iii-matrix", flowMs: 0.25, note: "NASA's test matrix and slide 23 give 25 cm/s for II-6; the PSI summary lists 20 cm/s for both strips." }, note: "5 cm wide strip. Reproduction uses the investigators' 25 cm/s airflow; the original PSI cell is retained here." },
  { id: "Saffire-II 2-8", source: "psi-saffire-ii", materialId: "pmma", flow: "concurrent", lengthM: 0.29, widthM: 0.05, flowMs: 0.2, oxygenPct: 22.05, pressureKpa: 101.325, pressureEvidence: "assumed", burnTimeS: 600, spreadMmS: null, damagedLengthM: 0.1, burnLengthM: null, use: "held-out", note: "O₂ 22.1 to 22.0 %. Thickness given only as a figure reference. Damage length is approximate (\"~ 10 cm\")." },
  { id: "Saffire-II 2-9", source: "psi-saffire-ii", materialId: "pmma", flow: "concurrent", lengthM: 0.29, widthM: 0.05, flowMs: 0.2, oxygenPct: 21.95, pressureKpa: 101.325, pressureEvidence: "assumed", burnTimeS: 900, spreadMmS: null, damagedLengthM: 0.1, burnLengthM: null, use: "held-out", note: "1 cm thick. O₂ 22.0 to 21.9 %. Damage length is approximate (\"~ 10 cm\")." },
  { id: "Saffire-II 2-1 to 2-4", source: "psi-saffire-ii", materialId: "silicone", flow: "concurrent", lengthM: 0.29, widthM: 0.05, flowMs: 0.2, oxygenPct: 21.9, pressureKpa: 101.325, pressureEvidence: "assumed", burnTimeS: null, spreadMmS: null, damagedLengthM: null, burnLengthM: 0, use: "qualitative", note: "Silicone 0.27–1.03 mm; 2-4 was opposed flow. Microgravity burn \"insignificant\", burn length \"~ 0\"; in 1 g two of the four burned completely." },
];

/** Saffire-II note 4: regression rate at the anchored base of the PMMA flames, mm/s. */
export const SAFFIRE_II_PMMA_BASE_REGRESSION_MMS: Cited<[number, number]> = cite([0.01, 0.04], "psi-saffire-ii", "Note 4 of the Saffire-II table.", "measured");

/**
 * BASS-II run-level CO/CO₂ molar ratios: (final − initial CO, ppm) ÷ (final −
 * initial CO₂, ppm) for each run in the PSI-25 table. Rule: PMMA slabs, films and
 * rods (spherical sections excluded) or SIBAL; all six gas cells numeric; CO rise
 * not negative; CO₂ rise at least 3000 ppm for PMMA and 500 ppm for SIBAL (30 and
 * 5 times the 0.01 vol % CO₂ resolution). Reproduced from the CSV in
 * src/lib/fire/benchmarks.test.ts.
 */
export const BASS_II_CO_RATIOS = {
  source: "psi-bass-ii",
  pmmaHighOxygen: { label: "PMMA, initial O₂ ≥ 20.5 %", runs: 11, oxygenRange: [20.7, 22.2] as [number, number], median: 0.0340, q1: 0.0312, q3: 0.0367 },
  pmmaLowOxygen: { label: "PMMA, initial O₂ ≤ 17.5 %", runs: 20, oxygenRange: [15.1, 17.5] as [number, number], medianOxygenPct: 16.15, median: 0.0508, q1: 0.0282, q3: 0.0597 },
  sibal: { label: "SIBAL, all valid runs", runs: 4, oxygenRange: [18.5, 20.8] as [number, number], median: 0.0583, q1: 0.0464, q3: 0.0695 },
  caveats: [
    "Small samples (1–2 cm wide) in the glovebox wind tunnel, not cabin-scale fires.",
    "The low-oxygen PMMA runs are almost all rods, the high-oxygen runs mostly slabs, so geometry and oxygen are confounded.",
    "SIBAL CO₂ rises are only 500–700 ppm, so each SIBAL ratio carries about ±15–20 % quantisation error.",
  ],
} as const;

/** SAME-2 Table 1, micrometres. */
export const SAME2_TABLE = [
  { material: "Kapton", countMean: [0.056, 0.109], massMean: [0.101, 0.161], sigma: [2.154, 1.872] },
  { material: "Lamp wick (cellulose)", countMean: [0.128, 0.276], massMean: [0.258, 0.398], sigma: [2.312, 1.834] },
  { material: "Silicone rubber", countMean: [0.196, 0.355], massMean: [0.465, 0.619], sigma: [2.53, 2.108] },
  { material: "Teflon", countMean: [0.101, 0.105], massMean: [0.17, 0.232], sigma: [2.198, 2.442] },
  { material: "Pyrell", countMean: [0.204, 0.359], massMean: [0.384, 0.539], sigma: [2.211, 1.892] },
] as const;

/** Hirsch et al.: 1 g limits at 14.7 psia unless noted. */
export const WSTF_LIMITS = [
  { material: "PMMA rod, cast (hot wire)", uloi: 15.7, moc: 14, note: "1/8 in rod" },
  { material: "PMMA rod, extruded (chemical igniter)", uloi: 19.5, moc: 19, note: "1/8 in rod" },
  { material: "Polyoxymethylene (POM)", uloi: 12.9, moc: 12, note: "1/8 in rod" },
  { material: "Polypropylene", uloi: 17.6, moc: 16, note: "1/8 in rod" },
  { material: "Silicone, 4 mil", uloi: 17.5, moc: 17, note: "" },
  { material: "Silicone, 40 mil", uloi: 23.4, moc: 22, note: "" },
  { material: "PEEK", uloi: 20.8, moc: 20.1, note: "" },
  { material: "PET film (Melinex)", uloi: 21.5, moc: 20, note: "10.2 psia" },
  { material: "Nylon (Zytel 42)", uloi: 24.5, moc: 24.1, note: "standard 2.5 in sample" },
  { material: "Epoxy / glass (G-11)", uloi: 23.6, moc: 23, note: "standard 2.5 in sample" },
  { material: "PEI (Ultem 1000)", uloi: 26.5, moc: 24, note: "10.2 psia" },
  { material: "Polyimide (Kapton HN)", uloi: 27.2, moc: 26, note: "" },
  { material: "PVC", uloi: 40.1, moc: 35, note: "standard 2.5 in sample" },
  { material: "PTFE", uloi: 49, moc: null, note: "40.8 at 200 °F" },
] as const;
