import { MATRIX_TOPICS, TOPICS, type GravityRegime, type InvestigationRecord, type Topic } from "@/data/research/investigations";
import { isCellEmpty } from "@/lib/research/coverage";
import { compareRecords, recordCitations, type Citation, type CitedFinding } from "@/lib/research/compare";
import {
  RUN_TOLERANCE_TEXT,
  evidenceMatch,
  regimeText,
  type CabinConditions,
  type CabinSpecimen,
  type EvidenceMatchStatus,
} from "@/lib/research/envelope";
import { GEOMETRY_SHORT, listJoin, materialTerm } from "@/lib/research/materials";
import { describeQuestion, environmentRegimes, inSentence, questionEnvironments, questionGaps, resolveQuestion, type QuestionPart, type ResearchQuestion } from "@/lib/research/rank";
import { ROUTES } from "@/lib/routes";

/**
 * Evidence brief: the question, the investigations picked for it, how they compare, what their
 * recorded findings support, what stays uncertain, and the sources. A pure data structure, rendered
 * here to Markdown and JSON and by the Results page to HTML. Nothing in it is written for the brief:
 * conclusions are findings recorded in the index, and derived statements are labelled as derived.
 */

export const BRIEF_FORMAT = "ignis-evidence-brief";

export interface BriefCabin {
  name: string;
  conditions: CabinConditions;
  specimen?: CabinSpecimen;
}

export interface BriefInvestigation {
  id: string;
  name: string;
  title: string;
  kind: string;
  platform: string;
  period: string;
  path: string;
  evidence: { label: string; basis: string[] };
  cabinMatch: { status: EvidenceMatchStatus; label: string; reasons: string[] } | null;
}

export interface BriefRow {
  label: string;
  /** "derived" when IGNIS worked the row out from the index rather than reading it. */
  basis: "index" | "derived";
  cells: string[];
}

export interface BriefPair {
  between: string[];
  verdict: string;
  summary: string;
  details: string[];
}

export type UncertaintyKind = "coverage-gap" | "gravity" | "missing-dimension" | "holdings" | "cabin" | "comparability";

export interface BriefUncertainty {
  kind: UncertaintyKind;
  text: string;
  recordIds: string[];
}

export interface EvidenceBrief {
  format: typeof BRIEF_FORMAT;
  generatedAt: string;
  question: { text: string; criteria: QuestionPart[] };
  cabin: { name: string; oxygenPct: number; pressureKpa: number; flowCmS: number; gravityG: number; material: string | null; geometry: string | null } | null;
  investigations: BriefInvestigation[];
  comparison: { rows: BriefRow[]; pairs: BriefPair[] };
  conclusions: CitedFinding[];
  uncertainties: BriefUncertainty[];
  citations: Citation[];
  method: string[];
}

export const UNCERTAINTY_LABEL: Record<UncertaintyKind, string> = {
  "coverage-gap": "Evidence gap",
  gravity: "Gravity not tested",
  "missing-dimension": "Not reported",
  holdings: "Holdings",
  cabin: "Your cabin",
  comparability: "Comparability",
};

function topicGap(topic: Topic, regimes: GravityRegime[]): string | null {
  const empty = regimes.filter((regime) => isCellEmpty(topic, regime));
  return empty.length ? `No indexed test addresses ${inSentence(TOPICS[topic].label)} at ${listJoin(empty.map(regimeText), "or")}.` : null;
}

