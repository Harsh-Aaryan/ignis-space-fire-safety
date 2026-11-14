import type { FireMaterial } from "@/data/fire/materials";
export const STEFAN_BOLTZMANN = 5.670374419e-8;
export interface SolidState { temperaturesK: number[]; thicknessM: number; densityKgM3: number; conductivityWMK: number; }
export function makeSolid(m: FireMaterial, ambientC: number, edge = false): SolidState {
  const density = m.id === "pmma" ? 1190 : m.form === "wire" ? 920 : 700;
  const thickness = edge ? Math.min(0.001, m.arealFuelKgM2.value / density) : m.arealFuelKgM2.value / density;
  const cp = m.specificHeatKJkgK * 1000;
  // Recover k from the existing effective kρc. This is explicitly assumed for unverified profiles.
  const k = m.thermalInertia.value * 1e6 / (density * cp);
  return { temperaturesK: Array.from({ length: m.form === "thick" && !edge ? 10 : 1 }, () => ambientC + 273.15), thicknessM: thickness, densityKgM3: density, conductivityWMK: k };
}
/** Backward-Euler 1-D finite volumes, insulated back face. Conservative conduction.
 * Radiation/convection use an implicit surface linearization to stay stable for thin films.
 * Returns sensible energy change per m²; latent removal is handled by the caller.
 */
export function heatSolid(s: SolidState, cp: number, fluxWm2: number, gasK: number, surroundingsK: number, h: number, dt: number, emissivity = 0.9) {
  const n = s.temperaturesK.length, dx = s.thicknessM / n;
  const capacity = s.densityKgM3 * cp * dx;
  const cond = s.conductivityWMK / dx;
  const a = new Array<number>(n).fill(0), b = new Array<number>(n).fill(capacity / dt), c = new Array<number>(n).fill(0);
  const rhs = s.temperaturesK.map(t => capacity / dt * t);
  const t = s.temperaturesK[0];
  const hr = emissivity * STEFAN_BOLTZMANN * (t + surroundingsK) * (t * t + surroundingsK * surroundingsK);
  b[0] += h + hr; rhs[0] += fluxWm2 + h * gasK + hr * surroundingsK;
  for (let i = 0; i < n; i++) {
    if (i > 0) { a[i] = -cond; b[i] += cond; }
    if (i < n - 1) { c[i] = -cond; b[i] += cond; }
  }
  for (let i = 1; i < n; i++) { const q = a[i] / b[i - 1]; b[i] -= q * c[i - 1]; rhs[i] -= q * rhs[i - 1]; }
  const old = s.temperaturesK.reduce((sum, value) => sum + value, 0);
  s.temperaturesK[n - 1] = rhs[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) s.temperaturesK[i] = (rhs[i] - c[i] * s.temperaturesK[i + 1]) / b[i];
  return (s.temperaturesK.reduce((sum, value) => sum + value, 0) - old) * capacity;
}
export function thickIgnitionBenchmark(inertiaSI: number, riseK: number, fluxWm2: number) {
  return Math.PI * inertiaSI / 4 * (riseK / fluxWm2) ** 2;
}
