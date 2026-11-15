import type { FireState } from "@/lib/fire/model";
import type { MissionId } from "@/types/domain";

/** Shared labels and number formats for the fire scenario views. */

export type FirePhase = FireState["phase"];

export const PHASE_LABEL: Record<FirePhase, string> = {
  heating: "Heating",
  pyrolysis: "Pyrolysis",
  smoldering: "Smouldering",
  flaming: "Flaming",
  extinguished: "Flame out",
  "burned-out": "Burned out",
  "no-ignition": "No ignition",
};

/** One or two plain sentences on what the current phase means. */
export const PHASE_EXPLANATION: Record<FirePhase, string> = {
  heating: "The heat source is warming the fuel surface. Nothing is burning yet.",
  pyrolysis:
    "The heated material is releasing fuel vapor. The vapor can ignite when enough oxygen reaches it and the flame's heat feeds back to the surface.",
  smoldering: "The material is reacting slowly without a flame and is producing smoke.",
  flaming:
    "Fuel vapor is burning. Heat from the flame keeps the material releasing vapor for as long as oxygen reaches it.",
  extinguished: "The flame has stopped. Hot material and combustion gases can remain in the cabin.",
  "burned-out": "The fuel has been consumed. Combustion gases and residual heat remain in the cabin.",
  "no-ignition": "The material did not ignite under these conditions.",
};

/** Text color token for each phase. */
export const PHASE_TONE: Record<FirePhase, string> = {
  heating: "text-status-caution",
  pyrolysis: "text-status-caution",
  smoldering: "text-status-caution",
  flaming: "text-status-warning",
  extinguished: "text-status-nominal",
  "burned-out": "text-muted-foreground",
  "no-ignition": "text-status-nominal",
};

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatPower(watts: number): string {
  return watts >= 1000 ? `${(watts / 1000).toFixed(2)} kW` : `${watts.toFixed(0)} W`;
}

export function habitatName(missionId: MissionId): string {
  if (missionId === "gateway-orbit") return "Gateway";
  if (missionId === "mars-habitat") return "Mars habitat";
  return "Moon habitat";
}

export function habitatCredit(missionId: MissionId): string {
  if (missionId === "gateway-orbit") return "NASA Gateway exterior, conceptual interior";
  if (missionId === "mars-habitat") return "Conceptual habitat after AI SpaceFactory MARSHA";
  return "Conceptual habitat after Foster + Partners / ESA";
}

/** "Level 2" on the surface habitats, "Module" on Gateway. */
export function levelLabel(missionId: MissionId, level: number): string {
  return missionId === "gateway-orbit" ? "Module" : `Level ${level}`;
}

/** Shared form-control styling for the side panel. */
export const fieldClass =
  "min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";
