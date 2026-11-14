"use client";

import {
  objectById,
  roomById,
  roomForSystem,
  roomsForHabitat,
  type NavigationMode,
} from "@/data/habitat-interiors";
import {
  JOURNEYS,
  scenarioAfterHabitatSwitch,
  scenarioFromMission,
} from "@/data/missions";
import { scenarioRepository } from "@/services/scenario-repository";
import { EMPTY_FILTERS } from "@/lib/evidence/filters";
import { DEFAULT_WEIGHTS } from "@/lib/ranking/score";
import type {
  ActivityEvent,
  ChatTurn,
  EquipmentId,
  ExplorerFilters,
  DataMode,
  MissionId,
  MissionScenario,
  RankingWeights,
  SavedScenario,
  SortKey,
} from "@/types/domain";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FiretwinMode = "evidence" | "scenario";
export type HeatAxis = "gravity" | "oxygen" | "pressure" | "airflow" | "fuel";

interface Toast {
  id: number;
  message: string;
}

interface MissionState {
  scenario: MissionScenario;
  dataMode: DataMode;
  weights: RankingWeights;
  filters: ExplorerFilters;
  includeMissingInFilters: boolean;
  sort: SortKey;
  page: number;
  comparisonIds: string[];
  selectedEquipment: EquipmentId | null;
  selectedRoomId: string | null;
  selectedObjectId: string | null;
  selectedLevel: number | null;
  navigationMode: NavigationMode;
  hideRoof: boolean;
  hideFrontWalls: boolean;
  selectRoom: (id: string) => void;
  selectObject: (id: string) => void;
  setLevel: (level: number | null) => void;
  navigate: (mode: NavigationMode) => void;
  setHideRoof: (value: boolean) => void;
  setHideFrontWalls: (value: boolean) => void;
  assistantDraft: string;
  setAssistantDraft: (draft: string) => void;
  firetwinMode: FiretwinMode;
  cutaway: boolean;
  exploded: boolean;
  showFlame: boolean;
  marsDusk: boolean;
  cameraResetNonce: number;
  focusNonce: number;
  heatmapX: HeatAxis;
  heatmapY: HeatAxis;
  activity: ActivityEvent[];
  chat: ChatTurn[];
  savedScenarios: SavedScenario[];
  toast: Toast | null;
  selectMission: (id: MissionId) => void;
  setDataMode: (mode: DataMode) => void;
  patchScenario: (patch: Partial<MissionScenario>, label?: string) => void;
  setWeights: (weights: RankingWeights) => void;
  resetWeights: () => void;
  setFilters: (filters: ExplorerFilters) => void;
  patchFilters: (patch: Partial<ExplorerFilters>) => void;
  resetFilters: () => void;
  setIncludeMissing: (value: boolean) => void;
  setSort: (sort: SortKey) => void;
  setPage: (page: number) => void;
  toggleComparison: (id: string) => void;
  clearComparison: () => void;
  selectEquipment: (id: EquipmentId | null) => void;
  setMode: (mode: FiretwinMode) => void;
  setCutaway: (value: boolean) => void;
  setExploded: (value: boolean) => void;
  setShowFlame: (value: boolean) => void;
  setMarsDusk: (value: boolean) => void;
  resetCamera: () => void;
  setHeatmapAxes: (x: HeatAxis, y: HeatAxis) => void;
  applyJourney: (id: string) => void;
  resetScenario: () => void;
  pushActivity: (label: string, module: ActivityEvent["module"]) => void;
  addChat: (turn: ChatTurn) => void;
  clearChat: () => void;
  refreshSaved: () => void;
  saveScenario: (name: string, notes?: string) => void;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  importScenarios: (items: SavedScenario[]) => void;
  notify: (message: string) => void;
  dismissToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function activity(
  label: string,
  module: ActivityEvent["module"],
): ActivityEvent {
  return {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    label,
    module,
  };
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      scenario: scenarioFromMission("lunar-habitat"),
      dataMode: "combined",
      weights: DEFAULT_WEIGHTS,
      filters: EMPTY_FILTERS,
      includeMissingInFilters: false,
      sort: "relevance",
      page: 1,
      comparisonIds: [],
      selectedEquipment: null,
      selectedRoomId: null,
      selectedObjectId: null,
      selectedLevel: null,
      navigationMode: "orbit",
      hideRoof: true,
      hideFrontWalls: true,
      assistantDraft: "",
      setAssistantDraft: (draft) => set({ assistantDraft: draft }),
      setHideRoof: (value) => set({ hideRoof: value }),
      setHideFrontWalls: (value) => set({ hideFrontWalls: value }),
      selectRoom: (id) => {
        const room = roomById(id);
        if (!room || room.habitatId !== get().scenario.missionId) return;
        set({
          activity: [
            activity(`Selected room ${room.name} in FireTwin.`, "firetwin"),
            ...get().activity,
          ].slice(0, 12),
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
        if (!object || !room || object.habitatId !== get().scenario.missionId)
          return;
        set({
          activity: [
            activity(`Selected ${object.label} in ${room.name}.`, "firetwin"),
            ...get().activity,
          ].slice(0, 12),
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
      setLevel: (level) => {
        const rooms = roomsForHabitat(get().scenario.missionId);
        if (level !== null && !rooms.some((room) => room.level === level))
          return;
        const room = rooms.find((room) => level === room.level);
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
          set({
            navigationMode: mode,
            cutaway: false,
            exploded: false,
            selectedRoomId: null,
            selectedObjectId: null,
            selectedEquipment: null,
            selectedLevel: null,
            cameraResetNonce: get().cameraResetNonce + 1,
          });
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
      firetwinMode: "evidence",
      cutaway: false,
      exploded: false,
      showFlame: false,
      marsDusk: false,
      cameraResetNonce: 0,
      focusNonce: 0,
      heatmapX: "oxygen",
      heatmapY: "gravity",
      activity: [
        {
          id: "session-start",
          at: 0,
          label: "Session opened on the illustrative lunar habitat scenario.",
          module: "overview",
        },
      ],
      chat: [],
      savedScenarios: [],
      toast: null,
      setDataMode: (mode) =>
        set({
          dataMode: mode,
          page: 1,
          activity: [
            activity(`Evidence mode set to ${mode}.`, "research"),
            ...get().activity,
          ].slice(0, 12),
        }),
      selectMission: (id) => {
        const scenario = scenarioAfterHabitatSwitch(get().scenario, id);
        set({
          scenario,
          selectedEquipment: null,
          selectedRoomId: null,
          selectedObjectId: null,
          selectedLevel: null,
          navigationMode: "orbit",
          cutaway: false,
          exploded: false,
          cameraResetNonce: get().cameraResetNonce + 1,
          page: 1,
          activity: [
            activity(`Selected ${scenario.name}.`, "overview"),
            ...get().activity,
          ].slice(0, 12),
        });
      },
      patchScenario: (patch, label) => {
        const scenario = { ...get().scenario, ...patch };
        set({
          scenario,
          page: 1,
          activity: label
            ? [activity(label, "overview"), ...get().activity].slice(0, 12)
            : get().activity,
        });
      },
      setWeights: (weights) => set({ weights, page: 1 }),
      resetWeights: () => set({ weights: DEFAULT_WEIGHTS }),
      setFilters: (filters) => set({ filters, page: 1 }),
      patchFilters: (patch) =>
        set({ filters: { ...get().filters, ...patch }, page: 1 }),
      resetFilters: () => set({ filters: EMPTY_FILTERS, page: 1 }),
      setIncludeMissing: (value) =>
        set({ includeMissingInFilters: value, page: 1 }),
      setSort: (sort) => set({ sort, page: 1 }),
      setPage: (page) => set({ page }),
      toggleComparison: (id) => {
        const current = get().comparisonIds;
        const next = current.includes(id)
          ? current.filter((item) => item !== id)
          : current.length >= 3
            ? current
            : [...current, id];
        set({
          comparisonIds: next,
          activity: [
            activity(`Comparison set: ${next.length} dossiers.`, "research"),
            ...get().activity,
          ].slice(0, 12),
        });
        if (!current.includes(id) && current.length >= 3) {
          get().notify("Compare up to three dossiers.");
        }
      },
      clearComparison: () => set({ comparisonIds: [] }),
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
      setMode: (mode) => set({ firetwinMode: mode }),
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
      setShowFlame: (value) => set({ showFlame: value }),
      setMarsDusk: (value) => set({ marsDusk: value }),
      resetCamera: () =>
        set({
          cameraResetNonce: get().cameraResetNonce + 1,
          focusNonce: get().focusNonce + 1,
          selectedEquipment: null,
          selectedObjectId: null,
          selectedRoomId: null,
        }),
      setHeatmapAxes: (x, y) => set({ heatmapX: x, heatmapY: y }),
      applyJourney: (id) => {
        const journey = JOURNEYS.find((item) => item.id === id);
        if (!journey) return;
        set({
          scenario: journey.scenario,
          selectedRoomId: null,
          selectedObjectId: null,
          selectedLevel: null,
          navigationMode: "orbit",
          cutaway: false,
          exploded: false,
          filters: EMPTY_FILTERS,
          page: 1,
          selectedEquipment: journey.equipment ?? null,
          focusNonce: get().focusNonce + 1,
          activity: [
            activity(
              `Applied journey ${journey.code}: ${journey.title}.`,
              "overview",
            ),
            ...get().activity,
          ].slice(0, 12),
        });
        get().notify(`Journey ${journey.code} loaded.`);
      },
      resetScenario: () => {
        set({
          scenario: scenarioFromMission("lunar-habitat"),
          selectedRoomId: null,
          selectedObjectId: null,
          selectedLevel: null,
          navigationMode: "orbit",
          cutaway: false,
          exploded: false,
          weights: DEFAULT_WEIGHTS,
          filters: EMPTY_FILTERS,
          page: 1,
          comparisonIds: [],
          selectedEquipment: null,
        });
        get().notify("Scenario reset to the lunar illustration.");
      },
      pushActivity: (label, module) =>
        set({
          activity: [activity(label, module), ...get().activity].slice(0, 12),
        }),
      addChat: (turn) => set({ chat: [...get().chat, turn].slice(-40) }),
      clearChat: () => set({ chat: [] }),
      refreshSaved: () => set({ savedScenarios: scenarioRepository.list() }),
      saveScenario: (name, notes) => {
        scenarioRepository.save({
          name,
          notes,
          scenario: get().scenario,
          weights: get().weights,
        });
        set({ savedScenarios: scenarioRepository.list() });
        get().notify(`Saved “${name.trim() || "Untitled scenario"}”.`);
        get().pushActivity(
          `Saved scenario “${name.trim() || "Untitled scenario"}”.`,
          "reports",
        );
      },
      loadScenario: (id) => {
        const item = scenarioRepository.list().find((entry) => entry.id === id);
        if (!item) return;
        set({
          scenario: item.scenario,
          selectedRoomId: null,
          selectedObjectId: null,
          selectedLevel: null,
          selectedEquipment: null,
          navigationMode: "orbit",
          cutaway: false,
          exploded: false,
          weights: item.weights,
          page: 1,
          savedScenarios: scenarioRepository.list(),
        });
        get().notify(`Loaded “${item.name}”.`);
        get().pushActivity(`Loaded scenario “${item.name}”.`, "reports");
      },
      deleteScenario: (id) => {
        scenarioRepository.remove(id);
        set({ savedScenarios: scenarioRepository.list() });
      },
      importScenarios: (items) => {
        const merged = [...items, ...scenarioRepository.list()];
        const seen = new Set<string>();
        scenarioRepository.replaceAll(
          merged.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }),
        );
        set({ savedScenarios: scenarioRepository.list() });
        get().notify(
          `Imported ${items.length} scenario${items.length === 1 ? "" : "s"}.`,
        );
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
        dataMode: state.dataMode,
        weights: state.weights,
        filters: state.filters,
        includeMissingInFilters: state.includeMissingInFilters,
        sort: state.sort,
        comparisonIds: state.comparisonIds,
        selectedEquipment: state.selectedEquipment,
        selectedRoomId: state.selectedRoomId,
        selectedObjectId: state.selectedObjectId,
        selectedLevel: state.selectedLevel,
        navigationMode: state.navigationMode,
        hideRoof: state.hideRoof,
        hideFrontWalls: state.hideFrontWalls,
        assistantDraft: state.assistantDraft,
        firetwinMode: state.firetwinMode,
        cutaway: state.cutaway,
        exploded: state.exploded,
        showFlame: state.showFlame,
        heatmapX: state.heatmapX,
        heatmapY: state.heatmapY,
        activity: state.activity,
        chat: state.chat,
      }),
    },
  ),
);
