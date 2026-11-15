import { FIRE_SOURCES } from "@/data/fire/sources";
import {
  CREW_ENVIRONMENTS,
  GRAVITY_REGIMES,
  INVESTIGATIONS,
  MATRIX_TOPICS,
  TOPICS,
  type CrewEnvironment,
  type Finding,
  type GravityRegime,
  type InvestigationRecord,
  type Topic,
} from "@/data/research/investigations";
import { Bm25Index, tokenize } from "@/lib/rag/bm25";
import { PSI_CORPUS, psiInvestigation, psiLabel, type PsiInvestigation } from "@/lib/rag/corpus";
import { retrievePassages, unknownWords, type Passage } from "@/lib/rag/retrieve";
import { isCellEmpty } from "@/lib/research/coverage";
import { questionFromText, rankInvestigations, type RankedRecord, type ResearchQuestion } from "@/lib/research/rank";
import { ROUTES } from "@/lib/routes";
import type { ScenarioInput } from "./scenario-assistant";

/**
 * Research mode for Ask IGNIS: answers "which investigations / what evidence /
 * what has not been tested" questions from the research index, the source
 * registry and the NASA PSI corpus. Works with or without a selected scenario.
 * Every sentence is assembled from record fields or quoted from a record;
 * nothing is generated.
 */

export interface ResearchRecordRef {
  id: string;
  name: string;
  href: string;
  /** One line built from the ranking reasons. */
  why: string;
  /** Evidence-quality label from the ranking. */
  evidence: string;
}

export interface PassageRef {
  id: string;
  title: string;
  href: string;
  citationLabel: string;
}

export interface ResearchBrief {
  question: ResearchQuestion;
  /** Relevant records, best first (up to five). */
  ranked: RankedRecord[];
  /** The top three, shaped for display. */
  records: ResearchRecordRef[];
  findings: Array<{ record: InvestigationRecord; finding: Finding }>;
  /** Conditions the index holds no test for, then the transfer caveats stated in the records. */
  gaps: string[];
  /** Matching NASA PSI passages, one per investigation. */
  passages: Passage[];
  /** Fire-source registry ids behind the quoted findings. */
  sources: string[];
  text: string;
}

/* ------------------------------------------------------------------ */
/* Question classification                                             */
/* ------------------------------------------------------------------ */

const RESEARCH_NOUN = /\b(investigations?|stud(?:y|ies)|experiments?|research|evidence|data(?:sets?)?|publications?|papers?|literature|records?|findings?|measurements?|tests?|testing|results? (?:from|of|in) (?:nasa|flight|saffire|bass|same|flex|acme|the iss))\b/i;
const DISCOVERY = /\b(which|what|list|find|name|recommend|rank|compare|relevant|most|best|exist\w*|available|key|main)\b/i;
/** Investigation names. Upper-case forms only for words that are also ordinary English. */
const NAMED_EXACT = /\b(?:SAME(?:-R|-2)?|BASS(?:-II)?|FLEX(?:-2)?|ACME|CFI|SPICE|SLICE|DAFT|NTRS|SoFIE|PSI-\d+)\b/;
const NAMED_ANY_CASE = /\b(?:saffire(?:-[ivx]+)?|s-flame|same-r|same-2|bass-ii|flex-2|psi-\d+)\b/i;

export function mentionsInvestigation(message: string): boolean {
  return NAMED_EXACT.test(message) || NAMED_ANY_CASE.test(message);
}

