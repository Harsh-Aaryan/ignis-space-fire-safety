import { Search } from "lucide-react";
import { GRAVITY_REGIMES, KIND_LABEL, TOPICS, type GravityRegime, type RecordKind, type Topic } from "@/data/research/investigations";
import { isGravityRegime, isRecordKind, isTopic, type IndexFilters } from "@/lib/research/filter";

export const fieldClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-input focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary md:min-h-10";

const labelClass = "flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground";

/** One compact row of filters: topic, record type, gravity and text. */
export function IndexFilterBar({ filters, onChange }: { filters: IndexFilters; onChange: (patch: Partial<IndexFilters>) => void }) {
  return (
    <form role="search" aria-label="Filter the research index" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]" onSubmit={(event) => event.preventDefault()}>
      <label className={labelClass}>
        Topic
        <select
          className={fieldClass}
          value={filters.topic ?? ""}
          onChange={(event) => onChange({ topic: isTopic(event.target.value) ? (event.target.value as Topic) : null })}
        >
          <option value="">All topics</option>
          {(Object.keys(TOPICS) as Topic[]).map((topic) => (
            <option key={topic} value={topic}>
              {TOPICS[topic].label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Record type
        <select
          className={fieldClass}
          value={filters.kind ?? ""}
          onChange={(event) => onChange({ kind: isRecordKind(event.target.value) ? (event.target.value as RecordKind) : null })}
        >
          <option value="">All types</option>
          {(Object.keys(KIND_LABEL) as RecordKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Gravity tested
        <select
          className={fieldClass}
          value={filters.gravity ?? ""}
          onChange={(event) => onChange({ gravity: isGravityRegime(event.target.value) ? (event.target.value as GravityRegime) : null })}
        >
          <option value="">Any gravity</option>
          {(Object.keys(GRAVITY_REGIMES) as GravityRegime[]).map((gravity) => (
            <option key={gravity} value={gravity}>
              {GRAVITY_REGIMES[gravity].label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Search records
        <span className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <input
            type="search"
            className={`${fieldClass} pl-9`}
            value={filters.query}
            placeholder="Search records"
            onChange={(event) => onChange({ query: event.target.value })}
          />
        </span>
      </label>
    </form>
  );
}
