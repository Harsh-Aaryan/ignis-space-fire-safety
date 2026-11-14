import { describe, expect, it } from "vitest";
import { FIRE_MATERIALS, materialById } from "@/data/fire/materials";
import { IGNITION_SOURCES, SAFFIRE_BENCHMARKS, ignitionById } from "@/data/fire/options";
import { FIRE_SOURCES } from "@/data/fire/sources";
import {
  buoyantBaseVelocity,
  ignitionDelayS,
  limitingOxygenPct,
  runFire,
  type FireInput,
} from "@/lib/fire/model";
import { genericFireInput, saffireInput } from "@/lib/fire/scenario";

const EXPLORATION = { oxygenPct: 32, pressurePsi: 10.2, airflowMs: 0.05 };

function input(gravityG: number, materialId: string, ignitionId = "hot-wire", patch: Partial<FireInput> = {}): FireInput {
  return { ...genericFireInput({ ...EXPLORATION, gravityG }, materialId, ignitionId), ...patch };
}

describe("provenance", () => {
  it("points every material property at a registered source", () => {
    const ids = new Set(FIRE_SOURCES.map((source) => source.id));
    for (const material of FIRE_MATERIALS) {
      for (const value of Object.values(material)) {
        if (value && typeof value === "object" && "source" in value) {
          expect(ids.has((value as { source: string }).source), `${material.id}`).toBe(true);
        }
      }
      for (const id of material.nasaSources) expect(ids.has(id)).toBe(true);
    }
    for (const ignition of IGNITION_SOURCES) for (const id of ignition.sources) expect(ids.has(id)).toBe(true);
  });
});

describe("flammability limit", () => {
  const pmma = materialById("pmma");

  it("reproduces the BASS-II PMMA limits it was fitted to", () => {
    // 1 g blowoff limit 16 %, microgravity minimum 13.6 %.
    expect(limitingOxygenPct(pmma, buoyantBaseVelocity(1, 101.325), 101.325)).toBeCloseTo(16, 0);
    expect(limitingOxygenPct(pmma, 0.08, 101.325)).toBeCloseTo(13.6, 1);
    // Film at 21 %: quench below 2 cm/s, blowoff near 40 cm/s.
    expect(limitingOxygenPct(pmma, 0.015, 101.325)).toBeGreaterThan(21);
    expect(limitingOxygenPct(pmma, 0.03, 101.325)).toBeLessThan(21);
    expect(limitingOxygenPct(pmma, 0.3, 101.325)).toBeLessThan(21);
    expect(limitingOxygenPct(pmma, 0.5, 101.325)).toBeGreaterThan(21);
  });

  it("puts the oxygen limit lowest near lunar gravity, not at 0 g or 1 g", () => {
    const at = (g: number) => limitingOxygenPct(pmma, Math.hypot(0.02, buoyantBaseVelocity(g, 70.3)), 70.3);
    expect(at(0.165)).toBeLessThan(at(0));
    expect(at(0.165)).toBeLessThan(at(1));
    expect(at(0.165)).toBeLessThan(at(0.38));
  });

  it("raises the limit as pressure falls, with the White Sands slope", () => {
    const high = limitingOxygenPct(pmma, 0.1, 101.325);
    const low = limitingOxygenPct(pmma, 0.1, 56.5);
    expect(low - high).toBeCloseTo(0.607 * (14.7 - 56.5 / 6.894757), 1);
  });

  it("keeps Nomex from igniting at the Saffire VI condition", () => {
    const nomex = materialById("nomex");
    expect(limitingOxygenPct(nomex, 0.2, 54.1)).toBeGreaterThan(31);
  });
});

describe("ignition", () => {
  it("lets an arc light thin fuel but not a thick slab", () => {
    const arc = ignitionById("short-circuit");
    expect(ignitionDelayS(materialById("paper"), arc, 22, 0.05)).not.toBeNull();
    expect(ignitionDelayS(materialById("pmma"), arc, 22, 0.05)).toBeNull();
  });

  it("gives a sustained overload time to ignite a thick slab", () => {
    const delay = ignitionDelayS(materialById("pmma"), ignitionById("overload-wire"), 22, 0.05);
    expect(delay).not.toBeNull();
    expect(delay!).toBeGreaterThan(20);
    expect(delay!).toBeLessThan(400);
  });

  it("cannot ignite PTFE with an overheated component", () => {
    expect(ignitionDelayS(materialById("ptfe"), ignitionById("overheated-component"), 22, 0.05)).toBeNull();
  });
});