/** Materials and fuels a crew might ask about. Wider than the ranking's own material list. */
export const MATERIAL_TERMS = /\b(pmma|acrylic|plexiglas\w*|kapton|polyimide|nomex|aramid|teflon|ptfe|silicone|cotton|fabrics?|cloth|textiles?|sibal|wires?|wiring|cables?|insulation|batter(?:y|ies)|lithium|candles?|wax|polymers?|plastics?|foams?|ultem|mylar|polyethylene|ldpe|fuels?|paper|droplets?|heptane|methanol)\b/i;
/** Burning and safety words. On their own they are not fire questions; see isScenarioQuestion. */
export const RISK_TERMS = /\b(burn\w*|safe\w*|safety|risk\w*|hazard\w*|danger\w*|melt\w*|catch(?:es|ing)? fire)\b/i;
export const BURN_TERMS = /\b(burn\w*|ignit\w*|flammab\w*|melt\w*|catch(?:es|ing)? fire)\b/i;
/** Crewed vehicles and places. */
export const HABITAT_CONTEXT = /\b(lunar|moon|mars|martian|habitats?|spacecraft|space(?:flight)?|cabins?|space ?stations?|iss|rovers?|crew(?:ed)?|astronauts?|gateway|artemis|orbit\w*|capsules?|partial[- ]gravity|reduced[- ]gravity)\b/i;
/** "Is it safe", "riskiest": questions that ask for a rating the index cannot give. */
const SAFETY_QUESTION = /\b(safe|safer|safest|unsafe|risky|riskier|riskiest|risks?|hazardous|dangerous)\b/i;

/**
 * Plain-language rewrites before topic parsing, so the shared ranking sees its own vocabulary:
 * "put out a fire" and "fight a fire" are suppression; "is PMMA safe", "can Kapton burn" are flammability.
 */
export function normalizeQuestion(text: string): string {
  let out = text
    .replace(/\bput(?:s|ting)?\s+(?:(?:a|an|the|it|this|that|small|cabin|electrical)\s+)*(?:fires?\s+|flames?\s+)?out\b/gi, "extinguish")
    .replace(/\bfire-?fight\w*/gi, "fire suppression")
    .replace(/\b(?:fight(?:s|ing)?|douse|dousing|quench(?:es|ing)?|smother(?:s|ing)?)\b/gi, "suppress");
  if (!/\bflammab/i.test(out) && RISK_TERMS.test(out) && (MATERIAL_TERMS.test(out) || /\bmaterials?\b/i.test(out))) out += " (flammability)";
  return out;
}

