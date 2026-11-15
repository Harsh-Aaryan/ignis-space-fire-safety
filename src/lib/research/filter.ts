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