export function buildEvidenceBrief(input: {
  question: ResearchQuestion;
  records: InvestigationRecord[];
  cabin?: BriefCabin | null;
  generatedAt?: string;
}): EvidenceBrief {
  const question = resolveQuestion(input.question);
  const comparison = compareRecords(input.records);
  const records = comparison.columns.map((column) => column.record);
  const cabin = input.cabin ?? null;

  const investigations: BriefInvestigation[] = comparison.columns.map((column) => {
    const match = cabin && column.record.kind !== "standard" ? evidenceMatch(column.record, cabin.conditions, cabin.specimen) : null;
    return {
      id: column.record.id,
      name: column.record.name,
      title: column.record.title,
      kind: column.kind,
      platform: column.platform,
      period: column.period,
      path: ROUTES.investigation(column.record.id),
      evidence: { label: column.evidence.label, basis: column.evidence.basis },
      cabinMatch: match ? { status: match.status, label: match.label, reasons: match.reasons } : null,
    };
  });

  const cols = comparison.columns;
  const rows: BriefRow[] = [
    { label: "Record type", basis: "index", cells: cols.map((c) => c.kind) },
    { label: "Platform", basis: "index", cells: cols.map((c) => c.platform) },
    { label: "Period", basis: "index", cells: cols.map((c) => c.period) },
    { label: "Gravity tested", basis: "index", cells: cols.map((c) => c.gravity.join("; ")) },
    { label: "Oxygen", basis: "index", cells: cols.map((c) => c.oxygen) },
    { label: "Pressure", basis: "index", cells: cols.map((c) => c.pressure) },
    { label: "Airflow", basis: "index", cells: cols.map((c) => c.airflow) },
    { label: "Materials tested", basis: "index", cells: cols.map((c) => c.materials.join("; ")) },
    { label: "Specimen geometry", basis: "derived", cells: cols.map((c) => (c.geometry.length ? c.geometry.map((g) => GEOMETRY_SHORT[g]).join(", ") : "Not stated")) },
    { label: "Held in IGNIS", basis: "index", cells: cols.map((c) => [...c.holdings, ...(c.runs ? [c.runs] : [])].join("; ")) },
    { label: "Evidence quality", basis: "derived", cells: cols.map((c) => c.evidence.label) },
    { label: "Limitations", basis: "derived", cells: cols.map((c) => c.limitations.map((item) => (item.basis === "index" ? `${item.text} (index)` : item.text)).join(" ")) },
  ];

  const pairs: BriefPair[] = [...comparison.pairs, ...(comparison.all ? [comparison.all] : [])].map((pair) => ({
    between: pair.names,
    verdict: pair.verdict,
    summary: pair.summary,
    details: [
      pair.gravity.text,
      `Oxygen: ${pair.oxygen.text}`,
      `Pressure: ${pair.pressure.text}`,
      `Airflow: ${pair.airflow.text}`,
      pair.materials.text,
      pair.geometry.text,
      ...pair.runPairs.map((run) => `Run pair: ${run.text}`),
    ],
  }));

  const conclusions = cols.flatMap((column) => column.findings);

  const uncertainties: BriefUncertainty[] = [];
  const add = (kind: UncertaintyKind, text: string, recordIds: string[]) => {
    if (!uncertainties.some((item) => item.text === text)) uncertainties.push({ kind, text, recordIds });
  };

  // Coverage gaps: the question's own, then those of the selected records' topics.
  for (const gap of questionGaps(question)) add("coverage-gap", gap, []);
  const asked = questionEnvironments(question);
  const partial = asked.length ? [...new Set(asked.flatMap(environmentRegimes))] : (["lunar", "mars"] as GravityRegime[]);
  const topics = [...new Set(records.flatMap((record) => record.topics))].filter((topic) => MATRIX_TOPICS.includes(topic));
  for (const topic of topics) {
    const gap = topicGap(topic, partial);
    if (gap) add("coverage-gap", gap, records.filter((record) => record.topics.includes(topic)).map((record) => record.id));
  }

  const experiments = records.filter((record) => record.kind !== "standard");
  const untested = experiments.filter((record) => !partial.some((regime) => record.gravity.includes(regime)));
  if (untested.length) {
    add("gravity", `Not tested at ${listJoin(partial.map(regimeText), "or")}: ${listJoin(untested.map((record) => record.name))}.`, untested.map((record) => record.id));
  }

  for (const column of cols) {
    if (column.record.kind === "standard") continue;
    const missing = [
      ["oxygen", column.oxygen],
      ["pressure", column.pressure],
      ["airflow", column.airflow],
    ].filter(([, value]) => value === "Not reported").map(([name]) => name);
    if (missing.length) add("missing-dimension", `${column.record.name} does not report ${listJoin(missing, "or")}.`, [column.record.id]);
  }

  const summaryOnly = cols.filter((c) => c.evidence.grade === "flight-summary" || c.evidence.grade === "ground-summary").map((c) => c.record);
  if (summaryOnly.length) add("holdings", `IGNIS holds published summary values only, not original data files, for ${listJoin(summaryOnly.map((r) => r.name))}.`, summaryOnly.map((r) => r.id));
  const citationOnly = cols.filter((c) => c.evidence.grade === "citation-only").map((c) => c.record);
  if (citationOnly.length) add("holdings", `IGNIS holds a citation record and no values for ${listJoin(citationOnly.map((r) => r.name))}.`, citationOnly.map((r) => r.id));

  for (const item of investigations) {
    if (item.cabinMatch && item.cabinMatch.status !== "matching-run") {
      add("cabin", `${item.name}, against your cabin: ${item.cabinMatch.label}. ${item.cabinMatch.reasons.join(" ")}`, [item.id]);
    }
  }

  for (const pair of comparison.pairs) {
    if (pair.verdict === "not-comparable") add("comparability", `${listJoin(pair.names)}: ${pair.summary}`, pair.recordIds);
  }

  const seen = new Set<string>();
  const citations = records.flatMap(recordCitations).filter((citation) => {
    const key = citation.url ?? citation.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const method = [
    "Supported conclusions are findings recorded in the IGNIS research index for the selected investigations, quoted as recorded. Where the index does not trace a finding to one document, the record's own sources are cited instead.",
    "Rows and statements marked derived were worked out by IGNIS from the index and the run table. They are not statements made by the sources.",
    "Evidence quality describes what IGNIS holds for a record: original data files, published summary values or a citation. It is not a judgement of the work.",
    "An empty coverage cell means no such test is indexed here, not that none exists.",
  ];
  if (cabin) method.push(RUN_TOLERANCE_TEXT);

  const material = cabin?.specimen?.materialId ? materialTerm(cabin.specimen.materialId)?.label ?? null : null;
  return {
    format: BRIEF_FORMAT,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    question: { text: input.question.text.trim(), criteria: describeQuestion(input.question) },
    cabin: cabin
      ? {
          name: cabin.name,
          ...cabin.conditions,
          material,
          geometry: cabin.specimen?.geometry ? GEOMETRY_SHORT[cabin.specimen.geometry] : null,
        }
      : null,
    investigations,
    comparison: { rows, pairs },
    conclusions,
    uncertainties,
    citations,
    method,
  };
}

/* ------------------------------------------------------------------ */
/* Markdown and JSON                                                   */
/* ------------------------------------------------------------------ */

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
}

function link(citation: Citation): string {
  return citation.url ? `[${citation.label}](${citation.url})` : citation.label;
}

function round(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

export function briefToMarkdown(brief: EvidenceBrief, siteOrigin = ""): string {
  const lines: string[] = [];
  lines.push("# Evidence brief", "");
  lines.push(`Generated ${brief.generatedAt.slice(0, 10)} from the IGNIS research index.`, "");

  lines.push("## Question", "");
  lines.push(brief.question.text ? `> ${brief.question.text}` : "No question was entered.", "");
  if (brief.question.criteria.length) {
    for (const part of brief.question.criteria) lines.push(`- ${part.label}: ${part.value}${part.source === "question" ? " (read from the question)" : ""}`);
    lines.push("");
  }
  if (brief.cabin) {
    const c = brief.cabin;
    lines.push(
      `Cabin: ${c.name}, ${round(c.oxygenPct)}% O₂, ${round(c.pressureKpa)} kPa, ${round(c.flowCmS)} cm/s, ${round(c.gravityG, 3)} g${c.material ? `, ${c.material}` : ""}${c.geometry ? `, ${c.geometry} specimen` : ""}.`,
      "",
    );
  }

  lines.push("## Selected investigations", "");
  if (!brief.investigations.length) lines.push("No investigation was selected.", "");
  brief.investigations.forEach((item, i) => {
    lines.push(`${i + 1}. **${item.name}**: ${item.title}. ${item.kind}, ${item.platform}, ${item.period}. Evidence: ${item.evidence.label}. ${siteOrigin}${item.path}`);
    if (item.cabinMatch) lines.push(`   - Against your cabin: ${item.cabinMatch.label}. ${item.cabinMatch.reasons.join(" ")}`);
  });
  lines.push("");

  if (brief.investigations.length) {
    lines.push("## Side-by-side comparison", "");
    lines.push(`| | ${brief.investigations.map((item) => cell(item.name)).join(" | ")} |`);
    lines.push(`|---|${brief.investigations.map(() => "---").join("|")}|`);
    for (const row of brief.comparison.rows) lines.push(`| ${row.label}${row.basis === "derived" ? " (derived)" : ""} | ${row.cells.map(cell).join(" | ")} |`);
    lines.push("");
    if (brief.comparison.pairs.length) {
      lines.push("### Where results can be compared (derived)", "");
      for (const pair of brief.comparison.pairs) {
        lines.push(`- **${listJoin(pair.between)}.** ${pair.summary}`);
        for (const detail of pair.details) lines.push(`  - ${detail}`);
      }
      lines.push("");
    }
  }

  lines.push("## Supported conclusions", "");
  if (!brief.conclusions.length) lines.push("None: no investigation was selected.", "");
  else {
    lines.push("Each statement is a finding recorded for a selected investigation, with its source.", "");
    for (const item of brief.conclusions) {
      lines.push(`- ${item.recordName}: ${item.text} Source: ${item.citations.map(link).join("; ") || "not recorded"}${item.direct ? "" : " (record sources)"}.`);
    }
    lines.push("");
  }

  lines.push("## Unresolved uncertainties", "");
  if (!brief.uncertainties.length) lines.push("None identified from the index.", "");
  else {
    for (const item of brief.uncertainties) lines.push(`- ${UNCERTAINTY_LABEL[item.kind]}: ${item.text}`);
    lines.push("");
  }

  lines.push("## Citations", "");
  if (!brief.citations.length) lines.push("None.", "");
  else {
    for (const citation of brief.citations) lines.push(`- ${link(citation)}`);
    lines.push("");
  }

  lines.push("## Method", "");
  for (const note of brief.method) lines.push(`- ${note}`);
  lines.push("");
  return lines.join("\n");
}

export function briefToJson(brief: EvidenceBrief): string {
  return JSON.stringify(brief, null, 2);
}

export function briefFilename(brief: EvidenceBrief, extension: "md" | "json"): string {
  return `ignis-evidence-brief-${brief.generatedAt.slice(0, 10)}.${extension}`;
}
