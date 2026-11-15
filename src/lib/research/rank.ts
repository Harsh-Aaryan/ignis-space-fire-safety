import {
  CREW_ENVIRONMENTS,
  INVESTIGATIONS,
  MATRIX_TOPICS,
  TOPICS,
  type CrewEnvironment,
  type GravityRegime,
  type InvestigationRecord,
  type Topic,
} from "@/data/research/investigations";
import { describeRunCoverage, runsForRecord } from "@/data/research/runs";
import { isCellEmpty } from "@/lib/research/coverage";
import { EVIDENCE_MATCH_LABEL, evidenceMatch, regimeText, type CabinConditions, type CabinSpecimen } from "@/lib/research/envelope";
import {
  GEOMETRY_SHORT,
  MATERIAL_TERMS,
  fuelsMatching,
  hasSpecificFuels,
  listJoin,
  materialTerm,
  recordGeometry,
  type SpecimenGeometry,
} from "@/lib/research/materials";

/**
 * Explainable research ranking.
 *
 * Relevance answers "how directly does this record address the question?" and is built only from
 * itemized, inspectable reasons, each with its points. Evidence quality answers "how strong is what
 * IGNIS holds for this record?" and is reported separately: a highly relevant record can rest on weak
 * evidence and vice versa. Neither is a measure of scientific merit beyond what the index records.
 *
 * Public API (shared contract — keep signatures stable):
 *   rankInvestigations(question, records?) -> RankedRecord[]
 *   questionFromText(text) -> ResearchQuestion
 *   evidenceQuality(record) -> EvidenceQuality
 *   isEmptyQuestion(question) -> boolean
 * Additions: resolveQuestion, describeQuestion, questionGaps, environmentRegimes, RANK_POINTS.
 */

export type { SpecimenGeometry } from "@/lib/research/materials";

export interface ResearchQuestion {
  /** Free text as the user typed it. */
  text: string;
  environment: CrewEnvironment | null;
  topic: Topic | null;
  /** Lower-case material keys from MATERIAL_TERMS, e.g. "pmma", "sibal", "kapton". */
  materials: string[];
  geometry: SpecimenGeometry | null;
  /** Cabin atmosphere to compare with tested conditions, when known. */
  cabin: CabinConditions | null;
  /**
   * Every environment the question names when it names more than one ("Moon and Mars", "partial gravity").
   * environment holds the first. Optional: read it with questionEnvironments().
   */
  environments?: CrewEnvironment[];
}

export type RankFactor = "environment" | "gravity" | "topic" | "material" | "geometry" | "conditions" | "text";

export interface RankReason {
  factor: RankFactor;
  /** Contribution to relevance. Negative values are penalties. */
  points: number;
  /** One plain sentence a reader can check against the record. */
  detail: string;
}

export type EvidenceGrade = "measured-table" | "flight-summary" | "ground-summary" | "citation-only" | "standard";

export interface EvidenceQuality {
  grade: EvidenceGrade;
  label: string;
  /** 1 (weakest) to 4 (strongest), for ordering only. */
  strength: 1 | 2 | 3 | 4;
  basis: string[];
}

export interface RankedRecord {
  record: InvestigationRecord;
  relevance: number;
  /** Every contribution, largest effect first. */
  reasons: RankReason[];
  evidence: EvidenceQuality;
  /** 1-based position in the ranking. */
  position: number;
  /** Relevance above zero. Records at or below zero are shown as less related, never hidden. */
  related: boolean;
}

export const EMPTY_QUESTION: ResearchQuestion = { text: "", environment: null, topic: null, materials: [], geometry: null, cabin: null };

export function isEmptyQuestion(q: ResearchQuestion): boolean {
  return !q.text.trim() && !q.environment && !q.topic && !q.materials.length && !q.geometry && !q.cabin;
}

/* ------------------------------------------------------------------ */
/* Evidence quality                                                    */
/* ------------------------------------------------------------------ */

