import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SAFFIRE_BENCHMARKS, SAFFIRE_IV_VI_EMISSION } from "@/data/fire/options";
import { INVESTIGATIONS, investigationById } from "@/data/research/investigations";
import { parsePsiCsv } from "@/lib/fire/psi-data";
import { EXPERIMENT_RUNS, KPA_PER_MMHG, RUN_TABLES, runPressureKpa, runsForRecord, type ExperimentRun, type RunTableId } from "./runs";

/**
 * Every value in runs.ts is checked against the table it was transcribed from.
 * The parsing here is independent of runs.ts, so a typo on either side fails.
 */

function table(file: string) {
  return parsePsiCsv(readFileSync(path.join(process.cwd(), file), "utf8"));
}

function column(headers: string[], prefix: string): number {
  const index = headers.findIndex((header) => header.trim().toLowerCase().startsWith(prefix.toLowerCase()));
  if (index < 0) throw new Error(`No column starting with "${prefix}" in ${headers.join(" | ")}`);
  return index;
}

function runsOf(id: RunTableId): ExperimentRun[] {
  return EXPERIMENT_RUNS.filter((run) => run.table === id);
}

function byId(id: string): ExperimentRun {
  const run = EXPERIMENT_RUNS.find((item) => item.id === id);
  if (!run) throw new Error(`No run ${id}`);
  return run;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** "21.5 - 21.7", "22.1 to 22.0", "~ 21.5" -> [low, high] and whether marked approximate. */
function oxygenCell(cell: string): { range: [number, number]; approx: boolean } | null {
  const text = cell.trim();
  if (!text) return null;
  const approx = text.startsWith("~");
  const numbers = (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (!numbers.length) return null;
  return { range: [Math.min(...numbers), Math.max(...numbers)], approx };
}

/** "20", "20 cm/s" -> 20. */
function flowCell(cell: string): number | null {
  const match = cell.trim().match(/^(\d+(?:\.\d+)?)(?:\s*cm\/s)?$/);
  return match ? Number(match[1]) : null;
}

describe("run table structure", () => {
  it("gives every run a unique id and a record that exists", () => {
    const ids = EXPERIMENT_RUNS.map((run) => run.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const run of EXPERIMENT_RUNS) {
      const record = investigationById(run.recordId);
      expect(record, run.id).not.toBeNull();
      expect(RUN_TABLES[run.table].recordId).toBe(run.recordId);
    }
  });

  it("only cites PSI tables the record itself links to", () => {
    for (const run of EXPERIMENT_RUNS.filter((item) => item.table.startsWith("PSI-"))) {
      expect(investigationById(run.recordId)!.links.psi, run.id).toContain(run.table);
    }
  });

  it("assigns each run a gravity regime its record lists", () => {
    for (const run of EXPERIMENT_RUNS) expect(investigationById(run.recordId)!.gravity, run.id).toContain(run.gravity);
  });

  it("stays inside the ranges the record tabulates", () => {
    for (const record of INVESTIGATIONS) {
      for (const run of runsForRecord(record.id)) {
        const { oxygenPct, pressureKpa, flowCmS } = record.conditions;
        if (oxygenPct && run.oxygenPct) {
          expect(run.oxygenPct[0], run.id).toBeGreaterThanOrEqual(oxygenPct[0] - 1e-9);
          expect(run.oxygenPct[1], run.id).toBeLessThanOrEqual(oxygenPct[1] + 1e-9);
        }
        const kpa = runPressureKpa(run);
        if (pressureKpa && kpa !== null) {
          expect(kpa, run.id).toBeGreaterThanOrEqual(pressureKpa[0] - 1e-9);
          expect(kpa, run.id).toBeLessThanOrEqual(pressureKpa[1] + 1e-9);
        }
        if (flowCmS && run.flowCmS !== null) {
          expect(run.flowCmS, run.id).toBeGreaterThanOrEqual(flowCmS[0]);
          expect(run.flowCmS, run.id).toBeLessThanOrEqual(flowCmS[1]);
        }
      }
    }
  });

  it("converts mmHg with 101.325 kPa per 760 mmHg", () => {
    expect(KPA_PER_MMHG * 760).toBeCloseTo(101.325, 9);
    const flex = byId("PSI-69:1");
    expect(runPressureKpa(flex)).toBeCloseTo(757.7 * KPA_PER_MMHG, 9);
  });
});

describe("Saffire VI paper rows", () => {
  it("match SAFFIRE_BENCHMARKS one for one", () => {
    const runs = runsOf("saffire-vi-paper");
    expect(runs).toHaveLength(SAFFIRE_BENCHMARKS.length);
    for (const test of SAFFIRE_BENCHMARKS) {
      const run = byId(`saffire-vi-paper:${test.id}`);
      expect(run.recordId).toBe("saffire-vi");
      expect(run.material).toBe(test.material);
      expect(run.oxygenPct).toEqual([test.oxygenPct, test.oxygenPct]);
      expect(run.pressure).toEqual({ value: test.pressureKpa, unit: "kPa" });
      expect(run.flowCmS).toBeCloseTo(test.flowMs * 100, 9);
      expect(run.thickness).toBeNull();
      expect(run.diluents).toBeNull();
    }
  });
});

describe("Saffire IV–VI emission paper rows (ICES-2026-577)", () => {
  it("adds only the tests ICES-2024-365 does not tabulate, so no physical test has two runs", () => {
    const runs = runsOf("saffire-iv-vi-emission");
    expect(runs.map((run) => run.id)).toEqual(["saffire-iv-vi-emission:IV-2", "saffire-iv-vi-emission:V-3", "saffire-iv-vi-emission:V-2"]);
    const covered = new Set(SAFFIRE_BENCHMARKS.map((test) => test.id));
    for (const run of runs) expect(covered.has(run.label.replace("Test ", "")), run.id).toBe(false);
    expect(runs.length + SAFFIRE_BENCHMARKS.length).toBe(SAFFIRE_IV_VI_EMISSION.length);
  });

  it("converts mbar to kPa and mole fraction to percent, and keeps concurrent flow", () => {
    for (const run of runsOf("saffire-iv-vi-emission")) {
      const test = SAFFIRE_IV_VI_EMISSION.find((item) => `saffire-iv-vi-emission:${item.id}` === run.id)!;
      expect(run.recordId).toBe("saffire-iv-v");
      expect(run.pressure).toEqual({ value: test.pressureMbar / 10, unit: "kPa" });
      expect(run.oxygenPct![0]).toBeCloseTo(test.oxygenMolFraction * 100, 9);
      expect(run.flowCmS).toBe(20);
      expect(run.flowDirection).toBe("Concurrent");
      expect(run.material).toBe(test.material);
    }
    expect(byId("saffire-iv-vi-emission:V-3").thickness).toBe("5 mm");
    expect(byId("saffire-iv-vi-emission:IV-2").thickness).toBe("10 mm");
    expect(byId("saffire-iv-vi-emission:V-2").thickness).toBeNull();
  });
});

describe("Saffire I, II and III rows (PSI-98, PSI-99, PSI-100)", () => {
  const cases: Array<{ id: RunTableId; thicknessUnitFromHeader: string | null; hasOxygen: boolean }> = [
    { id: "PSI-98", thicknessUnitFromHeader: "cm", hasOxygen: true },
    { id: "PSI-99", thicknessUnitFromHeader: null, hasOxygen: true },
    { id: "PSI-100", thicknessUnitFromHeader: null, hasOxygen: false },
  ];

  for (const { id, thicknessUnitFromHeader, hasOxygen } of cases) {
    it(`${id}: one run per sample row, every value as tabulated`, () => {
      const { headers, rows } = table(RUN_TABLES[id].file);
      const sampleCol = column(headers, "Sample Number");
      const materialCol = column(headers, "Material");
      const thicknessCol = column(headers, id === "PSI-99" ? "Samle Thickness" : "Sample Thickness");
      const flowCol = column(headers, "Air Flow");
      const directionCol = headers.findIndex((header) => /direction/i.test(header));
      const oxygenCol = hasOxygen ? column(headers, "Percent O2") : -1;

      // Rows without an airflow cell are flow-visualization or note rows, not burns.
      const sampleRows = rows.filter((row) => (row[flowCol] ?? "").trim() !== "");
      const runs = runsOf(id);
      expect(runs).toHaveLength(sampleRows.length);

      for (const row of sampleRows) {
        const run = byId(`${id}:${row[sampleCol].trim()}`);
        const material = row[materialCol].trim();
        expect(run.material, run.id).toBe(material ? collapse(material) : null);
        const thickness = row[thicknessCol].trim();
        expect(run.thickness, run.id).toBe(thicknessUnitFromHeader ? `${thickness} ${thicknessUnitFromHeader}` : thickness);
        expect(run.flowCmS, run.id).toBe(flowCell(row[flowCol]));
        expect(run.flowDirection, run.id).toBe(row[directionCol].trim());
        if (hasOxygen) {
          const oxygen = oxygenCell(row[oxygenCol]);
          expect(run.oxygenPct, run.id).toEqual(oxygen?.range ?? null);
          expect(run.oxygenApprox, run.id).toBe(oxygen?.approx ?? false);
        } else {
          expect(run.oxygenPct, run.id).toBeNull();
        }
        // These tables have no pressure column.
        expect(headers.some((header) => /pressure/i.test(header))).toBe(false);
        expect(run.pressure, run.id).toBeNull();
      }
    });
  }
});

describe("FLEX rows (PSI-69)", () => {
  it("has one run per tabulated test with fuel, pressure and gas composition as tabulated", () => {
    const { headers, rows } = table(RUN_TABLES["PSI-69"].file);
    const testCol = column(headers, "FLEX Test #");
    const idCol = column(headers, "FLEX Identifier");
    const fuelCol = column(headers, "Fuel");
    const pressureCol = column(headers, "Ambient pressure; mmHg");
    const o2Col = column(headers, "O initial");
    const n2Col = column(headers, "N initial");
    const co2Col = column(headers, "CO initial");
    const heCol = column(headers, "He initial");
    expect(headers.some((header) => /flow|velocity/i.test(header))).toBe(false);

    const runs = runsOf("PSI-69");
    expect(runs).toHaveLength(rows.length);
    for (const row of rows) {
      const run = byId(`PSI-69:${row[testCol].trim()}`);
      expect(run.label).toBe(`FLEX test ${row[testCol].trim()} (${row[idCol].trim()})`);
      expect(run.material).toBe(`${row[fuelCol].trim()} droplet`);
      expect(run.pressure).toEqual({ value: Number(row[pressureCol]), unit: "mmHg" });
      expect(run.oxygenPct![0]).toBeCloseTo(Number(row[o2Col]) * 100, 9);
      expect(run.oxygenPct![1]).toBe(run.oxygenPct![0]);
      expect(run.diluents).toEqual({ n2: Number(row[n2Col]), co2: Number(row[co2Col]), he: Number(row[heCol]) });
      expect(run.flowCmS).toBeNull();
      expect(run.thickness).toBeNull();
    }
  });
});

describe("BASS-II rows (PSI-25)", () => {
  it("has one run per tabulated test with its material and calibrated initial oxygen", () => {
    const { headers, rows } = table(RUN_TABLES["PSI-25"].file);
    const testCol = column(headers, "Test #");
    const materialCol = column(headers, "Fuel Sample Material");
    const o2Col = column(headers, "Calibrated  initial O2");
    expect(headers.some((header) => /pressure/i.test(header))).toBe(false);

    const runs = runsOf("PSI-25");
    expect(runs).toHaveLength(rows.length);
    expect(rows.length).toBe(129);
    for (const row of rows) {
      const run = byId(`PSI-25:${row[testCol].trim()}`);
      expect(run.material).toBe(collapse(row[materialCol]));
      expect(run.oxygenPct).toEqual([Number(row[o2Col]), Number(row[o2Col])]);
      // Flow is given as fan and air-display settings, not cm/s; pressure is not tabulated.
      expect(run.flowCmS).toBeNull();
      expect(run.pressure).toBeNull();
    }
  });
});

describe("coverage", () => {
  it("holds runs only for the five sourced records", () => {
    const records = new Set(EXPERIMENT_RUNS.map((run) => run.recordId));
    expect([...records].sort()).toEqual(["bass-ii", "flex", "saffire-i-iii", "saffire-iv-v", "saffire-vi"]);
    expect(runsForRecord("saffire-vi")).toHaveLength(4);
    expect(runsForRecord("saffire-iv-v")).toHaveLength(3);
    expect(runsForRecord("saffire-i-iii")).toHaveLength(13);
    expect(runsForRecord("flex")).toHaveLength(274);
    expect(runsForRecord("bass-ii")).toHaveLength(129);
    expect(runsForRecord("same-2")).toEqual([]);
  });
});
