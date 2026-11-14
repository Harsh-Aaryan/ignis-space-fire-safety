import { fuelElements, reactionYields } from "./chemistry";
import { makeSolid, heatSolid, type SolidState } from "./thermal";
import { GAS_CV, GAS_R, makeZone, gasMoles, gasEnergy, gasPressure, exchangeGas, equaliseGas, brownianDiffusivity, type GasZone } from "./transport";
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
export interface FuelGeometry {
  widthM: number;
  lengthM: number;
  sides: 1 | 2;
  enclosed: boolean;
}

export interface FireInput {
  gravityG: number;
  baselineCo2Ppm?: number;
  flowOrientation?: "concurrent" | "opposed" | "crossflow";
  spatial?: { origin: [number, number, number]; flow: [number, number, number]; size: [number, number, number]; detectors: { id: string; position: [number, number, number]; distanceM: number; downstream: boolean }[]; obstacles: { center: [number, number, number]; half: [number, number, number] }[] };

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
  | "pyrolysis"
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

type Zone = GasZone;

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

  local: Zone;
  solid: SolidState;
  wallTempK: number;
  vaporFuelKg: number;
  fuelPyrolysedKg: number;
  residueKg: number;
  removedSmokeKg: number;
  removedAerosolFuelKg: number;
  chemicalHrrW: number;
  sourceHeatW: number;
  smokeRateKgS: number;
  transportFrames: { t: number; forcedMs: number; chemicalW: number; smokeKgS: number; countUm: number; tempK: number; pressureKpa: number }[];
  cumulativeOxygenKg: number;
  sourceEnergyJ: number;
  wallEnergyJ: number;
  agentAbsorbedJ: number;
  co2TotalMmHg: number;
  co2BaselinePpm: number;
  ri: number;
  transportFlowM3s: number;
  detectorLocations: { id: string; smokeMgM3: number; coPpm: number; transportS: number; sensors: Record<SensorId, SensorState> }[];
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
    mistReleasedKg: number;
    mistEvaporatedKg: number;
    mistDepositedKg: number;
    halonReleasedKg: number;
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const U_OPTIMUM = 0.08; // PMMA rod envelope only, not a material-independent optimum
export function buoyantBaseVelocity(g: number, p: number) {
  return g <= 0 ? 0 : Math.cbrt(g * G0 * 1.5e-4 * 101.325 / p * 5);
}
export function buoyantFlameVelocity(g: number, lengthM: number) {
  return g <= 0 ? 0 : 0.35 * Math.sqrt(g * G0 * Math.max(lengthM, 0.02) * 5);
}
/** Empirical envelope. PMMA: BASS rod trend, not the film's quench curve.
 * Other materials retain exploratory margins with their own reference pressure.
 * No universal White Sands pressure slope is applied outside its specimens.
 */
export function limitingOxygenPct(m: FireMaterial, u: number, p: number) {
  const referencePressure = m.id === "pei" ? 70.3 : 101.325;
  const min = m.loc1gPct.value - m.lowFlowMarginPct.value;
  const opt = m.id === "pmma" ? 0.08 : m.id === "sibal" || m.id === "paper" ? 0.2 : 0.15;
  const x = Math.log(Math.max(u, 0.003) / opt);
  const quench = m.form === "thick" ? 1.0 : 2.0;
  const curvature = x < 0 ? quench : m.lowFlowMarginPct.value / Math.max(0.3, Math.log(0.45 / opt) ** 2);
  // Pressure extrapolation is explicitly a closure, not the WSTF mean transferred to all fuels.
  const shift = m.id === "pei" ? -0.251 * (p - referencePressure) / 6.894757 : 0;
  return clamp(min + curvature * x * x + shift, 5, 100);
}

/** Analytical preview; actual ignition follows the evolving conduction state. */
export function surfaceRiseK(m: FireMaterial, ignition: IgnitionSource, seconds: number, loss: number) {
  if (seconds <= 0) return 0;
  const flux = Math.min(ignition.heatFluxKwM2.value, ignition.ownHeatW / ignition.areaM2 / 1000);
  if (m.form === "thick" && !ignition.edge) {
    const a = 2 * Math.sqrt(seconds / (Math.PI * m.thermalInertia.value));
    return a * flux / (1 + a * loss);
  }
  const capacity = Math.min(m.arealFuelKgM2.value, ignition.edge ? 1.19 : Infinity) * m.specificHeatKJkgK;
  return loss > 0 ? flux / loss * -Math.expm1(-loss * seconds / capacity) : flux * seconds / capacity;
}
export function ignitionDelayS(m: FireMaterial, ignition: IgnitionSource, ambientC: number, u: number) {
  const solid = makeSolid(m, ambientC, ignition.edge);
  const flux = Math.min(ignition.heatFluxKwM2.value * 1000, ignition.ownHeatW / ignition.areaM2);
  const max = ignition.durationS.value ?? 1800;
  for (let t = 0.25; t <= max; t += 0.25) {
    heatSolid(solid, m.specificHeatKJkgK * 1000, flux, ambientC + 273.15, ambientC + 273.15, 5 + 20 * Math.sqrt(u), 0.25);
    if (solid.temperaturesK[0] >= m.ignitionTempC.value + 273.15) return t;
  }
  return null;
}

const sensorCells = () => Object.fromEntries(FIRE_SENSORS.map(s => [s.id, { signal: 0, alarmed: false, alarmTime: null }])) as Record<SensorId, SensorState>;
export function createFireState(input: FireInput): FireState {
  if (![input.gravityG, input.pressureKpa, input.oxygenPct, input.roomVolumeM3, input.habitatVolumeM3, input.ventilationMs, input.ambientC].every(Number.isFinite) || input.pressureKpa <= 0 || input.roomVolumeM3 <= 0 || input.habitatVolumeM3 < input.roomVolumeM3 || input.gravityG < 0 || input.oxygenPct <= 0 || input.oxygenPct > 70 || input.ventilationMs < 0) throw new RangeError("Invalid fire atmosphere or volume.");
  const tempK = input.ambientC + 273.15;
  const baseline = input.baselineCo2Ppm ?? 400;
  if (tempK <= 0 || !Number.isFinite(baseline) || baseline < 0 || baseline / 1e6 + input.oxygenPct / 100 >= 1 ||
      ![input.ventAreaM2, input.wallAreaM2, input.roomHeightM, input.roomFloorAreaM2, input.fuel.widthM, input.fuel.lengthM].every(Number.isFinite) ||
      input.ventAreaM2 < 0 || input.wallAreaM2 < 0 || input.roomHeightM <= 0 || input.roomFloorAreaM2 <= 0 || input.fuel.widthM <= 0 || input.fuel.lengthM <= 0) throw new RangeError("Invalid baseline gas, temperature or geometry.");
  const localVolume = Math.min(input.roomVolumeM3 * 0.1, input.fuel.enclosed ? 0.15 : 0.025);
  const local = makeZone(localVolume, input.pressureKpa, input.oxygenPct, tempK, baseline);
  const room = makeZone(input.roomVolumeM3 - localVolume, input.pressureKpa, input.oxygenPct, tempK, baseline);
  const rest = makeZone(Math.max(1e-6, input.habitatVolumeM3 - input.roomVolumeM3), input.pressureKpa, input.oxygenPct, tempK, baseline);
  const buoyant = buoyantBaseVelocity(input.gravityG, input.pressureKpa);
  return {
    t: 0, phase: "heating", surfaceTempC: input.ambientC, ignitionTime: null, sourceActive: true, sourceOnTime: 0,
    pyroLengthM: 0, pyroWidthM: 0, burningAreaM2: 0, fuelBurnedKg: 0,
    fuelTotalKg: input.material.arealFuelKgM2.value * input.fuel.widthM * input.fuel.lengthM * (input.material.form === "thick" ? input.fuel.sides : 1),
    hrrW: 0, peakHrrW: 0, totalHeatJ: 0, massFluxGm2s: 0, spreadRateMmS: 0,
    uForcedMs: input.ventilationMs, uForcedTargetMs: input.ventilationMs, uBuoyantMs: buoyant,
    uBaseMs: Math.hypot(input.ventilationMs, buoyant), locPct: limitingOxygenPct(input.material, Math.hypot(input.ventilationMs, buoyant), input.pressureKpa), localO2Pct: input.oxygenPct,
    local, room, rest, isolated: false, solid: makeSolid(input.material, input.ambientC, input.ignition.edge), wallTempK: tempK,
    vaporFuelKg: 0, fuelPyrolysedKg: 0, residueKg: 0, removedSmokeKg: 0, removedAerosolFuelKg: 0, chemicalHrrW: 0, sourceHeatW: 0, smokeRateKgS: 0, cumulativeOxygenKg: 0,
    transportFrames: [], sourceEnergyJ: 0, wallEnergyJ: 0, agentAbsorbedJ: 0, co2TotalMmHg: baseline / 1e6 * input.pressureKpa * 7.50062, co2BaselinePpm: baseline, ri: 0, transportFlowM3s: 0,
    o2Pct: input.oxygenPct, o2KpaPartial: input.oxygenPct / 100 * input.pressureKpa, co2RisePct: 0, co2RiseMmHg: 0, coPpm: 0,
    tempC: input.ambientC, nearFireTempC: input.ambientC, pressureKpa: input.pressureKpa, smokeMgM3: 0, ventFlowM3s: input.ventilationMs * input.ventAreaM2,
    layerHeightM: input.roomHeightM, stratification: 0, transportS: 0, smokeCountMeanUm: input.material.smokeCountMeanUm.value[0], smokeMassMeanUm: input.material.smokeMassMeanUm.value[0], detectorSmokeMgM3: 0, detectorCoPpm: 0,
    sensors: sensorCells(), detectorLocations: (input.spatial?.detectors.length ? input.spatial.detectors : [{ id: "assumed-return", distanceM: input.detectorDistanceM }]).map(d => ({ id: d.id, smokeMgM3: 0, coPpm: 0, transportS: 0, sensors: sensorCells() })), firstAlarmTime: null,
    powerOff: false, ventOff: false, agent: { co2Start: null, mistStart: null, halonStart: null, localCo2: 0, localHalon: 0, mistCoolingW: 0, jetMs: 0, co2ReleasedKg: 0, mistReleasedKg: 0, mistEvaporatedKg: 0, mistDepositedKg: 0, halonReleasedKg: 0 }, autoResponseDone: false, crewAgentDone: false,
    belowLimitS: 0, weakS: 0, limitNoted: false, hotUntil: 0, extinctionCause: null, extinctionTime: null,
    flame: { kind: "none", lengthM: 0, widthM: 0, standoffM: 0, tiltRad: 0, blueFraction: 0, flickerHz: 0 },
    events: [{ t: 0, kind: "info", label: `${input.ignition.name} heats ${input.material.name}. Local transport and solid heating are modeled; partial-gravity spread is exploratory.` }],
    hazardFlags: { co24h: false, co1h: false, co2: false, o2Low: false }, lag: { s1: 0, s2: 0, c1: 0, c2: 0 },
    initial: { o2: local.o2 + room.o2 + rest.o2, co2: local.co2 + room.co2 + rest.co2, nTotal: gasMoles(local) + gasMoles(room) + gasMoles(rest), o2Kpa: input.oxygenPct / 100 * input.pressureKpa },
  };
}

function log(s: FireState, kind: FireEvent["kind"], label: string, source?: string) { s.events.push({ t: s.t, kind, label, source }); }
export function applyAction(s: FireState, input: FireInput, id: SuppressionId) {
  if (id === "power-off" && !s.powerOff) {
    s.powerOff = true; if (input.ignition.electrical) s.sourceActive = false;
    log(s, "action", "Power removed from the affected equipment.", "iss-fds-2001");
  } else if (id === "vent-off" && !s.ventOff) {
    s.ventOff = true; s.isolated = true; s.uForcedTargetMs = 0;
    log(s, "action", "Fans stopped; intermodule path isolated. Hot fuel can continue to release vapor.", "saffire-iv-v");
  } else if (id === "co2" && s.agent.co2Start === null) {
    s.agent.co2Start = s.t; log(s, "action", "CO₂ extinguisher discharged: finite 2.72 kg dose over 45 s.", "iss-fds-2001");
  } else if (id === "water-mist" && s.agent.mistStart === null) {
    s.agent.mistStart = s.t; log(s, "action", "Fine water mist discharged: finite 2.72 kg supply; capture is an assumption.", "fwm-pfe");
  } else if (id === "halon" && s.agent.halonStart === null) {
    s.agent.halonStart = s.t; log(s, "action", "Halon 1301 discharged: exploratory chemical-inhibition model.", "model");
  }
}
export function setVentilation(s: FireState, ms: number) {
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError("Air speed must be finite and nonnegative.");
  if (s.uForcedTargetMs !== ms) log(s, "action", `Ventilation target set to ${ms.toFixed(3)} m/s; fan time constant 8 s (assumed).`, "model");
  s.uForcedTargetMs = ms;
  if (ms > 0) { s.ventOff = false; s.isolated = false; }
}
function delivered(start: number | null, t: number, dt: number, mass: number, duration: number) {
  if (start === null) return 0;
  return mass * (clamp((t - start) / duration, 0, 1) - clamp((t - dt - start) / duration, 0, 1));
}
function agents(s: FireState, input: FireInput, dt: number, availableW: number) {
  const a = s.agent;
  const co2 = a.co2Start === null ? 0 : delivered(a.co2Start, s.t, dt, 1.36, 10) + delivered(a.co2Start + 10, s.t, dt, 1.36, 35);
  const halon = delivered(a.halonStart, s.t, dt, 1.1, 10);
  const water = delivered(a.mistStart, s.t, dt, 2.72, 30);
  a.co2ReleasedKg += co2; a.halonReleasedKg += halon; a.mistReleasedKg += water;
  // Added gases arrive at ambient temperature; sensible-energy transfer is explicit.
  const oldEnergy = gasEnergy(s.local);
  s.local.co2 += co2 / 0.044; s.local.halon += halon / 0.149;
  s.local.tempK = (oldEnergy + (co2 / 0.044 + halon / 0.149) * GAS_CV * 295.15) / (gasMoles(s.local) * GAS_CV);
  a.localCo2 = s.local.co2 / gasMoles(s.local);
  a.localHalon = s.local.halon / gasMoles(s.local);
  a.jetMs = co2 > 0 || halon > 0 ? 0.4 : 0;
  const capture = input.fuel.enclosed ? 0.01 : 0.5; // assumed nozzle capture
  const boilingK = 1 / (1 / 373.15 - 461.5 / 2.257e6 * Math.log(s.pressureKpa / 101.325));
  const specificHeatAbsorption = 4180 * Math.max(0, boilingK - 295.15) + 2.257e6;
  a.mistCoolingW = Math.min(Math.max(0, availableW), water / dt * specificHeatAbsorption * capture);
  const evaporated = a.mistCoolingW * dt / specificHeatAbsorption;
  a.mistEvaporatedKg += evaporated;
  a.mistDepositedKg += water - evaporated;
  // Steam enters the same inventory and is transported with combustion water.
  const beforeSteam = gasEnergy(s.local);
  s.local.water += evaporated / 0.018;
  s.local.tempK = (beforeSteam + evaporated / 0.018 * GAS_CV * boilingK) / (gasMoles(s.local) * GAS_CV);
}
function extinguish(s: FireState, reason: string) {
  s.phase = "extinguished"; s.extinctionTime = s.t; s.extinctionCause = reason;
  s.burningAreaM2 = 0; s.belowLimitS = 0;
  log(s, "extinction", `Flame out: ${reason}. Smoke and heat can remain.`, "model");
}

/** Public integrator bounds substeps for thermal/chemical coupling. Transport is analytic. */
export function stepFire(s: FireState, input: FireInput, dt: number): FireState {
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError("Fire time step must be positive and finite.");
  const count = Math.ceil(dt / 0.125), step = dt / count;
  for (let i = 0; i < count; i++) advance(s, input, step);
  return s;
}
function advance(s: FireState, input: FireInput, dt: number) {
  const m = input.material, ambient = input.ambientC + 273.15;
  s.t += dt;
  if (s.firstAlarmTime !== null) {
    if (input.autoResponse && !s.autoResponseDone && s.t >= s.firstAlarmTime + 2) { s.autoResponseDone = true; applyAction(s, input, "power-off"); applyAction(s, input, "vent-off"); }
    if (input.crewAgent && !s.crewAgentDone && s.t >= s.firstAlarmTime + input.crewResponseS) { s.crewAgentDone = true; applyAction(s, input, input.crewAgent); }
  }
  s.uForcedMs += (s.uForcedTargetMs - s.uForcedMs) * -Math.expm1(-dt / 8);
  if (s.uForcedMs < 1e-5) s.uForcedMs = 0;
  s.ventFlowM3s = s.uForcedMs * input.ventAreaM2;
  s.uBuoyantMs = buoyantBaseVelocity(input.gravityG, s.pressureKpa);
  const forced = s.uForcedMs * (input.fuel.enclosed ? 0.3 : 1);
  s.uBaseMs = Math.hypot(forced, s.uBuoyantMs);
  const burnWidth = Math.max(s.pyroWidthM, Math.sqrt(input.ignition.areaM2));
  // Three finite volumes: source, room, connected habitat. Molecular diffusion remains at 0 g.
  const length = Math.max(0.02, Math.sqrt(s.local.volumeM3));
  s.transportFlowM3s = (forced + s.uBuoyantMs) * Math.max(0.01, burnWidth * 0.12) + 2e-5 * 0.02 / length;
  exchangeGas(s.local, s.room, s.transportFlowM3s, dt / 2);
  if (!s.isolated) exchangeGas(s.room, s.rest, 0.3 * s.ventFlowM3s, dt / 2);
  s.vaporFuelKg = s.local.vapor * 0.1; // representative pyrolysis-gas molar mass, assumed
  let sourceDt = s.sourceActive ? dt : 0;
  if (input.ignition.durationS.value !== null) sourceDt = Math.min(sourceDt, Math.max(0, input.ignition.durationS.value - s.sourceOnTime));
  s.sourceOnTime += sourceDt;
  const circuit = input.ignition.electricalModel;
  s.sourceHeatW = (circuit ? circuit.currentA ** 2 * circuit.resistanceOhm : input.ignition.ownHeatW) * sourceDt / dt;
  if (input.ignition.durationS.value !== null && s.sourceOnTime >= input.ignition.durationS.value) s.sourceActive = false;
  s.sourceEnergyJ += s.sourceHeatW * dt;
  // This reduced-order mist branch cools the exposed solid. Limit evaporation
  // to its available sensible heat so an assumed capture fraction cannot cool
  // the surface below incoming water temperature without a wet-bulb model.
  const exposedArea = Math.max(input.ignition.areaM2, s.burningAreaM2);
  const exposedCapacity = s.solid.densityKgM3 * m.specificHeatKJkgK * 1000 * s.solid.thicknessM / s.solid.temperaturesK.length * exposedArea;
  agents(s, input, dt, 0.8 * exposedCapacity * Math.max(0, s.solid.temperaturesK[0] - 295.15) / dt);
  s.localO2Pct = s.local.o2 / gasMoles(s.local) * 100;
  s.locPct = limitingOxygenPct(m, s.uBaseMs, s.pressureKpa);
  const flammable = s.localO2Pct >= s.locPct && s.agent.localHalon < 0.05 && fuelElements(m).supported;

  const spot = input.ignition.areaM2;
  const sourceSurfaceW = Math.min(s.sourceHeatW, input.ignition.heatFluxKwM2.value * 1000 * spot);
  // Effective gasification latent heat is a documented closure, not a measured kinetic rate.
  const latent = 1.6e6;
  const potentialFlux = m.refMassFluxGm2s.value * 1e-3 * Math.sqrt(Math.max(0.01, s.uBaseMs) / 0.2 * s.pressureKpa / 101.325) * s.localO2Pct / 21;
  const flaming = s.phase === "flaming";
  const activeArea = Math.max(spot, s.burningAreaM2);
  const feedbackW = flaming ? Math.min(s.chemicalHrrW * 0.55, potentialFlux * activeArea * latent + 35e3 * activeArea) : 0;
  const netSurfaceW = sourceSurfaceW + feedbackW - s.agent.mistCoolingW;
  const solidEnergyChange = heatSolid(s.solid, m.specificHeatKJkgK * 1000, netSurfaceW / activeArea, s.room.tempK, s.wallTempK, 2 + 6 * Math.sqrt(s.uBaseMs), dt) * activeArea;
  const solidGasExchangeW = (2 + 6 * Math.sqrt(s.uBaseMs)) * (s.room.tempK - s.solid.temperaturesK[0]) * activeArea;
  // Close the implicit solid step's energy balance: its radiative residual reaches walls.
  const solidRadiationJ = netSurfaceW * dt + solidGasExchangeW * dt - solidEnergyChange;
  const roomEnergyBeforeSolid = gasEnergy(s.room);
  s.room.tempK = (roomEnergyBeforeSolid - solidGasExchangeW * dt) / (gasMoles(s.room) * GAS_CV);
  s.surfaceTempC = s.solid.temperaturesK[0] - 273.15;
  const pyroK = m.ignitionTempC.value + 273.15;
  const capacityM2 = s.solid.densityKgM3 * m.specificHeatKJkgK * 1000 * s.solid.thicknessM / s.solid.temperaturesK.length;
  const excessJ = Math.max(0, s.solid.temperaturesK[0] - pyroK) * capacityM2 * activeArea;
  let pyro = Math.min(excessJ / latent, Math.max(0, s.fuelTotalKg - s.fuelPyrolysedKg));
  if (pyro > 0) { s.solid.temperaturesK[0] -= pyro * latent / (capacityM2 * activeArea); s.fuelPyrolysedKg += pyro; s.vaporFuelKg += pyro; s.local.vapor += pyro / 0.1; }
  // Sub-ignition emissions are pyrolysis, never automatically called solid smoldering.
  if (s.phase === "heating" && s.surfaceTempC > input.ambientC + 0.65 * (m.ignitionTempC.value - input.ambientC)) { s.phase = "pyrolysis"; log(s, "info", "Heated material is approaching pyrolysis; no flaming reaction yet.", "same-2"); }
  // Condensed pre-fire emissions: an exploratory source model, NOT a measured
  // SAME generation rate. Track their fuel mass separately from carbon soot.
  const preheatFraction = (s.surfaceTempC - input.ambientC) / Math.max(1, m.ignitionTempC.value - input.ambientC);
  const preAerosol = s.phase === "pyrolysis" ? Math.min(Math.max(0, s.fuelTotalKg - s.fuelPyrolysedKg), 0.3e-3 * spot * clamp((preheatFraction - .65) / .35, 0, 1) * dt) : 0;
  s.fuelPyrolysedKg += preAerosol; s.local.aerosolFuelKg += preAerosol;
  s.solid.temperaturesK[0] -= preAerosol * latent / (capacityM2 * activeArea);
  if (!flaming && flammable && s.vaporFuelKg > 1e-9 && (s.sourceActive || sourceDt > 0)) {
    s.phase = "flaming"; s.ignitionTime ??= s.t; s.extinctionCause = null; s.belowLimitS = 0;
    s.pyroWidthM = input.igniterSpansWidth ? input.fuel.widthM : Math.min(input.fuel.widthM, Math.sqrt(spot));
    s.pyroLengthM = Math.min(input.fuel.lengthM, spot / s.pyroWidthM / (m.form === "thick" ? input.fuel.sides : 1));
    log(s, "ignition", "Flaming ignition: hot fuel vapor and a sustaining oxygen supply.", "model");
  }
  if (s.phase === "flaming") {
    const orientation = input.flowOrientation ?? "concurrent";
    const reference = (m.refSpreadMmS?.value ?? 0) * 1e-3;
    const spread = m.form === "thick" ? 0 : reference * Math.sqrt(Math.max(0.01, s.uBaseMs) / 0.2) * s.localO2Pct / 22 * (orientation === "opposed" ? 0.65 : orientation === "crossflow" ? 0.5 : 1);
    s.spreadRateMmS = spread * 1000;
    s.pyroLengthM = Math.min(input.fuel.lengthM, s.pyroLengthM + spread * dt);
    s.pyroWidthM = Math.min(input.fuel.widthM, s.pyroWidthM + 0.25 * spread * dt);
    // Thick-fuel burning footprint grows by thermal penetration/feedback, NOT flame-tip displacement.
    if (m.form === "thick") s.pyroLengthM = Math.min(input.fuel.lengthM, (spot / Math.max(0.001, s.pyroWidthM) / (m.form === "thick" ? input.fuel.sides : 1)) + Math.sqrt(Math.max(0, s.t - (s.ignitionTime ?? s.t)) * s.solid.conductivityWMK / (s.solid.densityKgM3 * m.specificHeatKJkgK * 1000)) * 4);
    const sides = m.form === "thick" ? input.fuel.sides : 1;
    const footprint = s.pyroWidthM * s.pyroLengthM * sides;
    const burnedArea = m.form === "thick" ? 0 : s.fuelPyrolysedKg / m.arealFuelKgM2.value;
    s.burningAreaM2 = Math.max(0, footprint - burnedArea);
  } else { s.burningAreaM2 = 0; s.spreadRateMmS = 0; }
  const y = reactionYields(m, s.localO2Pct);
  const localOxygenKg = s.local.o2 * 0.032;
  const burn = s.phase === "flaming" ? Math.min(s.vaporFuelKg, potentialFlux * Math.max(s.burningAreaM2, spot) * dt, localOxygenKg / Math.max(y.oxygen, 1e-9)) * (flammable ? 1 : 0.05) : 0;
  s.vaporFuelKg -= burn; s.fuelBurnedKg += burn; s.cumulativeOxygenKg += burn * y.oxygen;
  s.residueKg += burn * y.residue;
  const oldLocalEnergy = gasEnergy(s.local);
  s.local.vapor = Math.max(0, s.local.vapor - burn / 0.1);
  s.local.o2 = Math.max(0, s.local.o2 - burn * y.oxygen / 0.032);
  s.local.co2 += burn * y.co2 / 0.044; s.local.co += burn * y.co / 0.028; s.local.water += burn * y.water / 0.018;
  s.local.smokeKg += burn * y.soot;
  s.smokeRateKgS = (burn * y.soot + preAerosol) / dt;
  // Oxygen calorimetry is available as a diagnostic; stoichiometry governs this supported chemistry.
  s.chemicalHrrW = burn / dt * m.heatOfCombustionMJkg.value * 1e6;
  s.totalHeatJ += s.chemicalHrrW * dt;
  s.hrrW = s.chemicalHrrW;
  s.peakHrrW = Math.max(s.peakHrrW, s.hrrW);
  s.massFluxGm2s = burn / dt / Math.max(activeArea, 1e-9) * 1000;
  const radiativeW = s.chemicalHrrW * m.radiativeFraction.value;
  const gasW = s.chemicalHrrW - radiativeW - feedbackW + s.sourceHeatW - sourceSurfaceW;
  const mistGasW = 0; // Direct flame/droplet heat transfer awaits calibrated spray data.
  s.agentAbsorbedJ += (s.agent.mistCoolingW + mistGasW) * dt;
  s.local.tempK = (oldLocalEnergy + (gasW - mistGasW) * dt) / (gasMoles(s.local) * GAS_CV);
  const wallCap = input.wallAreaM2 * 12000;
  if (wallCap > 0) {
    const film = 3 + 10 * Math.sqrt(s.uBaseMs);
    for (const z of [s.local, s.room, s.rest]) {
      const areaShare = z === s.local ? 0.05 : z === s.room ? 0.7 : 0.25;
      const cap = gasMoles(z) * GAS_CV;
      const conductance = film * input.wallAreaM2 * areaShare;
      const heat = (z.tempK - s.wallTempK) * -Math.expm1(-conductance * dt * (1 / cap + 1 / wallCap)) / (1 / cap + 1 / wallCap);
      z.tempK -= heat / cap; s.wallTempK += heat / wallCap; s.wallEnergyJ += heat;
    }
    s.wallTempK += (radiativeW * dt + solidRadiationJ) / wallCap;
    const loss = (s.wallTempK - ambient) * input.wallAreaM2 * 0.3 * dt;
    s.wallTempK -= loss / wallCap;
  }
  exchangeGas(s.local, s.room, s.transportFlowM3s, dt / 2);
  equaliseGas(s.local, s.room);
  if (!s.isolated) { exchangeGas(s.room, s.rest, 0.3 * s.ventFlowM3s, dt / 2); equaliseGas(s.room, s.rest); }
  for (const z of [s.local, s.room, s.rest]) {
    const removed = z.smokeKg * -Math.expm1(-(1 / 900 + (z === s.room ? 0.15 * s.ventFlowM3s / z.volumeM3 : 0)) * dt);
    z.smokeKg -= removed; s.removedSmokeKg += removed;
    const aerosolRemoved = z.aerosolFuelKg * -Math.expm1(-(1 / 900 + (z === s.room ? 0.15 * s.ventFlowM3s / z.volumeM3 : 0)) * dt);
    z.aerosolFuelKg -= aerosolRemoved; s.removedAerosolFuelKg += aerosolRemoved;
  }
  if (s.phase === "flaming") {
    const weak = !flammable || s.chemicalHrrW < 0.5 || s.agent.mistCoolingW > feedbackW;
    s.belowLimitS = weak ? s.belowLimitS + dt : Math.max(0, s.belowLimitS - dt);
    if (s.belowLimitS > 2) extinguish(s, s.agent.mistCoolingW > 0 ? "fuel cooled by captured water" : s.agent.localHalon >= 0.05 ? "assumed chemical inhibition threshold reached" : "local heat/oxygen balance no longer sustains burning");
    if (s.fuelPyrolysedKg >= s.fuelTotalKg - 1e-9 && s.vaporFuelKg < 1e-8) { s.phase = "burned-out"; s.extinctionTime = s.t; s.extinctionCause = "solid fuel exhausted; unburned gases may remain"; }
  }
  if (!s.sourceActive && s.surfaceTempC < input.ambientC + 20 && !s.ignitionTime) { s.phase = "no-ignition"; s.extinctionTime ??= s.t; }
  // HotUntil is now derived from thermal state, not an unconditional re-ignition timer.
  s.hotUntil = s.surfaceTempC > 100 ? s.t + 1 : s.t;
  readouts(s, input, dt);
  s.transportFrames.push({ t: s.t, forcedMs: s.uForcedMs, chemicalW: s.chemicalHrrW, smokeKgS: s.smokeRateKgS, countUm: s.smokeCountMeanUm, tempK: s.room.tempK, pressureKpa: s.pressureKpa });
  // Two minutes at the integration resolution; batch results do not need an unbounded trace.
  if (s.transportFrames.length > 960) s.transportFrames.splice(0, s.transportFrames.length - 960);
}

function readouts(s: FireState, input: FireInput, dt: number) {
  const n = gasMoles(s.room);
  s.pressureKpa = gasPressure(s.room);
  s.o2Pct = s.room.o2 / n * 100; s.o2KpaPartial = s.o2Pct / 100 * s.pressureKpa;
  s.localO2Pct = s.local.o2 / gasMoles(s.local) * 100;
  s.vaporFuelKg = s.local.vapor * 0.1;
  s.co2RisePct = Math.max(0, s.room.co2 / n * 100 - s.co2BaselinePpm / 1e4);
  s.co2RiseMmHg = s.co2RisePct / 100 * s.pressureKpa * 7.50062;
  s.co2TotalMmHg = s.room.co2 / n * s.pressureKpa * 7.50062;
  s.coPpm = s.room.co / n * 1e6; s.tempC = s.room.tempK - 273.15; s.nearFireTempC = s.local.tempK - 273.15;
  s.smokeMgM3 = (s.room.smokeKg + s.local.smokeKg + s.room.aerosolFuelKg + s.local.aerosolFuelKg) * 1e6 / input.roomVolumeM3;
  const plumeSpeed = input.gravityG > 0 && s.chemicalHrrW > 0 ? 0.96 * Math.cbrt(input.gravityG * s.chemicalHrrW / 1000 / Math.max(0.2, input.roomHeightM - input.fireHeightM)) : 0;
  s.ri = input.gravityG * G0 * Math.max(0, s.local.tempK - s.room.tempK) / s.room.tempK * 0.1 / Math.max(1e-9, s.uForcedMs ** 2);
  s.stratification = plumeSpeed ** 2 / (plumeSpeed ** 2 + s.uForcedMs ** 2 + 1e-9);
  const emit = s.chemicalHrrW > 1;
  if (input.gravityG > 0 && emit) {
    const density = s.pressureKpa * 1000 * 0.029 / (GAS_R * s.room.tempK);
    const entrain = 0.071 * Math.cbrt(input.gravityG * s.chemicalHrrW * (1 - input.material.radiativeFraction.value) / 1000) * Math.max(0, s.layerHeightM - input.fireHeightM) ** (5 / 3);
    s.layerHeightM -= entrain / density / input.roomFloorAreaM2 * dt;
  }
  s.layerHeightM += (input.roomHeightM - s.layerHeightM) * -Math.expm1(-(2 * s.ventFlowM3s / input.roomVolumeM3 + (emit ? 0 : 1 / 300)) * dt);
  s.layerHeightM = clamp(s.layerHeightM, Math.min(input.fireHeightM, input.roomHeightM * 0.3), input.roomHeightM);
  const count = input.material.smokeCountMeanUm.value, mass = input.material.smokeMassMeanUm.value;
  s.smokeCountMeanUm = count[0] + (count[1] - count[0]) * clamp(s.t / 720, 0, 1);
  s.smokeMassMeanUm = mass[0] + (mass[1] - mass[0]) * clamp(s.t / 720, 0, 1);
  for (const location of s.detectorLocations) {
    const metadata = input.spatial?.detectors.find(d => d.id === location.id);
    const distance = metadata?.distanceM ?? input.detectorDistanceM;
    const byFlow = s.uForcedMs > 0.001 && (metadata?.downstream ?? true) ? distance / s.uForcedMs : Infinity;
    const byPlume = plumeSpeed > 0 ? (input.roomHeightM - input.fireHeightM + distance) / plumeSpeed : Infinity;
    const diffusion = brownianDiffusivity(s.smokeCountMeanUm * 1e-6, s.room.tempK, s.pressureKpa);
    location.transportS = Math.min(byFlow, byPlume, distance * distance / (6 * diffusion));
    const gate = clamp(s.t / Math.max(0.25, location.transportS) - 0.5, 0, 1);
    const k = -Math.expm1(-dt / Math.max(1, location.transportS / 2));
    location.smokeMgM3 += (s.smokeMgM3 * gate - location.smokeMgM3) * k;
    // CO is a gas, whose molecular diffusion is much faster than aerosol Brownian motion.
    const gasTravel = Math.min(byFlow, byPlume, distance * distance / (6 * 2e-5));
    location.coPpm += (s.coPpm - location.coPpm) * -Math.expm1(-dt / Math.max(1, gasTravel));
    const scatter = clamp((s.smokeMassMeanUm / 0.3) ** 3, 0.02, 1.5);
    const ion = clamp(s.smokeCountMeanUm / 0.2 / (s.smokeMassMeanUm / 0.3) ** 3, 0.05, 8);
    const radiation = input.fuel.enclosed ? 0 : s.chemicalHrrW * input.material.radiativeFraction.value / (4 * Math.PI * Math.max(distance, 0.5) ** 2);
    const raw: Record<SensorId, number> = { photoelectric: location.smokeMgM3 * scatter, ionization: location.smokeMgM3 * ion, "two-moment": location.smokeMgM3, "uv-ir": radiation, "gas-co": location.coPpm };
    for (const sensor of FIRE_SENSORS) {
      const cell = location.sensors[sensor.id];
      cell.signal += (raw[sensor.id] - cell.signal) * -Math.expm1(-dt / sensor.responseS);
      if (!cell.alarmed && input.sensors.includes(sensor.id) && cell.signal >= sensor.threshold.value) {
        cell.alarmed = true; cell.alarmTime = s.t;
        log(s, "detection", `${sensor.name} alarm at ${location.id} (assumed instrument calibration).`, "model"); s.firstAlarmTime ??= s.t;
      }
    }
  }
  const best = s.detectorLocations.reduce((a, b) => a.smokeMgM3 > b.smokeMgM3 ? a : b);
  s.detectorSmokeMgM3 = best.smokeMgM3; s.detectorCoPpm = best.coPpm; s.transportS = best.transportS;
  for (const sensor of FIRE_SENSORS) {
    const cells = s.detectorLocations.map(d => d.sensors[sensor.id]);
    s.sensors[sensor.id] = { signal: Math.max(...cells.map(c => c.signal)), alarmed: cells.some(c => c.alarmed), alarmTime: cells.filter(c => c.alarmTime !== null).reduce<number | null>((t, c) => t === null ? c.alarmTime : Math.min(t, c.alarmTime!), null) };
  }
  updateFlame(s, input);
}

function updateFlame(s: FireState, input: FireInput) {
  const f = s.flame;
  if (s.phase !== "flaming" || s.chemicalHrrW < 0.1) {
    f.kind = s.surfaceTempC > 100 ? "glow" : "none"; f.lengthM = 0; f.widthM = 0; f.flickerHz = 0; return;
  }
  const diameter = Math.sqrt(4 * Math.max(s.burningAreaM2, input.ignition.areaM2) / Math.PI);
  const buoyant = buoyantFlameVelocity(input.gravityG, diameter);
  const density = input.pressureKpa * 1000 * 0.029 / (GAS_R * (input.ambientC + 273.15));
  const g = input.gravityG * G0;
  const qStar = g > 0 ? s.chemicalHrrW / (density * 1005 * (input.ambientC + 273.15) * Math.sqrt(g * diameter) * diameter * diameter) : 0;
  const length = g > 0 ? diameter * (3.7 * qStar ** 0.4 - 1.02) : 0;
  f.kind = g > 0 && buoyant > s.uForcedMs * 0.6 ? "plume" : "dome";
  f.lengthM = f.kind === "plume" ? clamp(length, diameter * 0.4, input.roomHeightM - input.fireHeightM) : Math.max(diameter, s.pyroLengthM);
  f.widthM = Math.max(0.025, s.pyroWidthM, diameter * 0.5);
  f.standoffM = clamp(0.008 * Math.sqrt(0.2 / Math.max(s.uBaseMs, 0.005)), 0.004, 0.05);
  f.tiltRad = Math.atan2(s.uForcedMs, Math.max(buoyant, 1e-6));
  // Fuel soot tendency, local oxygen and residence time control appearance. RGB is illustrative.
  const residence = 0.05 / Math.max(0.01, s.uBaseMs);
  const soot = input.material.sootYield.value * (1 + 0.5 * Math.min(2, residence));
  f.blueFraction = clamp(1 - soot / 0.035, 0.05, 0.9);
  f.flickerHz = g > 0 ? 0.48 * Math.sqrt(g / diameter) : 0;
}

export interface ScheduledAction { t: number; id: SuppressionId; }
export interface FireSample {
  t: number; hrrW: number; o2Pct: number; tempC: number; coPpm: number; co2RiseMmHg: number;
  smokeMgM3: number; detectorSmokeMgM3: number; layerHeightM: number;
}
export function sample(s: FireState): FireSample { return { t: s.t, hrrW: s.hrrW, o2Pct: s.o2Pct, tempC: s.tempC, coPpm: s.coPpm, co2RiseMmHg: s.co2RiseMmHg, smokeMgM3: s.smokeMgM3, detectorSmokeMgM3: s.detectorSmokeMgM3, layerHeightM: s.layerHeightM }; }
export interface FireRun { state: FireState; history: FireSample[]; timeToCo24h: number | null; timeToCo1h: number | null; timeToCo2Limit: number | null; }
export function runFire(input: FireInput, options: { durationS: number; dt?: number; actions?: ScheduledAction[]; sampleEveryS?: number; stopWhenOut?: boolean }): FireRun {
  const dt = options.dt ?? 0.25, every = options.sampleEveryS ?? 5;
  if (![dt, every, options.durationS].every(Number.isFinite) || dt <= 0 || every <= 0 || options.durationS < 0) throw new RangeError("Invalid simulation horizon or time step.");
  const s = createFireState(input), history = [sample(s)];
  const pending = [...options.actions ?? []].sort((a, b) => a.t - b.t);
  if (pending.some(a => !Number.isFinite(a.t) || a.t < 0)) throw new RangeError("Action time must be nonnegative and finite.");
  let next = every;
  while (s.t < options.durationS - 1e-9) {
    while (pending.length && pending[0].t <= s.t + 1e-9) applyAction(s, input, pending.shift()!.id);
    const step = Math.min(dt, options.durationS - s.t, pending.length ? pending[0].t - s.t : Infinity, next - s.t);
    if (step > 1e-9) stepFire(s, input, step);
    if (s.t >= next - 1e-9) { history.push(sample(s)); next += every; }
  }
  while (pending.length && pending[0].t <= s.t + 1e-9) applyAction(s, input, pending.shift()!.id);
  if (history.at(-1)!.t < s.t) history.push(sample(s));
  // Kept for legacy callers; these are instantaneous reference crossings, never exposure verdicts.
  return { state: s, history, timeToCo24h: history.find(p => p.coPpm >= 100)?.t ?? null, timeToCo1h: history.find(p => p.coPpm >= 425)?.t ?? null, timeToCo2Limit: history.find(p => p.co2RiseMmHg >= 3)?.t ?? null };
}
