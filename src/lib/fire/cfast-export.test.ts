/**
 * Exports IGNIS fire histories as inputs for the offline NIST CFAST cross-check
 * (scripts/cfast). Skipped unless CFAST_EXPORT=1:
 *
 *   CFAST_EXPORT=1 npx vitest run src/lib/fire/cfast-export.test.ts
 *
 * It only calls the public model API, so it can be re-run after any model
 * change. Each file carries the heat release, cabin temperature and oxygen
 * histories from IGNIS plus the geometry, atmosphere and fuel chemistry CFAST
 * needs, so CFAST and IGNIS see the same heat release.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAFFIRE_BENCHMARKS } from "@/data/fire/options";
import { FIRE_MODEL_VERSION } from "@/data/fire/sources";
import { roomById } from "@/data/habitat-interiors";
import { scenarioFromMission } from "@/data/missions";
import { fuelElements, reactionYields } from "@/lib/fire/chemistry";
import { runFire, type FireInput, type FireRun } from "@/lib/fire/model";
import { buildFireInput, fuelPackageFor, roomGeometry, saffireInput } from "@/lib/fire/scenario";
import type { MissionId } from "@/types/domain";

const OUT_DIR = fileURLToPath(new URL("../../../scripts/cfast/inputs/", import.meta.url));
const SAMPLE_EVERY_S = 1;
const HABITAT_DURATION_S = 900;

/** One representative room per habitat. The same fuel package (the PMMA sample on
 * the laboratory workbench) is used in all three, so differences come from the
 * room, the atmosphere and gravity rather than the fuel. */
const HABITAT_CASES: { id: string; missionId: MissionId; roomId: string; equipmentType: "bench" }[] = [
  { id: "moon-lab", missionId: "lunar-habitat", roomId: "lunar-habitat-lab", equipmentType: "bench" },
  { id: "mars-lab", missionId: "mars-habitat", roomId: "mars-habitat-lab", equipmentType: "bench" },
  { id: "gateway-ihab", missionId: "gateway-orbit", roomId: "gateway-orbit-ihab", equipmentType: "bench" },
];

const round = (value: number, digits: number) => Number(value.toFixed(digits));

function material(input: FireInput) {
  const m = input.material;
  const y = reactionYields(m, input.oxygenPct, { gravityG: input.gravityG });
  const e = fuelElements(m);
  return {
    id: m.id,
    name: m.name,
    form: m.form,
    heatOfCombustionMJkg: m.heatOfCombustionMJkg.value,
    heatOfCombustionSource: m.heatOfCombustionMJkg.source,
    radiativeFraction: m.radiativeFraction.value,
    radiativeFractionSource: m.radiativeFraction.source,
    /** Product yields IGNIS uses at the initial cabin oxygen, kg per kg of fuel burned. */
    yields: { co2: y.co2, co: y.co, soot: y.soot, water: y.water, oxygen: y.oxygen },
    /** Element mass fractions of the fuel (IGNIS chemistry). */
    elements: { c: e.c, h: e.h, o: e.o, supported: e.supported },
  };
}

function history(run: FireRun, input: FireInput) {
  const h = run.history;
  // FireSample carries the CO2 rise as a partial pressure. Converting with the
  // initial total pressure is accurate to the cabin pressure rise (about 1 %).
  const toPpm = (mmHg: number) => (mmHg / (input.pressureKpa * 7.50062)) * 1e6;
  return {
    t: h.map((p) => round(p.t, 3)),
    hrrW: h.map((p) => round(p.hrrW, 3)),
    tempC: h.map((p) => round(p.tempC, 4)),
    o2Pct: h.map((p) => round(p.o2Pct, 5)),
    co2RisePpm: h.map((p) => round(toPpm(p.co2RiseMmHg), 2)),
  };
}

function ignisBlock(run: FireRun, input: FireInput) {
  const s = run.state;
  return {
    ignitionTimeS: s.ignitionTime,
    finalPhase: s.phase,
    extinctionCause: s.extinctionCause,
    totalHeatJ: s.totalHeatJ,
    peakHrrW: s.peakHrrW,
    fuelBurnedKg: s.fuelBurnedKg,
    initialO2Pct: input.oxygenPct,
    co2RisePpmFinal: s.co2RisePct * 1e4,
    history: history(run, input),
  };
}

function atmosphere(input: FireInput) {
  return {
    gravityG: input.gravityG,
    pressureKpa: input.pressureKpa,
    oxygenPct: input.oxygenPct,
    ambientC: input.ambientC,
    baselineCo2Ppm: input.baselineCo2Ppm ?? 400,
    ventilationMs: input.ventilationMs,
    ventilationSchedule: input.ventilationSchedule ?? [],
  };
}

function write(name: string, payload: unknown) {
  writeFileSync(`${OUT_DIR}${name}`, `${JSON.stringify(payload, null, 1)}\n`);
}

