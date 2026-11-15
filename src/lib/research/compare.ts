import { FIRE_SOURCES } from "@/data/fire/sources";
import {
  CREW_ENVIRONMENTS,
  GRAVITY_REGIMES,
  HOLDING_LABEL,
  INVESTIGATIONS,
  KIND_LABEL,
  investigationById,
  ntrsUrl,
  psiUrl,
  type CrewEnvironment,
  type Finding,
  type GravityRegime,
  type InvestigationRecord,
} from "@/data/research/investigations";
import { describeRunCoverage, runCoverage, runPressureKpa, runsForRecord, type ExperimentRun } from "@/data/research/runs";
import { citationById } from "@/data/verified";
import { RUN_TOLERANCE, describeRun, regimeText } from "@/lib/research/envelope";
import { GEOMETRY_SHORT, MATERIAL_TERMS, hasSpecificFuels, listJoin, recordGeometry, recordMaterials, type SpecimenGeometry } from "@/lib/research/materials";
import { evidenceQuality, type EvidenceQuality } from "@/lib/research/rank";

/**
 * Side-by-side comparison of two or three investigations, and where their results can be compared.
 * Everything here is read from, or derived from, the research index and the run table; derived
 * statements are marked as such. Nothing is scored.
 */

export const MAX_COMPARE = 3;

/* ------------------------------------------------------------------ */
/* Ids in the URL                                                      */
/* ------------------------------------------------------------------ */

/** Reads "a,b,c" into known, distinct record ids, at most MAX_COMPARE. */
export function idsFromParam(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => investigationById(id) !== null);
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function idsToParam(ids: string[]): string {
  return ids.join(",");
}

export function recordsForIds(ids: string[]): InvestigationRecord[] {
  return ids.map((id) => investigationById(id)).filter((record): record is InvestigationRecord => record !== null);
}

/* ------------------------------------------------------------------ */
/* Citations                                                           */
/* ------------------------------------------------------------------ */

export interface Citation {
  kind: "source" | "ntrs" | "psi" | "doi";
  label: string;
  url: string | null;
}

/** Every source a record lists: NTRS records, PSI datasets, dataset DOI and documents read for the fire model. */
export function recordCitations(record: InvestigationRecord): Citation[] {
  const out: Citation[] = [];
  for (const id of record.links.ntrs) {
    const citation = citationById(id);
    out.push({ kind: "ntrs", label: citation ? `${citation.title} (NTRS ${id})` : `NTRS ${id}`, url: ntrsUrl(id) });
  }
  for (const id of record.links.psi) out.push({ kind: "psi", label: `NASA Physical Sciences Informatics ${id}`, url: psiUrl(id) });
  if (record.links.doi) out.push({ kind: "doi", label: `Dataset DOI ${record.links.doi}`, url: `https://doi.org/${record.links.doi}` });
  for (const id of record.links.sources) {
    const source = FIRE_SOURCES.find((item) => item.id === id);
    if (source) out.push({ kind: "source", label: `${source.title}. ${source.authors}${source.year ? `, ${source.year}` : ""}`, url: source.url });
  }
  return out;
}

export interface CitedFinding {
  recordId: string;
  recordName: string;
  text: string;
  /** True when the finding was read out of the cited document itself. */
  direct: boolean;
  citations: Citation[];
}

/**
 * A finding with its citation. When the index names the document the finding was read from, that
 * document is the citation. Otherwise the record's own source list is given, marked as not direct.
 */
export function citeFinding(record: InvestigationRecord, finding: Finding): CitedFinding {
  const source = finding.sourceId ? FIRE_SOURCES.find((item) => item.id === finding.sourceId) : undefined;
  if (source) {
    return {
      recordId: record.id,
      recordName: record.name,
      text: finding.text,
      direct: true,
      citations: [{ kind: "source", label: source.short, url: source.url }],
    };
  }
  return { recordId: record.id, recordName: record.name, text: finding.text, direct: false, citations: recordCitations(record).filter((item) => item.kind !== "source") };
}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export interface Limitation {
  text: string;
  /** "derived": worked out by IGNIS from the index. "index": stated in the index entry. */
  basis: "derived" | "index";
}

