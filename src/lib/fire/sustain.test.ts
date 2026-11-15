import { describe, expect, it } from "vitest";
import { createFireState, runFire, stepFire, type ScheduledAction } from "@/lib/fire/model";
import { genericFireInput } from "@/lib/fire/scenario";
import { materialById } from "@/data/fire/materials";

/**
 * Model 2.1.0 acceptance cases. Each is anchored to a flight or ground result
 * recorded in src/data/fire/sources.ts. They check which fires persist and which
 * go out; they are not a validation of heat-release magnitudes.
 */

const AIR = { oxygenPct: 21, pressurePsi: 14.7 };

function burn(
  materialId: string,
  gravityG: number,
  airflowMs: number,
  options: { atmosphere?: { oxygenPct: number; pressurePsi: number }; durationS?: number; actions?: ScheduledAction[] } = {},
) {
  const input = genericFireInput({ gravityG, airflowMs, ...(options.atmosphere ?? AIR) }, materialId, "hot-wire");
  return runFire(input, { durationS: options.durationS ?? 600, actions: options.actions, sampleEveryS: 5 });
}

describe("thick fuel sustains inside the measured flammability envelope", () => {
  // BASS-II: acrylic rods burned steadily at 0.4–4 cm/s and 16–21 % O₂; the limit's minimum sits at very low flow.
  it("acrylic keeps burning in microgravity at 5 cm/s", () => {
    const run = burn("pmma", 0, 0.05);
    const at30 = run.history.find((point) => point.t >= 30)!;
    expect(run.state.phase).toBe("flaming");
    expect(run.state.hrrW).toBeGreaterThan(at30.hrrW);
  });

  // Ferkul et al. 2026: flammability is expected to be greatest near lunar gravity, not absent.
  it("acrylic keeps burning in still air at lunar and Martian gravity", () => {
    const lowFlow = burn("pmma", 0, 0.05);
    const lunar = burn("pmma", 0.165, 0);
    const mars = burn("pmma", 0.38, 0);
    expect(lunar.state.phase).toBe("flaming");
    expect(mars.state.phase).toBe("flaming");
    // Buoyant flow at 0.165 g (about 11 cm/s) lies between the two reference cases.
    expect(lunar.state.peakHrrW).toBeGreaterThan(lowFlow.state.peakHrrW);
    expect(lunar.state.peakHrrW).toBeLessThan(mars.state.peakHrrW);
  });

  // BASS-II: radiative quenching at very low flow. No buoyancy, no fan, air: no sustained flame.
  it("acrylic does not sustain a flame in still microgravity air", () => {
    const run = burn("pmma", 0, 0);
    expect(["no-ignition", "extinguished"]).toContain(run.state.phase);
    expect(run.state.totalHeatJ).toBeLessThan(10_000);
  });
});

describe("responses still put the fire out", () => {
  it("stopping the fans extinguishes acrylic in microgravity air", () => {
    const run = burn("pmma", 0, 0.2, { durationS: 200, actions: [{ t: 120, id: "vent-off" }] });
    expect(run.state.phase).toBe("extinguished");
  });

  // Saffire V-3: thick acrylic burned for 300 s at 5 cm/s and 25.4 % O₂, then went out quickly once the
  // flow stopped. The flight pressure is not recorded in this repository; the case runs at 14.7 psi.
  it("reproduces the Saffire V-3 sequence", () => {
    const atmosphere = { oxygenPct: 25.4, pressurePsi: 14.7 };
    const burning = burn("pmma", 0, 0.05, { atmosphere, durationS: 300 });
    expect(burning.state.phase).toBe("flaming");
    const stopped = burn("pmma", 0, 0.05, { atmosphere, durationS: 380, actions: [{ t: 300, id: "vent-off" }] });
    expect(stopped.state.phase).toBe("extinguished");
  });

  it.each(["co2", "water-mist"] as const)("%s extinguishes acrylic burning at 20 cm/s", (agent) => {
    const run = burn("pmma", 0, 0.2, { durationS: 240, actions: [{ t: 120, id: agent }] });
    expect(run.state.phase).toBe("extinguished");
  });
});