export const EVIDENCE_GRADE_HINT: Record<EvidenceGrade, string> = {
  "measured-table": "IGNIS holds an original NASA data file for this record.",
  "flight-summary": "A flight experiment; IGNIS holds values published in its papers, not the original data files.",
  "ground-summary": "IGNIS holds values published in the record's papers.",
  "citation-only": "IGNIS holds a citation record and no values.",
  standard: "A requirement or limit, not an experiment.",
};

export function evidenceQuality(record: InvestigationRecord): EvidenceQuality {
  const basis: string[] = [];
  const tables = record.holdings.filter((h) => h.kind === "table" || h.kind === "telemetry");
  const runs = describeRunCoverage(record.id);
  if (record.kind === "standard") {
    return { grade: "standard", label: "Standard or requirement", strength: 2, basis: ["A requirement or limit, not an experiment."] };
  }
  if (tables.length) {
    basis.push(`${tables.length} original NASA data file${tables.length > 1 ? "s" : ""} held in IGNIS.`);
    if (runs) basis.push(runs);
    if (record.kind === "flight-experiment") basis.push("Flight experiment.");
    return { grade: "measured-table", label: "Original measurements held", strength: 4, basis };
  }
  const summaries = record.holdings.some((h) => h.kind === "summary");
  if (summaries && record.kind === "flight-experiment") {
    basis.push("Flight experiment.", "IGNIS holds published summary values, not the original data files.");
    if (runs) basis.push(`${runs} Transcribed from the published tables.`);
    return { grade: "flight-summary", label: "Flight results, published summary", strength: 3, basis };
  }
  if (summaries) {
    return { grade: "ground-summary", label: "Published summary", strength: 2, basis: ["IGNIS holds published summary values only."] };
  }
  return { grade: "citation-only", label: "Citation only", strength: 1, basis: ["IGNIS holds a citation record, no values."] };
}

/* ------------------------------------------------------------------ */
/* Question parsing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Environment words. Every pattern that matches adds its environments, in the order they appear in
 * the text, so "Moon and Mars" reads as both. Gravity levels and "partial gravity" count too.
 */
const ENVIRONMENT_WORDS: Array<[RegExp, CrewEnvironment[]]> = [
  [/\b(rovers?)\b/i, ["rover"]],
  [/\b(lunar|moon|artemis)\b/i, ["lunar-base"]],
  [/(?:^|[^\d.])0?\.165?\s?g\b/i, ["lunar-base"]],
  [/\b(mars|martian)\b/i, ["mars-base"]],
  [/(?:^|[^\d.])0?\.38\s?g\b/i, ["mars-base"]],
  [/\b(partial|reduced)[\s-]gravity\b/i, ["lunar-base", "mars-base"]],
  [/\b(station|stations|iss|gateway)\b/i, ["station"]],
  [/\b(spacecraft|capsule|vehicle|orion|cygnus|orbit|orbital|microgravity|0\s?g|zero.?g)\b/i, ["spacecraft"]],
];

/** Words that tie "spread" or "growth" to fire, so "growing plants" is not read as flame spread. */
const FIRE_CONTEXT = /\b(fires?|flames?|burn\w*|combust\w*|ignit\w*|smoulder\w*|smolder\w*)\b/i;

interface TopicRule {
  pattern: RegExp;
  topic: Topic;
  /** The pattern only counts when the text also speaks of fire or names a tested material. */
  needsFireContext?: boolean;
}

/** Checked in order: the first rule that matches sets the topic. The same patterns find the topic inside a record's statements. */
const TOPIC_WORDS: TopicRule[] = [
  { pattern: /\b(detect\w*|alarm\w*|sensor\w*)\b/i, topic: "detection" },
  { pattern: /\b(suppress\w*|extinguish\w*|mist|agent|halon)\b/i, topic: "suppression" },
  { pattern: /\b(smoke|aerosol\w*|particle\w*)\b/i, topic: "smoke" },
  { pattern: /\b(spread\w*|growth|grow\w*)\b/i, topic: "flame-spread", needsFireContext: true },
  { pattern: /\b(flammab\w*|oxygen index|loi|moc|extinction|ignit\w*)\b/i, topic: "flammability-limits" },
  { pattern: /\b(cabin.?scale|heat release|hrr|large.?scale)\b/i, topic: "cabin-scale-fire" },
  { pattern: /\b(exposure|toxic\w*|smac|habitab\w*)\b/i, topic: "atmosphere-limits" },
];

