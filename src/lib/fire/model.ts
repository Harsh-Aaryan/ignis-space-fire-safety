import type { FireMaterial } from "@/data/fire/materials";
import {
  FIRE_SENSORS,
  type IgnitionSource,
  type SensorId,
  type SuppressionId,
} from "@/data/fire/options";

/**
 * Reduced-order compartment fire model for 0 g, lunar and Martian habitats.
 *
 * Chain: ignition source and material -> heat release rate -> cabin oxygen,
 * temperature, CO2, CO and smoke -> ventilation and smoke transport ->
 * detection and suppression.
 *
 * It is a zone model with correlations, not CFD. Each relation below names the
 * measurement or handbook result it leans on. Where nothing was published the
 * comment says "assumption".
 */

export const G0 = 9.81;
const R = 8.314;
const KPA_PER_PSI = 6.894757;
const MMHG_PER_KPA = 7.50062;
/** Huggett: 13.1 MJ released per kg of oxygen consumed. Used by Saffire VI for its calorimetry. */
const HUGGETT_J_PER_KG_O2 = 13.1e6;
const M_O2 = 0.032;
const M_CO2 = 0.044;
const M_CO = 0.028;
const M_AIR = 0.029;
const M_HALON = 0.149;
const CV_MOLAR = 20.8;
const CP_AIR = 1005;
/** Flame to ambient temperature rise over ambient temperature, roughly (1800 - 300) / 300. */
const DT_OVER_T = 5;
/** Flow speed at which the flammability boundary is lowest. BASS-II: "of the order of diffusive flows". */
export const U_OPTIMUM = 0.08;
/** Buoyant flame-base velocity in 1 g at 1 atm from (g alpha dT/T)^(1/3). */
const U_BASE_1G = 0.194;
/** Quench-side curvature, fitted to BASS-II: PMMA film at 21 % O2 quenches below 2 cm/s. */
const QUENCH_CURVATURE = 3.85;
/** MOC falls 0.607 % O2 per psia of added pressure on average (Hirsch et al.). */
const LOC_PRESSURE_SLOPE = -0.607;
/** CO to CO2 molar ratio in microgravity, from Saffire IV to VI far-field rises (0.036 to 0.058). */
const CO_CO2_RATIO_0G = 0.04;
/** Share of ventilation flow exchanged with the rest of the habitat. Assumption. */
const EXCHANGE_FRACTION = 0.3;
/** Share of the flow reaching fuel behind a panel. Assumption. */
const ENCLOSED_FLOW_FACTOR = 0.3;

export interface FuelGeometry {
  widthM: number;
  lengthM: number;
  sides: 1 | 2;
  enclosed: boolean;
}

export interface FireInput {
  gravityG: number;
  oxygenPct: number;
  pressureKpa: number;
  ambientC: number;
  /** Mean cabin air speed, m/s. */
  ventilationMs: number;
  /** Area the ventilation flow crosses, m². Volume flow is speed times this. */
  ventAreaM2: number;
  roomVolumeM3: number;
  /** Free volume of every connected compartment, room included. */
  habitatVolumeM3: number;
  roomHeightM: number;
  roomFloorAreaM2: number;
  wallAreaM2: number;
  /** Height of the fuel above the floor, m. */
  fireHeightM: number;
  /** Path from the fuel to the nearest smoke sensor, m. */
  detectorDistanceM: number;
  material: FireMaterial;
  fuel: FuelGeometry;
  ignition: IgnitionSource;
  /** The igniter lights the whole leading edge, as in the Saffire rig. */
  igniterSpansWidth?: boolean;
  sensors: SensorId[];
  /** On alarm, remove power and stop ventilation as the ISS does. */
  autoResponse: boolean;
  /** Agent the crew brings, and how long after the alarm they discharge it. */
  crewAgent: SuppressionId | null;
  crewResponseS: number;
}

export type FirePhase =
  | "heating"
  | "smoldering"
  | "flaming"
  | "extinguished"
  | "burned-out"
  | "no-ignition";

export interface FireEvent {
  t: number;
  kind: "ignition" | "detection" | "action" | "extinction" | "hazard" | "info";
  label: string;
  source?: string;
}

interface Zone {
  o2: number;
  co2: number;
  co: number;
  inert: number;
  smokeKg: number;
  tempK: number;
  volumeM3: number;
}

export interface SensorState {
  signal: number;
  alarmed: boolean;
  alarmTime: number | null;
}

export interface FlameShape {
  kind: "none" | "glow" | "dome" | "plume";
  lengthM: number;
  widthM: number;
  standoffM: number;
  /** 0 is straight up, pi/2 lies along the ventilation flow. */
  tiltRad: number;
  /** 1 is a blue, soot-free flame. */
  blueFraction: number;
  flickerHz: number;
}

export interface FireState {
  t: number;
  phase: FirePhase;
  surfaceTempC: number;
  ignitionTime: number | null;
  sourceActive: boolean;
  sourceOnTime: number;

  pyroLengthM: number;
  pyroWidthM: number;
  burningAreaM2: number;
  fuelBurnedKg: number;
  fuelTotalKg: number;

  hrrW: number;
  peakHrrW: number;
  totalHeatJ: number;
  massFluxGm2s: number;
  spreadRateMmS: number;

  /** Forced flow now, after any fan spin-down, m/s. */
  uForcedMs: number;
  uForcedTargetMs: number;
  /** Buoyant velocity at the flame base, m/s. */
  uBuoyantMs: number;
  /** Combined velocity that sets the flammability limit, m/s. */
  uBaseMs: number;
  /** Limiting oxygen concentration for this material and flow, %. */
  locPct: number;
  /** Oxygen seen by the flame after agent dilution, %. */
  localO2Pct: number;

  room: Zone;
  rest: Zone;
  isolated: boolean;

  o2Pct: number;
  o2KpaPartial: number;
  co2RisePct: number;
  co2RiseMmHg: number;
  coPpm: number;
  tempC: number;
  nearFireTempC: number;
  pressureKpa: number;
  smokeMgM3: number;
  ventFlowM3s: number;

  /** Height of the smoke layer interface above the floor, m. Equals room height when there is no layer. */
  layerHeightM: number;
  /** 1 when buoyancy stratifies the smoke, 0 when forced flow mixes it. */
  stratification: number;
  /** Seconds for smoke to travel from the fuel to the sensor. */
  transportS: number;
  smokeCountMeanUm: number;
  smokeMassMeanUm: number;
  detectorSmokeMgM3: number;
  detectorCoPpm: number;

  sensors: Record<SensorId, SensorState>;
  firstAlarmTime: number | null;

