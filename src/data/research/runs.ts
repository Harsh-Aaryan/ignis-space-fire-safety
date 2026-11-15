import { SAFFIRE_BENCHMARKS, SAFFIRE_IV_VI_EMISSION, SAFFIRE_IV_VI_EMISSION_META } from "@/data/fire/options";
import type { GravityRegime } from "@/data/research/investigations";

/**
 * Run-level table: individual tabulated runs, transcribed from tables already in this repository.
 *
 *  - Saffire VI paper Tables 1–2 (four tests), read from SAFFIRE_BENCHMARKS in src/data/fire/options.ts,
 *  - Saffire IV–VI emission paper (ICES-2026-577) Table 1, read from SAFFIRE_IV_VI_EMISSION in the same file. Only the
 *    three tests the Saffire VI paper does not cover (IV-2, V-3, V-2) are added here; IV-1, VI-2, VI-3 and VI-4 are already
 *    rows of the Saffire VI paper table, and one physical test gets one run,
 *  - NASA PSI experiment tables in public/data/nasa-psi: Saffire I (PSI-98), Saffire II (PSI-99),
 *    Saffire III (PSI-100), FLEX (PSI-69) and BASS-II (PSI-25).
 *
 * Only fields the source tabulates are filled. A field the source does not report is null and is
 * never estimated. runs.test.ts re-reads every source table and checks each value here against it.
 *
 * Gravity is not a column in any of these tables. Every run below flew in microgravity (ISS or Cygnus),
 * as recorded in the investigation index, so each run carries that regime from its record.
 */

export type RunTableId = "saffire-vi-paper" | "saffire-iv-vi-emission" | "PSI-98" | "PSI-99" | "PSI-100" | "PSI-69" | "PSI-25";

export interface ExperimentRun {
  /** Unique: table id and the row's own test or sample id. */
  id: string;
  /** Investigation record the run belongs to. */
  recordId: string;
  label: string;
  table: RunTableId;
  /** Where to find the row in the source. */
  locator: string;
  /** As written in the source, whitespace collapsed. Null when the row leaves it blank. */
  material: string | null;
  /** As written in the source, with the unit the source gives. */
  thickness: string | null;
  /** Percent by volume, [low, high]. Equal ends when the source gives one value. */
  oxygenPct: [number, number] | null;
  /** The source marks the oxygen value as approximate ("~"). */
  oxygenApprox: boolean;
  /** How the oxygen value was obtained, when it is not a direct reading. Derived conversions are named here. */
  oxygenNote: string | null;
  /** In the unit the source tabulates. Convert with runPressureKpa. */
  pressure: { value: number; unit: "kPa" | "mmHg" } | null;
  flowCmS: number | null;
  flowDirection: "Concurrent" | "Opposed" | null;
  /** Initial mole fractions of the other gases, when the source tabulates them. */
  diluents: { n2: number; co2: number; he: number } | null;
  gravity: GravityRegime;
}

/** 1 mmHg in kPa (101.325 kPa / 760 mmHg). */
export const KPA_PER_MMHG = 101.325 / 760;

/** Pressure in kPa. Derived when the source tabulates mmHg. */
export function runPressureKpa(run: ExperimentRun): number | null {
  if (!run.pressure) return null;
  return run.pressure.unit === "kPa" ? run.pressure.value : run.pressure.value * KPA_PER_MMHG;
}

export const RUN_TABLES: Record<RunTableId, { recordId: string; label: string; file: string }> = {
  "saffire-vi-paper": { recordId: "saffire-vi", label: "Saffire VI paper, Tables 1–2", file: "src/data/fire/options.ts (SAFFIRE_BENCHMARKS)" },
  "saffire-iv-vi-emission": { recordId: "saffire-iv-v", label: "Saffire IV–VI emission paper, Table 1", file: "src/data/fire/options.ts (SAFFIRE_IV_VI_EMISSION)" },
  "PSI-98": { recordId: "saffire-i-iii", label: "Saffire I experiment table (PSI-98)", file: "public/data/nasa-psi/PSI-98_Experimental table_SAFFIRE-1.csv" },
  "PSI-99": { recordId: "saffire-i-iii", label: "Saffire II experiment table (PSI-99)", file: "public/data/nasa-psi/PSI-99_Experimental table_SAFFIRE-2.csv" },
  "PSI-100": { recordId: "saffire-i-iii", label: "Saffire III experiment table (PSI-100)", file: "public/data/nasa-psi/PSI-100_Experimental table_SAFFIRE-3.csv" },
  "PSI-69": { recordId: "flex", label: "FLEX experiment table (PSI-69)", file: "public/data/nasa-psi/PSI-69_Experimental table_FLEX.csv" },
  "PSI-25": { recordId: "bass-ii", label: "BASS-II experiment table (PSI-25)", file: "public/data/nasa-psi/PSI-25_Experimental table_BASS-II.csv" },
};

const NO_FIELDS = {
  material: null,
  thickness: null,
  oxygenPct: null,
  oxygenApprox: false,
  oxygenNote: null,
  pressure: null,
  flowCmS: null,
  flowDirection: null,
  diluents: null,
  gravity: "0g",
} as const satisfies Partial<ExperimentRun>;

