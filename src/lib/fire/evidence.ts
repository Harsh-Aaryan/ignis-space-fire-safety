import type { FireInput } from "./model";
import { FIRE_MODEL_VERSION } from "@/data/fire/sources";
import { testCoverage } from "./accuracy";
export { FIRE_MODEL_VERSION };
export const MODEL_ASSUMPTIONS = [
  "Conceptual fuel dimensions and free-air volume; HVAC paths approximate the rendered rooms.",
  "Cabin wall heat transfer is assumed: wall capacity 12 kJ/(m² K), gas-to-wall convection 3 + 10√u W/(m² K), structural coupling 0.3 W/(m² K) (parameters.ts).",
  "Thin fuels: a front spreading at a rate fitted to Saffire VI, with burnout behind it at a flux derived from Saffire-II. Thick fuels: a burning region that grows downstream at a fitted rate and burns at a fitted average flux.",
  "Spread, growth and burning flux scale with airflow, pressure and oxygen through assumed boundary-layer forms. Only 0 g, 22–31 % O₂, 54–100 kPa and 20 cm/s are compared with flight data.",
  "Low-flow CO/CO₂ ratios are fitted to Saffire VI. Partial-gravity CO interpolates linearly toward 1 g handbook yields, an assumption.",
  "The still-air oxygen limit of thick acrylic rests on one flight observation (Saffire V-3); the thin-fuel low-flow limit on one ISS thin-sample test. Limits are checked against near-fire oxygen, which includes the flame's own depletion.",
  "Flame feedback is capped at 55 % of the heat released; the near-fire mixing volume is an exploratory closure.",
  "Detector thresholds, response constants and mist capture efficiency need hardware calibration.",
  "Handbook-tagged properties without exact table references remain unverified exploratory inputs.",
  "Other toxic gases and deflagration are not resolved.",
];
export function applicability(input: Pick<FireInput, "material" | "gravityG" | "pressureKpa" | "oxygenPct" | "ventilationMs" | "fuel"> & Partial<Pick<FireInput, "flowOrientation">>) {
  const coverage = testCoverage(input);
  const matchedSummary = coverage.kind === "saffire-vi";
  return {
    status: matchedSummary ? "Comparable Saffire conditions" : "Exploratory / extrapolated",
    reason: coverage.kind === "saffire-vi"
      ? `Sample, atmosphere and airflow lie close to Saffire VI test ${coverage.rowId}, so the held-out errors of the model check apply. Cabin geometry, timing and fan history still differ.`
      : coverage.kind === "flight"
        ? `Conditions match flight test ${coverage.checkId}, which the model does not reproduce (${coverage.summary}). Treat the readings as extrapolated.`
        : input.gravityG > 0
          ? "No cabin-scale partial-gravity fire data exist to compare with; results at this gravity are extrapolated."
          : `${coverage.reason[0].toUpperCase()}${coverage.reason.slice(1)}: no flight comparison applies and results are extrapolated.`,
    independentValidation: false,
    modelVersion: FIRE_MODEL_VERSION,
    sources: input.material.nasaSources,
  };
}
