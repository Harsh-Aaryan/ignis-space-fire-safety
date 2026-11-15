export type MissionId =
  | "lunar-habitat"
  | "mars-habitat"
  | "iss-microgravity"
  | "lunar-rover"
  | "gateway-orbit";

/** Broad fuel class of a piece of equipment. Carried with the cabin scenario. */
export type FuelCategory =
  | "solid-polymer"
  | "solid-fabric"
  | "solid-composite"
  | "liquid-droplet"
  | "aerosol-smoke"
  | "paper-cellulose";

/** The fire-safety question a piece of equipment relates to. Carried with the cabin scenario. */
export type ResearchObjective =
  | "solid-material-flammability"
  | "flame-spread"
  | "extinction-suppression"
  | "smoke-detection"
  | "oxygen-enriched-atmospheres"
  | "droplet-combustion"
  | "detector-aerosol"
  | "habitat-fire-safety";

/** A habitat system, as selectable in the 3D scene. */
export type EquipmentId =
  | "material-storage"
  | "ventilation"
  | "smoke-detection"
  | "airlock-oxygen"
  | "fire-suppression"
  | "laboratory"
  | "living-quarters"
  | "shell";

/** The cabin shared by every section: which habitat, and its atmosphere. */
export interface MissionScenario {
  missionId: MissionId;
  name: string;
  oxygenPct: number;
  pressurePsi: number;
  gravityG: number;
  airflowMs: number;
  fuelCategory: FuelCategory;
  objective: ResearchObjective;
}

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  scenario: MissionScenario;
  notes: string;
}
