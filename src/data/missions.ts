import { GRAVITY_G } from "@/lib/physics/atmosphere";
import type { MissionId, MissionScenario, ResearchObjective, FuelCategory } from "@/types/domain";

export const GATEWAY_SCENE_LABEL =
  "Gateway-Inspired Lunar Orbit Habitat — Conceptual Digital Twin";

export interface MissionProfile {
  id: MissionId;
  name: string;
  short: string;
  gravityG: number;
  gravityLabel: string;
  summary: string;
  defaults: {
    oxygenPct: number;
    pressurePsi: number;
    airflowMs: number;
    fuelCategory: FuelCategory;
    objective: ResearchObjective;
  };
}

export const MISSIONS: MissionProfile[] = [
  {
    id: "lunar-habitat",
    name: "Lunar Habitat",
    short: "Moon",
    gravityG: GRAVITY_G.moon,
    gravityLabel: "0.165 g",
    summary:
      "Pressurized surface habitat. Cabin oxygen and total pressure are scenario inputs, not the lunar exterior and not an approved cabin specification.",
    defaults: {
      oxygenPct: 32,
      pressurePsi: 10.2,
      airflowMs: 0.05,
      fuelCategory: "solid-polymer",
      objective: "solid-material-flammability",
    },
  },
  {
    id: "mars-habitat",
    name: "Mars Habitat",
    short: "Mars",
    gravityG: GRAVITY_G.mars,
    gravityLabel: "0.38 g",
    summary:
      "Conceptual surface habitat inspired by AI SpaceFactory’s MARSHA. Cabin atmosphere is separate from the thin exterior CO₂ atmosphere. Not an official AI SpaceFactory or NASA design.",
    defaults: {
      oxygenPct: 32,
      pressurePsi: 10.2,
      airflowMs: 0.05,
      fuelCategory: "solid-polymer",
      objective: "solid-material-flammability",
    },
  },
  {
    id: "iss-microgravity",
    name: "ISS / Microgravity Spacecraft",
    short: "ISS",
    gravityG: GRAVITY_G.microgravity,
    gravityLabel: "~0 g",
    summary:
      "Microgravity spacecraft reference. Closest to the gravity regime actually represented in the synthetic runs.",
    defaults: {
      oxygenPct: 21,
      pressurePsi: 14.7,
      airflowMs: 0.15,
      fuelCategory: "aerosol-smoke",
      objective: "smoke-detection",
    },
  },
  {
    id: "lunar-rover",
    name: "Pressurized Lunar Rover",
    short: "Rover",
    gravityG: GRAVITY_G.moon,
    gravityLabel: "0.165 g",
    summary:
      "Small pressurized rover cabin. Same lunar gravity as the habitat, with a tighter airflow and a composite interior.",
    defaults: {
      oxygenPct: 30,
      pressurePsi: 9.5,
      airflowMs: 0.2,
      fuelCategory: "solid-composite",
      objective: "oxygen-enriched-atmospheres",
    },
  },
  {
    id: "gateway-orbit",
    name: GATEWAY_SCENE_LABEL,
    short: "Gateway",
    gravityG: GRAVITY_G.microgravity,
    gravityLabel: "~0 g",
    summary:
      "Conceptual lunar-orbit habitat in microgravity (~0 g), not lunar surface gravity (0.165 g). A research visualization, not certified NASA geometry.",
    defaults: {
      oxygenPct: 32,
      pressurePsi: 10.2,
      airflowMs: 0.05,
      fuelCategory: "solid-polymer",
      objective: "solid-material-flammability",
    },
  },
];

export function missionById(id: MissionId): MissionProfile {
  const mission = MISSIONS.find((item) => item.id === id);
  if (!mission) throw new Error(`Unknown mission ${id}`);
  return mission;
}

export const FIRETWIN_HABITATS: MissionId[] = ["lunar-habitat", "mars-habitat", "gateway-orbit"];

/** Oxygen, pressure, airflow, fuel, and objective carry over. Gravity follows the habitat. */
export function scenarioAfterHabitatSwitch(current: MissionScenario, id: MissionId): MissionScenario {
  const next = scenarioFromMission(id);
  return {
    ...next,
    oxygenPct: current.oxygenPct,
    pressurePsi: current.pressurePsi,
    airflowMs: current.airflowMs,
    fuelCategory: current.fuelCategory,
    objective: current.objective,
  };
}

export function scenarioFromMission(id: MissionId): MissionScenario {
  const mission = missionById(id);
  return {
    missionId: mission.id,
    name: mission.name,
    oxygenPct: mission.defaults.oxygenPct,
    pressurePsi: mission.defaults.pressurePsi,
    gravityG: mission.gravityG,
    airflowMs: mission.defaults.airflowMs,
    fuelCategory: mission.defaults.fuelCategory,
    objective: mission.defaults.objective,
  };
}

export const LUNAR_DEFAULT = scenarioFromMission("lunar-habitat");

export interface Journey {
  id: string;
  code: "A" | "B" | "C";
  title: string;
  summary: string;
  route: string;
  equipment?: "material-storage" | "smoke-detection" | "airlock-oxygen";
  scenario: MissionScenario;
}

export const JOURNEYS: Journey[] = [
  {
    id: "lunar-materials",
    code: "A",
    title: "Lunar material flammability",
    summary:
      "Oxygen-enriched lunar habitat, solid polymers, then the material-storage evidence panel and the ranked BASS-family dossiers.",
    route: "/firetwin",
    equipment: "material-storage",
    scenario: scenarioFromMission("lunar-habitat"),
  },
  {
    id: "smoke-microg",
    code: "B",
    title: "Microgravity smoke detection",
    summary:
      "ISS-like atmosphere and a smoke-detection objective. Explorer rankings shift toward the SAME and DAFT family dossiers.",
    route: "/research",
    equipment: "smoke-detection",
    scenario: scenarioFromMission("iss-microgravity"),
  },
  {
    id: "mars-gaps",
    code: "C",
    title: "Martian habitat research gaps",
    summary:
      "Martian gravity and a fabric-rich cabin. GravityBridge shows an empty partial-gravity band and FireLab drafts studies from that gap.",
    route: "/gravity-bridge",
    scenario: scenarioFromMission("mars-habitat"),
  },
];
