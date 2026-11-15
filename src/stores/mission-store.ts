"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  objectById,
  roomById,
  roomForSystem,
  roomsForHabitat,
  type NavigationMode,
} from "@/data/habitat-interiors";
import { scenarioAfterHabitatSwitch, scenarioFromMission } from "@/data/missions";
import { scenarioRepository } from "@/services/scenario-repository";
import type { EquipmentId, MissionId, MissionScenario, SavedScenario } from "@/types/domain";

interface Toast {
  id: number;
  message: string;
}

/**
 * The cabin shared by every section, and what is selected in the habitat.
 * The 3D scene reads the selection and view fields every frame.
 */
interface MissionState {
  scenario: MissionScenario;

  selectedEquipment: EquipmentId | null;
  selectedRoomId: string | null;
  selectedObjectId: string | null;
  selectedLevel: number | null;
  navigationMode: NavigationMode;
  hideRoof: boolean;
  hideFrontWalls: boolean;
  cutaway: boolean;
  exploded: boolean;
  marsDusk: boolean;
  cameraResetNonce: number;
  focusNonce: number;

  savedScenarios: SavedScenario[];
  toast: Toast | null;

  selectMission: (id: MissionId) => void;
  /** The optional label is accepted for callers that describe the change; it is not stored. */
  patchScenario: (patch: Partial<MissionScenario>, label?: string) => void;
  resetScenario: () => void;

  selectRoom: (id: string) => void;
  selectObject: (id: string) => void;
  selectEquipment: (id: EquipmentId | null) => void;
  setLevel: (level: number | null) => void;
  navigate: (mode: NavigationMode) => void;
  setHideRoof: (value: boolean) => void;
  setHideFrontWalls: (value: boolean) => void;
  setCutaway: (value: boolean) => void;
  setExploded: (value: boolean) => void;
  setMarsDusk: (value: boolean) => void;
  resetCamera: () => void;

  refreshSaved: () => void;
  saveScenario: (name: string, notes?: string) => void;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  importScenarios: (items: SavedScenario[]) => void;

  notify: (message: string) => void;
  dismissToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** Selection and view state with nothing selected, looking at the exterior. */
const EXTERIOR = {
  selectedEquipment: null,
  selectedRoomId: null,
  selectedObjectId: null,
  selectedLevel: null,
  navigationMode: "orbit" as NavigationMode,
  cutaway: false,
  exploded: false,
};

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      scenario: scenarioFromMission("lunar-habitat"),
      ...EXTERIOR,
      hideRoof: true,
      hideFrontWalls: true,
      marsDusk: false,
      cameraResetNonce: 0,
      focusNonce: 0,
      savedScenarios: [],
      toast: null,

      selectMission: (id) => {
        set({
          scenario: scenarioAfterHabitatSwitch(get().scenario, id),
          ...EXTERIOR,
          cameraResetNonce: get().cameraResetNonce + 1,
        });
      },
      patchScenario: (patch) => set({ scenario: { ...get().scenario, ...patch } }),
      resetScenario: () => {
        set({ scenario: scenarioFromMission("lunar-habitat"), ...EXTERIOR });
        get().notify("Cabin reset to the lunar habitat defaults.");
      },

