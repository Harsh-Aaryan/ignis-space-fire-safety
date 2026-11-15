import { FUEL_PACKAGES, materialById, type FuelPackage } from "@/data/fire/materials";
import {
  ignitionById,
  type SaffireBenchmark,
  type SensorId,
  type SuppressionId,
} from "@/data/fire/options";
import {
  roomsForHabitat,
  type EquipmentType,
  type HabitatRoomConfig,
  type InteriorEquipment,
} from "@/data/habitat-interiors";
import { KPA_PER_PSI } from "@/lib/physics/atmosphere";
import type { FireInput } from "@/lib/fire/model";
import type { MissionId, MissionScenario } from "@/types/domain";

export const CFM_PER_M3S = 2118.88;
/** Share of a room's box volume that is free air. Assumption. */
const FREE_VOLUME = 0.7;
/** Share of the room cross-section the ventilation flow moves through. Assumption. */
const AISLE_FRACTION = 0.6;

/** Heights of the conceptual equipment models, m. Mirrors the 3D scene. */
export const EQUIPMENT_HEIGHT: Record<EquipmentType, number> = {
  rack: 1.9,
  cabinet: 1.6,
  duct: 0.4,
  filter: 1.6,
  detector: 0.25,
  oxygen: 0.8,
  extinguisher: 0.8,
  bench: 1.6,
  samples: 1.65,
  bed: 1.1,
  emergency: 0.65,
  door: 2.1,
  light: 0.15,
};

export interface RoomGeometry {
  floorAreaM2: number;
  heightM: number;
  volumeM3: number;
  wallAreaM2: number;
  ventAreaM2: number;
}

export function roomGeometry(room: HabitatRoomConfig): RoomGeometry {
  const [w, h, d] = room.size;
  const floorAreaM2 = room.round ? Math.PI * (w / 2) ** 2 : w * d;
  const perimeter = room.round ? Math.PI * w : 2 * (w + d);
  return {
    floorAreaM2,
    heightM: h,
    volumeM3: floorAreaM2 * h * FREE_VOLUME,
    wallAreaM2: 2 * floorAreaM2 + perimeter * h,
    ventAreaM2: Math.min(w, d) * h * AISLE_FRACTION,
  };
}

export function habitatVolumeM3(missionId: MissionId): number {
  return roomsForHabitat(missionId).reduce((sum, room) => sum + roomGeometry(room).volumeM3, 0);
}

/** Position of the burning fuel in room coordinates. */
export function firePoint(object: InteriorEquipment, room: HabitatRoomConfig): [number, number, number] {
  const pack = FUEL_PACKAGES[object.type];
  const height = object.position[1] + EQUIPMENT_HEIGHT[object.type] * object.scale * pack.heightFraction;
  return [object.position[0], Math.min(height, room.size[1] - 0.25), object.position[2]];
}

/** Nearest smoke detector in the room, or an assumed one in the return duct of the next compartment. */
export function nearestDetector(
  room: HabitatRoomConfig,
  from: [number, number, number],
): { distanceM: number; inRoom: boolean; position: [number, number, number] | null } {
  const detectors = room.equipment.filter((item) => item.type === "detector");
  let best: { distanceM: number; inRoom: boolean; position: [number, number, number] | null } | null = null;
  for (const item of detectors) {
    const distanceM = Math.hypot(
      item.position[0] - from[0],
      item.position[1] - from[1],
      item.position[2] - from[2],
    );
    if (!best || distanceM < best.distanceM) best = { distanceM, inRoom: true, position: item.position };
  }
  if (best) return { ...best, distanceM: Math.max(0.4, best.distanceM) };
  const [w, h, d] = room.size;
  return { distanceM: Math.hypot(w, h, d) + 3, inRoom: false, position: null };
}

export function ventilationCfm(speedMs: number, room: HabitatRoomConfig): number {
  return speedMs * roomGeometry(room).ventAreaM2 * CFM_PER_M3S;
}

export function speedFromCfm(cfm: number, room: HabitatRoomConfig): number {
  return cfm / CFM_PER_M3S / roomGeometry(room).ventAreaM2;
}

export interface FireConfig {
  materialId: string | null;
  ignitionId: string | null;
  sensors: SensorId[];
  autoResponse: boolean;
  crewAgent: SuppressionId | null;
  crewResponseS: number;
  flowOrientation?: "concurrent" | "opposed" | "crossflow";
}

/** Conceptual supply-to-return axis, shared by detector paths and tracers. */
export function roomFlowDirection(room: HabitatRoomConfig): [number, number, number] {
  const z = room.size[2] >= room.size[0];
  const duct = room.equipment.find(e => e.type === "duct");
  const sign = (duct?.position[z ? 2 : 0] ?? -1) <= 0 ? 1 : -1;
  return z ? [0, 0, sign] : [sign, 0, 0];
}

export function fuelPackageFor(object: InteriorEquipment): FuelPackage {
  return FUEL_PACKAGES[object.type];
}

