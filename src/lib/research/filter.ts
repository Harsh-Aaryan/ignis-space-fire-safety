import {
  CREW_ENVIRONMENTS,
  GRAVITY_REGIMES,
  HOLDING_LABEL,
  KIND_LABEL,
  TOPICS,
  type CrewEnvironment,
  type EnvironmentLink,
  type GravityRegime,
  type InvestigationRecord,
  type RecordKind,
  type Topic,
} from "@/data/research/investigations";
import type { CabinConditions } from "@/lib/research/envelope";
import { GEOMETRY_LABEL, materialTerm, type SpecimenGeometry } from "@/lib/research/materials";
import type { ResearchQuestion } from "@/lib/research/rank";

export interface IndexFilters {
  environment: CrewEnvironment | null;
  topic: Topic | null;
  kind: RecordKind | null;
  gravity: GravityRegime | null;
  query: string;
}

export const NO_FILTERS: IndexFilters = { environment: null, topic: null, kind: null, gravity: null, query: "" };

export function environmentLink(record: InvestigationRecord, environment: CrewEnvironment): EnvironmentLink | null {
  return record.environments.find((link) => link.id === environment) ?? null;
}

/** All the words a reader might search a record by. */
function searchText(record: InvestigationRecord): string {
  return [
    record.name,
    record.title,
    record.organization,
    record.platform,
    record.period,
    record.summary,
    KIND_LABEL[record.kind],
    ...record.findings.map((finding) => finding.text),
    ...record.topics.map((topic) => TOPICS[topic].label),
    ...record.gravity.map((gravity) => GRAVITY_REGIMES[gravity].label),
    ...record.conditions.fuels,
    ...record.holdings.map((holding) => `${HOLDING_LABEL[holding.kind]} ${holding.label} ${holding.psiId ?? ""}`),
    ...record.links.psi,
    ...record.links.ntrs,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterInvestigations(records: InvestigationRecord[], filters: IndexFilters): InvestigationRecord[] {
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.filter((record) => {
    if (filters.environment && !environmentLink(record, filters.environment)) return false;
    if (filters.topic && !record.topics.includes(filters.topic)) return false;
    if (filters.kind && record.kind !== filters.kind) return false;
    if (filters.gravity && !record.gravity.includes(filters.gravity)) return false;
    if (terms.length) {
      const text = searchText(record);
      if (!terms.every((term) => text.includes(term))) return false;
    }
    return true;
  });
}

export function isCrewEnvironment(value: string | null | undefined): value is CrewEnvironment {
  return !!value && value in CREW_ENVIRONMENTS;
}

export function isTopic(value: string | null | undefined): value is Topic {
  return !!value && value in TOPICS;
}

export function isRecordKind(value: string | null | undefined): value is RecordKind {
  return !!value && value in KIND_LABEL;
}

export function isGravityRegime(value: string | null | undefined): value is GravityRegime {
  return !!value && value in GRAVITY_REGIMES;
}

/** Reads filters from a URL query, ignoring anything that is not a known value. */
export function filtersFromQuery(params: { get(name: string): string | null }): IndexFilters {
  const environment = params.get("environment");
  const topic = params.get("topic");
  const kind = params.get("type");
  const gravity = params.get("gravity");
  return {
    environment: isCrewEnvironment(environment) ? environment : null,
    topic: isTopic(topic) ? topic : null,
    kind: isRecordKind(kind) ? kind : null,
    gravity: isGravityRegime(gravity) ? gravity : null,
    query: params.get("q") ?? "",
  };
}

/** Writes filters to a URL query string, without the leading "?". Empty filters are left out. */
export function filtersToQuery(filters: IndexFilters): string {
  const params = new URLSearchParams();
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.kind) params.set("type", filters.kind);
  if (filters.gravity) params.set("gravity", filters.gravity);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  return params.toString();
}

/* ------------------------------------------------------------------ */
/* Explorer state: ranking criteria plus the hard filters               */
/* ------------------------------------------------------------------ */

/**
 * What the Investigations view holds. Environment, topic, material, geometry and the question text
 * rank the index; record type and gravity tested narrow it.
 */
export interface ExplorerState {
  filters: IndexFilters;
  material: string | null;
  geometry: SpecimenGeometry | null;
  /** Rank against the cabin set in the top bar. */
  matchCabin: boolean;
}

export const NO_EXPLORER_STATE: ExplorerState = { filters: NO_FILTERS, material: null, geometry: null, matchCabin: false };

export function isSpecimenGeometry(value: string | null | undefined): value is SpecimenGeometry {
  return !!value && value in GEOMETRY_LABEL;
}

export function isMaterialId(value: string | null | undefined): value is string {
  return !!value && materialTerm(value) !== null;
}

export function explorerStateFromQuery(params: { get(name: string): string | null }): ExplorerState {
  const material = params.get("material");
  const geometry = params.get("geometry");
  return {
    filters: filtersFromQuery(params),
    material: isMaterialId(material) ? material : null,
    geometry: isSpecimenGeometry(geometry) ? geometry : null,
    matchCabin: params.get("cabin") === "1",
  };
}

export function explorerStateToQuery(state: ExplorerState): string {
  const params = new URLSearchParams(filtersToQuery(state.filters));
  if (state.material) params.set("material", state.material);
  if (state.geometry) params.set("geometry", state.geometry);
  if (state.matchCabin) params.set("cabin", "1");
  return params.toString();
}

/** Whether a URL carries any explorer parameter. */
export function hasExplorerQuery(params: { get(name: string): string | null }): boolean {
  return ["environment", "topic", "type", "gravity", "q", "material", "geometry", "cabin"].some((name) => params.get(name) !== null);
}

/** The ranking question the explorer state asks, with explicit choices only. Resolve it before ranking. */
export function explorerQuestion(state: ExplorerState, cabin: CabinConditions | null): ResearchQuestion {
  return {
    text: state.filters.query,
    environment: state.filters.environment,
    topic: state.filters.topic,
    materials: state.material ? [state.material] : [],
    geometry: state.geometry,
    cabin: state.matchCabin ? cabin : null,
  };
}

/** The explorer state a stored question corresponds to. */
export function explorerStateFromQuestion(question: ResearchQuestion, matchCabin = false): ExplorerState {
  return {
    filters: { ...NO_FILTERS, environment: question.environment, topic: question.topic, query: question.text },
    material: question.materials[0] ?? null,
    geometry: question.geometry,
    matchCabin,
  };
}