export interface CompareColumn {
  record: InvestigationRecord;
  kind: string;
  platform: string;
  period: string;
  gravity: string[];
  oxygen: string;
  pressure: string;
  airflow: string;
  materials: string[];
  /** Derived from the index text; empty when the index does not say. */
  geometry: SpecimenGeometry[];
  holdings: string[];
  runs: string | null;
  evidence: EvidenceQuality;
  findings: CitedFinding[];
  limitations: Limitation[];
}

export const NOT_REPORTED = "Not reported";

export function formatRangeText(range: [number, number] | undefined, unit: string): string {
  if (!range) return NOT_REPORTED;
  const [low, high] = range;
  const join = unit.startsWith("%") ? "" : " ";
  return low === high ? `${low}${join}${unit}` : `${low}–${high}${join}${unit}`;
}

const SURFACE: CrewEnvironment[] = ["lunar-base", "mars-base", "rover"];

/** Limits of a record for a reader comparing it with others. Each is labelled derived or from the index. */
export function recordLimitations(record: InvestigationRecord): Limitation[] {
  const out: Limitation[] = [];
  if (record.kind === "standard") {
    out.push({ basis: "derived", text: "A standard: its numbers are requirements or limits, not experimental results." });
  } else {
    const partial = record.gravity.filter((g) => g === "lunar" || g === "mars");
    if (!partial.length) out.push({ basis: "derived", text: "Not tested at lunar or Martian gravity." });
    if (!record.gravity.includes("0g")) out.push({ basis: "derived", text: "Not tested in microgravity." });
  }
  const missing = (["oxygen", "pressure", "airflow"] as const).filter(
    (d) => !record.conditions[d === "oxygen" ? "oxygenPct" : d === "pressure" ? "pressureKpa" : "flowCmS"],
  );
  if (missing.length && record.kind !== "standard") {
    out.push({ basis: "derived", text: `${listJoin([...missing])} not reported in the index.`.replace(/^./, (c) => c.toUpperCase()) });
  }
  const evidence = evidenceQuality(record);
  if (evidence.grade === "flight-summary" || evidence.grade === "ground-summary") {
    out.push({ basis: "derived", text: "IGNIS holds published summary values only, not the original data files." });
  } else if (evidence.grade === "citation-only") {
    out.push({ basis: "derived", text: "IGNIS holds a citation record only; no values." });
  }
  const coverage = runCoverage(record.id);
  if (coverage.runs) {
    const lacking = (["oxygen", "pressure", "airflow"] as const).filter((d) => coverage[d] < coverage.runs);
    if (lacking.length) out.push({ basis: "derived", text: `The tabulated runs do not all report ${listJoin([...lacking], "or")}, so run-level matching is limited.` });
  }
  const notes = new Map<string, string[]>();
  for (const link of record.environments.filter((item) => SURFACE.includes(item.id) && item.basis === "transferable")) {
    notes.set(link.note, [...(notes.get(link.note) ?? []), CREW_ENVIRONMENTS[link.id].label]);
  }
  for (const [note, environments] of notes) out.push({ basis: "index", text: `${listJoin(environments)}: ${note}` });
  if (record.conditions.note) out.push({ basis: "index", text: record.conditions.note });
  return out;
}

