import type { EquipmentId } from "@/types/domain";

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

/** Mars-only names. The equipment ids stay the same in every habitat. */
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