/** Removes floating-point noise from a unit conversion. */
function clean(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/* ------------------------------------------------------------------ */
/* Saffire VI paper, Tables 1–2                                        */
/* ------------------------------------------------------------------ */

/** SAFFIRE_BENCHMARKS tabulates flow in m/s; ×100 gives cm/s. */
const SAFFIRE_VI_RUNS: ExperimentRun[] = SAFFIRE_BENCHMARKS.map((test) => ({
  ...NO_FIELDS,
  id: `saffire-vi-paper:${test.id}`,
  recordId: "saffire-vi",
  label: `Test ${test.id}`,
  table: "saffire-vi-paper",
  locator: `ICES-2024-365 Table 1, test ${test.id}`,
  material: test.material,
  oxygenPct: [test.oxygenPct, test.oxygenPct],
  pressure: { value: test.pressureKpa, unit: "kPa" },
  flowCmS: clean(test.flowMs * 100),
  flowDirection: "Concurrent",
}));

/* ------------------------------------------------------------------ */
/* Saffire IV–VI emission paper (ICES-2026-577), Table 1               */
/* ------------------------------------------------------------------ */

/** Tests of the emission paper that ICES-2024-365 (SAFFIRE_BENCHMARKS) does not tabulate. */
const EMISSION_ONLY_TESTS = SAFFIRE_IV_VI_EMISSION.filter((test) => !SAFFIRE_BENCHMARKS.some((benchmark) => benchmark.id === test.id));

/**
 * Table 1 gives pressure in mbar (1 mbar = 0.1 kPa) and O₂ as a mole fraction (×100 for percent by volume).
 * Its caption says "opposed flow"; the Saffire VI paper and this paper's text describe concurrent flow, so the run keeps "Concurrent".
 */
const SAFFIRE_EMISSION_RUNS: ExperimentRun[] = EMISSION_ONLY_TESTS.map((test) => ({
  ...NO_FIELDS,
  id: `saffire-iv-vi-emission:${test.id}`,
  recordId: "saffire-iv-v",
  label: `Test ${test.id}`,
  table: "saffire-iv-vi-emission",
  locator: `ICES-2026-577 Table 1, test ${test.id}`,
  material: test.material,
  thickness: test.material === "PMMA" ? `${test.sidesBurning === 1 ? SAFFIRE_IV_VI_EMISSION_META.pmmaThicknessMm.oneSided : SAFFIRE_IV_VI_EMISSION_META.pmmaThicknessMm.twoSided} mm` : null,
  oxygenPct: [clean(test.oxygenMolFraction * 100), clean(test.oxygenMolFraction * 100)],
  oxygenNote: "Converted from the tabulated mole fraction.",
  pressure: { value: clean(test.pressureMbar / 10), unit: "kPa" },
  flowCmS: SAFFIRE_IV_VI_EMISSION_META.flow.speedCmS,
  flowDirection: "Concurrent",
}));

/* ------------------------------------------------------------------ */
/* Saffire I, II and III (PSI-98, PSI-99, PSI-100)                     */
/* ------------------------------------------------------------------ */

const SAFFIRE_I_RUNS: ExperimentRun[] = [
  {
    ...NO_FIELDS,
    id: "PSI-98:S1",
    recordId: "saffire-i-iii",
    label: "Saffire I, sample S1",
    table: "PSI-98",
    locator: "PSI-98 experiment table, Sample Number S1",
    material: "SIBAL Fabric",
    thickness: "0.37 cm",
    oxygenPct: [21.5, 21.7],
    flowCmS: 20,
    flowDirection: "Concurrent",
  },
  {
    ...NO_FIELDS,
    id: "PSI-98:S2",
    recordId: "saffire-i-iii",
    label: "Saffire I, sample S2",
    table: "PSI-98",
    locator: "PSI-98 experiment table, Sample Number S2",
    material: "SIBAL Fabric",
    thickness: "0.37 cm",
    oxygenPct: [21.5, 21.5],
    oxygenApprox: true,
    flowCmS: 20,
    flowDirection: "Opposed",
  },
];

const SAFFIRE_II_O2_NOTE = "Derived by the investigators from measured CO₂ production, referenced to the initial O₂ reported by the ISS (table note 1).";

/** [sample, material (null when the row leaves it blank), thickness as written, O₂ low, O₂ high, approximate, flow direction] */
const SAFFIRE_II_ROWS: Array<[string, string | null, string, number, number, boolean, "Concurrent" | "Opposed"]> = [
  ["2-1", "Silicone", "0.27 mm", 21.5, 21.5, true, "Concurrent"],
  ["2-2", "Silicone", "0.61 mm", 22.1, 22.1, true, "Concurrent"],
  ["2-3", "Silicone", "1.03 mm", 22.1, 22.1, true, "Concurrent"],
  ["2-4", "Silicone", "037 mm", 22.1, 22.1, true, "Opposed"],
  ["2-5", "Cotton-Fiberglass (SIBAL)", "037 mm", 22.1, 22.1, true, "Concurrent"],
  ["2-6", null, "037 mm", 22.1, 22.1, true, "Concurrent"],
  ["2-7", "PMMA & Nomex", "0.85 and 0.37 mm", 22.1, 22.1, true, "Concurrent"],
  ["2-8", "PMMA", "See Fig. 5", 22.0, 22.1, false, "Concurrent"],
  ["2-9", null, "1 cm", 21.9, 22.0, false, "Concurrent"],
];

const SAFFIRE_II_RUNS: ExperimentRun[] = SAFFIRE_II_ROWS.map(([sample, material, thickness, low, high, approx, direction]) => ({
  ...NO_FIELDS,
  id: `PSI-99:${sample}`,
  recordId: "saffire-i-iii",
  label: `Saffire II, sample ${sample}`,
  table: "PSI-99",
  locator: `PSI-99 experiment table, Sample Number ${sample}`,
  material,
  thickness,
  oxygenPct: [low, high],
  oxygenApprox: approx,
  oxygenNote: SAFFIRE_II_O2_NOTE,
  flowCmS: 20,
  flowDirection: direction,
}));

const SAFFIRE_III_RUNS: ExperimentRun[] = (["S1", "S2"] as const).map((sample) => ({
  ...NO_FIELDS,
  id: `PSI-100:${sample}`,
  recordId: "saffire-i-iii",
  label: `Saffire III, sample ${sample}`,
  table: "PSI-100",
  locator: `PSI-100 experiment table, Sample Number ${sample}`,
  material: "SIBAL Fabric",
  thickness: ".33 cm",
  flowCmS: 30,
  flowDirection: sample === "S1" ? "Concurrent" : "Opposed",
}));

/* ------------------------------------------------------------------ */
/* FLEX (PSI-69)                                                       */
/* ------------------------------------------------------------------ */

/**
 * [FLEX Test #, FLEX Identifier, Fuel, ambient pressure (mmHg), initial mole fractions of O₂, N₂, CO₂ and He].
 * The table has no airflow column, so flow is not reported.
 */
const FLEX_ROWS: Array<[number, string, string, number, number, number, number, number]> = [
  [1, "20CAL08", "Methanol", 757.7, 0.21, 0.79, 0, 0],
  [2, "20CAL10", "Methanol", 762, 0.21, 0.79, 0, 0],
  [3, "20CAL12", "Methanol", 764.2, 0.21, 0.79, 0, 0],
  [4, "30CAL02", "Methanol", 760, 0.21, 0.79, 0, 0],
  [5, "30CAL03", "Methanol", 760, 0.21, 0.79, 0, 0],
  [6, "40CAL01", "Methanol", 760, 0.21, 0.79, 0, 0],
  [7, "20CAL13", "Heptane", 761.3, 0.21, 0.79, 0, 0],
  [8, "30CAL06", "Heptane", 762.4, 0.21, 0.79, 0, 0],
  [9, "30CAL07", "Heptane", 760, 0.21, 0.79, 0, 0],
  [10, "256F002", "Methanol", 2319.7, 0.21, 0.09, 0.7, 0],
  [11, "256R001", "Methanol", 2318.8, 0.21, 0.09, 0.7, 0],
  [12, "264F003", "Heptane", 2319.9, 0.21, 0.09, 0.7, 0],
  [13, "256R002", "Methanol", 2074.2, 0.21, 0.09, 0.7, 0],
  [14, "256F007", "Methanol", 2055.6, 0.21, 0.09, 0.7, 0],
  [15, "256F008", "Methanol", 2066.6, 0.21, 0.09, 0.7, 0],
  [16, "256F009", "Methanol", 2072.1, 0.21, 0.09, 0.7, 0],
  [17, "240R003", "Methanol", 1545.7, 0.21, 0.09, 0.7, 0],
  [18, "248F001", "Heptane", 1553.8, 0.21, 0.09, 0.7, 0],
  [19, "196F001", "Heptane", 539.1, 0.34, 0.66, 0, 0],
  [20, "192F001", "Methanol", 539.5, 0.34, 0.66, 0, 0],
  [21, "192F002", "Methanol", 540.6, 0.34, 0.66, 0, 0],
  [22, "192F003", "Methanol", 540.5, 0.34, 0.66, 0, 0],
  [23, "196F002", "Heptane", 541.8, 0.34, 0.66, 0, 0],
  [24, "196F003", "Heptane", 542.8, 0.34, 0.66, 0, 0],
  [25, "191R001", "Methanol", 537.3, 0.3, 0.7, 0, 0],
  [26, "191F001", "Methanol", 538.4, 0.3, 0.7, 0, 0],
  [27, "195F001", "Heptane", 540.7, 0.3, 0.7, 0, 0],
  [28, "195F002", "Heptane", 539.7, 0.3, 0.7, 0, 0],
  [29, "178R001", "Methanol", 766.9, 0.3, 0.7, 0, 0],
  [30, "178F001", "Methanol", 769.2, 0.3, 0.7, 0, 0],
  [31, "182F001", "Heptane", 770.5, 0.3, 0.7, 0, 0],
  [32, "182F002", "Heptane", 771, 0.3, 0.7, 0, 0],
  [33, "177R002", "Methanol", 764.5, 0.21, 0.79, 0, 0],
  [34, "177F001", "Methanol", 767.7, 0.21, 0.79, 0, 0],
  [35, "181F001", "Heptane", 768.1, 0.21, 0.79, 0, 0],
  [36, "190R002", "Methanol", 539, 0.2, 0.8, 0, 0],
  [37, "220R001", "Methanol", 534.3, 0.34, 0.66, 0, 0],
  [38, "220R002", "Methanol", 534.4, 0.34, 0.66, 0, 0],
  [39, "224F001", "Heptane", 534.9, 0.34, 0.66, 0, 0],
  [40, "219R001", "Methanol", 535.1, 0.3, 0.7, 0, 0],
  [41, "219F001", "Methanol", 534.3, 0.3, 0.7, 0, 0],
  [42, "223F001", "Heptane", 535, 0.3, 0.7, 0, 0],
  [43, "223F002", "Heptane", 534.9, 0.3, 0.7, 0, 0],
  [44, "206F001", "Methanol", 766.8, 0.3, 0.7, 0, 0],
  [45, "206R001", "Methanol", 768.3, 0.3, 0.7, 0, 0],
  [46, "205R001", "Methanol", 769.5, 0.21, 0.79, 0, 0],
  [47, "209F001", "Heptane", 770.1, 0.21, 0.79, 0, 0],
  [48, "205F001", "Methanol", 768.7, 0.21, 0.79, 0, 0],
  [49, "209F003", "Heptane", 764.9, 0.21, 0.79, 0, 0],
  [50, "209F004", "Heptane", 770.1, 0.21, 0.79, 0, 0],
  [51, "209F005", "Heptane", 771.4, 0.21, 0.79, 0, 0],
  [52, "210F002", "Heptane", 771.1, 0.3, 0.7, 0, 0],
  [53, "209F002", "Heptane", 770.2, 0.21, 0.79, 0, 0],
  [54, "190F003", "Methanol", 541.4, 0.2, 0.8, 0, 0],
  [55, "218F001", "Methanol", 542.6, 0.2, 0.8, 0, 0],
  [56, "194F001", "Heptane", 544.1, 0.2, 0.79, 0, 0],
  [57, "303F001", "Heptane", 544.4, 0.2, 0.79, 0, 0],
  [58, "176F001", "Methanol", 773.3, 0.18, 0.82, 0, 0],
  [59, "176R001", "Methanol", 769.2, 0.18, 0.82, 0, 0],
  [60, "204F001", "Methanol", 773.7, 0.18, 0.82, 0, 0],
  [61, "204R001", "Methanol", 774.1, 0.18, 0.82, 0, 0],
  [62, "301F001", "Heptane", 761.8, 0.18, 0.82, 0, 0],
  [63, "301F002", "Heptane", 767.6, 0.18, 0.81, 0, 0],
  [64, "302F001", "Heptane", 764.6, 0.18, 0.81, 0, 0],
  [65, "189R001", "Methanol", 765.9, 0.15, 0.85, 0, 0],
  [66, "189F001", "Methanol", 766.8, 0.15, 0.85, 0, 0],
  [67, "189F002", "Methanol", 767.7, 0.15, 0.85, 0, 0],
  [68, "189R003", "Methanol", 768.8, 0.15, 0.84, 0, 0],
  [69, "193R002", "Heptane", 767.1, 0.14, 0.84, 0, 0],
  [70, "193F001", "Heptane", 761, 0.15, 0.84, 0, 0],
  [71, "189R002", "Methanol", 768.3, 0.15, 0.84, 0, 0],
  [72, "193R001", "Heptane", 765.2, 0.15, 0.84, 0, 0],
  [73, "193F001", "Heptane", 761, 0.15, 0.84, 0, 0],
  [74, "221F001", "Heptane", 765.9, 0.15, 0.84, 0, 0],
  [75, "203R002", "Methanol", 770.8, 0.13, 0.85, 0, 0],
  [76, "203F001", "Methanol", 769.5, 0.13, 0.85, 0, 0],
  [77, "175R001", "Methanol", 768.4, 0.14, 0.85, 0, 0],
  [78, "175F001", "Methanol", 766, 0.14, 0.85, 0, 0],
  [79, "179F001", "Heptane", 768.1, 0.13, 0.85, 0, 0],
  [80, "207F001", "Heptane", 770, 0.13, 0.85, 0, 0],
  [81, "207F002", "Heptane", 770.2, 0.13, 0.85, 0, 0],
  [82, "304F001", "Methanol", 764.6, 0.13, 0.87, 0, 0],
  [83, "304F002", "Methanol", 772, 0.12, 0.87, 0, 0],
  [84, "304R001", "Methanol", 767.2, 0.12, 0.87, 0, 0],
  [85, "304R002", "Methanol", 771.2, 0.12, 0.87, 0, 0],
  [86, "305F002", "Methanol", 770, 0.12, 0.87, 0, 0],
  [87, "305F003", "Methanol", 771.2, 0.12, 0.87, 0, 0],
  [88, "053R001", "Methanol", 537.5, 0.25, 0.6, 0.15, 0],
  [89, "053F001", "Methanol", 537.4, 0.25, 0.6, 0.15, 0],
  [90, "141R001", "Methanol", 539.2, 0.25, 0.6, 0.15, 0],
  [91, "141F001", "Methanol", 538.3, 0.25, 0.6, 0.15, 0],
  [92, "061F002", "Heptane", 536.3, 0.25, 0.6, 0.15, 0],
  [93, "149F001", "Heptane", 537.3, 0.25, 0.6, 0.15, 0],
  [94, "C08H101", "Heptane", 533.6, 0.24, 0.56, 0.2, 0],
  [95, "C08H201", "Heptane", 534.4, 0.24, 0.56, 0.2, 0],
  [96, "C08H301", "Heptane", 534.4, 0.24, 0.56, 0.2, 0],
  [97, "C08M101", "Methanol", 534.2, 0.23, 0.56, 0.2, 0],
  [98, "C09M201", "Methanol", 537.1, 0.23, 0.52, 0.25, 0],
  [99, "C09M101", "Methanol", 535, 0.23, 0.52, 0.25, 0],
  [100, "C09H101", "Heptane", 536.7, 0.23, 0.52, 0.25, 0],
  [101, "C09H201", "Heptane", 538.7, 0.23, 0.52, 0.25, 0],
  [102, "C10H101", "Heptane", 534.2, 0.21, 0.49, 0.3, 0],
  [103, "C10H201", "Heptane", 534.3, 0.21, 0.49, 0.3, 0],
  [104, "C08M201", "Methanol", 534.1, 0.23, 0.56, 0.2, 0],
  [105, "C08M301", "Methanol", 534.6, 0.23, 0.56, 0.2, 0],
  [106, "C09M401", "Methanol", 538.3, 0.23, 0.52, 0.25, 0],
  [107, "C08M401", "Methanol", 535, 0.23, 0.56, 0.2, 0],
  [108, "C09M301", "Methanol", 538.3, 0.23, 0.52, 0.25, 0],
  [109, "C10M102", "Methanol", 536.5, 0.21, 0.49, 0.3, 0],
  [110, "C10M201", "Methanol", 537, 0.21, 0.49, 0.3, 0],
  [111, "C10M303", "Methanol", 536.9, 0.21, 0.49, 0.3, 0],
  [112, "C10M401", "Methanol", 530.7, 0.21, 0.49, 0.3, 0],
  [113, "C11M101", "Methanol", 534.6, 0.2, 0.45, 0.35, 0],
  [114, "C11M201", "Methanol", 0, 0.2, 0.45, 0.35, 0],
  [115, "C11M301", "Methanol", 535.8, 0.2, 0.45, 0.35, 0],
  [116, "C11M401", "Methanol", 536.3, 0.2, 0.45, 0.35, 0],
  [117, "C11H101", "Heptane", 531.1, 0.2, 0.45, 0.35, 0],
  [118, "C11H201", "Heptane", 532.8, 0.2, 0.44, 0.35, 0],
  [119, "C12H103", "Heptane", 532.6, 0.18, 0.42, 0.4, 0],
  [120, "C12H201", "Heptane", 532.5, 0.18, 0.42, 0.4, 0],
  [121, "C12M101", "Methanol", 526.3, 0.18, 0.42, 0.4, 0],
  [122, "C12M201", "Methanol", 531.2, 0.18, 0.42, 0.4, 0],
  [123, "C12M301", "Methanol", 532, 0.18, 0.42, 0.4, 0],
  [124, "C12M401", "Methanol", 532.4, 0.18, 0.42, 0.4, 0],
  [125, "C13M103", "Methanol", 537.2, 0.17, 0.38, 0.45, 0],
  [126, "C13M201", "Methanol", 536.1, 0.17, 0.38, 0.45, 0],
  [127, "C13M301", "Methanol", 536.7, 0.17, 0.38, 0.45, 0],
  [128, "C13M401", "Methanol", 537.3, 0.17, 0.38, 0.45, 0],
  [129, "C13H102", "Heptane", 536.2, 0.17, 0.38, 0.45, 0],
  [130, "C13H201", "Heptane", 537.2, 0.17, 0.38, 0.45, 0],
  [131, "C21H101", "Heptane", 763.9, 0.24, 0.56, 0.2, 0],
  [132, "C21H201", "Heptane", 765.2, 0.24, 0.56, 0.2, 0],
  [133, "C21H301", "Heptane", 766.7, 0.24, 0.56, 0.2, 0],
  [134, "C21H401", "Heptane", 767.2, 0.24, 0.56, 0.2, 0],
  [135, "C21H501", "Heptane", 768.2, 0.24, 0.56, 0.2, 0],
  [136, "C21H302", "Heptane", 768.1, 0.24, 0.56, 0.2, 0],
  [137, "C21H303", "Heptane", 768.2, 0.24, 0.56, 0.2, 0],
  [138, "C21H304", "Heptane", 768.6, 0.24, 0.56, 0.2, 0],
  [139, "C21H305", "Heptane", 768, 0.24, 0.56, 0.2, 0],
  [140, "C14M101", "Methanol", 533.5, 0.15, 0.35, 0.5, 0],
  [141, "C14M201", "Methanol", 534.1, 0.15, 0.35, 0.5, 0],
  [142, "C14M301", "Methanol", 534.5, 0.15, 0.35, 0.5, 0],
  [143, "C14M302", "Methanol", 534.7, 0.15, 0.35, 0.5, 0],
  [144, "C01M101", "Methanol", 761.9, 0.2, 0.75, 0.05, 0],
  [145, "C01M201", "Methanol", 763.5, 0.2, 0.75, 0.05, 0],
  [146, "C01M301", "Methanol", 765.5, 0.2, 0.75, 0.05, 0],
  [147, "C13M102", "Methanol", 535.7, 0.17, 0.38, 0.45, 0],
  [148, "C01H101", "Heptane", 764.4, 0.2, 0.75, 0.05, 0],
  [149, "C01H201", "Heptane", 766.2, 0.2, 0.75, 0.05, 0],
  [150, "C01H302", "Heptane", 767.6, 0.2, 0.75, 0.05, 0],
  [151, "C03M101", "Methanol", 762.5, 0.18, 0.67, 0.15, 0],
  [152, "C03M201", "Methanol", 765, 0.18, 0.67, 0.15, 0],
  [153, "C03M301", "Methanol", 765.6, 0.18, 0.67, 0.15, 0],
  [154, "C03H101", "Heptane", 762.3, 0.18, 0.67, 0.15, 0],
  [155, "C03H201", "Heptane", 764.9, 0.18, 0.67, 0.15, 0],
  [156, "C03H401", "Heptane", 765.7, 0.18, 0.67, 0.15, 0],
  [157, "C05M101", "Methanol", 762.1, 0.16, 0.59, 0.25, 0],
  [158, "C05M201", "Methanol", 764.4, 0.16, 0.59, 0.25, 0],
  [159, "C05M301", "Methanol", 765.5, 0.16, 0.59, 0.25, 0],
  [160, "C05M401", "Methanol", 767.6, 0.16, 0.59, 0.25, 0],
  [161, "C06M101", "Methanol", 763.3, 0.15, 0.54, 0.32, 0],
  [162, "C06M201", "Methanol", 764.4, 0.15, 0.53, 0.32, 0],
  [163, "C06M301", "Methanol", 765.9, 0.15, 0.53, 0.32, 0],
  [164, "C06M401", "Methanol", 766.1, 0.15, 0.53, 0.32, 0],
  [165, "C03H302", "Heptane", 765.4, 0.18, 0.67, 0.15, 0],
  [166, "C07M101", "Methanol", 760.8, 0.14, 0.5, 0.36, 0],
  [167, "C07M201", "Methanol", 761.6, 0.14, 0.5, 0.36, 0],
  [168, "C15M101", "Methanol", 763.4, 0.21, 0.64, 0.15, 0],
  [169, "C15M201", "Methanol", 766.1, 0.21, 0.64, 0.15, 0],
  [170, "C15M301", "Methanol", 766.7, 0.21, 0.64, 0.15, 0],
  [171, "C03H501", "Heptane", 759.9, 0.18, 0.67, 0.15, 0],
  [172, "C03H601", "Heptane", 762, 0.18, 0.67, 0.15, 0],
  [173, "C03H701", "Heptane", 762.1, 0.18, 0.67, 0.15, 0],
  [174, "C08H502", "Heptane", 531.7, 0.24, 0.56, 0.2, 0],
  [175, "C08H601", "Heptane", 532.1, 0.24, 0.56, 0.2, 0],
  [176, "C08M501", "Methanol", 536.9, 0.24, 0.56, 0.2, 0],
  [177, "C08M601", "Methanol", 537, 0.24, 0.56, 0.2, 0],
  [178, "C09H501", "Heptane", 533.6, 0.23, 0.52, 0.25, 0],
  [179, "C09H601", "Heptane", 534.4, 0.23, 0.52, 0.25, 0],
  [180, "C02H101", "Heptane", 758.4, 0.19, 0.71, 0.1, 0],
  [181, "C02H201", "Heptane", 759.1, 0.19, 0.71, 0.1, 0],
  [182, "C02H202", "Heptane", 759, 0.19, 0.71, 0.1, 0],
  [183, "C09M501", "Methanol", 534.4, 0.23, 0.52, 0.25, 0],
  [184, "C09M502", "Methanol", 535.1, 0.23, 0.52, 0.25, 0],
  [185, "C09M601", "Methanol", 535.2, 0.23, 0.52, 0.25, 0],
  [186, "C09M701", "Methanol", 536.2, 0.23, 0.52, 0.25, 0],
  [187, "C02M101", "Methanol", 758, 0.19, 0.71, 0.1, 0],
  [188, "C02M201", "Methanol", 758.1, 0.19, 0.71, 0.1, 0],
  [189, "C03M501", "Methanol", 761.2, 0.18, 0.67, 0.15, 0],
  [190, "C03M601", "Methanol", 764.6, 0.18, 0.67, 0.15, 0],
  [191, "C03M701", "Methanol", 765.3, 0.18, 0.67, 0.15, 0],
  [192, "C04M101", "Methanol", 759.5, 0.17, 0.63, 0.2, 0],
  [193, "C04M201", "Methanol", 759.1, 0.17, 0.63, 0.2, 0],
  [194, "C04H101", "Heptane", 752, 0.17, 0.63, 0.2, 0],
  [195, "C04H201", "Heptane", 752.5, 0.17, 0.63, 0.2, 0],
  [196, "C01H501", "Heptane", 758.4, 0.2, 0.75, 0.05, 0],
  [197, "C01H601", "Heptane", 759.8, 0.2, 0.75, 0.05, 0],
  [198, "C01H701", "Heptane", 760.1, 0.2, 0.75, 0.05, 0],
  [199, "C01M501", "Methanol", 754, 0.2, 0.75, 0.05, 0],
  [200, "C01M602", "Methanol", 756.1, 0.2, 0.75, 0.05, 0],
  [201, "C01M603", "Methanol", 756.9, 0.2, 0.75, 0.05, 0],
  [202, "N01M101", "Methanol", 760.2, 0.21, 0.79, 0, 0],
  [203, "N01M201", "Methanol", 761.6, 0.21, 0.79, 0, 0],
  [204, "N01H101", "Heptane", 756.5, 0.21, 0.79, 0, 0],
  [205, "N01H102", "Heptane", 757.3, 0.21, 0.79, 0, 0],
  [206, "N01H201", "Heptane", 760.2, 0.21, 0.79, 0, 0],
  [207, "N01H202", "Heptane", 762.7, 0.21, 0.79, 0, 0],
  [208, "N01H301", "Heptane", 762.9, 0.21, 0.79, 0, 0],
  [209, "N02H101", "Heptane", 759.8, 0.16, 0.84, 0, 0],
  [210, "N02H201", "Heptane", 759.8, 0.16, 0.84, 0, 0],
  [211, "N02H203", "Heptane", 759.9, 0.16, 0.84, 0, 0],
  [212, "N03H101", "Heptane", 764, 0.15, 0.85, 0, 0],
  [213, "N04H101", "Heptane", 759.8, 0.14, 0.86, 0, 0],
  [214, "N04H201", "Heptane", 759.9, 0.14, 0.86, 0, 0],
  [215, "N04M101", "Methanol", 757.6, 0.14, 0.86, 0, 0],
  [216, "N04M201", "Methanol", 758.3, 0.14, 0.86, 0, 0],
  [217, "N05M101", "Methanol", 759.4, 0.13, 0.87, 0, 0],
  [218, "N05M201", "Methanol", 760.6, 0.13, 0.87, 0, 0],
  [219, "N06M101", "Methanol", 761.6, 0.12, 0.88, 0, 0],
  [220, "N06M201", "Methanol", 761.9, 0.12, 0.88, 0, 0],
  [221, "N06M202", "Methanol", 763.7, 0.12, 0.88, 0, 0],
  [222, "H01M102", "Methanol", 759.2, 0.2, 0.75, 0, 0.05],
  [223, "H01M104", "Methanol", 759.6, 0.2, 0.75, 0, 0.05],
  [224, "H01H102", "Heptane", 755.3, 0.2, 0.75, 0, 0.05],
  [225, "H02M101", "Methanol", 753.4, 0.19, 0.71, 0, 0.1],
  [226, "H03M101", "Methanol", 759.2, 0.18, 0.67, 0, 0.15],
  [227, "H03M201", "Methanol", 760.3, 0.18, 0.67, 0, 0.15],
  [228, "N01H401", "Heptane", 767.4, 0.21, 0.79, 0, 0],
  [229, "N01H502", "Heptane", 768.1, 0.21, 0.79, 0, 0],
  [230, "N01H601", "Heptane", 769.2, 0.21, 0.79, 0, 0],
  [231, "H02H101", "Heptane", 758.8, 0.19, 0.71, 0, 0.1],
  [232, "H03H101", "Heptane", 763.7, 0.18, 0.67, 0, 0.15],
  [233, "H03H201", "Heptane", 765.9, 0.18, 0.67, 0, 0.15],
  [234, "H03H202", "Heptane", 766.5, 0.18, 0.67, 0, 0.15],
  [235, "H04H101", "Heptane", 759.3, 0.17, 0.63, 0, 0.2],
  [236, "H04H201", "Heptane", 759.3, 0.17, 0.63, 0, 0.2],
  [237, "H04H302", "Heptane", 759.6, 0.17, 0.63, 0, 0.2],
  [238, "H04H303", "Heptane", 759.8, 0.17, 0.63, 0, 0.2],
  [239, "H04M101", "Methanol", 754.2, 0.17, 0.63, 0, 0.2],
  [240, "H04M202", "Methanol", 757, 0.17, 0.63, 0, 0.2],
  [241, "H05M102", "Methanol", 759.9, 0.16, 0.59, 0, 0.25],
  [242, "H05M202", "Methanol", 761, 0.16, 0.59, 0, 0.25],
  [243, "H05H103", "Heptane", 757.9, 0.16, 0.59, 0, 0.25],
  [244, "H06M102", "Methanol", 755.6, 0.15, 0.55, 0, 0.3],
  [245, "H06M201", "Methanol", 756.7, 0.15, 0.55, 0, 0.3],
  [246, "H07M101", "Methanol", 759.2, 0.14, 0.51, 0, 0.35],
  [247, "H07M202", "Methanol", 759.8, 0.14, 0.51, 0, 0.35],
  [248, "H08M101", "Methanol", 763.5, 0.13, 0.47, 0, 0.4],
  [249, "H10H101", "Heptane", 534, 0.24, 0.56, 0, 0.2],
  [250, "H11H101", "Heptane", 532.2, 0.23, 0.52, 0, 0.25],
  [251, "H10M101", "Methanol", 534.3, 0.24, 0.56, 0, 0.2],
  [252, "H10M102", "Methanol", 534.6, 0.24, 0.56, 0, 0.2],
  [253, "H11M101", "Methanol", 531.7, 0.23, 0.52, 0, 0.25],
  [254, "H11M102", "Methanol", 531.8, 0.23, 0.52, 0, 0.25],
  [255, "H12M101", "Methanol", 531.9, 0.21, 0.49, 0, 0.3],
  [256, "H12M102", "Methanol", 531.2, 0.21, 0.49, 0, 0.3],
  [257, "H12M201", "Methanol", 531.2, 0.21, 0.49, 0, 0.3],
  [258, "H12H101", "Heptane", 529.6, 0.21, 0.49, 0, 0.3],
  [259, "H12H201", "Heptane", 529, 0.21, 0.49, 0, 0.3],
  [260, "H13H101", "Heptane", 532.5, 0.2, 0.45, 0, 0.35],
  [261, "H13H201", "Heptane", 532, 0.2, 0.45, 0, 0.35],
  [262, "H13M102", "Methanol", 527.6, 0.2, 0.45, 0, 0.35],
  [263, "H13M201", "Methanol", 527.9, 0.2, 0.45, 0, 0.35],
  [264, "H14M101", "Methanol", 532.4, 0.18, 0.42, 0, 0.4],
  [265, "H14M201", "Methanol", 532.9, 0.18, 0.42, 0, 0.4],
  [266, "H14M202", "Methanol", 533.2, 0.18, 0.42, 0, 0.4],
  [267, "H14H101", "Heptane", 528, 0.18, 0.42, 0, 0.4],
  [268, "H14H201", "Heptane", 530.3, 0.18, 0.42, 0, 0.4],
  [269, "H15H101", "Heptane", 532.2, 0.17, 0.38, 0, 0.45],
  [270, "H15H201", "Heptane", 532.5, 0.17, 0.38, 0, 0.45],
  [271, "H15M102", "Methanol", 530.4, 0.17, 0.38, 0, 0.45],
  [272, "H15M201", "Methanol", 531.5, 0.17, 0.38, 0, 0.45],
  [273, "H19H101", "Heptane", 764.7, 0.21, 0.64, 0, 0.15],
  [274, "H19H201", "Heptane", 766.2, 0.21, 0.64, 0, 0.15],
];

const FLEX_RUNS: ExperimentRun[] = FLEX_ROWS.map(([test, identifier, fuel, pressureMmHg, o2, n2, co2, he]) => ({
  ...NO_FIELDS,
  id: `PSI-69:${test}`,
  recordId: "flex",
  label: `FLEX test ${test} (${identifier})`,
  table: "PSI-69",
  locator: `PSI-69 experiment table, FLEX Test # ${test}`,
  material: `${fuel} droplet`,
  oxygenPct: [clean(o2 * 100), clean(o2 * 100)],
  oxygenNote: "Initial O₂ mole fraction × 100.",
  pressure: { value: pressureMmHg, unit: "mmHg" },
  diluents: { n2, co2, he },
}));

/* ------------------------------------------------------------------ */
/* BASS-II (PSI-25)                                                    */
/* ------------------------------------------------------------------ */

/**
 * [Test #, Fuel Sample Material (whitespace collapsed), calibrated initial O₂ % by volume].
 * The table gives fan and air-display settings, often several per run, not an airflow in cm/s,
 * and has no pressure column. Neither is reported here.
 */
const BASS_II_ROWS: Array<[string, string, number]> = [
  ["B1", "100 micron PMMA film 2 cm wide", 22.2],
  ["B2", "200 micron PMMA film 2 cm wide", 22.2],
  ["B3", "100 micron film 2 cm wide", 22.2],
  ["B4", "300 micron PMMA film 2 cm wide", 22.2],
  ["B5", "200 micron 2 cm wide", 22.2],
  ["B6", "2 cm 0.1 mm PMMA film", 21],
  ["B7", "400 micron film 2 cm wide", 22.2],
  ["B8", "2 cm 0.2 mm PMMA film", 21],
  ["B9", "2 cm 0.1 mm PMMA film", 21],
  ["B10", "1 cm 0.2 mm PMMA film", 21],
  ["B11", "2 cm 0.2 mm PMMA film", 21],
  ["B12", "300 micron film 2 cm wide", 22.2],
  ["B13", "2 cm 0.4 mm thick film", 21],
  ["B14", "1 cm wide 200 micron thick PMMA", 15],
  ["B15", "2 cm 0.1 mm PMMA film", 21],
  ["B16", "2 cm 100 micron thick PMMA", 17.3],
  ["B17", "1 cm wide 200 micron thick PMMA", 17.5],
  ["B18", "1 cm wide 200 micron thick PMMA", 17.4],
  ["B19", "2 cm 100 micron thick PMMA", 17.3],
  ["B20", "2 cm 100 micron thick PMMA", 17.4],
  ["B21", "1 cm wide 200 micron thick PMMA", 20.8],
  ["B22", "1 cm wide 200 micron thick PMMA", 20.7],
  ["F1", "Nomex natural (nomex III)", 22.2],
  ["F2", "Nomex natural (nomex III)", 21],
  ["F3", "Nomex natural (nomex III)", 21.7],
  ["F4", "Japan Wax candle", 17.4],
  ["M1", "1 mm thick PMMA 1 sided 2 cm", 22.2],
  ["M2", "3 mm thick PMMA 1 sided 2 cm wide", 22.2],
  ["M3", "2 cm wide 5 mm thick 1 sided PMMA", 20.8],
  ["M4", "5 mm thick PMMA 2 cm wide", 21.8],
  ["M5", "3 mm thick PMMA 2 sided 2 cm thick", 22.2],
  ["M6", "1 mm thick PMMA 2 cm wide", 21.8],
  ["M7", "1 cm wide PMMA 1 mm thick", 18.9],
  ["M8", "1 cm wide PMMA 2 mm thick", 19.1],
  ["M9", "1 cm wide PMMA 3 mm thick", 18],
  ["M10", "4 mm thick 1 cm wide PMMA slab", 20.1],
  ["M11", "1 cm wide PMMA 5 mm thick", 20],
  ["M12", "2 mm thick PMMA 2 cm wide", 21.7],
  ["M13", "4 mm thick PMMA 2 cm wide", 20.8],
  ["M14", "2mm thick PMMA 1 sided 2 cm wide", 22.2],
  ["M15", "2 cm 4 mm 1 sided PMMA slab", 21],
  ["M16", "1 mm thick PMMA 2 cm wide", 19.2],
  ["M17", "2 cm wide PMMA 2 mm thick", 18.8],
  ["M18", "2 cm wide PMMA 3 mm thick", 17.9],
  ["M19", "4 mm thick 2 cm 2ide PMMA slab", 19],
  ["M20", "5 mm thick PMMA 2 cm wide", 18],
  ["O1", "1/4\" clear rod", 22.2],
  ["O2", "1/4\" clear rod", 22.2],
  ["O3a", "1/4\" clear rod", 18],
  ["O3b", "1/4\" clear rod", 18],
  ["O4", "3/8\"clear rod", 14.8],
  ["O5a", "1/2\" clear PMMA rod", 15.1],
  ["O5b", "1/2\" clear PMMA rod", 14.2],
  ["O6", "1/4\" clear rod", 16.7],
  ["O7", "1/4\" clear rod", 16],
  ["O8a", "1/4\" clear rod", 15.7],
  ["O8b", "1/4\" clear rod", 15.5],
  ["O9", "1/4\" clear rod", 15],
  ["O10", "1/4\" clear rod", 16.7],
  ["O11", "1/4\" black rod", 15.4],
  ["O12", "3/8\" clear rod", 13.6],
  ["O13a", "1/2\" clear PMMA rod", 15.9],
  ["O13b", "1/2\" clear PMMA rod", 14.6],
  ["O14", "1/4\" black rod", 16.3],
  ["O15a", "3/8\" clear rod", 17.1],
  ["O15b", "3/8\" clear rod", 16.7],
  ["O16", "3/8\"clear rod", 14.5],
  ["O17", "1/4\" clear rod", 15.1],
  ["O18", "1/4\" clear rod", 15.2],
  ["O19", "1/4\" clear rod", 15.3],
  ["O20", "1/4\" clear rod", 16.5],
  ["O21", "3/8\" clear rod", 15.9],
  ["O22", "1/2\" clear rod", 15.4],
  ["P1", "1/4\" black rod", 17.7],
  ["P2", "1/4\" black rod", 17.4],
  ["P3a", "1/4\" clear rod", 17.7],
  ["P3b", "1/4 clear rod", 17.4],
  ["P4", "3/8\" black rod", 18.5],
  ["P5", "0.5\" black rod", 19.3],
  ["P6", "1/4\" black rod", 18.9],
  ["P8", "3/8\" black rod", 16.4],
  ["P9", "0.5\" black rod", 17.6],
  ["P10", "1/4\" black rod", 17],
  ["P12", "3/8\" black rod", 17.5],
  ["P13a", "0.5\" black rod", 20.7],
  ["P13b", "0.5\" black rod", 20.6],
  ["P14", "1/4 blac rod", 18.4],
  ["P15", "1/4 black rod", 18],
  ["P16", "1/4\" black rod", 18.2],
  ["P17", "1/4\" black rod", 16.8],
  ["P18", "1/4\" black rod", 20],
  ["P19", "1/4\" black rod", 17.5],
  ["P20", "1/4\" black rod", 19],
  ["P21a", "1/4 black rod", 16.3],
  ["P21b", "1/4\" black rod", 16.3],
  ["P22a", "3/8\" black rod", 20.8],
  ["P22b", "3/8\" black rod", 20],
  ["P23", "3/8\" black rod", 18.2],
  ["P24", "3/8\" black rod", 19],
  ["P25", "3/8\" clear rod", 20.9],
  ["T1", "2 cm SIBAL", 18.5],
  ["T2", "2 cm SIBAL", 18.5],
  ["T3", "4 cm spherical section", 17.2],
  ["T4", "2 cm SIBAL", 18.7],
  ["T5", "2 cm SIBAL", 18.8],
  ["T6", "2 cm SIBAL", 18.8],
  ["T7", "4 cm spherical section", 17.3],
  ["T9", "2 cm SIBAL", 16.4],
  ["T10", "2 cm SIBAL", 16.4],
  ["T11", "2 cm SIBAL", 17.1],
  ["T12", "2 cm SIBAL", 16.8],
  ["T13", "2 cm SIBAL", 17.5],
  ["T14", "2 cm SIBAL", 16.9],
  ["T15", "2 cm SIBAL", 18.7],
  ["T16", "2 cm SIBAL", 17.6],
  ["T17", "2 cm SIBAL", 16.9],
  ["T18", "2 cm SIBAL", 17.4],
  ["T19", "1 cm SIBAL", 17.2],
  ["T20", "1 cm SIBAL", 17.2],
  ["T21", "1 cm SIBAL", 17.2],
  ["T22", "1 cm SIBAL", 17.1],
  ["T23", "2 cm Sibal moved igniter", 17.2],
  ["T24", "1 cm SIBAL top side ign", 18.2],
  ["T25", "2 cm SIBAL", 20.8],
  ["T26", "2 cm SIBAL", 20.8],
  ["T27", "1 cm SIBAL", 20.7],
  ["T28a", "1 cm SIBAL", 20.7],
  ["T28b", "1 cm SIBAL", 20.7],
  ["T29", "1 cm SIBAL", 20.7],
];

const BASS_II_RUNS: ExperimentRun[] = BASS_II_ROWS.map(([test, material, o2]) => ({
  ...NO_FIELDS,
  id: `PSI-25:${test}`,
  recordId: "bass-ii",
  label: `BASS-II test ${test}`,
  table: "PSI-25",
  locator: `PSI-25 experiment table, Test # ${test}`,
  material,
  oxygenPct: [o2, o2],
  oxygenNote: "Calibrated initial O₂.",
}));

export const EXPERIMENT_RUNS: ExperimentRun[] = [
  ...SAFFIRE_VI_RUNS,
  ...SAFFIRE_EMISSION_RUNS,
  ...SAFFIRE_I_RUNS,
  ...SAFFIRE_II_RUNS,
  ...SAFFIRE_III_RUNS,
  ...FLEX_RUNS,
  ...BASS_II_RUNS,
];

const BY_RECORD = new Map<string, ExperimentRun[]>();
for (const run of EXPERIMENT_RUNS) BY_RECORD.set(run.recordId, [...(BY_RECORD.get(run.recordId) ?? []), run]);

/** Tabulated runs held for a record, in source order. Empty when IGNIS holds none. */
export function runsForRecord(recordId: string): ExperimentRun[] {
  return BY_RECORD.get(recordId) ?? [];
}

export interface RunCoverage {
  runs: number;
  oxygen: number;
  pressure: number;
  airflow: number;
}

/** How many of a record's runs report each of oxygen, pressure and airflow. */
export function runCoverage(recordId: string): RunCoverage {
  const runs = runsForRecord(recordId);
  return {
    runs: runs.length,
    oxygen: runs.filter((run) => run.oxygenPct !== null).length,
    pressure: runs.filter((run) => run.pressure !== null).length,
    airflow: runs.filter((run) => run.flowCmS !== null).length,
  };
}

/** Plain description of a record's run table, or null when IGNIS holds none. */
export function describeRunCoverage(recordId: string): string | null {
  const c = runCoverage(recordId);
  if (!c.runs) return null;
  const all = (n: number) => (n === c.runs ? "all" : n === 0 ? "none" : `${n}`);
  return `${c.runs} tabulated run${c.runs === 1 ? "" : "s"}: oxygen in ${all(c.oxygen)}, pressure in ${all(c.pressure)}, airflow in ${all(c.airflow)}.`;
}
