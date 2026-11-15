import { describe, expect, it } from "vitest";
import { SAFFIRE_BENCHMARKS, type VentilationStep } from "@/data/fire/options";
import { FIRE_CLOSURES } from "@/data/fire/parameters";
import { accuracyCue, testCoverage } from "./accuracy";
import { simulateSaffire } from "./benchmarks";
import { applyAction, createFireState, runFire, stepFire } from "./model";
import { saffireInput } from "./scenario";
import { gasMoles, makeZone, mixedStreamTemperatureK } from "./transport";

const vi3 = SAFFIRE_BENCHMARKS.find(row => row.id === "VI-3")!;

describe("prescribed flight ventilation", () => {
  const coolingState = (schedule: VentilationStep[]) => {
    const input = { ...saffireInput(vi3), ventilationSchedule: schedule };
    const state = createFireState(input);
    // An already extinguished fire isolates the fan's analytic response from combustion.
    state.phase = "extinguished";
    state.sourceActive = false;
    state.ignitionTime = 2;
    return { input, state };
  };

  it("uses the measured VI-3 times relative to ignition", () => {
    expect(vi3.ventilationSchedule).toEqual([
      { afterIgnitionS: 1120 - 637, speedMs: 0.05 },
      { afterIgnitionS: 1420 - 637, speedMs: 0 },
    ]);
    expect(SAFFIRE_BENCHMARKS.find(row => row.id === "VI-4")!.ventilationSchedule).toBeUndefined();
  });

  it("crosses an off-grid command at its exact time, with no pre-ignition reduction", () => {
    const { input, state } = coolingState([{ afterIgnitionS: 0.37, speedMs: 0.05 }]);
    stepFire(state, input, 2);
    expect(state.uForcedMs).toBe(0.2);
    stepFire(state, input, 2);
    const expected = 0.05 + (0.2 - 0.05) * Math.exp(-(4 - 2.37) / FIRE_CLOSURES.fanTimeConstantS.value);
    expect(state.uForcedMs).toBeCloseTo(expected, 10);
    expect(state.events.filter(event => event.kind === "action")).toHaveLength(1);
    expect(state.events.find(event => event.kind === "action")!.t).toBeCloseTo(2.37, 10);
  });

  it("never restarts a fan stopped by the emergency response", () => {
    const { input, state } = coolingState([{ afterIgnitionS: 0.37, speedMs: 0.3 }]);
    stepFire(state, input, 1);
    applyAction(state, input, "vent-off");
    stepFire(state, input, 3);
    expect(state.uForcedTargetMs).toBe(0);
    expect(state.uForcedMs).toBeCloseTo(0.2 * Math.exp(-3 / FIRE_CLOSURES.fanTimeConstantS.value), 10);
    expect(state.isolated).toBe(true);
    expect(state.ventOff).toBe(true);
  });

  it.each([
    [{ afterIgnitionS: -1, speedMs: 0.05 }],
    [{ afterIgnitionS: 1, speedMs: -0.05 }],
    [{ afterIgnitionS: NaN, speedMs: 0.05 }],
    [{ afterIgnitionS: 1, speedMs: Infinity }],
    [{ afterIgnitionS: 2, speedMs: 0.05 }, { afterIgnitionS: 1, speedMs: 0 }],
    [{ afterIgnitionS: 1, speedMs: 0.05 }, { afterIgnitionS: 1, speedMs: 0 }],
  ])("rejects invalid or ambiguous schedules: %j", (...schedule) => {
    expect(() => coolingState(schedule)).toThrow(/Ventilation schedule/);
  });

  it("uses the same observation window in benchmarks and exported histories", () => {
    const input = saffireInput(vi3);
    const run = runFire(input, { durationS: vi3.burnDurationS, durationFromIgnition: true });
    const comparison = simulateSaffire(vi3);
    expect(run.state.ignitionTime).not.toBeNull();
    expect(run.state.t - run.state.ignitionTime!).toBeCloseTo(vi3.burnDurationS, 9);
    expect(run.state.totalHeatJ / 1000).toBeCloseTo(comparison.heatKJ, 5);
    expect(run.state.peakHrrW).toBeCloseTo(comparison.peakHrrW, 5);
    expect(run.state.uForcedTargetMs).toBe(0.05);
    const constant = runFire({ ...input, ventilationSchedule: undefined }, { durationS: vi3.burnDurationS, durationFromIgnition: true });
    expect(run.state.totalHeatJ).toBeLessThan(constant.state.totalHeatJ);
    expect(run.history.at(-1)!.t).toBe(run.state.t);
  });

  it("withholds flight error cues when the airflow history differs", () => {
    const input = saffireInput(vi3);
    expect(testCoverage(input)).toEqual({ kind: "saffire-vi", rowId: "VI-3" });
    const constant = { ...input, ventilationSchedule: undefined };
    expect(testCoverage(constant)).toEqual({ kind: "extrapolated", reason: "airflow history differs from the published Saffire test" });
    expect(accuracyCue("hrr", constant).tested).toBe(false);
    const unknown = saffireInput(SAFFIRE_BENCHMARKS.find(row => row.id === "VI-4")!);
    expect(testCoverage(unknown)).toEqual({ kind: "extrapolated", reason: "the complete Saffire VI-4 airflow history is unavailable" });
    expect(accuracyCue("heat", unknown).tested).toBe(false);
  });
});

describe("outlet stream temperature", () => {
  const inlet = makeZone(1, 100, 21, 300);
  const source = makeZone(1, 100, 21, 600);

  it("conserves enthalpy while accounting for hot-gas expansion", () => {
    const totalMolarFlow = 2 * gasMoles(inlet);
    const hotMolarFlow = gasMoles(source);
    const outlet = mixedStreamTemperatureK(source, inlet, 1, 2)!;
    expect(outlet).toBeCloseTo(375, 10);
    expect(totalMolarFlow * outlet).toBeCloseTo(hotMolarFlow * source.tempK + (totalMolarFlow - hotMolarFlow) * inlet.tempK, 8);
  });

  it("has no outlet reading without flow and stays inside stream temperatures", () => {
    expect(mixedStreamTemperatureK(source, inlet, 1, 0)).toBeNull();
    expect(mixedStreamTemperatureK(source, inlet, 0, 2)).toBe(inlet.tempK);
    expect(mixedStreamTemperatureK(source, inlet, 10, 2)).toBe(source.tempK);
  });
});
