import type {
  EquipmentId,
  FuelCategory,
  MissionId,
  ResearchObjective,
} from "@/types/domain";

export type Vec3 = [number, number, number];
export type NavigationMode =
  "orbit" | "cutaway" | "interior" | "floor" | "equipment";
export type EquipmentType =
  | "rack"
  | "cabinet"
  | "duct"
  | "filter"
  | "detector"
  | "oxygen"
  | "extinguisher"
  | "bench"
  | "samples"
  | "bed"
  | "emergency"
  | "door"
  | "light";
export interface EquipmentProfile {
  label: string;
  system: EquipmentId;
  objective: ResearchObjective;
  description: string;
  /** Display names of the related programs. */
  families: string[];
  /** Ids of related records in src/data/research/investigations.ts. */
  investigations: string[];
  parameters: string[];
  limitation: string;
  material?: FuelCategory;
}
// Research links are topical. They do not imply that this conceptual hardware was tested.
export const EQUIPMENT_PROFILES: Record<EquipmentType, EquipmentProfile> = {
  rack: {
    label: "Equipment rack",
    system: "laboratory",
    objective: "habitat-fire-safety",
    description:
      "Instrument drawers, power distribution and a monitoring display.",
    families: ["Saffire","Wire fires in partial gravity"],
    investigations: ["saffire-vi","partial-gravity-wires","iss-fire-detection-suppression","fine-water-mist"],
    parameters: ["sample geometry", "oxygen", "airflow"],
    limitation:
      "The rack is conceptual. Evidence on wire and rack fires comes from other hardware and atmospheres.",
  },
  cabinet: {
    label: "Storage cabinet",
    system: "material-storage",
    objective: "solid-material-flammability",
    description:
      "Sealed, restrained containers for polymer, fabric and composite supplies.",
    families: ["BASS-II","White Sands flammability limits","Saffire"],
    investigations: ["bass-ii","wstf-flammability-limits","nasa-std-6001","saffire-vi"],
    parameters: ["material", "sample geometry", "oxygen", "pressure"],
    limitation:
      "Contents are illustrative. Material-scale results do not establish how an enclosure burns.",
    material: "solid-polymer",
  },
  duct: {
    label: "Ventilation duct",
    system: "ventilation",
    objective: "flame-spread",
    description:
      "Supply duct, intake grille and direction arrows for the selected cabin airflow.",
    families: ["BASS-II","Saffire","SAME-2"],
    investigations: ["bass-ii","saffire-iv-v","same-2","iss-fire-detection-suppression"],
    parameters: ["airflow", "gravity", "oxygen"],
    limitation:
      "Arrows show an assumed flow direction, not a computed flow field.",
  },
  filter: {
    label: "Air processing unit",
    system: "ventilation",
    objective: "detector-aerosol",
    description: "Replaceable filter cartridges and a circulation fan.",
    families: ["SAME-2","Fire signatures and detection"],
    investigations: ["same-2","fire-detection-research","cabin-atmosphere-limits","iss-fire-detection-suppression"],
    parameters: ["particle diameter", "airflow", "detector response"],
    limitation:
      "No filtration efficiency or cabin aerosol transport has been measured for this conceptual unit.",
  },
  detector: {
    label: "Smoke detector",
    system: "smoke-detection",
    objective: "smoke-detection",
    description:
      "Ceiling aerosol sensing head connected to the conceptual monitoring system.",
    families: ["SAME","SAME-2","Saffire VI"],
    investigations: ["same-2","same","fire-detection-research","saffire-vi","iss-fire-detection-suppression"],
    parameters: [
      "particle diameter",
      "number density",
      "detector response",
      "airflow",
    ],
    limitation:
      "Detector thresholds and response times in the model are assumed, not calibrated to flight hardware.",
  },
  oxygen: {
    label: "Oxygen control panel",
    system: "airlock-oxygen",
    objective: "oxygen-enriched-atmospheres",
    description:
      "Cabin oxygen, total pressure and oxygen partial-pressure readout.",
    families: ["Exploration atmospheres","White Sands flammability limits","Saffire VI"],
    investigations: ["exploration-atmospheres","wstf-flammability-limits","saffire-vi","cabin-atmosphere-limits"],
    parameters: ["oxygen", "pressure", "oxygen partial pressure"],
    limitation:
      "Scenario inputs are research conditions, not approved atmosphere settings.",
  },
  extinguisher: {
    label: "Fire extinguisher",
    system: "fire-suppression",
    objective: "extinction-suppression",
    description:
      "Restrained portable suppression bottle with valve, hose and bracket.",
    families: ["Fine water mist extinguisher","ISS fire detection and suppression","FLEX"],
    investigations: ["fine-water-mist","iss-fire-detection-suppression","flex","saffire-iv-v"],
    parameters: ["extinction limit", "oxygen", "gravity"],
    limitation:
      "Agent delivery and capture in the model are assumed. Published extinction times belong to the tested configurations.",
  },
  bench: {
    label: "Research workbench",
    system: "laboratory",
    objective: "flame-spread",
    description:
      "Work surface with a sample fixture, monitor and instrument enclosure.",
    families: ["BASS-II","Saffire"],
    investigations: ["bass-ii","saffire-vi","saffire-iv-v","lunar-martian-flammability"],
    parameters: ["sample geometry", "flame spread", "oxygen", "airflow"],
    limitation:
      "The workbench is conceptual. Its fuel package is a representative sample, not a tested article.",
  },
  samples: {
    label: "Material sample rack",
    system: "material-storage",
    objective: "solid-material-flammability",
    description:
      "Labeled polymer coupons, fabric strips and composite samples in restrained holders.",
    families: ["BASS","BASS-II","White Sands flammability limits"],
    investigations: ["bass-ii","bass","wstf-flammability-limits","exploration-atmospheres","nasa-std-6001"],
    parameters: [
      "sample geometry",
      "oxygen",
      "pressure",
      "flame spread",
      "mass loss",
    ],
    limitation:
      "Sample materials are representative. A material-scale result cannot by itself predict a habitat fire.",
    material: "solid-polymer",
  },
  bed: {
    label: "Crew sleeping station",
    system: "living-quarters",
    objective: "solid-material-flammability",
    description:
      "Crew berth, fabric bedding, restraint straps and a personal reading light.",
    families: ["Saffire","BASS-II"],
    investigations: ["saffire-vi","saffire-i-iii","bass-ii","nasa-std-6001"],
    parameters: ["fabric", "sample geometry", "oxygen"],
    limitation:
      "Bedding is illustrative. No tested composition or certified flammability rating is asserted.",
    material: "solid-fabric",
  },
  emergency: {
    label: "Emergency panel",
    system: "fire-suppression",
    objective: "extinction-suppression",
    description: "Conceptual isolation, alarm and suppression controls.",
    families: ["ISS fire detection and suppression","Fine water mist extinguisher"],
    investigations: ["iss-fire-detection-suppression","fine-water-mist","saffire-iv-v","cabin-atmosphere-limits"],
    parameters: ["oxygen", "extinction limit", "gravity"],
    limitation:
      "This panel is conceptual and does not define an operational emergency procedure.",
  },
  door: {
    label: "Airlock door",
    system: "airlock-oxygen",
    objective: "oxygen-enriched-atmospheres",
    description:
      "Pressure hatch, wheel, frame and viewport beside an open inspection passage.",
    families: ["Exploration atmospheres","White Sands flammability limits"],
    investigations: ["exploration-atmospheres","wstf-flammability-limits","cabin-atmosphere-limits"],
    parameters: ["pressure", "oxygen", "material"],
    limitation:
      "Pressure geometry and seals are illustrative and are not structurally analyzed.",
  },
  light: {
    label: "Lighting fixture",
    system: "living-quarters",
    objective: "habitat-fire-safety",
    description: "Low-profile room lighting with an enclosed power connection.",
    families: ["Wire fires in partial gravity","Saffire"],
    investigations: ["partial-gravity-wires","nasa-std-6001","saffire-vi"],
    parameters: ["material", "oxygen"],
    limitation:
      "The fixture is conceptual. Electrical ignition is represented only by the model's generic heat sources.",
  },
};
export interface InteriorEquipment extends EquipmentProfile {
  id: string;
  habitatId: MissionId;
  roomId: string;
  type: EquipmentType;
  position: Vec3;
  rotation: number;
  scale: number;
}
export interface HabitatRoomConfig {
  id: string;
  habitatId: MissionId;
  name: string;
  level: number;
  system: EquipmentId;
  position: Vec3;
  size: Vec3;
  color: string;
  round?: boolean;
  moduleName?: string;
  equipment: InteriorEquipment[];
}
type Placement = [
  EquipmentType,
  number,
  number,
  number,
  number?,
  number?,
  string?,
];
function room(
  habitatId: MissionId,
  slug: string,
  name: string,
  level: number,
  system: EquipmentId,
  position: Vec3,
  size: Vec3,
  color: string,
  placements: Placement[],
  extra: Partial<HabitatRoomConfig> = {},
): HabitatRoomConfig {
  const id = `${habitatId}-${slug}`;
  return {
    id,
    habitatId,
    name,
    level,
    system,
    position,
    size,
    color,
    ...extra,
    equipment: placements.map(
      ([type, x, y, z, rotation = 0, scale = 1, label], index) => ({
        ...EQUIPMENT_PROFILES[type],
        label: label ?? EQUIPMENT_PROFILES[type].label,
        id: `${id}-${type}-${index}`,
        habitatId,
        roomId: id,
        type,
        position: [x, y, z],
        rotation,
        scale,
      }),
    ),
  };
}
export const HABITAT_ROOMS: HabitatRoomConfig[] = [
  room(
    "lunar-habitat",
    "lab",
    "Laboratory",
    1,
    "laboratory",
    [1.55, 0.5, -0.7],
    [2.65, 2.35, 3.1],
    "#8AAEB6",
    [
      ["bench", 0, 0, -0.9, 0, 0.85],
      ["samples", -0.75, 0, 0.65, 0, 0.75],
      ["rack", 0.8, 0, -0.75, 0, 0.65],
      ["detector", 0.4, 2.05, -0.3],
      ["light", 0, 2.15, -0.9, 0, 0.8],
    ],
  ),
  room(
    "lunar-habitat",
    "storage",
    "Material storage",
    1,
    "material-storage",
    [-1.5, 0.5, -1.4],
    [2.7, 2.35, 2.1],
    "#BDA578",
    [
      ["cabinet", -0.65, 0, -0.4, 0, 0.8],
      ["samples", 0.55, 0, -0.35, 0, 0.8],
      ["extinguisher", -0.95, 0.2, 0.6],
      ["light", 0, 2.1, -0.3],
    ],
  ),
  room(
    "lunar-habitat",
    "eclss",
    "Environmental control",
    1,
    "ventilation",
    [-1.65, 0.5, 0.8],
    [2.1, 2.35, 1.9],
    "#95AA90",
    [
      ["filter", -0.45, 0, -0.25, 0, 0.75],
      ["duct", 0.15, 1.7, -0.35, 0, 0.8],
      ["emergency", 0.55, 0.5, -0.5, 0, 0.75],
    ],
  ),
  room(
    "lunar-habitat",
    "airlock",
    "Airlock",
    1,
    "airlock-oxygen",
    [0, 0.5, 2.5],
    [2.1, 2.35, 1.8],
    "#B0A899",
    [
      ["door", 0, 0, -0.7, 0, 0.8, "Interior pressure hatch"],
      ["oxygen", 0.7, 0.6, 0.4, 0, 0.75],
      ["extinguisher", -0.75, 0.15, 0.35],
      ["emergency", -0.65, 1.1, -0.55, 0, 0.65],
    ],
  ),
  room(
    "lunar-habitat",
    "crew",
    "Crew quarters",
    2,
    "living-quarters",
    [0, 3.05, -0.65],
    [3.7, 1.65, 2.7],
    "#A49CB5",
    [
      ["bed", -0.95, 0, -0.1, 0, 0.75],
      ["bed", 0.95, 0, -0.1, 0, 0.75],
      ["cabinet", 0, 0, -0.9, 0, 0.65, "Personal lockers"],
      ["oxygen", 0, 0.65, -1, 0, 0.65],
      ["light", 0.85, 1.3, -0.5, 0, 0.7],
      ["bench", 0, 0, 0.65, 0, 0.5, "Crew workstation"],
    ],
  ),
  room(
    "mars-habitat",
    "airlock",
    "Airlock & storage",
    1,
    "airlock-oxygen",
    [0, 0.5, 0],
    [5.6, 2.7, 5.6],
    "#BDA578",
    [
      ["door", 0, 0, -2.15, 0, 1, "Interior airlock hatch"],
      ["door", 0, 0, 2.25, 0, 0.8, "Exterior airlock hatch"],
      ["cabinet", -1.5, 0, -0.9],
      ["samples", 1.4, 0, -0.9],
      ["oxygen", 1.6, 0.7, 0.8],
      ["extinguisher", -1.65, 0.15, 1.1],
      ["emergency", -1.65, 1.2, 0.45],
      ["light", 0, 2.5, -1.2],
    ],
    { round: true },
  ),
  room(
    "mars-habitat",
    "lab",
    "Laboratory",
    2,
    "laboratory",
    [0, 3.7, 0],
    [5.8, 2.8, 5.8],
    "#8AAEB6",
    [
      ["bench", -0.9, 0, -1.55],
      ["bench", 1.35, 0, -1.1, -0.35],
      ["rack", -1.75, 0, 0.1],
      ["samples", 1.35, 0, 0.75],
      ["detector", 0.2, 2.45, -0.4],
      ["extinguisher", -1.55, 0.15, 1.3],
      ["duct", 0, 2.2, -1.6],
      ["light", 0, 2.55, 0.2],
    ],
    { round: true },
  ),
  room(
    "mars-habitat",
    "crew",
    "Crew quarters",
    3,
    "living-quarters",
    [0, 7.1, 0],
    [5.1, 2.8, 5.1],
    "#A49CB5",
    [
      ["bed", -1.25, 0, -0.5, 0, 0.9],
      ["bed", 1.25, 0, -0.5, 0, 0.9],
      ["cabinet", -1.1, 0, -1.55, 0, 0.8, "Personal lockers"],
      ["bench", 0.55, 0, 1.05, 0, 0.7, "Shared crew workstation"],
      ["oxygen", 1, 0.75, -1.6, 0, 0.75],
      ["detector", 0, 2.4, -0.4],
      ["light", 0, 2.5, 0],
      ["extinguisher", -1.75, 0.15, 0.9],
    ],
    { round: true },
  ),
  room(
    "mars-habitat",
    "eclss",
    "Environmental control",
    4,
    "ventilation",
    [0, 10.6, 0],
    [4.1, 2.45, 4.1],
    "#95AA90",
    [
      ["filter", -0.85, 0, -0.5],
      ["rack", 0.8, 0, -0.8, 0, 0.8],
      ["duct", 0, 1.95, -0.55],
      ["oxygen", 1.15, 0.7, 0.5, 0, 0.7, "Pressure & oxygen monitor"],
      ["emergency", -0.2, 0.55, 0.8],
      ["detector", 0, 2.1, -0.2],
      ["extinguisher", -1.2, 0.15, 0.65],
      ["light", 0, 2.25, -0.8],
    ],
    { round: true },
  ),
  // Named-mesh transforms are resolved at runtime. These are conceptual layouts.
  room(
    "gateway-orbit",
    "halo",
    "HALO · living & systems",
    1,
    "living-quarters",
    [0, -1.3, 3],
    [3.4, 2.65, 5.4],
    "#A49CB5",
    [
      ["bed", -0.9, 0, -0.8, 0, 0.8, "Crew restraint station"],
      ["bench", 0.65, 0, -1.6, 0, 0.7, "Crew workstation"],
      ["filter", -0.95, 0, 1.25, 0, 0.65],
      ["oxygen", 0.9, 0.8, 0.75, 0, 0.75],
      ["duct", 0, 2.25, -0.6, 0, 0.8],
      ["detector", 0.3, 2.2, 0],
      ["extinguisher", 1.1, 0.15, 1.6],
      ["light", 0, 2.35, 0.6],
    ],
    { moduleName: "NG_HALO001" },
  ),
  room(
    "gateway-orbit",
    "ihab",
    "I-Hab · experiment workspace",
    1,
    "laboratory",
    [0, -1.3, 8],
    [3.3, 2.65, 5.4],
    "#8AAEB6",
    [
      ["bench", -0.7, 0, -1.6, 0, 0.8],
      ["rack", 1, 0, -1.4, 0, 0.75],
      ["samples", -0.9, 0, 0.6, 0, 0.8],
      ["cabinet", 1, 0, 0.6, 0, 0.7, "Restrained stowage"],
      ["detector", 0, 2.2, -0.5],
      ["extinguisher", 1.15, 0.2, 1.7],
      ["light", 0, 2.35, 0],
    ],
    { moduleName: "I-Hab" },
  ),
  room(
    "gateway-orbit",
    "passage",
    "Airlock · docking passage",
    1,
    "airlock-oxygen",
    [4, -1.3, 8],
    [2.8, 2.65, 3.6],
    "#BDA578",
    [
      ["door", 0, 0, -1.55, 0, 0.95, "Docking pressure hatch"],
      ["oxygen", 0.85, 0.75, -0.6, 0, 0.75],
      ["cabinet", -0.8, 0, 0.2, 0, 0.65, "Emergency stowage"],
      ["emergency", 0.8, 0.65, 0.7],
      ["extinguisher", -1, 0.15, 1.2],
      ["duct", 0, 2.2, -0.4, 0, 0.7],
      ["light", 0, 2.35, 0.4],
    ],
    { moduleName: "Airlock" },
  ),
];
export function roomsForHabitat(id: MissionId) {
  return HABITAT_ROOMS.filter((item) => item.habitatId === id);
}
export function roomById(id: string | null) {
  return HABITAT_ROOMS.find((item) => item.id === id) ?? null;
}
export function objectById(id: string | null) {
  return (
    HABITAT_ROOMS.flatMap((item) => item.equipment).find(
      (item) => item.id === id,
    ) ?? null
  );
}
export function roomForSystem(mission: MissionId, system: EquipmentId) {
  const rooms = roomsForHabitat(mission);
  return (
    rooms.find((item) => item.system === system) ??
    rooms.find((item) =>
      item.equipment.some((object) => object.system === system),
    ) ??
    null
  );
}
export function levelOffset(level: number, exploded: boolean) {
  return exploded ? (level - 1) * 2.1 : 0;
}
