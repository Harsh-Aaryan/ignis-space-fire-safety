import type { FireMaterial } from "@/data/fire/materials";
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
/** kg product per kg burned, with carbon, hydrogen and oxygen closure.
 * CO/soot partition is empirical, constrained by elemental inventory; no gravity multiplier.
 */
export function reactionYields(m: FireMaterial, localO2Pct: number) {
  const e = fuelElements(m);
  const starved = Math.max(0, Math.min(1, (21 - localO2Pct) / 12));
  const soot = Math.min(e.c * 0.2, m.sootYield.value * (1 + starved));
  const co = Math.min((e.c - soot) * 28 / 12, m.coYield1g.value * (1 + 5 * starved));
  const co2 = Math.max(0, e.c - soot - co * 12 / 28) * 44 / 12;
  const water = e.h * 9;
  const oxygen = Math.max(0, co2 * 32 / 44 + co * 16 / 28 + water * 16 / 18 - e.o);
  const residue = Math.max(0, 1 - e.c - e.h - e.o);
  return { co2, co, water, soot, oxygen, residue, elements: e };
}