function topicPattern(topic: Topic): RegExp {
  return TOPIC_WORDS.find((rule) => rule.topic === topic)!.pattern;
}

/** Shapes read from text. Wires and droplets are read as materials, so they are not repeated here. */
const GEOMETRY_WORDS: Array<[RegExp, SpecimenGeometry]> = [
  [/\b(thin|films?|fabrics?|sheets?|textiles?|cloth)\b/i, "thin"],
  [/\b(thick|slabs?|rods?|blocks?)\b/i, "thick"],
];

function environmentsFromText(text: string): CrewEnvironment[] {
  const found = ENVIRONMENT_WORDS.map(([re, envs]) => ({ at: text.search(re), envs }))
    .filter((item) => item.at >= 0)
    .sort((a, b) => a.at - b.at)
    .flatMap((item) => item.envs);
  const unique = [...new Set(found)];
  // A rover already implies lunar or Martian gravity; naming the body it drives on does not add a second environment.
  return unique.includes("rover") ? ["rover", ...unique.filter((env) => env !== "rover" && env !== "lunar-base" && env !== "mars-base")] : unique;
}

/** Every environment a question asks about: `environments` when set, else `environment`. */
export function questionEnvironments(question: ResearchQuestion): CrewEnvironment[] {
  if (question.environments?.length) return question.environments;
  return question.environment ? [question.environment] : [];
}

function withEnvironments(envs: CrewEnvironment[]): Pick<ResearchQuestion, "environment" | "environments"> {
  return envs.length > 1 ? { environment: envs[0], environments: envs } : { environment: envs[0] ?? null };
}

export function questionFromText(text: string): ResearchQuestion {
  const materials = MATERIAL_TERMS.filter((term) => term.words.test(text)).map((term) => term.id);
  const fireContext = FIRE_CONTEXT.test(text) || materials.length > 0;
  const topic = TOPIC_WORDS.find((rule) => rule.pattern.test(text) && (!rule.needsFireContext || fireContext))?.topic ?? null;
  const geometry = GEOMETRY_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
  return { text, ...withEnvironments(environmentsFromText(text)), topic, materials, geometry, cabin: null };
}

/**
 * Fills the criteria a person did not set from what their text says. Explicit choices win;
 * materials are the union of both.
 */
export function resolveQuestion(question: ResearchQuestion): ResearchQuestion {
  const parsed = questionFromText(question.text);
  const explicit = questionEnvironments(question);
  return {
    text: question.text,
    ...withEnvironments(explicit.length ? explicit : questionEnvironments(parsed)),
    topic: question.topic ?? parsed.topic,
    materials: [...new Set([...question.materials, ...parsed.materials])],
    geometry: question.geometry ?? parsed.geometry,
    cabin: question.cabin,
  };
}

export interface QuestionPart {
  factor: Exclude<RankFactor, "text" | "gravity">;
  label: string;
  value: string;
  /** "selected": chosen in a control. "question": read from the typed text. */
  source: "selected" | "question";
}

/** What IGNIS ranks on, and where each criterion came from. */
export function describeQuestion(question: ResearchQuestion): QuestionPart[] {
  const resolved = resolveQuestion(question);
  const parts: QuestionPart[] = [];
  const chosen = questionEnvironments(question);
  for (const env of questionEnvironments(resolved)) {
    parts.push({ factor: "environment", label: "Environment", value: CREW_ENVIRONMENTS[env].label, source: chosen.includes(env) ? "selected" : "question" });
  }
  if (resolved.topic) parts.push({ factor: "topic", label: "Topic", value: TOPICS[resolved.topic].label, source: question.topic ? "selected" : "question" });
  for (const id of resolved.materials) {
    const term = materialTerm(id);
    if (term) parts.push({ factor: "material", label: "Material", value: term.label, source: question.materials.includes(id) ? "selected" : "question" });
  }
  if (resolved.geometry) parts.push({ factor: "geometry", label: "Specimen", value: GEOMETRY_SHORT[resolved.geometry], source: question.geometry ? "selected" : "question" });
  if (resolved.cabin) {
    const c = resolved.cabin;
    parts.push({
      factor: "conditions",
      label: "Cabin",
      value: `${round(c.oxygenPct)}% O₂, ${round(c.pressureKpa)} kPa, ${round(c.flowCmS)} cm/s, ${round(c.gravityG, 3)} g`,
      source: "selected",
    });
  }
  return parts;
}

