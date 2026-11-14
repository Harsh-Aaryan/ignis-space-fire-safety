import type {
  Completeness,
  EquipmentId,
  FuelCategory,
  GapDimension,
  GravityRegime,
  MeasurementType,
  ResearchObjective,
} from "@/types/domain";

export const FUEL_LABEL: Record<FuelCategory, string> = {
  "solid-polymer": "Solid polymer",
  "solid-fabric": "Solid fabric",
  "solid-composite": "Solid composite",
  "liquid-droplet": "Liquid droplet",
  "aerosol-smoke": "Aerosol / smoke",
  "paper-cellulose": "Paper / cellulose",
};

export const OBJECTIVE_LABEL: Record<ResearchObjective, string> = {
  "solid-material-flammability": "Solid-material flammability",
  "flame-spread": "Flame spread",
  "extinction-suppression": "Extinction and suppression",
  "smoke-detection": "Smoke detection",
  "oxygen-enriched-atmospheres": "Oxygen-enriched atmospheres",
  "droplet-combustion": "Droplet combustion",
  "detector-aerosol": "Detector aerosols",
  "habitat-fire-safety": "Habitat fire safety",
};

export const MEASUREMENT_META: Record<
  MeasurementType,
  { label: string; unit: string }
> = {
  "flame-spread-rate": { label: "Flame spread rate", unit: "mm/s" },
  "burn-duration": { label: "Burn duration", unit: "s" },
  "mass-loss-rate": { label: "Mass-loss rate", unit: "mg/s" },
  "soot-volume-fraction": { label: "Soot index", unit: "synthetic index" },
  "smoke-particle-diameter": { label: "Smoke particle diameter", unit: "µm" },
  "smoke-number-density": { label: "Smoke number density", unit: "1/cm³" },
  "detector-response": { label: "Detector response", unit: "AU" },
  "extinction-limit-oxygen": {
    label: "Extinction-limit marker",
    unit: "% O₂",
  },
  "flame-standoff": { label: "Flame standoff", unit: "mm" },
};

export const REGIME_LABEL: Record<GravityRegime, string> = {
  microgravity: "Microgravity (ISS ~0 g)",
  lunar: "Lunar (0.165 g)",
  martian: "Martian (0.38 g)",
  earth: "Earth (1 g)",
  "partial-other": "Other partial gravity",
};

export const COMPLETENESS_LABEL: Record<Completeness, string> = {
  complete: "Complete",
  partial: "Partial",
  sparse: "Sparse",
};

export const EQUIPMENT_LABEL: Record<EquipmentId, string> = {
  "material-storage": "Material storage",
  ventilation: "Ventilation",
  "smoke-detection": "Smoke detection",
  "airlock-oxygen": "Airlock / oxygen",
  "fire-suppression": "Fire suppression",
  laboratory: "Laboratory",
  "living-quarters": "Living quarters",
  shell: "Habitat shell",
};

/** Mars-only names. The equipment ids stay the same so dossier links do not move. */
export const MARS_EQUIPMENT_LABEL: Record<EquipmentId, string> = {
  shell: "Printed shell",
  "airlock-oxygen": "Airlock",
  "material-storage": "Stowage",
  laboratory: "Wet / dry lab",
  ventilation: "ECLSS",
  "living-quarters": "Crew pods",
  "smoke-detection": "Smoke detection",
  "fire-suppression": "Suppression",
};

export const MOON_EQUIPMENT_LABEL: Record<EquipmentId, string> = {
  shell: "Printed mound",
  "airlock-oxygen": "Airlock",
  laboratory: "Lab",
  "material-storage": "Stowage",
  ventilation: "ECLSS",
  "living-quarters": "Crew quarters",
  "smoke-detection": "Smoke detection",
  "fire-suppression": "Suppression",
};

export function equipmentLabel(id: EquipmentId, missionId?: string) {
  if (missionId === "mars-habitat") return MARS_EQUIPMENT_LABEL[id];
  if (missionId === "lunar-habitat") return MOON_EQUIPMENT_LABEL[id];
  return EQUIPMENT_LABEL[id];
}

export const GAP_LABEL: Record<GapDimension, string> = {
  gravity: "Gravity",
  oxygen: "Oxygen",
  pressure: "Pressure",
  fuel: "Fuel",
  airflow: "Airflow",
  measurement: "Measurement",
  metadata: "Metadata",
};

export const OBJECTIVE_MEASUREMENTS: Record<
  ResearchObjective,
  MeasurementType[]
> = {
  "solid-material-flammability": [
    "flame-spread-rate",
    "mass-loss-rate",
    "burn-duration",
  ],
  "flame-spread": ["flame-spread-rate", "flame-standoff"],
  "extinction-suppression": ["extinction-limit-oxygen", "burn-duration"],
  "smoke-detection": [
    "smoke-particle-diameter",
    "smoke-number-density",
    "detector-response",
  ],
  "oxygen-enriched-atmospheres": [
    "flame-spread-rate",
    "extinction-limit-oxygen",
  ],
  "droplet-combustion": [
    "burn-duration",
    "soot-volume-fraction",
    "flame-standoff",
  ],
  "detector-aerosol": [
    "smoke-particle-diameter",
    "detector-response",
    "smoke-number-density",
  ],
  "habitat-fire-safety": [
    "flame-spread-rate",
    "detector-response",
    "extinction-limit-oxygen",
  ],
};

export const RELATED_OBJECTIVES: Record<
  ResearchObjective,
  ResearchObjective[]
> = {
  "solid-material-flammability": [
    "flame-spread",
    "oxygen-enriched-atmospheres",
    "habitat-fire-safety",
  ],
  "flame-spread": ["solid-material-flammability", "oxygen-enriched-atmospheres"],
  "extinction-suppression": ["droplet-combustion", "habitat-fire-safety"],
  "smoke-detection": ["detector-aerosol"],
  "oxygen-enriched-atmospheres": [
    "solid-material-flammability",
    "habitat-fire-safety",
  ],
  "droplet-combustion": ["extinction-suppression"],
  "detector-aerosol": ["smoke-detection"],
  "habitat-fire-safety": [
    "solid-material-flammability",
    "smoke-detection",
    "extinction-suppression",
    "oxygen-enriched-atmospheres",
  ],
};

const SOLID = new Set<FuelCategory>([
  "solid-polymer",
  "solid-fabric",
  "solid-composite",
  "paper-cellulose",
]);

export function fuelsAreRelated(a: FuelCategory, b: FuelCategory): boolean {
  return a === b || (SOLID.has(a) && SOLID.has(b));
}