describe("Saffire calibration sanity checks (not independent validation)", () => {
  const results = SAFFIRE_BENCHMARKS.map((benchmark) => ({
    benchmark,
    run: runFire(saffireInput(benchmark), { durationS: benchmark.burnDurationS + 20, dt: 0.25 }),
  }));

  it("keeps calibrated peak HRR within a quarter of the published peaks", () => {
    for (const { benchmark, run } of results) {
      if (benchmark.peakHeatW === null) continue; // A reported mean is not a measured peak.
      const measured = benchmark.peakHeatW;
      const ratio = run.state.peakHrrW / measured;
      expect(ratio, `${benchmark.id} peak ${run.state.peakHrrW.toFixed(0)} W vs ${measured} W`).toBeGreaterThan(0.75);
      expect(ratio, `${benchmark.id} peak ${run.state.peakHrrW.toFixed(0)} W vs ${measured} W`).toBeLessThan(1.25);
    }
  });

  it("puts cabin CO and CO2 in the measured range without heating the far field", () => {
    for (const { benchmark, run } of results) {
      const co2Ppm = run.state.co2RisePct * 1e4;
      expect(co2Ppm / benchmark.co2RisePpm, `${benchmark.id} CO2 ${co2Ppm.toFixed(0)} ppm`).toBeGreaterThan(0.5);
      expect(co2Ppm / benchmark.co2RisePpm, `${benchmark.id} CO2 ${co2Ppm.toFixed(0)} ppm`).toBeLessThan(1.6);
      expect(run.state.coPpm / benchmark.coRisePpm, `${benchmark.id} CO ${run.state.coPpm.toFixed(0)} ppm`).toBeGreaterThan(0.4);
      expect(run.state.coPpm / benchmark.coRisePpm, `${benchmark.id} CO ${run.state.coPpm.toFixed(0)} ppm`).toBeLessThan(1.8);
      const warmest = Math.max(...run.history.map((point) => point.tempC));
      expect(warmest - 20).toBeLessThan(8);
    }
  });
});

describe("gravity regimes", () => {
  it("burns harder on the Moon and Mars than in orbit for the same slab", () => {
    const orbit = runFire(input(0, "pmma"), { durationS: 600 });
    const moon = runFire(input(0.165, "pmma"), { durationS: 600 });
    const mars = runFire(input(0.38, "pmma"), { durationS: 600 });
    expect(orbit.state.peakHrrW).toBeGreaterThan(200);
    expect(moon.state.peakHrrW).toBeGreaterThan(orbit.state.peakHrrW * 1.5);
    expect(mars.state.peakHrrW).toBeGreaterThan(orbit.state.peakHrrW * 1.5);
  });

  it("quenches a microgravity flame when ventilation stops, but not a lunar one", () => {
    const actions = [{ t: 150, id: "vent-off" as const }];
    const orbit = runFire(input(0, "sibal", "hot-wire", { ventilationMs: 0.2 }), { durationS: 260, actions });
    const moon = runFire(input(0.165, "pmma", "hot-wire", { ventilationMs: 0.2 }), { durationS: 260, actions });
    expect(orbit.state.phase).toBe("extinguished");
    expect(orbit.state.extinctionCause).toMatch(/quenched/);
    expect(moon.state.phase).toBe("flaming");
  });

  it("forms a descending smoke layer only where there is gravity", () => {
    const orbit = runFire(input(0, "pmma"), { durationS: 300 });
    const mars = runFire(input(0.38, "pmma"), { durationS: 300 });
    expect(orbit.state.layerHeightM).toBeCloseTo(2.4, 5);
    expect(mars.state.layerHeightM).toBeLessThan(2.2);
    expect(orbit.state.flame.flickerHz).toBe(0);
    expect(mars.state.flame.kind).toBe("plume");
  });
});