const exportIt = process.env.CFAST_EXPORT === "1" ? it : it.skip;

describe("CFAST input export", () => {
  exportIt("writes IGNIS histories for the Saffire rows and one room per habitat", () => {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const file of readdirSync(OUT_DIR)) if (file.endsWith(".json")) rmSync(`${OUT_DIR}${file}`);
    const generatedAt = new Date().toISOString();
    const index: { id: string; file: string; kind: "saffire" | "habitat" }[] = [];

    for (const row of SAFFIRE_BENCHMARKS) {
      const input = saffireInput(row);
      const run = runFire(input, { durationS: row.burnDurationS, durationFromIgnition: true, sampleEveryS: SAMPLE_EVERY_S });
      const id = `saffire-${row.id}`;
      write(`${id}.json`, {
        schemaVersion: 1,
        id,
        kind: "saffire",
        label: `Saffire ${row.id} · ${row.material}`,
        generatedAt,
        ignisModelVersion: FIRE_MODEL_VERSION,
        benchmark: row,
        atmosphere: atmosphere(input),
        geometry: {
          volumeM3: input.roomVolumeM3,
          heightM: input.roomHeightM,
          floorAreaM2: input.roomFloorAreaM2,
          wallAreaM2: input.wallAreaM2,
          fireHeightM: input.fireHeightM,
          closedRoom: true,
          note: "Cygnus cabin free volume from the Saffire table; room height, floor and wall area are the IGNIS saffireInput values.",
        },
        fuel: { ...input.fuel, areaM2: input.fuel.widthM * input.fuel.lengthM },
        material: material(input),
        ignition: { id: input.ignition.id, name: input.ignition.name },
        run: { durationS: run.state.t, burnDurationS: row.burnDurationS, timeBasis: "heater start; observation ends at ignition + burn duration", sampleEveryS: SAMPLE_EVERY_S },
        ignis: ignisBlock(run, input),
      });
      index.push({ id, file: `${id}.json`, kind: "saffire" });
      expect(run.history.length).toBeGreaterThan(10);
    }

    for (const c of HABITAT_CASES) {
      const room = roomById(c.roomId);
      if (!room) throw new Error(`Unknown room ${c.roomId}`);
      const object = room.equipment.find((item) => item.type === c.equipmentType);
      if (!object) throw new Error(`No ${c.equipmentType} in ${c.roomId}`);
      const scenario = scenarioFromMission(c.missionId);
      const base = buildFireInput(scenario, room, object, {
        materialId: null,
        ignitionId: null,
        sensors: ["photoelectric", "ionization", "two-moment", "uv-ir", "gas-co"],
        autoResponse: false,
        crewAgent: null,
        crewResponseS: 60,
      });
      // The room is closed to the rest of the habitat in both models, so the
      // IGNIS room zone and the single CFAST compartment hold the same gas.
      const input: FireInput = { ...base, habitatVolumeM3: base.roomVolumeM3 + 0.01 };
      const run = runFire(input, { durationS: HABITAT_DURATION_S, sampleEveryS: SAMPLE_EVERY_S });
      const geometry = roomGeometry(room);
      const pack = fuelPackageFor(object);
      write(`${c.id}.json`, {
        schemaVersion: 1,
        id: c.id,
        kind: "habitat",
        label: `${scenario.name} · ${room.name} · ${pack.label}`,
        generatedAt,
        ignisModelVersion: FIRE_MODEL_VERSION,
        missionId: c.missionId,
        roomId: room.id,
        roomName: room.name,
        roomSize: room.size,
        roomRound: room.round ?? false,
        equipmentId: object.id,
        fuelPackage: pack.label,
        atmosphere: atmosphere(input),
        geometry: {
          volumeM3: geometry.volumeM3,
          heightM: geometry.heightM,
          floorAreaM2: geometry.floorAreaM2,
          wallAreaM2: geometry.wallAreaM2,
          fireHeightM: input.fireHeightM,
          closedRoom: true,
          note: "roomGeometry(): free volume is 70 % of the room box (assumption in scenario.ts). The room is closed to the rest of the habitat for this comparison.",
        },
        fuel: { ...input.fuel, areaM2: input.fuel.widthM * input.fuel.lengthM },
        material: material(input),
        ignition: { id: input.ignition.id, name: input.ignition.name },
        run: { durationS: HABITAT_DURATION_S, sampleEveryS: SAMPLE_EVERY_S },
        ignis: ignisBlock(run, input),
      });
      index.push({ id: c.id, file: `${c.id}.json`, kind: "habitat" });
      expect(run.state.totalHeatJ).toBeGreaterThan(0);
    }

    write("index.json", { schemaVersion: 1, generatedAt, ignisModelVersion: FIRE_MODEL_VERSION, cases: index });
  }, 120_000);
});