/** Questions about gaps in the evidence. */
export function asksAboutGaps(message: string): boolean {
  return /\b(gaps?|untested|unmeasured|unknowns?|missing|(?:not|never|yet to be|n['’]t) (?:yet )?(?:been )?(?:tested|measured|studied))\b/i.test(message);
}

/** Research discovery: which investigations or data, what is known, compare, gaps. Independent of any scenario. */
export function isResearchQuestion(message: string): boolean {
  const m = message.trim();
  if (/\bwhat(?:['’]s| is| was)? (?:already )?known\b|\bwhat (?:do|does|did) (?:we|nasa|researchers|the research) (?:know|show|say|find)\b/i.test(m)) return true;
  if (asksAboutGaps(m)) return true;
  if (/\bcompare\b|\bversus\b|\bvs\.?\b|\bdifference between\b/i.test(m) && (mentionsInvestigation(m) || RESEARCH_NOUN.test(m))) return true;
  if (RESEARCH_NOUN.test(m) && DISCOVERY.test(m)) return true;
  return mentionsInvestigation(m) && /\b(what|which|how|did|does|do|find|found|measur\w*|show\w*|learn\w*|tell|study|studied|test\w*)\b/i.test(m);
}

/** References to the open run: "this run", "my scenario", "supports this?", "what if I…", "explain". */
export function refersToRun(message: string, isSummary: (m: string) => boolean = () => false): boolean {
  const m = message.toLowerCase().trim();
  return /\b(?:my|this|current|our)\s+(?:run|scenario|simulation|setup|set-up|result|results|fire|flame|smoke|detector|alarm|material|forecast|case)\b/.test(m)
    || /\bthe\s+(?:run|scenario|simulation|setup|forecast)\b/.test(m)
    || /\b(?:this|it|here)\s*[?.!]*$/.test(m)
    // "what changes if I stop ventilation?", "why hasn't the smoke detector alarmed?", "did the fire go out?"
    || /\bif (?:i|we)\b/.test(m)
    || /\b(?:has|have|did|was|is|does)(?:n['’]?t)?\s+(?:the|my)\s+\w+(?:\s+\w+)?\s+(?:alarm|ignit|burn|go|went|start|stop|trigger|respond|spread)\w*/.test(m)
    || isSummary(m);
}

/* ------------------------------------------------------------------ */
/* Named investigations                                                */
/* ------------------------------------------------------------------ */

function nameMatcher(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[–-]/g, "[–-]").replace(/\s+/g, "\\s+");
  // All-caps words such as SAME, BASS and FLEX are also English words: match them only as written.
  const anyCase = /[\d\s–-]/.test(name) || name.length >= 7;
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, anyCase ? "i" : "");
}

function psiAliases(investigation: PsiInvestigation): string[] {
  // "ACME" alone names a family of investigations, not one record.
  const parts = investigation.acronym.split("/").map((part) => part.trim()).filter((part) => part && part !== "ACME");
  const short = parts.flatMap((part) => (/^ACME\s+\S*-/.test(part) ? [part.replace(/^ACME\s+/, "")] : []));
  return [...parts, ...short, investigation.accession];
}

const NAMED_PSI = PSI_CORPUS.investigations.map((investigation) => ({ investigation, matchers: psiAliases(investigation).map(nameMatcher) }));
const NAMED_RECORDS = INVESTIGATIONS.map((record) => ({
  record,
  matchers: [record.name, ...record.links.psi.flatMap((id) => {
    const linked = psiInvestigation(id);
    return linked ? psiAliases(linked) : [id];
  })].map(nameMatcher),
}));

/** Records and PSI investigations the question names, e.g. "SAME-R", "FLEX-2", "PSI-25", "Saffire", and the names as written. */
export function namedInQuestion(text: string): { records: InvestigationRecord[]; psi: PsiInvestigation[]; mentions: string[] } {
  const found: Array<{ at: number; name: string }> = [];
  const test = (matchers: RegExp[]) => matchers.some((re) => {
    const match = re.exec(text);
    if (match) found.push({ at: match.index, name: match[0] });
    return !!match;
  });
  const psi = NAMED_PSI.filter(({ matchers }) => test(matchers)).map(({ investigation }) => investigation);
  let records = NAMED_RECORDS.filter(({ matchers }) => test(matchers)).map(({ record }) => record);
  if (!records.length && /\bsaffire\b/i.test(text)) records = INVESTIGATIONS.filter((record) => /^saffire\b/i.test(record.name));
  // The names as the user wrote them, in reading order, without a shorter name inside a longer one.
  const mentions = found
    .filter((a) => !found.some((b) => b.name.length > a.name.length && b.at <= a.at && a.at < b.at + b.name.length))
    .sort((a, b) => a.at - b.at)
    .map((item) => item.name);
  return { records, psi, mentions: [...new Set(mentions)] };
}

/* ------------------------------------------------------------------ */
/* Phrasing                                                            */
/* ------------------------------------------------------------------ */

const ENVIRONMENT_PHRASE: Record<CrewEnvironment, string> = {
  spacecraft: "crewed spacecraft",
  station: "space stations",
  "lunar-base": "lunar surface habitats",
  "mars-base": "Martian surface habitats",
  rover: "pressurized rovers",
};

const GRAVITY_AT: Record<GravityRegime, string> = {
  "0g": "in microgravity",
  lunar: `at lunar gravity (${GRAVITY_REGIMES.lunar.g} g)`,
  mars: `at Martian gravity (${GRAVITY_REGIMES.mars.g} g)`,
  "1g": "at Earth gravity",
};

const TOPIC_NOUN: Record<Topic, string> = {
  "flammability-limits": "flammability-limit test",
  "flame-spread": "flame-spread test",
  "cabin-scale-fire": "cabin-scale fire test",
  smoke: "smoke-particle measurement",
  detection: "fire detection test",
  suppression: "suppression test",
  "atmosphere-limits": "atmosphere-limit study",
};

/** Topics a partial-gravity gap also bears on: detection and suppression act on a whole-cabin fire. */
const RELATED_TOPICS: Partial<Record<Topic, Topic[]>> = {
  detection: ["smoke", "cabin-scale-fire"],
  smoke: ["detection", "cabin-scale-fire"],
  suppression: ["cabin-scale-fire"],
};

/** Environment words. The ranking already weighs them; in a quote search they would favor any microgravity sentence. */
const ENVIRONMENT_WORDS = /\b(?:lunar|moon|mars|martian|microgravity|low-gravity|gravity|partial|habitats?|spacecraft|station|iss|orbit\w*|rovers?|surface)\b/gi;

/** Words that say "this is a research question" but carry no topic. Dropped before text matching. */
const GENERIC = new Set(
  ("fire fires nasa investigation investigations investigated relevant research researched study studies studied experiment experiments examined explored data dataset evidence record records known matter matters most test tests tested testing condition conditions compare compared comparison difference differences between versus vs did does done know learn learned exist exists available key main best top tell show list find found "
    + "behave behaves behaving behavior behaviour put puts putting use used uses using happen happens happened work works make makes get gets go goes keep keeps act acts look looks like "
    + "safe safer safest unsafe safety risk risks risky riskier riskiest danger dangerous hazard hazards hazardous worst material materials thing things way ways will would can could should might").split(" "),
);

function topical(text: string): string {
  return text.split(/\s+/).filter((word) => !GENERIC.has(word.toLowerCase().replace(/[^a-z0-9-]/g, ""))).join(" ");
}

function listJoin(items: string[], conjunction = "and"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

function focusPhrase(q: ResearchQuestion, named: string[]): string {
  if (named.length) return listJoin(named);
  const topic = q.topic ? TOPICS[q.topic].label.toLowerCase() : null;
  const environment = q.environment ? ENVIRONMENT_PHRASE[q.environment] : null;
  if (topic && environment) return `${topic} in ${environment}`;
  return topic ?? environment ?? (q.materials.length ? listJoin(q.materials.map((m) => (m.length <= 5 ? m.toUpperCase() : m))) : "this question");
}

function environmentForGravity(g: number): CrewEnvironment | null {
  if (g < 0.05) return "spacecraft";
  if (Math.abs(g - GRAVITY_REGIMES.lunar.g) < 0.06) return "lunar-base";
  if (Math.abs(g - GRAVITY_REGIMES.mars.g) < 0.08) return "mars-base";
  return null;
}

/** A ranked record shaped for display: link, reason and evidence label. */
export function recordRef(item: RankedRecord, named = false): ResearchRecordRef {
  return { id: item.record.id, name: item.record.name, href: ROUTES.investigation(item.record.id), why: whyLine(item, named), evidence: item.evidence.label };
}

function whyLine(ranked: RankedRecord, named: boolean): string {
  const parts = ranked.reasons
    .filter((reason) => reason.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, named ? 1 : 2)
    .map((reason) => (reason.factor === "environment" ? reason.detail.split(":")[0] : reason.detail).replace(/\.$/, ""));
  if (named) parts.unshift("Named in the question");
  const line = parts.map((part, i) => (i ? part.charAt(0).toLowerCase() + part.slice(1) : part)).join("; ").replace(/\bmartian\b/g, "Martian");
  return line ? `${line}.` : "Closest text match in the index.";
}

function firstSentence(text: string, maxWords = 45): string {
  const sentence = text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)[0] ?? text;
  const words = sentence.split(/\s+/);
  return words.length <= maxWords ? sentence : `${words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "")}…`;
}

/* ------------------------------------------------------------------ */
/* Evidence assembly                                                   */
/* ------------------------------------------------------------------ */

/** With a run open: does the question ask about another environment or material than the run's? Then it is a research question. */
export function asksBeyondRun(text: string, input: ScenarioInput): boolean {
  const asked = questionFromText(normalizeQuestion(text));
  const run = questionFromText(input.material.name);
  if (asked.environment && asked.environment !== environmentForGravity(input.gravityG)) return true;
  if (asked.materials.some((material) => !run.materials.includes(material))) return true;
  return EXTRA_MATERIALS.some(([pattern]) => pattern.test(text) && !pattern.test(input.material.name));
}

/** The research question, optionally informed by the open scenario's gravity, atmosphere and material. */
export function researchQuestionFor(text: string, input: ScenarioInput | null = null, useScenario = false): ResearchQuestion {
  const normalized = normalizeQuestion(text);
  const parsed = questionFromText(normalized);
  // Ranking matches the remaining words against record text; drop words with no topic.
  const base = { ...parsed, text: topical(normalized) };
  if (!input || !useScenario) return base;
  return {
    ...base,
    environment: base.environment ?? environmentForGravity(input.gravityG),
    materials: [...new Set([...base.materials, ...questionFromText(input.material.name).materials])],
    cabin: { oxygenPct: input.oxygenPct, pressureKpa: input.pressureKpa, flowCmS: input.ventilationMs * 100, gravityG: input.gravityG },
  };
}

function topicWords(topic: Topic | null): string {
  return topic ? topical(`${TOPICS[topic].label} ${TOPICS[topic].description}`) : "";
}

function pickFindings(text: string, q: ResearchQuestion, top: RankedRecord[]) {
  const items = top.flatMap(({ record }) => record.findings.map((finding) => ({ record, finding })));
  if (!items.length) return [];
  const query = [topical(text).replace(ENVIRONMENT_WORDS, " "), topicWords(q.topic), ...q.materials].join(" ");
  const hits = new Bm25Index(items.map((item) => ({ item, fields: [{ text: item.finding.text, weight: 1 }] }))).search(query, items.length);
  const picked: typeof items = [];
  for (const { item, score } of hits) {
    // A second quote must be nearly as relevant as the first, and from another record.
    if (picked.some((p) => p.record.id === item.record.id) || (picked.length && score < 0.6 * hits[0].score)) continue;
    picked.push(item);
    if (picked.length === 2) break;
  }
  if (picked.length) return picked;
  // Nothing in the question matches a finding ("how does fire behave on the Moon?"): lead with each top record's first finding.
  return top.slice(0, 2).flatMap(({ record }) => (record.findings[0] ? [{ record, finding: record.findings[0] }] : []));
}

const MATERIAL_LABEL: Record<string, string> = {
  pmma: "PMMA (acrylic)", sibal: "cotton fabric", nomex: "Nomex", kapton: "Kapton", teflon: "Teflon (PTFE)", silicone: "silicone",
  ultem: "Ultem", mylar: "Mylar", wire: "wire insulation", droplet: "liquid fuel droplet", battery: "lithium battery",
};
/** Materials the ranking does not parse but the index does mention. [pattern, text searched in records, label]. */
const EXTRA_MATERIALS: Array<[RegExp, string, string]> = [[/\b(?:candles?|wax)\b/i, "candle", "candle"]];

function recordText(record: InvestigationRecord): string {
  return [record.name, record.title, record.summary, ...record.findings.map((f) => f.text), ...record.conditions.fuels, record.conditions.note ?? ""].join(" ").toLowerCase();
}

/** Asked materials with no indexed test at all, or none at the asked (or any) partial gravity. */
function materialGaps(q: ResearchQuestion, text: string): string[] {
  const asked = new Map<string, string>(q.materials.map((m) => [m, MATERIAL_LABEL[m] ?? m]));
  for (const [pattern, term, label] of EXTRA_MATERIALS) if (pattern.test(text)) asked.set(term, label);
  const gravity = q.environment ? CREW_ENVIRONMENTS[q.environment].gravity : null;
  const out: string[] = [];
  for (const [term, label] of asked) {
    const tested = INVESTIGATIONS.filter((record) => record.kind !== "standard" && recordText(record).includes(term));
    if (!tested.length) out.push(`No ${label} test is indexed.`);
    else if (gravity === "lunar" || gravity === "mars") {
      if (!tested.some((record) => record.gravity.includes(gravity))) out.push(`No ${label} test ${GRAVITY_AT[gravity]} is indexed.`);
    } else if (!gravity && !tested.some((record) => record.gravity.includes("lunar") || record.gravity.includes("mars"))) {
      out.push(`No ${label} test at lunar or Martian gravity is indexed.`);
    }
  }
  return out;
}

/** For "is it safe" questions: the index rates nothing; material acceptance and its stated limit come from the standard's record. */
function safetyNote(q: ResearchQuestion, text: string): { sentence: string; gap: string | null; sources: string[] } | null {
  if (!SAFETY_QUESTION.test(text) || !(MATERIAL_TERMS.test(text) || /\bmaterials?\b/i.test(text))) return null;
  const standard = INVESTIGATIONS.find((record) => record.id === "nasa-std-6001");
  if (!standard) return null;
  const link = standard.environments.find((l) => l.id === (q.environment ?? "spacecraft"));
  const partial = q.environment === "lunar-base" || q.environment === "mars-base" || q.environment === "rover";
  return {
    sentence: `IGNIS does not rate materials as safe or risky; the records show which materials burned under which conditions. Flight acceptance follows ${standard.name}${link ? `; for ${ENVIRONMENT_PHRASE[link.id]} its record notes: “${link.note}”` : "."}`,
    gap: link && partial ? `${standard.name}: ${link.note}` : null,
    sources: standard.links.sources.filter((id) => FIRE_SOURCES.some((s) => s.id === id)),
  };
}

function cellGaps(q: ResearchQuestion, wantsGaps: boolean): string[] {
  const matrix = (topics: Topic[]) => [...new Set(topics)].filter((topic) => MATRIX_TOPICS.includes(topic));
  const sentence = (topics: Topic[], gravities: GravityRegime[]) =>
    `No ${listJoin(topics.map((topic) => TOPIC_NOUN[topic]), "or")} ${gravities.length > 1 ? "at lunar or Martian gravity" : GRAVITY_AT[gravities[0]]} is indexed.`;
  const gravity = q.environment ? CREW_ENVIRONMENTS[q.environment].gravity : null;
  if (gravity === "lunar" || gravity === "mars") {
    // The asked partial-gravity regime: the topic and what it depends on, or every topic.
    const candidates = q.topic ? matrix([q.topic, ...(RELATED_TOPICS[q.topic] ?? [])]) : MATRIX_TOPICS;
    const empty = candidates.filter((topic) => isCellEmpty(topic, gravity));
    return empty.length ? [sentence(empty, [gravity])] : [];
  }
  const out: string[] = [];
  if (gravity && q.topic && MATRIX_TOPICS.includes(q.topic) && isCellEmpty(q.topic, gravity)) out.push(sentence([q.topic], [gravity]));
  if (!q.topic && !wantsGaps) return out;
  // Beyond the asked regime, name the partial-gravity cells the index leaves empty.
  const candidates = q.topic ? matrix([q.topic]) : MATRIX_TOPICS;
  const lunar = candidates.filter((topic) => isCellEmpty(topic, "lunar"));
  const mars = candidates.filter((topic) => isCellEmpty(topic, "mars"));
  if (lunar.length && lunar.join() === mars.join()) out.push(sentence(lunar, ["lunar", "mars"]));
  else {
    if (lunar.length) out.push(sentence(lunar, ["lunar"]));
    if (mars.length) out.push(sentence(mars, ["mars"]));
  }
  return out;
}

/** Transfer caveats stated in the records for the asked environment, grouped by wording. */
function transferCaveats(q: ResearchQuestion, top: RankedRecord[]): Array<{ names: string[]; note: string }> {
  if (!q.environment) return [];
  const groups = new Map<string, string[]>();
  for (const { record } of top) {
    const link = record.environments.find((l) => l.id === q.environment && l.basis === "transferable");
    if (link) groups.set(link.note, [...(groups.get(link.note) ?? []), record.name]);
  }
  return [...groups].map(([note, names]) => ({ note, names }));
}

const PSI_MIN_SCORE = 4;

/** Ranked records, findings, gaps and PSI passages for a research question. */
export function researchBrief(text: string, input: ScenarioInput | null = null, { useScenario = false }: { useScenario?: boolean } = {}): ResearchBrief {
  const q = researchQuestionFor(text, input, useScenario);
  const named = namedInQuestion(text);
  const normalized = normalizeQuestion(text);
  // A subject the index never mentions ("plasma thrusters for spacecraft") must not be answered with
  // whatever matches a habitat word. Anything the ranking can parse (environment, topic, material) skips this.
  const parsedSomething = !!(q.environment || q.topic || q.materials.length || MATERIAL_TERMS.test(text) || named.records.length || named.psi.length);
  const residual = topical(normalized).replace(ENVIRONMENT_WORDS, " ");
  const subject = tokenize(residual).length;
  const unknown = unknownWords(residual).filter((word) => tokenize(word).length);
  const uncovered = !asksAboutGaps(text) && unknown.length > 0 && unknown.length * 2 >= subject;
  // With only a habitat parsed ("plasma thrusters for spacecraft"), answer for the habitat but say the subject is not covered.
  const uncoveredNote = uncovered && parsedSomething && !q.topic && !q.materials.length && !MATERIAL_TERMS.test(text) && !named.records.length && !named.psi.length
    ? `Nothing in the IGNIS research index or the NASA PSI combustion records mentions “${unknown.join(" ")}”. What the index holds for the habitat in general:`
    : null;
  if (!parsedSomething && uncovered) {
    return {
      question: q, ranked: [], records: [], findings: [], gaps: [], passages: [], sources: [],
      text: `Nothing in the IGNIS research index or the NASA PSI combustion records mentions “${unknown.join(" ")}”. The index covers spacecraft and habitat fire safety: flammability limits, flame spread, cabin-scale fires, smoke, detection and suppression.`,
    };
  }
  const namedIds = new Set(named.records.map((record) => record.id));
  const all = rankInvestigations(q);
  // Named records lead. When the question names investigations, others must match on more than wording.
  const ranked = [
    ...all.filter((item) => namedIds.has(item.record.id)),
    ...all.filter((item) => !namedIds.has(item.record.id) && item.relevance > 0
      && (!namedIds.size && !named.psi.length || item.reasons.some((reason) => reason.points > 0 && reason.factor !== "text"))),
  ].slice(0, 5);
  const top = ranked.slice(0, 3);
  const records = top.map((item) => recordRef(item, namedIds.has(item.record.id)));
  const findings = pickFindings(normalized, q, top);
  const caveats = transferCaveats(q, top);
  const untested = [...materialGaps(q, text), ...cellGaps(q, asksAboutGaps(text))];
  const safety = safetyNote(q, text);
  const gaps = [...new Set([...untested, ...(safety?.gap ? [safety.gap] : []), ...caveats.slice(0, 2).map(({ names, note }) => `${listJoin(names)}: ${note}`)])].slice(0, 5);

  // PSI passages: named investigations first, then the best matches on topical words.
  const query = [topical(normalized), q.topic ? TOPICS[q.topic].label : "", q.environment ? CREW_ENVIRONMENTS[q.environment].label : "", ...q.materials].join(" ");
  const namedAccessions = new Set(named.psi.map((investigation) => investigation.accession));
  const retrieved = retrievePassages(query, { k: 12, kinds: ["psi"], perInvestigation: 1 });
  // With a topic, an unnamed passage must use one of its words, not only share the habitat or a generic term.
  const topicTerms = new Set(tokenize(topicWords(q.topic)));
  const onTopic = (p: Passage) => !topicTerms.size || tokenize(p.text).some((term) => topicTerms.has(term));
  const passages = [
    ...retrieved.filter((p) => namedAccessions.has(p.citeId)),
    ...retrieved.filter((p) => !namedAccessions.has(p.citeId) && p.score >= PSI_MIN_SCORE && onTopic(p)),
  ].slice(0, 3);
  const sources = [...new Set([
    ...findings.map(({ finding }) => finding.sourceId).filter((id): id is string => !!id && FIRE_SOURCES.some((s) => s.id === id)),
    ...(safety?.sources ?? []),
  ])];

  const focus = focusPhrase(q, named.mentions.slice(0, 3));
  const paragraphs: string[] = uncoveredNote ? [uncoveredNote] : [];
  if (top.length) {
    let lead = `For ${focus}, the closest records in the IGNIS research index are ${top.map((item) => `${item.record.name} (${item.evidence.label.toLowerCase()})`).join("; ")}.`;
    if (top.length === 1) lead = `For ${focus}, the closest record in the IGNIS research index is ${top[0].record.name} (${top[0].evidence.label.toLowerCase()}).`;
    if (q.environment) {
      const gravity = CREW_ENVIRONMENTS[q.environment].gravity;
      const at = GRAVITY_AT[gravity];
      // Judge by the gravity regimes a record tested, not by its environment link: a rover link can be "transferable"
      // for a record that did test at lunar gravity.
      const tested = top.filter(({ record }) => record.kind !== "standard" && record.gravity.includes(gravity));
      if (!tested.length) lead += ` None of them was tested ${at}${caveats.length ? "; they transfer with the caveats listed below" : ""}.`;
      else if (tested.length < top.length) lead += ` ${listJoin(tested.map(({ record }) => record.name))} ${tested.length > 1 ? "include tests" : "includes tests"} ${at}; the others do not.`;
    }
    paragraphs.push(lead);
    paragraphs.push(findings.map(({ record, finding }) => `${record.name} reports: “${finding.text}”`).join(" "));
  } else {
    paragraphs.push(`No record in the IGNIS research index addresses ${focus} directly.`);
  }
  // Named PSI investigations are quoted from their own records, so comparisons rest on NASA's wording.
  const quoted = named.psi.filter((p) => p.objective).slice(0, 2);
  if (quoted.length) paragraphs.push(quoted.map((p) => `${psiLabel(p)} states its objective as: “${firstSentence(p.objective)}”`).join(" "));
  const limits: string[] = [];
  if (safety) limits.push(safety.sentence);
  if (untested.length) limits.push(`Not yet tested: ${untested.join(" ")}`);
  if (caveats.length) limits.push(`Caveat stated for ${listJoin(caveats[0].names)}: “${caveats[0].note}”`);
  if (top.length && top.every((item) => item.evidence.grade !== "measured-table" && item.evidence.grade !== "standard")) {
    limits.push("IGNIS holds no original measurements for these records; their values come from published summaries or citations.");
  }
  if (limits.length) paragraphs.push(limits.join(" "));
  const related = passages.filter((p) => !quoted.some((n) => n.accession === p.citeId));
  if (related.length) paragraphs.push(`Related NASA PSI records: ${listJoin(related.map((p) => p.citationLabel))}.`);
  else if (!top.length && !quoted.length) paragraphs.push("The NASA PSI combustion records held by IGNIS do not match it either. Try naming a topic (detection, smoke, flame spread, suppression) or an environment (spacecraft, lunar or Martian habitat).");

  return { question: q, ranked, records, findings, gaps, passages, sources, text: paragraphs.join("\n\n") };
}

export function passageRef(passage: Passage): PassageRef {
  return { id: passage.id, title: passage.title, href: passage.href, citationLabel: passage.citationLabel };
}

export const RESEARCH_CONTEXT = `Research index, ${INVESTIGATIONS.length} records · NASA PSI combustion corpus, ${PSI_CORPUS.investigations.length} investigations retrieved ${PSI_CORPUS.retrievedAt.slice(0, 10)}`;

export const NO_RUN_TEXT = "No run is set up yet, so there is no result to explain. Choose a habitat and a piece of equipment, then select a material and ignition source to start one.\n\nResearch questions work without a run. Ask, for example, which NASA investigations matter most for lunar habitat fire detection, what is known about smoke particle size in microgravity, or which fire conditions have not been tested at Martian gravity.";