export function compareColumn(record: InvestigationRecord): CompareColumn {
  const counts = new Map<string, number>();
  for (const holding of record.holdings) {
    const label = `${HOLDING_LABEL[holding.kind]}: ${holding.label}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    record,
    kind: KIND_LABEL[record.kind],
    platform: record.platform,
    period: record.period,
    gravity: record.gravity.map((g) => GRAVITY_REGIMES[g].label),
    oxygen: formatRangeText(record.conditions.oxygenPct, "% O₂"),
    pressure: formatRangeText(record.conditions.pressureKpa, "kPa"),
    airflow: formatRangeText(record.conditions.flowCmS, "cm/s"),
    materials: record.conditions.fuels,
    geometry: recordGeometry(record),
    holdings: [...counts.keys()],
    runs: describeRunCoverage(record.id),
    evidence: evidenceQuality(record),
    findings: record.findings.map((finding) => citeFinding(record, finding)),
    limitations: recordLimitations(record),
  };
}

/* ------------------------------------------------------------------ */
/* Comparability                                                       */
/* ------------------------------------------------------------------ */

export type OverlapResult =
  | { status: "overlap"; interval: [number, number]; text: string }
  | { status: "no-overlap"; text: string }
  | { status: "not-reported"; missing: string[]; text: string };

type RangeKey = "oxygenPct" | "pressureKpa" | "flowCmS";
type DimensionName = "oxygen" | "pressure" | "airflow";

const RANGE: Record<DimensionName, { key: RangeKey; unit: string }> = {
  oxygen: { key: "oxygenPct", unit: "% O₂" },
  pressure: { key: "pressureKpa", unit: "kPa" },
  airflow: { key: "flowCmS", unit: "cm/s" },
};

/** Overlap of one condition across records: the shared interval, "no overlap", or which records do not report it. */
export function overlap(records: InvestigationRecord[], dimension: DimensionName): OverlapResult {
  const { key, unit } = RANGE[dimension];
  const missing = records.filter((record) => !record.conditions[key]).map((record) => record.name);
  if (missing.length) return { status: "not-reported", missing, text: `Not reported for ${listJoin(missing)}.` };
  const ranges = records.map((record) => record.conditions[key]!);
  const low = Math.max(...ranges.map((range) => Math.min(...range)));
  const high = Math.min(...ranges.map((range) => Math.max(...range)));
  if (low <= high) return { status: "overlap", interval: [low, high], text: `${records.length > 2 ? "All" : "Both"} include ${formatRangeText([low, high], unit)}.` };
  return { status: "no-overlap", text: `No overlap: ${records.map((record) => `${record.name} ${formatRangeText(record.conditions[key], unit)}`).join("; ")}.` };
}

export type Verdict = "comparable" | "partial" | "not-comparable";

export const VERDICT_LABEL: Record<Verdict, string> = {
  comparable: "Directly comparable",
  partial: "Comparable in part",
  "not-comparable": "Not comparable",
};

export interface Comparability {
  recordIds: string[];
  names: string[];
  gravity: { shared: GravityRegime[]; text: string };
  oxygen: OverlapResult;
  pressure: OverlapResult;
  airflow: OverlapResult;
  materials: { shared: string[]; text: string };
  geometry: { shared: SpecimenGeometry[]; text: string };
  verdict: Verdict;
  /** One plain sentence. Derived. */
  summary: string;
  /** For two records that both hold run tables: run pairs whose shared conditions agree within RUN_TOLERANCE. */
  runPairs: RunPair[];
}

export interface RunPair {
  a: ExperimentRun;
  b: ExperimentRun;
  /** Conditions both runs report and that agree within tolerance. */
  agree: DimensionName[];
  /** Conditions only one of the two runs reports. */
  unpaired: DimensionName[];
  /** Same material in both rows; null when either row leaves the material blank. */
  sameMaterial: boolean | null;
  text: string;
}

function runMaterialKeys(run: ExperimentRun): string[] | null {
  if (!run.material) return null;
  return MATERIAL_TERMS.filter((term) => term.fuel.test(run.material!)).map((term) => term.id);
}

/**
 * Pairs of tabulated runs from two records whose conditions agree: at least two conditions reported
 * by both and within RUN_TOLERANCE, none reported by both that disagree, in an oxygen–nitrogen
 * atmosphere. Same-material pairs first. Derived; at most `limit` pairs.
 */
export function matchingRunPairs(a: InvestigationRecord, b: InvestigationRecord, limit = 3): RunPair[] {
  const runsA = runsForRecord(a.id);
  const runsB = runsForRecord(b.id);
  const pairs: Array<RunPair & { score: number }> = [];
  const plain = (run: ExperimentRun) => !run.diluents || (run.diluents.co2 === 0 && run.diluents.he === 0);
  for (const x of runsA) {
    if (!plain(x)) continue;
    for (const y of runsB) {
      if (!plain(y) || x.gravity !== y.gravity) continue;
      const agree: DimensionName[] = [];
      const unpaired: DimensionName[] = [];
      let conflict = false;
      if (x.oxygenPct && y.oxygenPct) {
        const gap = Math.max(0, x.oxygenPct[0] - y.oxygenPct[1], y.oxygenPct[0] - x.oxygenPct[1]);
        if (gap <= RUN_TOLERANCE.oxygenPct + 1e-9) agree.push("oxygen");
        else conflict = true;
      } else if (x.oxygenPct || y.oxygenPct) unpaired.push("oxygen");
      const px = runPressureKpa(x);
      const py = runPressureKpa(y);
      if (px !== null && py !== null) {
        if (Math.abs(px - py) <= RUN_TOLERANCE.pressureKpa + 1e-9) agree.push("pressure");
        else conflict = true;
      } else if (px !== null || py !== null) unpaired.push("pressure");
      if (x.flowCmS !== null && y.flowCmS !== null) {
        if (Math.abs(x.flowCmS - y.flowCmS) <= RUN_TOLERANCE.flowCmS + 1e-9) agree.push("airflow");
        else conflict = true;
      } else if (x.flowCmS !== null || y.flowCmS !== null) unpaired.push("airflow");
      if (conflict || agree.length < 2) continue;
      const mx = runMaterialKeys(x);
      const my = runMaterialKeys(y);
      const sameMaterial = mx && my ? mx.some((key) => my.includes(key)) : null;
      const material = sameMaterial === true ? "same material" : sameMaterial === false ? "different materials" : "material not stated in one row";
      const text = `${x.label} (${x.material ?? "material not stated"}; ${describeRun(x)}) and ${y.label} (${y.material ?? "material not stated"}; ${describeRun(y)}): ${listJoin(agree)} agree within tolerance${unpaired.length ? `; ${listJoin(unpaired)} reported by only one` : ""}; ${material}.`;
      pairs.push({ a: x, b: y, agree, unpaired, sameMaterial, text, score: agree.length * 2 + (sameMaterial ? 1 : 0) });
    }
  }
  return pairs
    .sort((p, q) => q.score - p.score)
    .slice(0, limit)
    .map(({ score: _score, ...pair }) => pair);
}

/** "oxygen not reported for either; pressure and airflow not reported for BASS-II". */
function notReportedPhrases(dims: Array<[DimensionName, OverlapResult]>, count: number): string[] {
  const groups = new Map<string, { names: DimensionName[]; missing: string[] }>();
  for (const [name, result] of dims) {
    if (result.status !== "not-reported") continue;
    const key = result.missing.join("|");
    const group = groups.get(key) ?? { names: [], missing: result.missing };
    group.names.push(name);
    groups.set(key, group);
  }
  return [...groups.values()].map(
    ({ names, missing }) => `${listJoin(names)} not reported for ${missing.length === count ? (count > 2 ? "any" : "either") : listJoin(missing)}`,
  );
}

function intersect<T>(lists: T[][]): T[] {
  if (!lists.length) return [];
  return lists[0].filter((item) => lists.every((list) => list.includes(item)));
}

/** Where two or three records can reasonably be compared, and where they cannot. Derived. */
export function comparability(records: InvestigationRecord[]): Comparability {
  const names = records.map((record) => record.name);
  const both = records.length > 2 ? "All" : "Both";

  const sharedGravity = intersect(records.map((record) => record.gravity));
  const gravity = {
    shared: sharedGravity,
    text: sharedGravity.length
      ? `${both} tested in ${listJoin(sharedGravity.map(regimeText))}.`
      : `Different gravity: ${records.map((record) => `${record.name} ${listJoin(record.gravity.map(regimeText))}`).join("; ")}.`,
  };

  const oxygen = overlap(records, "oxygen");
  const pressure = overlap(records, "pressure");
  const airflow = overlap(records, "airflow");

  const unitemized = records.filter((record) => !hasSpecificFuels(record)).map((record) => record.name);
  const sharedTerms = intersect(records.map((record) => recordMaterials(record).map((term) => term.label)));
  const materials = {
    shared: sharedTerms,
    text: sharedTerms.length
      ? `${both} tested ${listJoin(sharedTerms)}.`
      : unitemized.length
        ? `Materials not itemized for ${listJoin(unitemized)}.`
        : "No shared material.",
  };

  const shapes = records.map((record) => recordGeometry(record));
  const sharedShapes = intersect(shapes);
  const unknownShape = records.filter((_, i) => !shapes[i].length).map((record) => record.name);
  const geometry = {
    shared: sharedShapes,
    text: sharedShapes.length
      ? `${both} include ${listJoin(sharedShapes.map((s) => GEOMETRY_SHORT[s]))} specimens.`
      : unknownShape.length
        ? `Specimen geometry not stated for ${listJoin(unknownShape)}.`
        : `No shared specimen geometry: ${records.map((record, i) => `${record.name} ${listJoin(shapes[i].map((s) => GEOMETRY_SHORT[s]))}`).join("; ")}.`,
  };

  const dims: Array<[DimensionName, OverlapResult]> = [
    ["oxygen", oxygen],
    ["pressure", pressure],
    ["airflow", airflow],
  ];
  const overlapping = dims.filter(([, result]) => result.status === "overlap") as Array<[DimensionName, Extract<OverlapResult, { status: "overlap" }>]>;
  const disjoint = dims.filter(([, result]) => result.status === "no-overlap").map(([name]) => name);
  const standards = records.filter((record) => record.kind === "standard").map((record) => record.name);

  let verdict: Verdict;
  let summary: string;
  if (standards.length) {
    verdict = "not-comparable";
    summary = `Not comparable as results: ${listJoin(standards)} ${standards.length > 1 ? "are standards" : "is a standard"}, a requirement rather than a test.`;
  } else if (!sharedGravity.length) {
    verdict = "not-comparable";
    summary = `Not comparable: different gravity${disjoint.length ? ` and no overlapping ${listJoin(disjoint)} range` : ""}.`;
  } else if (disjoint.length) {
    verdict = "not-comparable";
    summary = `Not directly comparable: same gravity (${listJoin(sharedGravity.map(regimeText))}), but no overlapping ${listJoin(disjoint)} range.`;
  } else {
    // Same gravity and no reported condition that fails to overlap. A condition that one record does not
    // report cannot be compared, so it is named as a caveat rather than counted against the pair.
    const on = [
      listJoin(sharedGravity.map(regimeText)),
      ...overlapping.map(([name, result]) => `${name} ${formatRangeText(result.interval, RANGE[name].unit)}`),
    ];
    const material = sharedTerms.length ? `; ${both.toLowerCase()} tested ${listJoin(sharedTerms)}` : "";
    const shape = sharedShapes.length ? `, with ${listJoin(sharedShapes.map((s) => GEOMETRY_SHORT[s]))} specimens` : "";
    const caveats = notReportedPhrases(dims, records.length);
    if (overlapping.length && sharedTerms.length && sharedShapes.length) {
      verdict = "comparable";
      const caveat = caveats.length ? ` ${caveats.join("; ").replace(/^./, (c) => c.toUpperCase())}.` : "";
      summary = `Directly comparable on ${listJoin(on)}${material}${shape}.${caveat}`;
    } else {
      verdict = "partial";
      const gaps: string[] = [];
      if (!overlapping.length) gaps.push(`no condition reported by ${records.length > 2 ? "all" : "both"}`);
      if (!sharedTerms.length) gaps.push(unitemized.length ? `materials not itemized for ${listJoin(unitemized)}` : "no shared material");
      if (!sharedShapes.length) {
        gaps.push(
          unknownShape.length === records.length
            ? `specimen geometry not stated for ${records.length > 2 ? "any" : "either"}`
            : unknownShape.length
              ? `specimen geometry not stated for ${listJoin(unknownShape)}`
              : "no shared specimen geometry",
        );
      }
      gaps.push(...caveats);
      summary = `Comparable in part on ${listJoin(on)}${material}${shape}; ${gaps.join("; ")}.`;
    }
  }

  const runPairs = records.length === 2 ? matchingRunPairs(records[0], records[1]) : [];
  return { recordIds: records.map((record) => record.id), names, gravity, oxygen, pressure, airflow, materials, geometry, verdict, summary, runPairs };
}

export interface Comparison {
  columns: CompareColumn[];
  /** One per pair of records. */
  pairs: Comparability[];
  /** Across all records, when there are three. */
  all: Comparability | null;
}

export function compareRecords(records: InvestigationRecord[]): Comparison {
  const list = records.slice(0, MAX_COMPARE);
  const pairs: Comparability[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push(comparability([list[i], list[j]]));
  return { columns: list.map(compareColumn), pairs, all: list.length > 2 ? comparability(list) : null };
}

/** A selection offered on an empty compare page: three microgravity flight experiments that share SIBAL fabric. */
export const EXAMPLE_COMPARISON = ["saffire-vi", "saffire-i-iii", "bass-ii"].filter((id) => INVESTIGATIONS.some((record) => record.id === id));
