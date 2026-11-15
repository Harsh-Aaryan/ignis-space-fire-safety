import type { FireMaterial } from "@/data/fire/materials";
import { FIRE_CLOSURES } from "@/data/fire/parameters";
/** Element mass fractions. Nominal repeat-unit compositions, not product-grade assays.
 * All other profiles use an explicitly assumed C/H/O surrogate. Halogen/Si/N
 * combustion chemistry is withheld; those profiles remain exploratory heating cases.
 */
export function fuelElements(m: FireMaterial) {
  switch (m.id) {
    case "pmma": return { c: 0.60, h: 0.08, o: 0.32, supported: true };
    case "sibal": case "paper": return { c: 72 / 162, h: 10 / 162, o: 80 / 162, supported: true };
    case "ldpe-wire": return { c: 12 / 14, h: 2 / 14, o: 0, supported: true };
    default: return { c: Math.min(0.75, m.co2Yield.value * 12 / 44), h: 0.06, o: 0.15, supported: false };
  }
}

/** Weight of the 1 g handbook CO yield against the low-flow microgravity ratio.
 * Assumption (model 3.0.0): linear in gravity between the calibrated 0 g ratio and the
 * 1 g handbook yield. No partial-gravity CO measurement exists; lunar and Martian CO is
 * an extrapolation. */
export function handbookCoWeight(gravityG: number) {
  return Math.max(0, Math.min(1, gravityG));
}

/** kg product per kg burned, with carbon, hydrogen and oxygen closure.
 * CO: the low-flow microgravity CO/CO₂ molar ratio where one is calibrated (PMMA, SIBAL;
 * cellulose tissue by transfer), blended toward the 1 g handbook yield with gravity,
 * then raised when the flame zone is oxygen-starved (gain derived from BASS-II).
 * Soot partition remains empirical. `gravityG` defaults to 0 g.
 */
export function reactionYields(m: FireMaterial, localO2Pct: number, options: { gravityG?: number } = {}) {
  const e = fuelElements(m);
  const starved = Math.max(0, Math.min(1, (21 - localO2Pct) / 12));
  const soot = Math.min(e.c * 0.2, m.sootYield.value * (1 + starved));
  const carbon = e.c - soot;
  const handbook = m.coYield1g.value;
  const ratio = m.coCo2LowFlow?.value;
  const lowFlow = ratio === undefined ? handbook : carbon * ratio / (1 + ratio) * 28 / 12;
  const w = handbookCoWeight(options.gravityG ?? 0);
  const co = Math.min(carbon * 28 / 12, (lowFlow * (1 - w) + handbook * w) * (1 + FIRE_CLOSURES.coStarvationGain.value * starved));
  const co2 = Math.max(0, carbon - co * 12 / 28) * 44 / 12;
  const water = e.h * 9;
  const oxygen = Math.max(0, co2 * 32 / 44 + co * 16 / 28 + water * 16 / 18 - e.o);
  const residue = Math.max(0, 1 - e.c - e.h - e.o);
  return { co2, co, water, soot, oxygen, residue, elements: e };
}
