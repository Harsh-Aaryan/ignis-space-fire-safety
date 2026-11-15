import type { FireInput } from "./model";
import { FIRE_MODEL_VERSION } from "@/data/fire/sources";
export { FIRE_MODEL_VERSION };
export const MODEL_ASSUMPTIONS = [
  "Conceptual fuel dimensions and free-air volume; HVAC paths approximate the rendered rooms.",
  "Surface emissivity 0.9; wall capacity 12 kJ/(m² K); ambient wall coupling 0.3 W/(m² K).",
  "Near-source mixing length and heat-feedback efficiency are exploratory closures.",
  "Thick fuels burn at an assumed local rate of 4 g/m²s where the flame is attached; flame feedback is capped at 55% of the heat released.",
  "The still-air oxygen limit of thick acrylic is calibrated to one flight observation (Saffire V-3).",
  "Detector thresholds, response constants and mist capture efficiency need hardware calibration.",
  "Handbook-tagged properties without exact table references remain unverified exploratory inputs.",
  "CO and soot partition are empirical. Other toxic gases and deflagration are not resolved.",
];
export function applicability(input: Pick<FireInput, "material" | "gravityG" | "pressureKpa" | "oxygenPct" | "ventilationMs" | "fuel">) {
  const measuredMaterial = ["pmma", "sibal"].includes(input.material.id);
  const matchedSummary = measuredMaterial && input.gravityG === 0 && input.pressureKpa >= 54 && input.pressureKpa <= 101 && input.oxygenPct >= 21 && input.oxygenPct <= 31.1 && Math.abs(input.ventilationMs - 0.2) < 0.001 && Math.abs(input.fuel.widthM - 0.41) < 0.01;
  return {
    status: matchedSummary ? "Comparable Saffire conditions" : "Exploratory / extrapolated",
    reason: input.gravityG > 0 ? "No matching cabin-scale partial-gravity validation is loaded." : matchedSummary ? "Atmosphere, sample width and initial flow overlap publication summaries; geometry, timing and fan histories still differ." : "Material, atmosphere, flow or geometry differs from the quantitative reference cases.",
    independentValidation: false,
    modelVersion: FIRE_MODEL_VERSION,
    sources: input.material.nasaSources,
  };
}
