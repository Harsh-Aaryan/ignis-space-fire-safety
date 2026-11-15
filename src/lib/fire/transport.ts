/** Conservative finite-volume gas network. SI units; ideal-gas, constant-cv closure.
 * NIST TN 1889v1 ch. 2/4. Equal-volume exchange is integrated analytically,
 * so a small cell cannot become negative at a large transport Courant number.
 */
export const GAS_R = 8.314462618;
export const GAS_CV = 20.8;
export interface GasZone {
  o2: number; co2: number; co: number; inert: number; water: number; halon: number; vapor: number;
  smokeKg: number; aerosolFuelKg: number; tempK: number; volumeM3: number;
}
export const gasKeys = ["o2", "co2", "co", "inert", "water", "halon", "vapor"] as const;
export function gasMoles(z: GasZone) { return gasKeys.reduce((n, k) => n + z[k], 0); }
export function gasEnergy(z: GasZone) { return gasMoles(z) * GAS_CV * z.tempK; }
export function gasPressure(z: GasZone) { return gasMoles(z) * GAS_R * z.tempK / z.volumeM3 / 1000; }
/** Adiabatic mixing of a source stream and bypass air at common molar cp.
 * Uses the source's gas temperature AFTER modeled fuel and wall losses. The
 * prescribed duct flow is specified at inlet conditions; hot gas has a different
 * molar density, so volume-weighted temperatures would not conserve enthalpy.
 * No forced flow means there is no defined mixed-mean duct outlet reading.
 */
export function mixedStreamTemperatureK(source: GasZone, inlet: GasZone, sourceFlowM3s: number, inletFlowM3s: number): number | null {
  if (inletFlowM3s <= 0) return null;
  const totalMolarFlow = inletFlowM3s * gasMoles(inlet) / inlet.volumeM3;
  const sourceMolarFlow = Math.max(0, sourceFlowM3s) * gasMoles(source) / source.volumeM3;
  if (totalMolarFlow <= 0) return null;
  const fraction = Math.min(1, sourceMolarFlow / totalMolarFlow);
  return inlet.tempK + fraction * (source.tempK - inlet.tempK);
}
export function makeZone(volumeM3: number, pressureKpa: number, oxygenPct: number, tempK: number, co2Ppm = 400): GasZone {
  const n = pressureKpa * 1000 * volumeM3 / (GAS_R * tempK);
  return { o2: n * oxygenPct / 100, co2: n * co2Ppm / 1e6, co: 0,
    inert: n * (1 - oxygenPct / 100 - co2Ppm / 1e6), water: 0, halon: 0, vapor: 0, smokeKg: 0, aerosolFuelKg: 0, tempK, volumeM3 };
}
export function exchangeGas(a: GasZone, b: GasZone, flowM3s: number, dt: number) {
  if (flowM3s <= 0 || dt <= 0) return;
  const rate = flowM3s * (1 / a.volumeM3 + 1 / b.volumeM3);
  const f = -Math.expm1(-rate * dt);
  const share = a.volumeM3 / (a.volumeM3 + b.volumeM3);
  let ea = gasEnergy(a), eb = gasEnergy(b);
  const heat = (ea - (ea + eb) * share) * f;
  ea -= heat; eb += heat;
  for (const key of [...gasKeys, "smokeKg", "aerosolFuelKg"] as const) {
    const move = (a[key] - (a[key] + b[key]) * share) * f;
    a[key] -= move; b[key] += move;
  }
  a.tempK = ea / (gasMoles(a) * GAS_CV);
  b.tempK = eb / (gasMoles(b) * GAS_CV);
}
/** Internal pressure redistribution transfers the donor's energy with its species. */
export function equaliseGas(a: GasZone, b: GasZone) {
  const ea = gasEnergy(a), eb = gasEnergy(b), total = ea + eb;
  const target = total * a.volumeM3 / (a.volumeM3 + b.volumeM3);
  const delta = ea - target;
  if (Math.abs(delta) < 1e-8) return;
  const from = delta > 0 ? a : b, to = delta > 0 ? b : a;
  const frac = Math.min(1, Math.abs(delta) / gasEnergy(from));
  const toEnergy = gasEnergy(to) + Math.abs(delta);
  for (const key of [...gasKeys, "smokeKg", "aerosolFuelKg"] as const) {
    const move = from[key] * frac; from[key] -= move; to[key] += move;
  }
  to.tempK = toEnergy / (gasMoles(to) * GAS_CV);
}
/** Butler & Mulholland 2004, eqs. 6–7: aerosol diffusion, NOT gas diffusion. */
export function brownianDiffusivity(diameterM: number, tempK: number, pressureKpa: number) {
  const d = Math.max(1e-9, diameterM);
  const meanFreePath = 6.6e-8 * (tempK / 293.15) * 101.325 / pressureKpa;
  const kn = 2 * meanFreePath / d;
  const slip = 1 + kn * (1.142 + 0.558 * Math.exp(-0.999 / kn));
  const viscosity = 1.81e-5 * (tempK / 293.15) ** 0.7;
  return 1.380649e-23 * tempK * slip / (3 * Math.PI * viscosity * d);
}
export function opticalOpacity(smokeKgM3: number, pathM: number, extinctionM2Kg = 7600) {
  // Effective mass extinction is an exploratory soot approximation, not a smoke calibration.
  return -Math.expm1(-Math.max(0, smokeKgM3 * pathM * extinctionM2Kg));
}