export function buildFireInput(
  scenario: MissionScenario,
  room: HabitatRoomConfig,
  object: InteriorEquipment,
  config: FireConfig,
): FireInput {
  const geometry = roomGeometry(room);
  const pack = fuelPackageFor(object);
  const material = materialById(config.materialId ?? pack.materialId);
  const ignition = ignitionById(config.ignitionId ?? pack.defaultIgnitionId);
  const point = firePoint(object, room);
  const detector = nearestDetector(room, point);
  return {
    gravityG: scenario.gravityG,
    flowOrientation: config.flowOrientation ?? "concurrent",
    baselineCo2Ppm: 400,
    spatial: {
      origin: point, flow: roomFlowDirection(room), size: room.size,
      detectors: room.equipment.filter(e => e.type === "detector").map(e => ({ id: e.id, position: e.position,
        distanceM: Math.max(.4, Math.hypot(...e.position.map((v, i) => v - point[i]))),
        downstream: e.position.reduce((sum, v, i) => sum + (v - point[i]) * roomFlowDirection(room)[i], 0) >= 0 })),
      obstacles: room.equipment.filter(e => e.id !== object.id && ["rack", "cabinet", "bed"].includes(e.type)).map(e => ({ center: [e.position[0], e.position[1] + EQUIPMENT_HEIGHT[e.type] * e.scale / 2, e.position[2]], half: [.3 * e.scale, EQUIPMENT_HEIGHT[e.type] * e.scale / 2, .25 * e.scale] })),
    },
    oxygenPct: scenario.oxygenPct,
    pressureKpa: scenario.pressurePsi * KPA_PER_PSI,
    ambientC: 22,
    ventilationMs: scenario.airflowMs,
    ventAreaM2: geometry.ventAreaM2,
    roomVolumeM3: geometry.volumeM3,
    habitatVolumeM3: Math.max(geometry.volumeM3 + 0.01, habitatVolumeM3(room.habitatId)),
    roomHeightM: geometry.heightM,
    roomFloorAreaM2: geometry.floorAreaM2,
    wallAreaM2: geometry.wallAreaM2,
    fireHeightM: Math.max(0.1, point[1]),
    detectorDistanceM: detector.distanceM,
    material,
    fuel: { widthM: pack.widthM, lengthM: pack.lengthM, sides: pack.sides, enclosed: pack.enclosed },
    ignition,
    igniterSpansWidth: ignition.id === "hot-wire",
    sensors: config.sensors,
    autoResponse: config.autoResponse,
    crewAgent: config.crewAgent,
    crewResponseS: config.crewResponseS,
  };
}

/** A generic compartment for the predictor, when no equipment is selected. */
export function genericFireInput(
  scenario: Pick<MissionScenario, "gravityG" | "oxygenPct" | "pressurePsi" | "airflowMs">,
  materialId: string,
  ignitionId: string,
): FireInput {
  const material = materialById(materialId);
  return {
    gravityG: scenario.gravityG,
    oxygenPct: scenario.oxygenPct,
    pressureKpa: scenario.pressurePsi * KPA_PER_PSI,
    ambientC: 22,
    ventilationMs: scenario.airflowMs,
    ventAreaM2: 3.7,
    roomVolumeM3: 17,
    habitatVolumeM3: 60,
    roomHeightM: 2.4,
    roomFloorAreaM2: 10,
    wallAreaM2: 50,
    fireHeightM: 1.0,
    detectorDistanceM: 2.5,
    material,
    fuel: {
      widthM: material.form === "wire" ? 0.03 : 0.41,
      lengthM: material.form === "thick" ? 0.18 : material.form === "wire" ? 1.0 : 0.5,
      sides: material.form === "thick" ? 2 : 1,
      enclosed: false,
    },
    ignition: ignitionById(ignitionId),
    igniterSpansWidth: ignitionId === "hot-wire",
    sensors: ["photoelectric", "ionization", "two-moment", "uv-ir", "gas-co"],
    autoResponse: false,
    crewAgent: null,
    crewResponseS: 60,
  };
}

/** The Cygnus test conditions of a Saffire flight, as model input. */
export function saffireInput(benchmark: SaffireBenchmark): FireInput {
  return {
    gravityG: 0,
    oxygenPct: benchmark.oxygenPct,
    pressureKpa: benchmark.pressureKpa,
    ambientC: 20,
    ventilationMs: benchmark.flowMs,
    ventilationSchedule: benchmark.ventilationSchedule,
    // The 30 cm by 45 cm Saffire flow duct.
    ventAreaM2: 0.135,
    roomVolumeM3: benchmark.freeVolumeM3,
    habitatVolumeM3: benchmark.freeVolumeM3 + 0.02,
    roomHeightM: 3,
    roomFloorAreaM2: 6,
    wallAreaM2: 50,
    fireHeightM: 1.5,
    detectorDistanceM: 4,
    material: materialById(benchmark.materialId),
    fuel: {
      widthM: benchmark.widthM,
      lengthM: benchmark.lengthM,
      sides: benchmark.materialId === "pmma" ? benchmark.sides : 1,
      enclosed: false,
    },
    ignition: ignitionById("hot-wire"),
    igniterSpansWidth: true,
    sensors: ["photoelectric", "ionization"],
    autoResponse: false,
    crewAgent: null,
    crewResponseS: 60,
  };
}