describe("thin fuel is unchanged", () => {
  // Totals recorded with model 2.0.0, before the thick-fuel closure changed.
  it.each([
    [0.05, 62],
    [0.2, 125],
  ])("cotton fabric at 0 g and %s m/s releases the same heat", (airflowMs, referenceKJ) => {
    const run = burn("sibal", 0, airflowMs);
    expect(run.state.totalHeatJ / 1000).toBeGreaterThan(referenceKJ * 0.9);
    expect(run.state.totalHeatJ / 1000).toBeLessThan(referenceKJ * 1.1);
  });

  it("cotton fabric does not ignite in still microgravity air", () => {
    expect(burn("sibal", 0, 0).state.phase).toBe("no-ignition");
  });
});

describe("a fire that has gone out is reported as out", () => {
  const atmospheres = [AIR, { oxygenPct: 32, pressurePsi: 10.2 }];
  const cases = ["pmma", "sibal", "ldpe-wire"].flatMap((materialId) =>
    [0, 0.165, 0.38, 1].flatMap((gravityG) =>
      [0, 0.05, 0.2].flatMap((airflowMs) => atmospheres.map((atmosphere) => ({ materialId, gravityG, airflowMs, atmosphere }))),
    ),
  );

  it("never shows a flame over a cold surface or without heat release", () => {
    const offenders: string[] = [];
    for (const item of cases) {
      const ignition = item.materialId === "ldpe-wire" ? "overload-wire" : "hot-wire";
      const input = genericFireInput({ gravityG: item.gravityG, airflowMs: item.airflowMs, ...item.atmosphere }, item.materialId, ignition);
      const state = createFireState(input);
      const limit = materialById(item.materialId).ignitionTempC.value - 30;
      let coldFor = 0;
      let worst = 0;
      let flameWithoutHeat = false;
      while (state.t < 600) {
        stepFire(state, input, 0.25);
        coldFor = state.phase === "flaming" && state.surfaceTempC < limit ? coldFor + 0.25 : 0;
        worst = Math.max(worst, coldFor);
        if ((state.flame.kind === "plume" || state.flame.kind === "dome") && state.chemicalHrrW < 0.1) flameWithoutHeat = true;
      }
      if (worst > 3 || flameWithoutHeat) {
        offenders.push(`${item.materialId} g=${item.gravityG} u=${item.airflowMs} O2=${item.atmosphere.oxygenPct}: cold ${worst}s, flame without heat ${flameWithoutHeat}`);
      }
    }
    expect(offenders).toEqual([]);
  }, 60_000);
});

describe("microgravity flame size follows the burning zone", () => {
  // Saffire IV–V: concurrent flames reach a limiting, steady size rather than growing with the distance travelled.
  it("draws a limiting flame on cotton fabric, comparable with the lunar case", () => {
    const flameAt = (gravityG: number) => {
      const input = genericFireInput({ gravityG, airflowMs: 0.2, ...AIR }, "sibal", "hot-wire");
      const state = createFireState(input);
      while (state.t < 120) stepFire(state, input, 0.25);
      return state.flame.lengthM;
    };
    const microgravity = flameAt(0);
    const lunar = flameAt(0.165);
    expect(microgravity).toBeLessThan(0.2);
    expect(microgravity / lunar).toBeLessThan(3);
    expect(lunar / microgravity).toBeLessThan(3);
  });

  it("shows no flame once the fabric is consumed", () => {
    const run = burn("sibal", 0, 0.2, { atmosphere: { oxygenPct: 32, pressurePsi: 10.2 } });
    expect(run.state.phase).toBe("burned-out");
    expect(["none", "glow"]).toContain(run.state.flame.kind);
  });
});
