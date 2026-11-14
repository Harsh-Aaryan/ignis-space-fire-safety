import { describe, expect, it } from "vitest";
import { applyAction, createFireState, runFire, stepFire } from "@/lib/fire/model";
import { genericFireInput } from "@/lib/fire/scenario";

const scenario = { gravityG: 0.165, oxygenPct: 32, pressurePsi: 10.2, airflowMs: 0.05 };
const input = () => genericFireInput(scenario, "pmma", "hot-wire");

describe("fire numerical and conservation regressions", () => {
  it("cannot release combustion energy beyond the oxygen inventory during delayed extinction", () => {
    const setup = input();
    const state = createFireState(setup);
    state.isolated = true;
    state.phase = "flaming";
    state.pyroLengthM = setup.fuel.lengthM;
    state.pyroWidthM = setup.fuel.widthM;
    state.room.o2 = 0;
    state.rest.o2 = 0;
    state.local.o2 = 1e-5;
    const availableJ = state.local.o2 * 0.032 * 13.1e6;
    for (let i = 0; i < 20; i++) stepFire(state, setup, 0.25);
    expect(state.totalHeatJ).toBeLessThanOrEqual(availableJ + 1e-9);
    expect(state.fuelBurnedKg * setup.material.heatOfCombustionMJkg.value * 1e6).toBeCloseTo(state.totalHeatJ, 8);
    expect(state.room.o2).toBeGreaterThanOrEqual(0);
  });

  it.each([0.25, 0.7])("delivers one complete CO₂ bottle across discharge boundaries with dt=%s", (dt) => {
    const setup = input();
    const state = createFireState(setup);
    applyAction(state, setup, "co2");
    for (let i = 0; i < Math.ceil(60 / dt); i++) {
      if (i === 10) applyAction(state, setup, "co2");
      stepFire(state, setup, dt);
    }
    expect(state.agent.co2ReleasedKg).toBeCloseTo(2.72, 10);
    expect(state.events.filter((event) => event.label.startsWith("CO₂ extinguisher discharged"))).toHaveLength(1);
  });

  it("executes an action at its requested time and ends at the requested horizon", () => {
    const run = runFire(input(), { durationS: 1.1, dt: 0.25, actions: [{ t: 0.1, id: "power-off" }] });
    expect(run.state.events.find((event) => event.kind === "action")?.t).toBeCloseTo(0.1, 10);
    expect(run.state.t).toBeCloseTo(1.1, 10);
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid time step %s instead of hanging", (dt) => {
    expect(() => runFire(input(), { durationS: 1, dt })).toThrow(RangeError);
    expect(() => stepFire(createFireState(input()), input(), dt)).toThrow(RangeError);
  });

  it.each([0, 0.165, 0.38])("keeps a small isolated cabin finite and within physical bounds at %s g", (gravityG) => {
    const setup = { ...input(), gravityG, roomVolumeM3: 0.1, habitatVolumeM3: 0.11 };
    const run = runFire(setup, { durationS: 600, actions: [{ t: 30, id: "vent-off" }], sampleEveryS: 1 });
    for (const point of run.history) {
      expect(Object.values(point).every(Number.isFinite)).toBe(true);
      expect(point.o2Pct).toBeGreaterThanOrEqual(0);
      expect(point.o2Pct).toBeLessThanOrEqual(32 + 1e-10);
      expect(point.coPpm).toBeGreaterThanOrEqual(0);
    }
    expect(run.state.fuelBurnedKg).toBeLessThanOrEqual(run.state.fuelTotalKg);
  });
});
