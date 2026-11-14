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

/** Measured Saffire tests the model is checked against. */
export interface SaffireBenchmark {
  id: string;
  material: string;
  materialId: "sibal" | "pmma";
  sides: 1 | 2;
  widthM: number;
  lengthM: number;
  flowMs: number;
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
  { id: "VI-3", material: "Two-sided PMMA, 1 cm", materialId: "pmma", sides: 2, widthM: 0.41, lengthM: 0.18, flowMs: 0.2, pressureKpa: 54.6, oxygenPct: 30.3, freeVolumeM3: 16.7, burnDurationS: 780, peakHeatW: 3080, avgHeatW: null, totalHeatKJ: 1280, co2RisePpm: 8539, coRisePpm: 308, maxOutletC: 77, maxFarFieldC: 21 },
  { id: "VI-4", material: "One-sided PMMA, 0.5 cm", materialId: "pmma", sides: 1, widthM: 0.41, lengthM: 0.18, flowMs: 0.2, pressureKpa: 55.2, oxygenPct: 28.8, freeVolumeM3: 16.7, burnDurationS: 1200, peakHeatW: 1507, avgHeatW: null, totalHeatKJ: 830, co2RisePpm: 8117, coRisePpm: 320, maxOutletC: 57, maxFarFieldC: 21 },
];

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