describe("conservation and products", () => {
  it("consumes oxygen at 13.1 MJ per kg and never creates it", () => {
    const run = runFire(input(0.38, "pmma", "hot-wire", { habitatVolumeM3: 17.01 }), { durationS: 400 });
    const { state } = run;
    const consumedKg = (state.initial.o2 - state.room.o2 - state.rest.o2 + (state.initial.o2 / 17) * 0.01) * 0.032;
    expect(state.o2Pct).toBeLessThan(32);
    expect(state.totalHeatJ / consumedKg / 1e6).toBeCloseTo(13.1, 0);
  });

  it("makes more CO per unit of fuel without gravity", () => {
    const orbit = runFire(input(0, "pmma", "hot-wire", { ventilationMs: 0.2 }), { durationS: 400 });
    const mars = runFire(input(0.38, "pmma", "hot-wire", { ventilationMs: 0.2 }), { durationS: 400 });
    const ratio = (run: typeof orbit) => run.state.coPpm / (run.state.co2RisePct * 1e4);
    expect(ratio(orbit)).toBeGreaterThan(ratio(mars) * 1.5);
    expect(ratio(orbit)).toBeCloseTo(0.04, 2);
  });
});

describe("detection and suppression", () => {
  it("lets ionization see fine Kapton smoke that light scattering misses", () => {
    const run = runFire(
      input(0, "kapton", "overheated-component", { ventilationMs: 0.15, fuel: { widthM: 0.03, lengthM: 0.6, sides: 1, enclosed: false } }),
      { durationS: 1800 },
    );
    const { sensors } = run.state;
    expect(sensors.ionization.signal).toBeGreaterThan(sensors.photoelectric.signal * 5);
  });

  it("stops smoke reaching the sensor when nothing moves the air", () => {
    const moving = runFire(input(0, "sibal", "hot-wire", { ventilationMs: 0.2 }), { durationS: 120 });
    const still = runFire(input(0, "sibal", "overheated-component", { ventilationMs: 0 }), { durationS: 600 });
    expect(moving.state.transportS).toBeLessThan(30);
    expect(still.state.transportS).toBeGreaterThan(10_000);
    expect(still.state.sensors.photoelectric.alarmed).toBe(false);
  });

  it("puts out a lunar fire with CO2, water mist or Halon", () => {
    for (const id of ["co2", "water-mist", "halon"] as const) {
      const run = runFire(input(0.165, "pmma"), { durationS: 400, actions: [{ t: 200, id }] });
      expect(run.state.extinctionTime, id).not.toBeNull();
      expect(run.state.extinctionTime!, id).toBeLessThan(260);
    }
  });

  it("drives an enclosed volume below 10.5 % oxygen within a minute of CO2 discharge", () => {
    const run = runFire(
      input(0, "epoxy-glass", "overload-wire", {
        oxygenPct: 21,
        pressureKpa: 101.325,
        fuel: { widthM: 0.4, lengthM: 0.5, sides: 2, enclosed: true },
      }),
      { durationS: 60, actions: [{ t: 0, id: "co2" }] },
    );
    expect(run.state.localO2Pct).toBeLessThan(10.5);
    expect(run.state.agent.localCo2).toBeGreaterThan(0.5);
  });

  it("raises cabin CO2 past the crew limit when the CO2 extinguisher is used", () => {
    const run = runFire(input(0, "pmma"), { durationS: 300, actions: [{ t: 120, id: "co2" }] });
    expect(run.state.co2RiseMmHg).toBeGreaterThan(3);
  });

  it("removes an electrical source when power is cut on alarm", () => {
    const run = runFire(
      input(0, "ptfe", "overheated-component", { ventilationMs: 0.15, autoResponse: true }),
      { durationS: 2400 },
    );
    if (run.state.firstAlarmTime !== null) {
      expect(run.state.powerOff).toBe(true);
      expect(run.state.sourceActive).toBe(false);
    }
    expect(run.state.phase).not.toBe("flaming");
  });
});
