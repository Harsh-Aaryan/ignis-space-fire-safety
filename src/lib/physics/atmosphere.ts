/** Shared physical context. These are not measurements from the catalog. */
export const GRAVITY_G = {
  moon: 0.165,
  mars: 0.38,
  microgravity: 0,
  earth: 1,
} as const;

export const KPA_PER_PSI = 6.894757293168361;
export const PA_PER_PSI = 6894.757293168361;

/** Oxygen partial pressure. Fraction is percent / 100. Total pressure is cabin pressure, not the exterior. */
export function oxygenPartialPressurePsi(oxygenPct: number, totalCabinPressurePsi: number): number {
  return (oxygenPct / 100) * totalCabinPressurePsi;
}

export function psiToKpa(psi: number): number {
  return psi * KPA_PER_PSI;
}

/** Millibar (hPa) to psi. Used only for the cited Mars fact-sheet exterior pressure. */
export function mbarToPsi(mbar: number): number {
  return (mbar * 100) / PA_PER_PSI;
}

export const MARS_EXTERIOR = {
  sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
  retrievedAt: "2026-11-12",
  surfacePressureMbar: 6.36,
  statement:
    "NASA Goddard fact sheet: surface pressure 6.36 mb at mean radius (variable from 4.0 to 8.7 mb). This is the exterior atmosphere, not the pressurized cabin.",
} as const;

export const LUNAR_EXTERIOR =
  "The lunar exterior is effectively vacuum. Cabin pressure is not the pressure outside the shell.";
