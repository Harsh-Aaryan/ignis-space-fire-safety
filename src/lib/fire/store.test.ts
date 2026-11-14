import { beforeEach, describe, expect, it } from "vitest";
import { scenarioAfterHabitatSwitch, scenarioFromMission } from "@/data/missions";
import { stepFire } from "@/lib/fire/model";
import { genericFireInput } from "@/lib/fire/scenario";
import { DEFAULT_FIRE_CONFIG, fireRuntime, syncFireMission, useFireSimStore } from "@/stores/fire-sim-store";

const scenario = scenarioFromMission("lunar-habitat");
const context = { scenario, selectedObjectId: "lunar-habitat-lab-bench-0" };
function start() {
  const setup = genericFireInput(scenario, "pmma", "hot-wire");
  useFireSimStore.getState().start(setup, "lunar-habitat-lab", context.selectedObjectId);
  return setup;
}
beforeEach(() => {
  useFireSimStore.getState().reset();
  useFireSimStore.setState({ open: false, config: { ...DEFAULT_FIRE_CONFIG, sensors: [...DEFAULT_FIRE_CONFIG.sensors] } });
});

describe("shared fire scenario state", () => {
  it("publishes independent telemetry snapshots while the runtime advances", () => {
    start();
    const snapshot = useFireSimStore.getState().snapshot!;
    const original = structuredClone(snapshot);
    for (let i = 0; i < 200; i++) stepFire(fireRuntime.state!, fireRuntime.input!, 0.25);
    expect(snapshot).toEqual(original);
    useFireSimStore.getState().publish();
    expect(useFireSimStore.getState().snapshot!.t).toBe(50);
    expect(snapshot.t).toBe(0);
  });

  it("does not mutate the forecast input when a live sensor is toggled", () => {
    const setup = start();
    const original = [...setup.sensors];
    useFireSimStore.getState().toggleSensor("uv-ir");
    expect(setup.sensors).toEqual(original);
    expect(fireRuntime.input!.sensors).toEqual(useFireSimStore.getState().config.sensors);
  });

  it("preserves material and ignition setup across Research, Predict and the FireTwin panel", () => {
    useFireSimStore.getState().patchConfig({ materialId: "nomex", ignitionId: "overheated-component" });
    useFireSimStore.getState().setOpen(true);
    useFireSimStore.getState().setOpen(false);
    syncFireMission(context, context);
    expect(useFireSimStore.getState().config).toMatchObject({ materialId: "nomex", ignitionId: "overheated-component" });
  });

  it("resets a run on habitat change even when its panel is closed", () => {
    start();
    syncFireMission({ ...context, scenario: scenarioAfterHabitatSwitch(scenario, "gateway-orbit"), selectedObjectId: null }, context);
    expect(useFireSimStore.getState().status).toBe("idle");
    expect(fireRuntime.state).toBeNull();
    expect(useFireSimStore.getState().activeRoomId).toBeNull();
  });

  it.each([{ oxygenPct: 21 }, { pressurePsi: 14.7 }, { gravityG: 0 }])("resets on changes to the initial atmosphere %j", (patch) => {
    start();
    syncFireMission({ ...context, scenario: { ...scenario, ...patch } }, context);
    expect(fireRuntime.input).toBeNull();
    expect(useFireSimStore.getState().history).toEqual([]);
  });

  it("applies airflow edits from any page to the live fan target without resetting the run", () => {
    start();
    syncFireMission({ ...context, scenario: { ...scenario, airflowMs: 0.2 } }, context);
    expect(fireRuntime.state!.uForcedTargetMs).toBe(0.2);
    expect(useFireSimStore.getState().status).toBe("running");
  });

  it("pauses and resumes without replacing the runtime and clears it on reset", () => {
    start();
    const state = fireRuntime.state;
    useFireSimStore.getState().pause();
    expect(useFireSimStore.getState().status).toBe("paused");
    useFireSimStore.getState().resume();
    expect(useFireSimStore.getState().status).toBe("running");
    expect(fireRuntime.state).toBe(state);
    useFireSimStore.getState().reset();
    expect(fireRuntime).toEqual({ state: null, input: null, roomId: null, objectId: null });
  });
});