  powerOff: boolean;
  ventOff: boolean;
  agent: {
    co2Start: number | null;
    mistStart: number | null;
    halonStart: number | null;
    localCo2: number;
    localHalon: number;
    mistCoolingW: number;
    jetMs: number;
    co2ReleasedKg: number;
  };
  autoResponseDone: boolean;
  crewAgentDone: boolean;

  belowLimitS: number;
  /** Seconds the flame has released almost no heat. */
  weakS: number;
  limitNoted: boolean;
  hotUntil: number;
  extinctionCause: string | null;
  extinctionTime: number | null;

  flame: FlameShape;
  events: FireEvent[];
  hazardFlags: { co24h: boolean; co1h: boolean; co2: boolean; o2Low: boolean };

  /** Internal lag states for transport to the sensor. */
  lag: { s1: number; s2: number; c1: number; c2: number };
  initial: { o2: number; co2: number; nTotal: number; o2Kpa: number };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function moles(zone: Zone): number {
  return zone.o2 + zone.co2 + zone.co + zone.inert;
}

function zonePressureKpa(zone: Zone): number {
  return (moles(zone) * R * zone.tempK) / zone.volumeM3 / 1000;
}

/**
 * Buoyant velocity where the flame is anchored: (g alpha dT/T)^(1/3).
 * Thermal diffusivity scales inversely with pressure. Zero in free fall.
 */
export function buoyantBaseVelocity(gravityG: number, pressureKpa: number): number {
  if (gravityG <= 0) return 0;
  const alpha = 1.5e-4 * (101.325 / pressureKpa);
  return Math.cbrt(gravityG * G0 * alpha * DT_OVER_T);
}

/** Buoyant velocity over a flame of height lengthM. Grows with the fire, which is why upward spread accelerates. */
export function buoyantFlameVelocity(gravityG: number, lengthM: number): number {
  if (gravityG <= 0) return 0;
  return 0.35 * Math.sqrt(gravityG * G0 * Math.max(lengthM, 0.02) * DT_OVER_T);
}

/**
 * Limiting oxygen concentration, % O2, for a material at flame-base velocity
 * uBase and total pressure.
 *
 * U-shaped in flow: radiative quenching at low speed, blowoff at high speed
 * (BASS-II, Konno et al.). The blowoff branch is pinned to the material's 1 g
 * limit at the 1 g buoyant velocity; the minimum sits lowFlowMargin below it
 * (BASS-II PMMA: 16 % in 1 g, 13.6 % in microgravity; Olson et al.: up to 4 %).
 * Pressure shifts the whole curve with the White Sands MOC slope.
 */
export function limitingOxygenPct(material: FireMaterial, uBaseMs: number, pressureKpa: number): number {
  const margin = material.lowFlowMarginPct.value;
  const minimum = material.loc1gPct.value - margin;
  const x = Math.log(Math.max(uBaseMs, 0.002) / U_OPTIMUM);
  const blowoffCurvature = margin / Math.log(U_BASE_1G / U_OPTIMUM) ** 2;
  const curvature = x < 0 ? QUENCH_CURVATURE : blowoffCurvature;
  const pressureShift = LOC_PRESSURE_SLOPE * (pressureKpa / KPA_PER_PSI - 14.7);
  return clamp(minimum + curvature * x * x + pressureShift, 5, 100);
}

/** Convective and radiative loss coefficient during heating, kW/m²K. Losses fall in still air. Assumption for the flow factor. */
function heatingLoss(material: FireMaterial, ambientC: number, uBaseMs: number): number {
  const flowFactor = 0.6 + 0.4 * Math.min(1, Math.sqrt(uBaseMs / U_BASE_1G));
  return (material.criticalHeatFluxKwM2.value / (material.ignitionTempC.value - ambientC)) * flowFactor;
}

/** Thick samples are lit at a tapered edge about 1 mm thick, as on Saffire II. */
const TAPERED_EDGE_KG_M2 = 1.2;

function heatsAsThin(material: FireMaterial, ignition: IgnitionSource): boolean {
  return material.form !== "thick" || ignition.edge === true;
}

function heatCapacityKJm2K(material: FireMaterial): number {
  const core = material.form === "wire" ? 2 : 1;
  const areal = material.form === "thick" ? Math.min(material.arealFuelKgM2.value, TAPERED_EDGE_KG_M2) : material.arealFuelKgM2.value;
  return areal * material.specificHeatKJkgK * core;
}

/**
 * Surface temperature rise after heating for seconds at a constant flux.
 * Thick solid: semi-infinite conduction with a linearised surface loss.
 * Thin solid or wire: lumped capacity.
 */
export function surfaceRiseK(
  material: FireMaterial,
  ignition: IgnitionSource,
  seconds: number,
  lossKwM2K: number,
): number {
  const fluxKwM2 = ignition.heatFluxKwM2.value;
  if (seconds <= 0 || fluxKwM2 <= 0) return 0;
  if (!heatsAsThin(material, ignition)) {
    const a = 2 * Math.sqrt(seconds / (Math.PI * material.thermalInertia.value));
    return (a * fluxKwM2) / (1 + a * lossKwM2K);
  }
  const capacity = heatCapacityKJm2K(material);
  return (fluxKwM2 / lossKwM2K) * (1 - Math.exp((-lossKwM2K * seconds) / capacity));
}

/** Seconds to piloted ignition, or null when the source cannot bring the surface to its ignition temperature. */
export function ignitionDelayS(
  material: FireMaterial,
  ignition: IgnitionSource,
  ambientC: number,
  uBaseMs: number,
): number | null {
  const loss = heatingLoss(material, ambientC, uBaseMs);
  const flux = ignition.heatFluxKwM2.value;
  const need = material.ignitionTempC.value - ambientC;
  if (flux / loss <= need) return null;
  let seconds: number;
  if (!heatsAsThin(material, ignition)) {
    // need = a q / (1 + a h)  ->  a = need / (q - h need)
    const a = need / (flux - loss * need);
    seconds = (Math.PI * material.thermalInertia.value * a * a) / 4;
  } else {
    seconds = (-heatCapacityKJm2K(material) / loss) * Math.log(1 - (need * loss) / flux);
  }
  const limit = ignition.durationS.value;
  if (limit !== null && seconds > limit) return null;
  return seconds;
}

function newZone(volumeM3: number, pressureKpa: number, oxygenPct: number, tempK: number): Zone {
  const n = (pressureKpa * 1000 * volumeM3) / (R * tempK);
  const o2 = (n * oxygenPct) / 100;
  return { o2, co2: 0, co: 0, inert: n - o2, smokeKg: 0, tempK, volumeM3 };
}

export function createFireState(input: FireInput): FireState {
  const tempK = input.ambientC + 273.15;
  const room = newZone(input.roomVolumeM3, input.pressureKpa, input.oxygenPct, tempK);
  const rest = newZone(
    Math.max(0.01, input.habitatVolumeM3 - input.roomVolumeM3),
    input.pressureKpa,
    input.oxygenPct,
    tempK,
  );
  const sides = input.material.form === "thick" ? input.fuel.sides : 1;
  const fuelTotalKg = input.material.arealFuelKgM2.value * input.fuel.widthM * input.fuel.lengthM * sides;
  const sensors = Object.fromEntries(
    FIRE_SENSORS.map((sensor) => [sensor.id, { signal: 0, alarmed: false, alarmTime: null }]),
  ) as Record<SensorId, SensorState>;
  const uBuoyant = buoyantBaseVelocity(input.gravityG, input.pressureKpa);
  const state: FireState = {
    t: 0,
    phase: "heating",
    surfaceTempC: input.ambientC,
    ignitionTime: null,
    sourceActive: true,
    sourceOnTime: 0,
    pyroLengthM: 0,
    pyroWidthM: 0,
    burningAreaM2: 0,
    fuelBurnedKg: 0,
    fuelTotalKg,
    hrrW: 0,
    peakHrrW: 0,
    totalHeatJ: 0,
    massFluxGm2s: 0,
    spreadRateMmS: 0,
    uForcedMs: input.ventilationMs,
    uForcedTargetMs: input.ventilationMs,
    uBuoyantMs: uBuoyant,
    uBaseMs: Math.hypot(input.ventilationMs, uBuoyant),
    locPct: 0,
    localO2Pct: input.oxygenPct,
    room,
    rest,
    isolated: false,
    o2Pct: input.oxygenPct,
    o2KpaPartial: (input.oxygenPct / 100) * input.pressureKpa,
    co2RisePct: 0,
    co2RiseMmHg: 0,
    coPpm: 0,
    tempC: input.ambientC,
    nearFireTempC: input.ambientC,
    pressureKpa: input.pressureKpa,
    smokeMgM3: 0,
    ventFlowM3s: input.ventilationMs * input.ventAreaM2,
    layerHeightM: input.roomHeightM,
    stratification: 0,
    transportS: 0,
    smokeCountMeanUm: input.material.smokeCountMeanUm.value[0],
    smokeMassMeanUm: input.material.smokeMassMeanUm.value[0],
    detectorSmokeMgM3: 0,
    detectorCoPpm: 0,
    sensors,
    firstAlarmTime: null,
    powerOff: false,
    ventOff: false,
    agent: {
      co2Start: null,
      mistStart: null,
      halonStart: null,
      localCo2: 0,
      localHalon: 0,
      mistCoolingW: 0,
      jetMs: 0,
      co2ReleasedKg: 0,
    },
    autoResponseDone: false,
    crewAgentDone: false,
    belowLimitS: 0,
    weakS: 0,
    limitNoted: false,
    hotUntil: 0,
    extinctionCause: null,
    extinctionTime: null,
    flame: { kind: "none", lengthM: 0, widthM: 0, standoffM: 0, tiltRad: 0, blueFraction: 1, flickerHz: 0 },
    events: [
      {
        t: 0,
        kind: "info",
        label: `${input.ignition.name} begins heating ${input.material.name}.`,
      },
    ],
    hazardFlags: { co24h: false, co1h: false, co2: false, o2Low: false },
    lag: { s1: 0, s2: 0, c1: 0, c2: 0 },
    initial: { o2: room.o2, co2: room.co2, nTotal: moles(room), o2Kpa: (input.oxygenPct / 100) * input.pressureKpa },
  };
  state.locPct = limitingOxygenPct(input.material, state.uBaseMs, input.pressureKpa);
  return state;
}

function log(state: FireState, kind: FireEvent["kind"], label: string, source?: string) {
  state.events.push({ t: state.t, kind, label, source });
}

/** Apply a response action at the current time. Safe to call twice. */
export function applyAction(state: FireState, input: FireInput, id: SuppressionId): void {
  if (id === "power-off") {
    if (state.powerOff) return;
    state.powerOff = true;
    log(state, "action", "Power removed from the affected equipment.", "iss-fds-2001");
    if (input.ignition.electrical && state.sourceActive) {
      state.sourceActive = false;
      log(state, "info", "The electrical ignition source stops heating.");
    }
    return;
  }
  if (id === "vent-off") {
    if (state.ventOff) return;
    state.ventOff = true;
    state.uForcedTargetMs = 0;
    state.isolated = true;
    log(state, "action", "Cabin fans stopped and intermodule ventilation closed.", "iss-fds-2001");
    return;
  }
  if (id === "co2" && state.agent.co2Start === null) {
    state.agent.co2Start = state.t;
    log(state, "action", "CO₂ extinguisher discharged: 2.7 kg over 45 s.", "iss-fds-2001");
    return;
  }
  if (id === "water-mist" && state.agent.mistStart === null) {
    state.agent.mistStart = state.t;
    log(state, "action", "Fine water mist extinguisher discharged: 2.7 kg of water.", "fwm-pfe");
    return;
  }
  if (id === "halon" && state.agent.halonStart === null) {
    state.agent.halonStart = state.t;
    log(state, "action", "Halon 1301 discharged.", "sfpe");
  }
}

/** Change the fan setting mid-run. */
export function setVentilation(state: FireState, speedMs: number): void {
  state.uForcedTargetMs = Math.max(0, speedMs);
  if (speedMs > 0) {
    state.ventOff = false;
    state.isolated = false;
  }
}

function exchange(state: FireState, flowM3s: number, dt: number) {
  const { room, rest } = state;
  if (flowM3s <= 0) return;
  const fraction = Math.min(0.5, (flowM3s * dt) / room.volumeM3);
  const back = Math.min(0.5, (flowM3s * dt) / rest.volumeM3);
  for (const key of ["o2", "co2", "co", "inert", "smokeKg"] as const) {
    const out = room[key] * fraction;
    const inn = rest[key] * back;
    room[key] += inn - out;
    rest[key] += out - inn;
  }
}

function equalise(state: FireState) {
  const { room, rest } = state;
  const total = moles(room) + moles(rest);
  // Common pressure: n_room T_room / V_room = n_rest T_rest / V_rest.
  const share = room.volumeM3 / room.tempK / (room.volumeM3 / room.tempK + rest.volumeM3 / rest.tempK);
  const delta = moles(room) - total * share;
  const from = delta > 0 ? room : rest;
  const to = delta > 0 ? rest : room;
  const fraction = Math.abs(delta) / moles(from);
  for (const key of ["o2", "co2", "co", "inert", "smokeKg"] as const) {
    const moved = from[key] * fraction;
    from[key] -= moved;
    to[key] += moved;
  }
}

function agentStep(state: FireState, input: FireInput, dt: number, uLocalForced: number) {
  const agent = state.agent;
  const localVolume = input.fuel.enclosed ? 1.7 : 1.0;
  const nLocal = (state.pressureKpa * 1000 * localVolume) / (R * state.room.tempK);
  // Flushing of the near-fuel volume. Slow behind a panel. Assumption.
  const flush = input.fuel.enclosed
    ? 0.002 + 0.05 * uLocalForced
    : 0.05 + Math.hypot(uLocalForced, state.uBuoyantMs);
  agent.jetMs = 0;

  let co2Mol = 0;
  if (agent.co2Start !== null) {
    const since = state.t - agent.co2Start;
    // Integrate across both discharge stages, including steps that cross 10 or 45 s.
    const delivered = (t: number) => 1.36 * clamp(t / 10, 0, 1) + 1.36 * clamp((t - 10) / 35, 0, 1);
    const doseKg = delivered(since) - delivered(since - dt);
    if (doseKg > 0) {
      const rateKg = doseKg / dt;
      co2Mol = doseKg / M_CO2;
      agent.co2ReleasedKg += doseKg;
      agent.jetMs = (input.fuel.enclosed ? 0.3 : 2.0) * (rateKg / 0.136);
    }
  }
  state.room.co2 += co2Mol;
  agent.localCo2 += (co2Mol / nLocal) * (1 - agent.localCo2) - flush * agent.localCo2 * dt;
  agent.localCo2 = clamp(agent.localCo2, 0, 0.95);

  let halonMol = 0;
  if (agent.halonStart !== null) {
    const since = state.t - agent.halonStart;
    const activeS = clamp(since, 0, 10) - clamp(since - dt, 0, 10);
    if (activeS > 0) {
      halonMol = ((1.1 / 10) * activeS) / M_HALON;
      agent.jetMs = Math.max(agent.jetMs, input.fuel.enclosed ? 0.2 : 1.0);
    }
  }
  state.room.inert += halonMol;
  agent.localHalon += (halonMol / nLocal) * (1 - agent.localHalon) - flush * agent.localHalon * dt;
  agent.localHalon = clamp(agent.localHalon, 0, 0.5);

  agent.mistCoolingW = 0;
  if (agent.mistStart !== null) {
    const since = state.t - agent.mistStart;
    if (since < 30) {
      // 2.72 kg over 30 s; 2.6 MJ/kg to heat and evaporate. Capture efficiency and
      // fill time are set so an open-cabin fire goes out in about a second and a
      // fire behind a panel takes tens of seconds, as in the ISS mist tests.
      const fullPower = (2.72 / 30) * 2.6e6;
      const efficiency = input.fuel.enclosed ? 0.006 : 0.5;
      const fill = input.fuel.enclosed ? 60 : 0.5;
      agent.mistCoolingW = fullPower * efficiency * (1 - Math.exp(-since / fill));
    }
  }
}

function extinguish(state: FireState, cause: string, source: string | undefined, keepHotS: number) {
  state.phase = "extinguished";
  state.extinctionCause = cause;
  state.extinctionTime = state.t;
  state.hotUntil = state.t + keepHotS;
  state.belowLimitS = 0;
  state.hrrW = 0;
  state.burningAreaM2 = 0;
  log(state, "extinction", `Flame out: ${cause}.`, source);
}

/** Advance the model by dt seconds. Mutates and returns state. */
export function stepFire(state: FireState, input: FireInput, dt: number): FireState {
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError("Fire time step must be positive and finite.");
  const material = input.material;
  const ignition = input.ignition;
  const ambientK = input.ambientC + 273.15;
  state.t += dt;

  // Automatic and crew response.
  if (state.firstAlarmTime !== null) {
    if (input.autoResponse && !state.autoResponseDone && state.t >= state.firstAlarmTime + 2) {
      state.autoResponseDone = true;
      applyAction(state, input, "power-off");
      applyAction(state, input, "vent-off");
    }
    if (
      input.crewAgent &&
      !state.crewAgentDone &&
      state.t >= state.firstAlarmTime + input.crewResponseS
    ) {
      state.crewAgentDone = true;
      if (state.phase === "flaming" || state.phase === "smoldering" || state.phase === "heating") {
        applyAction(state, input, input.crewAgent);
      }
    }
  }

  // Fan spin-down or spin-up.
  state.uForcedMs += (state.uForcedTargetMs - state.uForcedMs) * (1 - Math.exp(-dt / 8));
  if (state.uForcedMs < 1e-4) state.uForcedMs = 0;
  state.ventFlowM3s = state.uForcedMs * input.ventAreaM2;

  // Ignition source timing.
  const duration = ignition.durationS.value;
  if (state.sourceActive) {
    state.sourceOnTime += dt;
    if (duration !== null && state.sourceOnTime >= duration) state.sourceActive = false;
  }

  const uLocalForced = state.uForcedMs * (input.fuel.enclosed ? ENCLOSED_FLOW_FACTOR : 1);
  agentStep(state, input, dt, uLocalForced);

  state.uBuoyantMs = buoyantBaseVelocity(input.gravityG, state.pressureKpa);
  state.uBaseMs = Math.hypot(uLocalForced, state.uBuoyantMs, state.agent.jetMs);

  const room = state.room;
  const xO2 = room.o2 / moles(room);
  const xLocal = xO2 * (1 - state.agent.localCo2 - state.agent.localHalon);
  state.localO2Pct = xLocal * 100;
  // Halon inhibition: about 5 % by volume puts out a flame in air. Handbook.
  state.locPct =
    limitingOxygenPct(material, state.uBaseMs, state.pressureKpa) + 220 * state.agent.localHalon;
  const flammable = state.localO2Pct >= state.locPct;

  let fuelRateKgS = 0;
  let smokeRateKgS = 0;
  const sourceHeatW = state.sourceActive ? ignition.ownHeatW : 0;
  const loss = heatingLoss(material, input.ambientC, state.uBaseMs);
  const ignitionRise = material.ignitionTempC.value - input.ambientC;

  if (state.phase === "heating" || state.phase === "smoldering") {
    if (state.sourceActive) {
      const rise = surfaceRiseK(material, ignition, state.sourceOnTime, loss);
      state.surfaceTempC = input.ambientC + Math.min(rise, ignitionRise * 1.05);
    } else {
      const coolS = material.form === "thick" ? 60 : Math.max(5, heatCapacityKJm2K(material) / loss);
      state.surfaceTempC = input.ambientC + (state.surfaceTempC - input.ambientC) * Math.exp(-dt / coolS);
    }
    const fraction = (state.surfaceTempC - input.ambientC) / ignitionRise;
    // Pyrolysis smoke from a hot but unignited surface: the overheat event SAME studied. Rate is an assumption.
    if (fraction > 0.5) {
      const pyrolysis = 0.3e-3 * clamp((fraction - 0.5) / 0.5, 0, 1) * ignition.areaM2 * 4;
      smokeRateKgS += pyrolysis * 0.3;
      if (state.phase === "heating") {
        state.phase = "smoldering";
        log(state, "info", "Surface is pyrolysing and releasing smoke before any flame.", "same-2");
      }
    }
    if (fraction >= 1 && flammable) {
      state.phase = "flaming";
      state.ignitionTime = state.t;
      state.belowLimitS = 0;
      const spot = Math.sqrt(ignition.areaM2);
      state.pyroLengthM = Math.min(input.fuel.lengthM, Math.max(spot, 0.02));
      state.pyroWidthM = input.igniterSpansWidth ? input.fuel.widthM : Math.min(input.fuel.widthM, Math.max(spot, 0.02));
      log(
        state,
        "ignition",
        `Flaming ignition at ${state.surfaceTempC.toFixed(0)} °C surface temperature. Limit is ${state.locPct.toFixed(1)} % O₂, cabin has ${state.localO2Pct.toFixed(1)} %.`,
      );
    } else if (fraction >= 1 && !flammable && !state.limitNoted) {
      state.limitNoted = true;
      log(
        state,
        "info",
        `Surface reached ignition temperature but ${state.localO2Pct.toFixed(1)} % O₂ is below the ${state.locPct.toFixed(1)} % limit at this flow. It smoulders without a flame.`,
      );
    }
    if (!state.sourceActive && fraction < 0.15) {
      state.phase = "no-ignition";
      log(state, "info", "The source ended before the material ignited.");
    }
  }

  let chemicalHeatW = 0;
  if (state.phase === "flaming") {
    const uFlame = Math.hypot(
      uLocalForced,
      state.uBuoyantMs,
      buoyantFlameVelocity(input.gravityG, state.pyroLengthM),
    );
    const flowRatio = clamp(uFlame / 0.2, 0.05, 25);
    const excess = state.localO2Pct - state.locPct;
    const nearLimit = clamp(0.3 + (0.7 * excess) / 4, 0.3, 1);
    // Boundary-layer burning: flux ~ sqrt(rho U) times oxygen. Reference flux fitted to Saffire VI.
    const flux =
      material.refMassFluxGm2s.value *
      1e-3 *
      Math.sqrt((state.pressureKpa / 101.325) * flowRatio) *
      (xLocal / 0.21) *
      nearLimit;
    state.massFluxGm2s = flux * 1000;

    const sides = material.form === "thick" ? input.fuel.sides : 1;
    let spread: number;
    let lateral: number;
    let lengthCap = input.fuel.lengthM;
    if (material.form === "thick") {
      // Creeping rate from Saffire IV-2: 9.5 cm in 400 s in air.
      const creep = 0.24e-3 * (xLocal / 0.22) * nearLimit;
      // Upward spread: the flame preheats fuel ahead of it over an ignition time. Scales with g^(1/3).
      const flameFlux = 25 * (xLocal / 0.21);
      const preheatS =
        (Math.PI / 4) * material.thermalInertia.value * (ignitionRise / flameFlux) ** 2;
      const buoyancy = Math.cbrt(Math.max(0, input.gravityG));
      spread = creep + (buoyancy * state.pyroLengthM) / preheatS;
      lateral = creep;
      // Limiting flame length in purely forced flow (Saffire IV-2 and V-3). Gravity removes the cap.
      const limit0g = 0.095 * (xLocal / 0.22) * Math.sqrt(Math.max(uLocalForced, 0.02) / 0.2);
      lengthCap = Math.min(
        input.fuel.lengthM,
        limit0g + (input.fuel.lengthM - limit0g) * clamp(input.gravityG / 0.05, 0, 1),
      );
    } else {
      const reference = (material.refSpreadMmS?.value ?? 1.5) * 1e-3;
      const exponent = material.form === "wire" ? 0.5 : 1;
      spread =
        reference *
        Math.min(6, flowRatio) ** exponent *
        (xLocal / 0.22) *
        (state.pressureKpa / 100) ** 0.32 *
        Math.sqrt(clamp(excess / 4, 0.05, 1));
      lateral = 0.25 * reference * (xLocal / 0.22);
    }
    state.spreadRateMmS = spread * 1000;
    state.pyroLengthM = Math.min(input.fuel.lengthM, state.pyroLengthM + spread * dt);
    state.pyroWidthM = Math.min(input.fuel.widthM, state.pyroWidthM + 2 * lateral * dt);

    const ignitedArea = sides * Math.min(state.pyroLengthM, lengthCap) * state.pyroWidthM;
    const consumedArea = state.fuelBurnedKg / material.arealFuelKgM2.value;
    const frontArea = sides * state.pyroLengthM * state.pyroWidthM;
    const burnedOut = material.form === "thick" ? 0 : Math.min(frontArea, consumedArea);
    state.burningAreaM2 = Math.max(0, (material.form === "thick" ? ignitedArea : frontArea) - burnedOut);

    // An extinction delay cannot release more heat than the available oxygen supports.
    const oxygenLimitedKgS = (room.o2 * M_O2 * HUGGETT_J_PER_KG_O2) /
      (material.heatOfCombustionMJkg.value * 1e6 * dt);
    fuelRateKgS = Math.max(0, Math.min(
      flux * state.burningAreaM2,
      (state.fuelTotalKg - state.fuelBurnedKg) / dt,
      oxygenLimitedKgS,
    ));
    state.fuelBurnedKg += fuelRateKgS * dt;
    chemicalHeatW = fuelRateKgS * material.heatOfCombustionMJkg.value * 1e6;

    // Extinction tests.
    if (state.agent.mistCoolingW > 0 && state.agent.mistCoolingW >= 0.35 * chemicalHeatW) {
      state.belowLimitS += dt;
      if (state.belowLimitS >= 1) extinguish(state, "water mist absorbed the flame's heat", "fwm-pfe", 0);
    } else if (!flammable) {
      state.belowLimitS += dt;
      // Thick fuels hold heat and outgas after the flow stops, and flamelets can survive to re-light
      // them (Saffire IV-2). An agent knocks the gas flame down at once. Durations are assumptions.
      const byAgent = state.agent.localHalon > 0.01 || state.agent.localCo2 > 0.03 || state.agent.jetMs > 0;
      const persistence = byAgent ? 2 : material.form === "thick" ? 25 : 3;
      if (state.belowLimitS >= persistence) {
        const keepHot = material.form === "thick" ? 120 : 20;
        if (state.agent.localHalon > 0.01) extinguish(state, "chemical inhibition by Halon", "sfpe", 0);
        else if (byAgent)
          extinguish(state, "CO₂ displaced the oxygen and blew the flame off", "iss-fds-2001", 0);
        else if (state.uBaseMs < U_OPTIMUM)
          extinguish(state, "quenched, the flow is too slow to supply oxygen", "bass-ii", keepHot);
        else if (state.o2Pct < input.oxygenPct - 1)
          extinguish(state, "cabin oxygen fell below the flammability limit", undefined, keepHot);
        else extinguish(state, "blown off, the flow outruns the flame chemistry", "bass-ii", keepHot);
      }
    } else {
      state.belowLimitS = Math.max(0, state.belowLimitS - dt);
    }

    // A front that burns out faster than it spreads leaves nothing alight.
    state.weakS = chemicalHeatW < 1 ? state.weakS + dt : 0;
    if (state.phase === "flaming" && state.weakS > 5 && state.fuelBurnedKg < state.fuelTotalKg - 1e-9) {
      extinguish(state, "the flame burned out locally and could not spread", undefined, 10);
    }

    if (state.phase === "flaming" && state.fuelBurnedKg >= state.fuelTotalKg - 1e-9) {
      state.phase = "burned-out";
      state.extinctionCause = "fuel consumed";
      state.extinctionTime = state.t;
      state.burningAreaM2 = 0;
      log(state, "extinction", "The fuel is consumed.");
    }
  } else if (state.phase === "extinguished") {
    state.massFluxGm2s = 0;
    state.spreadRateMmS = 0;
    const reheating = state.sourceActive && state.t - (state.extinctionTime ?? 0) > 5;
    if ((state.t < state.hotUntil || reheating) && state.localO2Pct >= state.locPct + 0.5) {
      state.phase = "flaming";
      state.extinctionCause = null;
      state.belowLimitS = 0;
      state.weakS = 0;
      log(
        state,
        "ignition",
        reheating
          ? "Re-ignition: the ignition source is still powered."
          : "Re-ignition from fuel that was still hot when oxygen supply returned.",
        "saffire-iv-v",
      );
    }
    // Hot fuel keeps outgassing smoke for a while.
    if (state.t < state.hotUntil) smokeRateKgS += 2e-7;
  }

  // Heat release and products.
  state.hrrW = chemicalHeatW + sourceHeatW;
  state.peakHrrW = Math.max(state.peakHrrW, state.hrrW);
  state.totalHeatJ += chemicalHeatW * dt;

  const zeroGWeight = Math.exp(-state.uBuoyantMs / 0.08);
  if (fuelRateKgS > 0) {
    const o2Mol = (chemicalHeatW * dt) / HUGGETT_J_PER_KG_O2 / M_O2;
    room.o2 = Math.max(0, room.o2 - o2Mol);
    const co2Mol = (fuelRateKgS * dt * material.co2Yield.value) / M_CO2;
    room.co2 += co2Mol;
    const coYield0g = CO_CO2_RATIO_0G * material.co2Yield.value * (M_CO / M_CO2);
    const starved = xO2 < 0.15 ? 1 + (0.15 - xO2) / 0.05 : 1;
    const coYield = (material.coYield1g.value + (coYield0g - material.coYield1g.value) * zeroGWeight) * starved;
    room.co += (fuelRateKgS * dt * coYield) / M_CO;
    // Low-gravity flames make more and larger soot (Urban et al., cited in SAME-2). Factor is an assumption.
    smokeRateKgS += fuelRateKgS * material.sootYield.value * (1 + 0.5 * zeroGWeight);
  }
  room.smokeKg += smokeRateKgS * dt;

  // Smoke losses: deposition and the return filter. Assumption for both rates.
  const smokeLoss = 1 / 900 + (0.15 * state.ventFlowM3s) / room.volumeM3;
  room.smokeKg *= Math.exp(-smokeLoss * dt);
  state.rest.smokeKg *= Math.exp((-dt * 1) / 900);

  // Energy balance of the room gas. Radiation goes to the walls.
  const radiative = material.radiativeFraction.value;
  const convectiveW = chemicalHeatW * (1 - radiative) + sourceHeatW - state.agent.mistCoolingW * 0.2;
  // Wall film coefficient: still-air floor plus forced and buoyant terms. Assumption, sized so a 3 kW
  // Saffire fire warms the far field by a few kelvin.
  const film = 3 + 25 * state.uForcedMs + 4 * Math.cbrt(Math.max(0, input.gravityG));
  const lossW = film * input.wallAreaM2 * 2 * (room.tempK - ambientK);
  room.tempK += ((convectiveW - lossW) * dt) / (moles(room) * CV_MOLAR);
  room.tempK = Math.max(ambientK - 5, room.tempK);

  // Mixing with the rest of the habitat.
  if (!state.isolated) {
    exchange(state, EXCHANGE_FRACTION * state.ventFlowM3s, dt);
    equalise(state);
  }

  // Readouts.
  const nRoom = moles(room);
  state.pressureKpa = zonePressureKpa(room);
  state.o2Pct = (room.o2 / nRoom) * 100;
  state.o2KpaPartial = (room.o2 / nRoom) * state.pressureKpa;
  state.co2RisePct = (room.co2 / nRoom) * 100;
  state.co2RiseMmHg = (room.co2 / nRoom) * state.pressureKpa * MMHG_PER_KPA;
  state.coPpm = (room.co / nRoom) * 1e6;
  state.tempC = room.tempK - 273.15;
  state.smokeMgM3 = (room.smokeKg / room.volumeM3) * 1e6;

  const density = (state.pressureKpa * 1000 * M_AIR) / (R * room.tempK);
  const flameSpeed = Math.hypot(
    uLocalForced,
    state.uBuoyantMs,
    buoyantFlameVelocity(input.gravityG, Math.max(state.pyroLengthM, 0.05)),
  );
  // Entrained stream past the flame. Stream area is set so Saffire VI-3 gives its 77 C duct outlet.
  const streamArea = 0.15 + 0.4 * Math.max(state.pyroWidthM, 0.05);
  const entrained = density * Math.max(flameSpeed, 0.05) * streamArea;
  state.nearFireTempC = state.tempC + (state.hrrW * (1 - radiative)) / (entrained * CP_AIR);

  transportAndDetect(state, input, dt, smokeRateKgS, uLocalForced);
  updateFlame(state, input, uLocalForced, chemicalHeatW);
  updateHazards(state);
  return state;
}

function transportAndDetect(
  state: FireState,
  input: FireInput,
  dt: number,
  smokeRateKgS: number,
  uLocalForced: number,
) {
  const g = input.gravityG;
  const convectiveKw = Math.max(0.02, (state.hrrW * (1 - input.material.radiativeFraction.value)) / 1000);
  const rise = Math.max(0.2, input.roomHeightM - input.fireHeightM);
  // Plume and ceiling-jet speeds (Alpert), scaled with g^(1/3).
  const plumeSpeed = g > 0 ? 0.96 * Math.cbrt(g) * Math.cbrt(convectiveKw / rise) : 0;
  const forced = state.uForcedMs;
  state.stratification = plumeSpeed ** 2 / (plumeSpeed ** 2 + forced ** 2 + 1e-9);

  // Smoke layer: Zukoski plume entrainment 0.071 Q^(1/3) z^(5/3), scaled with g^(1/3).
  const emitting = state.hrrW > 5 || smokeRateKgS > 0;
  if (g > 0.01 && emitting) {
    const density = (state.pressureKpa * 1000 * M_AIR) / (R * state.room.tempK);
    const z = Math.max(0, state.layerHeightM - input.fireHeightM);
    const plumeKgS = 0.071 * Math.cbrt(g) * Math.cbrt(convectiveKw) * z ** (5 / 3);
    state.layerHeightM -= (plumeKgS / density / input.roomFloorAreaM2) * dt;
  }
  // Ventilation stirs the layer away.
  const stir = (2 * state.ventFlowM3s) / state.room.volumeM3 + (emitting ? 0 : 1 / 300);
  state.layerHeightM += (input.roomHeightM - state.layerHeightM) * (1 - Math.exp(-stir * dt));
  state.layerHeightM = clamp(state.layerHeightM, Math.min(input.fireHeightM, input.roomHeightM * 0.3), input.roomHeightM);

  // Time for smoke to reach the sensor.
  const distance = input.detectorDistanceM;
  const byFlow = forced > 0.005 ? distance / forced : Infinity;
  const byPlume = plumeSpeed > 0.01 ? rise / plumeSpeed + distance / (0.5 * plumeSpeed) : Infinity;
  // SAME-2: with no flow in microgravity smoke diffuses about 4 cm in 60 s.
  const byDiffusion = distance ** 2 / (4 * 1e-5);
  state.transportS = Math.min(byFlow, byPlume, byDiffusion);

  // Particle size: ages toward the 720 s values, and grows when there is no flow (SAME-2).
  const aging = clamp(state.transportS / 720, 0, 1);
  const stillAir = 1 + 1.5 * Math.exp(-state.uBaseMs / 0.03);
  const count = input.material.smokeCountMeanUm.value;
  const mass = input.material.smokeMassMeanUm.value;
  state.smokeCountMeanUm = (count[0] + (count[1] - count[0]) * aging) * stillAir;
  state.smokeMassMeanUm = (mass[0] + (mass[1] - mass[0]) * aging) * stillAir;

  // Concentration the sensor would see with no delay.
  const mixed = state.smokeMgM3;
  const streamArea = Math.PI * (0.15 + 0.12 * distance) ** 2;
  const stream = forced > 0.005 ? (smokeRateKgS * 1e6) / (forced * streamArea) : 0;
  const layerDepth = Math.max(0.15, input.roomHeightM - state.layerHeightM);
  const layer = (state.room.smokeKg * 1e6) / (input.roomFloorAreaM2 * layerDepth);
  // 0.35: chance the sensor sits in the downstream path. Assumption.
  const forcedTarget = mixed + 0.35 * Math.min(stream, 50 * Math.max(mixed, 0.02));
  const target = state.stratification * layer + (1 - state.stratification) * forcedTarget;
  const coTarget = state.coPpm * (mixed > 1e-9 ? clamp(target / mixed, 0.2, 20) : 1);

  // Two lags in series stand in for the transport delay. They freeze when nothing moves the smoke.
  const tau = Math.max(1, state.transportS / 2);
  const k = 1 - Math.exp(-dt / tau);
  state.lag.s1 += (target - state.lag.s1) * k;
  state.lag.s2 += (state.lag.s1 - state.lag.s2) * k;
  state.lag.c1 += (coTarget - state.lag.c1) * k;
  state.lag.c2 += (state.lag.c1 - state.lag.c2) * k;
  state.detectorSmokeMgM3 = state.lag.s2;
  state.detectorCoPpm = state.lag.c2;

  // Sensor response. Light scattering per unit mass rises as d^3 below about 0.3 um; ionization follows
  // number times diameter. Normalised at 0.2 um count mean, 0.3 um mass mean. Shapes follow SAME-2.
  const scatter = clamp((state.smokeMassMeanUm / 0.3) ** 3, 0.02, 1.5);
  const ion = clamp(state.smokeCountMeanUm / 0.2 / (state.smokeMassMeanUm / 0.3) ** 3, 0.05, 8);
  const flameW = state.phase === "flaming" ? state.hrrW * input.material.radiativeFraction.value : 0;
  const irradiance = input.fuel.enclosed ? 0 : flameW / (4 * Math.PI * Math.max(distance, 0.5) ** 2);
  const raw: Record<SensorId, number> = {
    photoelectric: state.detectorSmokeMgM3 * scatter,
    ionization: state.detectorSmokeMgM3 * ion,
    "two-moment": state.detectorSmokeMgM3 * Math.min(2, Math.max(scatter, ion)),
    "uv-ir": irradiance,
    "gas-co": state.detectorCoPpm,
  };
  for (const sensor of FIRE_SENSORS) {
    const cell = state.sensors[sensor.id];
    cell.signal += (raw[sensor.id] - cell.signal) * (1 - Math.exp(-dt / sensor.responseS));
    if (!cell.alarmed && input.sensors.includes(sensor.id) && cell.signal >= sensor.threshold.value) {
      cell.alarmed = true;
      cell.alarmTime = state.t;
      log(state, "detection", `${sensor.name} alarm.`, sensor.sources[0]);
      if (state.firstAlarmTime === null) state.firstAlarmTime = state.t;
    }
  }
}

function updateFlame(state: FireState, input: FireInput, uLocalForced: number, chemicalHeatW: number) {
  const flame = state.flame;
  if (state.phase !== "flaming" || chemicalHeatW <= 0) {
    const hot = state.phase === "smoldering" || (state.phase === "heating" && state.sourceActive);
    flame.kind = hot ? "glow" : "none";
    flame.lengthM = hot ? 0.02 : 0;
    flame.widthM = hot ? 0.02 : 0;
    flame.flickerHz = 0;
    return;
  }
  const g = input.gravityG;
  const diameter = Math.sqrt((4 * Math.max(state.burningAreaM2, 1e-4)) / Math.PI);
  const buoyant = buoyantFlameVelocity(g, Math.max(state.pyroLengthM, 0.05));
  const dominance = buoyant ** 2 / (buoyant ** 2 + uLocalForced ** 2 + 1e-9);
  // Heskestad flame height with Q* carrying the gravity dependence: L ~ Q^(2/5) g^(-1/5).
  const heskestad =
    g > 0 ? 0.235 * (chemicalHeatW / 1000) ** 0.4 * (1 / g) ** 0.2 - 1.02 * diameter : 0;
  const ceiling = Math.max(0.3, input.roomHeightM - input.fireHeightM);
  const plumeLength = clamp(Math.max(heskestad, 0.4 * diameter), 0.03, ceiling * 1.2);
  // Without buoyancy the flame hugs the fuel and trails downstream.
  const sheetLength = Math.max(0.03, state.burningAreaM2 / Math.max(state.pyroWidthM, 0.02));
  flame.kind = g > 0.01 && dominance > 0.3 ? "plume" : "dome";
  flame.lengthM = flame.kind === "plume" ? plumeLength : sheetLength;
  flame.widthM = Math.max(0.03, Math.min(diameter, Math.max(state.pyroWidthM, 0.03)));
  flame.standoffM = clamp(0.006 * Math.sqrt(0.2 / Math.max(state.uBaseMs, 0.01)) * Math.sqrt(101.325 / state.pressureKpa), 0.004, 0.06);
  flame.tiltRad = Math.atan2(uLocalForced, Math.max(buoyant, 1e-4));
  // BASS-II: low-speed microgravity flames are mostly blue with a hint of soot.
  flame.blueFraction = clamp(1 - state.uBaseMs / 0.45, 0, 1) * (g < 0.05 ? 1 : 0.45);
  // Puffing frequency 1.5 / sqrt(D) Hz in 1 g, scaling with sqrt(g). Steady in free fall.
  flame.flickerHz = g > 0 ? (1.5 * Math.sqrt(g)) / Math.sqrt(Math.max(diameter, 0.03)) : 0;
}

function updateHazards(state: FireState) {
  const flags = state.hazardFlags;
  if (!flags.co24h && state.coPpm >= 100) {
    flags.co24h = true;
    log(state, "hazard", "Instantaneous CO crossed the 24-hour SMAC reference of 100 ppm; exposure average is not calculated.", "saffire-vi");
  }
  if (!flags.co1h && state.coPpm >= 425) {
    flags.co1h = true;
    log(state, "hazard", "Instantaneous CO crossed the 1-hour SMAC reference of 425 ppm; exposure average is not calculated.", "saffire-vi");
  }
  if (!flags.co2 && state.co2RiseMmHg >= 3) {
    flags.co2 = true;
    log(state, "hazard", "Instantaneous CO₂ rise crossed the 1-hour reference of 3 mmHg; exposure average is not calculated.", "saffire-vi");
  }
  if (!flags.o2Low && state.o2KpaPartial < 16 && state.initial.o2Kpa >= 16) {
    flags.o2Low = true;
    log(state, "hazard", "Oxygen partial pressure fell below 16 kPa.");
  }
}

export interface ScheduledAction {
  t: number;
  id: SuppressionId;
}

export interface FireSample {
  t: number;
  hrrW: number;
  o2Pct: number;
  tempC: number;
  coPpm: number;
  co2RiseMmHg: number;
  smokeMgM3: number;
  detectorSmokeMgM3: number;
  layerHeightM: number;
}

export function sample(state: FireState): FireSample {
  return {
    t: state.t,
    hrrW: state.hrrW,
    o2Pct: state.o2Pct,
    tempC: state.tempC,
    coPpm: state.coPpm,
    co2RiseMmHg: state.co2RiseMmHg,
    smokeMgM3: state.smokeMgM3,
    detectorSmokeMgM3: state.detectorSmokeMgM3,
    layerHeightM: state.layerHeightM,
  };
}

export interface FireRun {
  state: FireState;
  history: FireSample[];
  /** First time each quantity crossed its limit, or null. */
  timeToCo24h: number | null;
  timeToCo1h: number | null;
  timeToCo2Limit: number | null;
}

/** Run a whole scenario without a clock. Used by the predictor, the benchmarks and the tests. */
export function runFire(
  input: FireInput,
  options: { durationS: number; dt?: number; actions?: ScheduledAction[]; sampleEveryS?: number; stopWhenOut?: boolean },
): FireRun {
  const dt = options.dt ?? 0.25;
  const every = options.sampleEveryS ?? 5;
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(every) || every <= 0 ||
      !Number.isFinite(options.durationS) || options.durationS < 0) {
    throw new RangeError("Fire duration must be finite and nonnegative; time and sample steps must be positive and finite.");
  }
  const state = createFireState(input);
  const pending = [...(options.actions ?? [])].sort((a, b) => a.t - b.t);
  const history: FireSample[] = [sample(state)];
  let next = every;
  let timeToCo24h: number | null = null;
  let timeToCo1h: number | null = null;
  let timeToCo2Limit: number | null = null;
  let outSince: number | null = null;
  while (state.t < options.durationS) {
    while (pending.length && pending[0].t <= state.t) applyAction(state, input, pending.shift()!.id);
    const untilAction = pending.length ? pending[0].t - state.t : Infinity;
    stepFire(state, input, Math.min(dt, options.durationS - state.t, untilAction));
    if (timeToCo24h === null && state.coPpm >= 100) timeToCo24h = state.t;
    if (timeToCo1h === null && state.coPpm >= 425) timeToCo1h = state.t;
    if (timeToCo2Limit === null && state.co2RiseMmHg >= 3) timeToCo2Limit = state.t;
    if (state.t >= next) {
      history.push(sample(state));
      next += every;
    }
    const out = state.phase === "burned-out" || state.phase === "no-ignition" || (state.phase === "extinguished" && state.t > state.hotUntil && !state.sourceActive);
    if (out && outSince === null) outSince = state.t;
    if (!out) outSince = null;
    if (options.stopWhenOut && outSince !== null && state.t - outSince > 60) break;
  }
  history.push(sample(state));
  return { state, history, timeToCo24h, timeToCo1h, timeToCo2Limit };
}
