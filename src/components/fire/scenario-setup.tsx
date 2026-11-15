"use client";

import { useSyncExternalStore } from "react";
import { FIRE_MATERIALS, materialById } from "@/data/fire/materials";
import { IGNITION_SOURCES } from "@/data/fire/options";
import { objectById, roomsForHabitat } from "@/data/habitat-interiors";
import { fuelPackageFor } from "@/lib/fire/scenario";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

const field =
  "mt-1.5 min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";

/** Materials whose flaming chemistry the model resolves. The rest heat and release vapor only. */
const FLAMING_PROFILES = ["pmma", "sibal", "paper", "ldpe-wire"];

const EXAMPLES: Array<{ label: string; materialId: string; ignitionId: string }> = [
  { label: "Acrylic ignition", materialId: "pmma", ignitionId: "hot-wire" },
  { label: "Bedding fabric", materialId: "sibal", ignitionId: "hot-wire" },
  { label: "Overheated wire", materialId: "kapton", ignitionId: "overheated-component" },
];

type FlowOrientation = "concurrent" | "opposed" | "crossflow";

const subscribeToHydration = () => () => {};

/**
 * What burns, where, and what lights it. One editor shared by the habitat
 * scenario (compact) and the gravity comparison page.
 */
export function ScenarioSetup({ compact = false }: { compact?: boolean }) {
  // Native selects can otherwise accept changes before React attaches onChange.
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const mission = useMissionStore();
  const sim = useFireSimStore();
  const rooms = roomsForHabitat(mission.scenario.missionId);
  const locked = sim.status !== "idle";
  const object = objectById(locked ? sim.activeObjectId : mission.selectedObjectId);
  const pack = object ? fuelPackageFor(object) : null;
  const material = materialById(sim.config.materialId ?? pack?.materialId ?? "pmma");

  function applyExample(materialId: string, ignitionId: string) {
    const room = rooms.find((item) => item.equipment.some((equipment) => equipment.type === "bench")) ?? rooms[0];
    const item = room?.equipment.find((equipment) => equipment.type === "bench") ?? room?.equipment[0];
    if (item) mission.selectObject(item.id);
    sim.patchConfig({ materialId, ignitionId });
  }

  function selectOrigin(objectId: string) {
    // Selecting equipment resets the fuel choice; keep what the user already chose.
    const { materialId, ignitionId } = sim.config;
    mission.selectObject(objectId);
    sim.patchConfig({ materialId, ignitionId });
  }

  return (
    <div className="space-y-4">
      {!locked ? (
        <div>
          <p className="mb-2 text-[13px] text-muted-foreground">Start from an example, or choose your own setup.</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example.materialId}
                type="button"
                disabled={!hydrated}
                onClick={() => applyExample(example.materialId, example.ignitionId)}
                className="min-h-10 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:border-primary hover:bg-elev-3"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-3", compact ? "" : "sm:grid-cols-2 xl:grid-cols-4")}>
        <label className="text-sm text-foreground">
          Where it starts
          <select
            aria-label={compact ? "Fire origin" : "Forecast origin"}
            disabled={locked || !hydrated}
            className={field}
            value={object?.id ?? ""}
            onChange={(event) => selectOrigin(event.target.value)}
          >
            <option value="">Choose a room and equipment</option>
            {rooms.map((room) => (
              <optgroup key={room.id} label={room.name}>
                {room.equipment.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="text-sm text-foreground">
          Material
          <select
            aria-label={compact ? "Material" : "Prediction material"}
            disabled={locked || !hydrated}
            className={field}
            value={material.id}
            onChange={(event) => sim.patchConfig({ materialId: event.target.value })}
          >
            {FIRE_MATERIALS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-foreground">
          Heat source
          <select
            aria-label={compact ? "Ignition source" : "Prediction ignition source"}
            disabled={locked || !hydrated}
            className={field}
            value={sim.config.ignitionId ?? pack?.defaultIgnitionId ?? "hot-wire"}
            onChange={(event) => sim.patchConfig({ ignitionId: event.target.value })}
          >
            {IGNITION_SOURCES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-foreground">
          Airflow relative to the fuel
          <select
            aria-label="Flow orientation"
            disabled={locked || !hydrated}
            className={field}
            value={sim.config.flowOrientation ?? "concurrent"}
            onChange={(event) => sim.patchConfig({ flowOrientation: event.target.value as FlowOrientation })}
          >
            <option value="concurrent">Along the flame spread</option>
            <option value="opposed">Against the flame spread</option>
            <option value="crossflow">Across the fuel</option>
          </select>
        </label>
      </div>

      <p className="text-[13px] leading-5 text-muted-foreground">
        {pack
          ? `${pack.label}, ${(pack.widthM * 100).toFixed(0)} × ${(pack.lengthM * 100).toFixed(0)} cm, ${
              pack.enclosed ? "inside an enclosure" : "open to the cabin"
            }. Dimensions are conceptual. `
          : "Select equipment in the habitat or use an example. "}
        {FLAMING_PROFILES.includes(material.id)
          ? "Combustion chemistry uses the nominal polymer composition."
          : "For this material the model resolves heating and vapor release only; its flaming chemistry is not modeled."}
      </p>
    </div>
  );
}