/* ------------------------------------------------------------------ */
/* Coverage gaps a question runs into                                  */
/* ------------------------------------------------------------------ */

/** Gravity regimes an environment implies. Rovers may work on the Moon or Mars. */
export function environmentRegimes(environment: CrewEnvironment): GravityRegime[] {
  return environment === "rover" ? ["lunar", "mars"] : [CREW_ENVIRONMENTS[environment].gravity];
}

/** A label inside a sentence: first letter lower-cased, except proper nouns ("Martian surface habitats", "ISS"). */
export function inSentence(label: string): string {
  return /^(Martian|Mars|Moon|ISS|Gateway|Earth|NASA|Saffire|SIBAL|PMMA)\b/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

function regimeWords(regimes: GravityRegime[], conjunction = "or"): string {
  return listJoin(regimes.map(regimeText), conjunction);
}

/**
 * Empty cells of the coverage matrix that a question falls into, as plain statements.
 * An empty cell means no such test is indexed here, not that none exists.
 */
export function questionGaps(question: ResearchQuestion): string[] {
  const q = resolveQuestion(question);
  const regimes = [...new Set(questionEnvironments(q).flatMap(environmentRegimes))];
  const out: string[] = [];
  if (q.topic && MATRIX_TOPICS.includes(q.topic)) {
    const target = regimes.length ? regimes : (["lunar", "mars"] as GravityRegime[]);
    const empty = target.filter((regime) => isCellEmpty(q.topic!, regime));
    if (empty.length) out.push(`No indexed test addresses ${inSentence(TOPICS[q.topic].label)} at ${regimeWords(empty)}.`);
  } else if (regimes.length) {
    for (const regime of regimes.filter((r) => r !== "0g" && r !== "1g")) {
      const empty = MATRIX_TOPICS.filter((topic) => isCellEmpty(topic, regime));
      if (empty.length) out.push(`At ${regimeWords([regime])}, no indexed test addresses: ${empty.map((topic) => inSentence(TOPICS[topic].label)).join("; ")}.`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

/** Points per reason. Published so the ranking can be read and checked. */
export const RANK_POINTS = {
  environment: { tested: 30, applies: 22, transferable: 10, notLinked: -15, noteOnTopic: 3 },
  gravity: { tested: 15, notTested: -5 },
  topic: { match: 40, mismatch: -10, primary: 5, perStatement: 1, statementsMax: 4 },
  material: { tested: 15, mentioned: 5, notTested: -6 },
  geometry: { match: 8, mismatch: -4 },
  conditions: { "matching-run": 20, "within-ranges": 8, insufficient: 0, outside: -8 },
  text: { perTerm: 3, max: 12 },
} as const;

const STOP = new Set(
  "a an and are as at be by can do does for from has have how i in is it its of on or the this to was were what when where which who why will with about most more best relevant research investigations investigation studies study nasa fire fires data results tests test tested known there their than then that these those into under over our we you should would could compare compared comparing comparison did does done show shows tell between versus give list find need want please help explain any all also each other such like much many some here whats".split(
    " ",
  ),
);

function recordText(r: InvestigationRecord): string {
  return [
    r.name,
    r.title,
    r.summary,
    r.platform,
    ...r.findings.map((f) => f.text),
    ...r.conditions.fuels,
    r.conditions.note ?? "",
    ...r.controlsUse,
    ...r.modelUse,
    ...r.topics.map((t) => TOPICS[t].label),
    ...r.environments.map((e) => e.note),
    ...r.holdings.map((h) => h.label),
    ...r.links.psi,
    r.organization,
  ]
    .join(" ")
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Patterns whose words have already been used by a structured criterion, so text matching skips them. */
function consumedPatterns(q: ResearchQuestion): RegExp[] {
  const patterns: RegExp[] = [];
  const envs = questionEnvironments(q);
  if (envs.length) {
    patterns.push(...ENVIRONMENT_WORDS.filter(([, list]) => list.some((env) => envs.includes(env))).map(([re]) => re));
    patterns.push(/^(gravity|partial|reduced)$/);
  }
  if (q.topic) patterns.push(topicPattern(q.topic));
  for (const id of q.materials) {
    const term = materialTerm(id);
    if (term) patterns.push(term.words);
  }
  if (q.geometry) patterns.push(...GEOMETRY_WORDS.filter(([, g]) => g === q.geometry).map(([re]) => re));
  return patterns;
}

/** Words of the question left for plain text matching. */
export function freeTerms(question: ResearchQuestion): string[] {
  const consumed = consumedPatterns(question);
  const tokens = question.text.toLowerCase().match(/[a-z0-9₂]+(?:-[a-z0-9₂]+)*/g) ?? [];
  return [...new Set(tokens.filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t) && !consumed.some((re) => re.test(t))))];
}

function round(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

function scoreRecord(record: InvestigationRecord, q: ResearchQuestion, terms: string[]): RankReason[] {
  const reasons: RankReason[] = [];
  const P = RANK_POINTS;

  const envs = questionEnvironments(q);
  if (envs.length) {
    const links = envs.map((id) => ({ id, link: record.environments.find((l) => l.id === id) ?? null }));
    const points = Math.round(links.reduce((sum, { link }) => sum + (link ? P.environment[link.basis] : P.environment.notLinked), 0) / links.length);
    const phrase = ({ id, link }: (typeof links)[number]) => {
      const label = inSentence(CREW_ENVIRONMENTS[id].label);
      if (!link) return `not linked to ${label} in the index`;
      return `${link.basis === "tested" ? "tested for" : link.basis === "applies" ? "applies in" : "transferable to"} ${label}`;
    };
    const detail =
      links.length === 1
        ? links[0].link
          ? `${phrase(links[0]).replace(/^./, (c) => c.toUpperCase())}: ${links[0].link.note}`
          : `${phrase(links[0]).replace(/^./, (c) => c.toUpperCase())}.`
        : `${links.map(phrase).join("; ").replace(/^./, (c) => c.toUpperCase())}. Points are the average over the ${links.length} environments asked about.`;
    reasons.push({ factor: "environment", points, detail });

    if (q.topic) {
      const pattern = topicPattern(q.topic);
      const onTopic = links.find(({ link }) => link && pattern.test(link.note));
      if (onTopic) {
        reasons.push({
          factor: "environment",
          points: P.environment.noteOnTopic,
          detail: `Its index note for ${inSentence(CREW_ENVIRONMENTS[onTopic.id].label)} concerns ${inSentence(TOPICS[q.topic].label)}: ${onTopic.link!.note}`,
        });
      }
    }

    const regimes = [...new Set(envs.flatMap(environmentRegimes))];
    const hit = regimes.filter((r) => record.gravity.includes(r));
    const tested = regimeWords(record.gravity, "and");
    if (hit.length) {
      reasons.push({
        factor: "gravity",
        points: P.gravity.tested,
        detail: record.kind === "standard" ? `Stated to apply at ${regimeWords(hit, "and")}.` : `Includes tests at ${regimeWords(hit, "and")}.`,
      });
    } else {
      reasons.push({
        factor: "gravity",
        points: P.gravity.notTested,
        detail: record.kind === "standard" ? `Defined for ${tested}, not ${regimeWords(regimes)}.` : `No test at ${regimeWords(regimes)}; tested in ${tested}.`,
      });
    }
  }

  if (q.topic) {
    const label = inSentence(TOPICS[q.topic].label);
    if (record.topics.includes(q.topic)) {
      reasons.push({ factor: "topic", points: P.topic.match, detail: `Addresses ${label}.` });
      // Finer signals, so records that all address the topic are separated by how much of the record is about it.
      if (record.topics[0] === q.topic) {
        reasons.push({ factor: "topic", points: P.topic.primary, detail: `${TOPICS[q.topic].label} is listed first among its topics in the index.` });
      }
      const pattern = topicPattern(q.topic);
      const statements = [...record.findings.map((finding) => finding.text), ...record.controlsUse].filter((statement) => pattern.test(statement)).length;
      if (statements) {
        reasons.push({
          factor: "topic",
          points: Math.min(P.topic.statementsMax, statements * P.topic.perStatement),
          detail: `${statements} of its findings and control statements concern ${label}.`,
        });
      }
    } else {
      reasons.push({ factor: "topic", points: P.topic.mismatch, detail: `Does not address ${label}.` });
    }
  }

  const text = recordText(record);
  for (const id of q.materials) {
    const term = materialTerm(id);
    if (!term) continue;
    const fuels = fuelsMatching(record, term);
    if (fuels.length) reasons.push({ factor: "material", points: P.material.tested, detail: `Tested ${term.label}: ${fuels.join("; ")}.` });
    else if (term.fuel.test(text)) reasons.push({ factor: "material", points: P.material.mentioned, detail: `Mentions ${term.label}, but it is not among the tested fuels.` });
    else if (hasSpecificFuels(record)) reasons.push({ factor: "material", points: P.material.notTested, detail: `Did not test ${term.label}; tested ${record.conditions.fuels.join("; ")}.` });
  }

  if (q.geometry) {
    const shapes = recordGeometry(record);
    const word = GEOMETRY_SHORT[q.geometry];
    if (shapes.includes(q.geometry)) reasons.push({ factor: "geometry", points: P.geometry.match, detail: `Includes ${word} specimens.` });
    else if (shapes.length) reasons.push({ factor: "geometry", points: P.geometry.mismatch, detail: `Tested ${listJoin(shapes.map((s) => GEOMETRY_SHORT[s]))} specimens, not ${word}.` });
  }

  if (q.cabin && record.kind !== "standard") {
    const specimen: CabinSpecimen = { materialId: q.materials[0] ?? null, geometry: q.geometry };
    const match = evidenceMatch(record, q.cabin, specimen);
    reasons.push({ factor: "conditions", points: P.conditions[match.status], detail: `${EVIDENCE_MATCH_LABEL[match.status]} for your cabin. ${match.reasons[0] ?? ""}`.trim() });
  }

  const hits = terms.filter((t) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}`).test(text));
  if (hits.length) {
    reasons.push({
      factor: "text",
      points: Math.min(P.text.max, P.text.perTerm * hits.length),
      detail: `Mentions ${hits.slice(0, 4).map((h) => `“${h}”`).join(", ")}${hits.length > 4 ? ` and ${hits.length - 4} more` : ""}.`,
    });
  }

  return reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

/**
 * Ranks records by relevance to a question. Order: relevance, then evidence quality, then index order,
 * so ties are stable. Pass a resolved question (see resolveQuestion) to use what the text says.
 */
export function rankInvestigations(question: ResearchQuestion, records: InvestigationRecord[] = INVESTIGATIONS): RankedRecord[] {
  const terms = freeTerms(question);
  const scored = records.map((record, index) => {
    const reasons = scoreRecord(record, question, terms);
    const relevance = reasons.reduce((sum, r) => sum + r.points, 0);
    return { record, relevance, reasons, evidence: evidenceQuality(record), index };
  });
  // Nothing asked: keep index order rather than sorting by evidence alone.
  if (!isEmptyQuestion(question)) scored.sort((a, b) => b.relevance - a.relevance || b.evidence.strength - a.evidence.strength || a.index - b.index);
  return scored.map(({ index: _index, ...rest }, i) => ({ ...rest, position: i + 1, related: rest.relevance > 0 }));
}

/** Whether a record holds run-level rows a cabin can be matched against. */
export function hasRunTable(record: InvestigationRecord): boolean {
  return runsForRecord(record.id).length > 0;
}
