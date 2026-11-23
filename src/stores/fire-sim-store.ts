"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { SensorId, SuppressionId } from "@/data/fire/options";
import {
  applyAction,
  createFireState,
  sample,
  setVentilation,
  stepFire,
  type FireEvent,
  type FireInput,
  type FireSample,
  type FireState,
} from "@/lib/fire/model";
import type { FireConfig } from "@/lib/fire/scenario";
import type { MissionScenario } from "@/types/domain";

/**
 * The running simulation lives outside React. The 3D layer reads it every
 * frame; the telemetry strip reads snapshots published a few times a second.
 */
export const fireRuntime: {
  state: FireState | null;
  input: FireInput | null;
  roomId: string | null;
  objectId: string | null;
} = { state: null, input: null, roomId: null, objectId: null };

export type FireStatus = "idle" | "running" | "paused" | "finished";
export type FireSpeed = 1 | 10 | 60;

const STEP_S = 0.25;
const MAX_HISTORY = 480;

interface FireSimStore {
  /**
   * The fire scenario panel is showing in the Simulation side panel. It starts
   * open so a direct visit lands on the scenario; choosing the Equipment tab
   * sets it false and that choice holds for the rest of the session.
   */
  open: boolean;
  enhanceVisibility: boolean;
  showAirflow: boolean;
  setVisuals: (patch: Partial<{ enhanceVisibility: boolean; showAirflow: boolean }>) => void;
  config: FireConfig;
  status: FireStatus;
  speed: FireSpeed;
  activeRoomId: string | null;
  activeObjectId: string | null;
  /** Bumps when a new snapshot is ready. Components read fireRuntime.state. */
  snapshot: FireState | null;
  history: FireSample[];
  events: FireEvent[];
  setOpen: (open: boolean) => void;
  patchConfig: (patch: Partial<FireConfig>) => void;
  toggleSensor: (id: SensorId) => void;
  start: (input: FireInput, roomId: string, objectId: string) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setSpeed: (speed: FireSpeed) => void;
  act: (id: SuppressionId) => void;
  setVentilation: (speedMs: number) => void;
  publish: () => void;
}

export const DEFAULT_FIRE_CONFIG: FireConfig = {
  materialId: null,
  ignitionId: null,
  sensors: ["photoelectric", "gas-co"],
  autoResponse: false,
  crewAgent: null,
  crewResponseS: 60,
};

function copyState(state: FireState): FireState {
  return structuredClone(state);
}

export const useFireSimStore = create<FireSimStore>()((set, get) => ({
  open: true,
  enhanceVisibility: false,
  showAirflow: false,
  setVisuals: (patch) => set(patch),
  config: DEFAULT_FIRE_CONFIG,
  status: "idle",
  speed: 1,
  activeRoomId: null,
  activeObjectId: null,
  snapshot: null,
  history: [],
  events: [],
  setOpen: (open) => set({ open }),
  patchConfig: (patch) => set({ config: { ...get().config, ...patch } }),
  toggleSensor: (id) => {
    const current = get().config.sensors;
    const sensors = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    set({ config: { ...get().config, sensors } });
    if (fireRuntime.input) {
      fireRuntime.input.sensors = sensors;
      if (fireRuntime.state) fireRuntime.state.events.push({ t: fireRuntime.state.t, kind: "action", label: `${id} detector ${sensors.includes(id) ? "enabled" : "disabled"}.` });
      get().publish();
    }
  },
  start: (input, roomId, objectId) => {
    fireRuntime.input = { ...input, fuel: { ...input.fuel }, sensors: [...input.sensors] };
    fireRuntime.state = createFireState(input);
    fireRuntime.roomId = roomId;
    fireRuntime.objectId = objectId;
    set({
      status: "running",
      activeRoomId: roomId,
      activeObjectId: objectId,
      snapshot: copyState(fireRuntime.state),
      history: [sample(fireRuntime.state)],
      events: [...fireRuntime.state.events],
    });
  },
  pause: () => get().status === "running" && set({ status: "paused" }),
  resume: () => get().status === "paused" && set({ status: "running" }),
  reset: () => {
    fireRuntime.state = null;
    fireRuntime.input = null;
    fireRuntime.roomId = null;
    fireRuntime.objectId = null;
    set({ status: "idle", activeRoomId: null, activeObjectId: null, snapshot: null, history: [], events: [] });
  },
  setSpeed: (speed) => set({ speed }),
  act: (id) => {
    if (!fireRuntime.state || !fireRuntime.input) return;
    applyAction(fireRuntime.state, fireRuntime.input, id);
    get().publish();
  },
  setVentilation: (speedMs) => {
    if (fireRuntime.state) setVentilation(fireRuntime.state, speedMs);
  },
  publish: () => {
    const state = fireRuntime.state;
    if (!state) return;
    const history = get().history;
    const last = history[history.length - 1];
    let next = history;
    if (!last || state.t - last.t >= 2) {
      next = [...history, sample(state)];
      // Halve the resolution of the older half when the buffer fills.
      if (next.length > MAX_HISTORY) {
        const half = Math.floor(next.length / 2);
        next = [...next.slice(0, half).filter((_, index) => index % 2 === 0), ...next.slice(half)];
      }
    }
    set({
      snapshot: copyState(state),
      history: next,
      events: state.events.length === get().events.length ? get().events : [...state.events],
    });
  },
}));

type MissionFireContext = { scenario: MissionScenario; selectedObjectId: string | null };

/** Synchronize edits from the top bar, scenario panel, habitat switcher and saved scenarios. */
export function syncFireMission(current: MissionFireContext, previous: MissionFireContext): void {
  const next = current.scenario;
  const prev = previous.scenario;
  const sim = useFireSimStore.getState();
  if (
    next.missionId !== prev.missionId || next.gravityG !== prev.gravityG ||
    next.oxygenPct !== prev.oxygenPct || next.pressurePsi !== prev.pressurePsi
  ) sim.reset();
  else if (next.airflowMs !== prev.airflowMs) sim.setVentilation(next.airflowMs);
  if (current.selectedObjectId !== previous.selectedObjectId && useFireSimStore.getState().status === "idle") {
    sim.patchConfig({ materialId: null, ignitionId: null });
  }
}

function settled(state: FireState): boolean {
  if (state.phase === "burned-out" || state.phase === "no-ignition") {
    return state.t - (state.extinctionTime ?? state.t - 61) > 60 || state.phase === "no-ignition";
  }
  return state.phase === "extinguished" && !state.sourceActive && state.t > state.hotUntil + 60;
}

/** Mount once where the simulation is shown. Advances the model on the animation clock. */
export function useFireSimDriver(): void {
  const status = useFireSimStore((store) => store.status);
  useEffect(() => {
    if (status !== "running") return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    let sincePublish = 0;
    const tick = (now: number) => {
      const state = fireRuntime.state;
      const input = fireRuntime.input;
      if (!state || !input) return;
      const real = Math.min(0.25, (now - last) / 1000);
      last = now;
      carry += real * useFireSimStore.getState().speed;
      let steps = 0;
      while (carry >= STEP_S && steps < 480) {
        stepFire(state, input, STEP_S);
        carry -= STEP_S;
        steps += 1;
      }
      sincePublish += real;
      if (sincePublish >= 0.15) {
        sincePublish = 0;
        useFireSimStore.getState().publish();
      }
      if (settled(state)) {
        useFireSimStore.getState().publish();
        useFireSimStore.setState({ status: "finished" });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);
}