      selectRoom: (id) => {
        const room = roomById(id);
        if (!room || room.habitatId !== get().scenario.missionId) return;
        set({
          selectedRoomId: id,
          selectedObjectId: null,
          selectedEquipment: room.system,
          selectedLevel: room.level,
          navigationMode: "interior",
          cutaway: true,
          scenario: {
            ...get().scenario,
            objective: room.equipment[0]?.objective ?? get().scenario.objective,
          },
          focusNonce: get().focusNonce + 1,
        });
      },
      selectObject: (id) => {
        const object = objectById(id);
        const room = object && roomById(object.roomId);
        if (!object || !room || object.habitatId !== get().scenario.missionId) return;
        set({
          selectedObjectId: id,
          selectedRoomId: room.id,
          selectedEquipment: object.system,
          selectedLevel: room.level,
          navigationMode: "equipment",
          cutaway: true,
          scenario: {
            ...get().scenario,
            objective: object.objective,
            fuelCategory: object.material ?? get().scenario.fuelCategory,
          },
          focusNonce: get().focusNonce + 1,
        });
      },
      selectEquipment: (id) => {
        if (id === "shell") {
          get().navigate("orbit");
          set({ selectedEquipment: "shell", focusNonce: get().focusNonce + 1 });
          return;
        }
        const room = id ? roomForSystem(get().scenario.missionId, id) : null;
        if (room) {
          const object = room.equipment.find((item) => item.system === id);
          if (object && room.system !== id) {
            get().selectObject(object.id);
            return;
          }
          get().selectRoom(room.id);
          return;
        }
        set({
          selectedEquipment: id,
          selectedObjectId: null,
          selectedRoomId: null,
          selectedLevel: null,
          focusNonce: get().focusNonce + 1,
        });
      },
      setLevel: (level) => {
        const rooms = roomsForHabitat(get().scenario.missionId);
        if (level !== null && !rooms.some((room) => room.level === level)) return;
        const room = rooms.find((item) => level === item.level);
        set({
          selectedLevel: level,
          selectedRoomId: room?.id ?? null,
          selectedObjectId: null,
          selectedEquipment: room?.system ?? null,
          cutaway: true,
          navigationMode: level === null ? "cutaway" : "floor",
          focusNonce: get().focusNonce + 1,
        });
      },
      navigate: (mode) => {
        if (mode === "orbit") {
          set({ ...EXTERIOR, cameraResetNonce: get().cameraResetNonce + 1 });
          return;
        }
        const rooms = roomsForHabitat(get().scenario.missionId);
        if (mode === "equipment") {
          const room = roomById(get().selectedRoomId) ?? rooms[0];
          const id = get().selectedObjectId ?? room?.equipment[0]?.id;
          if (id) get().selectObject(id);
          return;
        }
        if (mode === "interior") {
          const room = roomById(get().selectedRoomId) ?? rooms[0];
          if (room) get().selectRoom(room.id);
          return;
        }
        if (mode === "floor") {
          get().setLevel(get().selectedLevel ?? rooms[0]?.level ?? null);
          return;
        }
        set({
          navigationMode: mode,
          cutaway: true,
          selectedRoomId: null,
          selectedObjectId: null,
          selectedEquipment: null,
          selectedLevel: null,
          focusNonce: get().focusNonce + 1,
        });
      },
      setHideRoof: (value) => set({ hideRoof: value }),
      setHideFrontWalls: (value) => set({ hideFrontWalls: value }),
      setCutaway: (value) => get().navigate(value ? "cutaway" : "orbit"),
      setExploded: (value) =>
        set({
          exploded: value,
          cutaway: value || get().cutaway,
          navigationMode: value ? "cutaway" : get().navigationMode,
          selectedLevel: null,
          selectedRoomId: null,
          selectedObjectId: null,
          selectedEquipment: null,
          focusNonce: get().focusNonce + 1,
        }),
      setMarsDusk: (value) => set({ marsDusk: value }),
      resetCamera: () =>
        set({
          cameraResetNonce: get().cameraResetNonce + 1,
          focusNonce: get().focusNonce + 1,
          selectedEquipment: null,
          selectedObjectId: null,
          selectedRoomId: null,
        }),

      refreshSaved: () => set({ savedScenarios: scenarioRepository.list() }),
      saveScenario: (name, notes) => {
        scenarioRepository.save({ name, notes, scenario: get().scenario });
        set({ savedScenarios: scenarioRepository.list() });
        get().notify(`Saved “${name.trim() || "Untitled scenario"}”.`);
      },
      loadScenario: (id) => {
        const item = scenarioRepository.list().find((entry) => entry.id === id);
        if (!item) return;
        set({ scenario: item.scenario, ...EXTERIOR, savedScenarios: scenarioRepository.list() });
        get().notify(`Loaded “${item.name}”.`);
      },
      deleteScenario: (id) => {
        scenarioRepository.remove(id);
        set({ savedScenarios: scenarioRepository.list() });
      },
      importScenarios: (items) => {
        const seen = new Set<string>();
        scenarioRepository.replaceAll(
          [...items, ...scenarioRepository.list()].filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }),
        );
        set({ savedScenarios: scenarioRepository.list() });
        get().notify(`Imported ${items.length} scenario${items.length === 1 ? "" : "s"}.`);
      },

      notify: (message) => {
        const id = Date.now();
        set({ toast: { id, message } });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null });
        }, 3200);
      },
      dismissToast: () => set({ toast: null }),
    }),
    {
      name: "ignis-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        scenario: state.scenario,
        selectedEquipment: state.selectedEquipment,
        selectedRoomId: state.selectedRoomId,
        selectedObjectId: state.selectedObjectId,
        selectedLevel: state.selectedLevel,
        navigationMode: state.navigationMode,
        hideRoof: state.hideRoof,
        hideFrontWalls: state.hideFrontWalls,
        cutaway: state.cutaway,
        exploded: state.exploded,
      }),
    },
  ),
);
