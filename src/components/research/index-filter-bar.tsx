import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { GRAVITY_REGIMES, KIND_LABEL, TOPICS, type GravityRegime, type RecordKind, type Topic } from "@/data/research/investigations";
import { cn } from "@/lib/utils";
import { isGravityRegime, isMaterialId, isRecordKind, isSpecimenGeometry, isTopic, type ExplorerState } from "@/lib/research/filter";
import { GEOMETRY_LABEL, MATERIAL_TERMS, type SpecimenGeometry } from "@/lib/research/materials";

export const fieldClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-input focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary md:min-h-10";

const labelClass = "flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground";

const toggleClass =
  "flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border-subtle px-3 text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

/** "PMMA (acrylic)" → "PMMA": the short form for a one-line summary. */
function short(label: string): string {
  return label.split(" (")[0];
}

/** A disclosure button whose closed state says what is set inside it. */
function DisclosureToggle({
  open,
  onToggle,
  controls,
  label,
  active,
  hint,
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  label: string;
  /** What is set, e.g. ["Smoke and aerosols", "Thin"]. */
  active: string[];
  /** Shown when nothing is set. */
  hint: string;
}) {
  return (
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onToggle} className={toggleClass}>
      <span className="min-w-0 truncate">
        {label}
        <span aria-hidden="true" className="mx-1.5 text-text-tertiary">
          ·
        </span>
        {active.length ? <span className="text-ember-text">{active.join(", ")}</span> : <span className="text-text-tertiary">{hint}</span>}
      </span>
      <ChevronDown className={cn("size-4 shrink-0 motion-safe:transition-transform", open && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

/**
 * Ranking criteria (topic, material, specimen, the cabin's conditions) and the two filters that narrow
 * the list (record type, gravity tested), each folded behind one toggle that summarises what is set.
 */
export function IndexFilterBar({
  state,
  onChange,
  cabinSummary,
}: {
  state: ExplorerState;
  onChange: (next: ExplorerState) => void;
  /** e.g. "32% O₂, 70.3 kPa (10.2 psi), 5 cm/s, 0.165 g". */
  cabinSummary: string;
}) {
  const { filters } = state;
  const criteria = [
    filters.topic ? TOPICS[filters.topic].label : null,
    state.material ? short(MATERIAL_TERMS.find((term) => term.id === state.material)?.label ?? state.material) : null,
    state.geometry ? short(GEOMETRY_LABEL[state.geometry]) : null,
    state.matchCabin ? "My cabin" : null,
  ].filter((item): item is string => Boolean(item));
  const narrowing = [filters.kind ? KIND_LABEL[filters.kind] : null, filters.gravity ? GRAVITY_REGIMES[filters.gravity].label : null].filter(
    (item): item is string => Boolean(item),
  );
  const [refineOpen, setRefineOpen] = useState(criteria.length > 0);
  const [narrowOpen, setNarrowOpen] = useState(narrowing.length > 0);
  const id = useId();
  const refineId = `${id}-ranking-criteria`;
  const narrowId = `${id}-narrow-list`;

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <DisclosureToggle
          open={refineOpen}
          onToggle={() => setRefineOpen((value) => !value)}
          controls={refineId}
          label="Refine the ranking"
          active={criteria}
          hint="topic, material, specimen, cabin"
        />
        <DisclosureToggle
          open={narrowOpen}
          onToggle={() => setNarrowOpen((value) => !value)}
          controls={narrowId}
          label="Narrow the list"
          active={narrowing}
          hint="record type, gravity tested"
        />
      </div>

      <div id={refineId} hidden={!refineOpen} className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.3fr)]">
        <label className={labelClass}>
          Topic
          <select
            className={fieldClass}
            value={filters.topic ?? ""}
            onChange={(event) => onChange({ ...state, filters: { ...filters, topic: isTopic(event.target.value) ? (event.target.value as Topic) : null } })}
          >
            <option value="">Any topic</option>
            {(Object.keys(TOPICS) as Topic[]).map((topic) => (
              <option key={topic} value={topic}>
                {TOPICS[topic].label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Material
          <select
            className={fieldClass}
            value={state.material ?? ""}
            onChange={(event) => onChange({ ...state, material: isMaterialId(event.target.value) ? event.target.value : null })}
          >
            <option value="">Any material</option>
            {MATERIAL_TERMS.map((term) => (
              <option key={term.id} value={term.id}>
                {term.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Specimen
          <select
            className={fieldClass}
            value={state.geometry ?? ""}
            onChange={(event) => onChange({ ...state, geometry: isSpecimenGeometry(event.target.value) ? (event.target.value as SpecimenGeometry) : null })}
          >
            <option value="">Any shape</option>
            {(Object.keys(GEOMETRY_LABEL) as SpecimenGeometry[]).map((geometry) => (
              <option key={geometry} value={geometry}>
                {GEOMETRY_LABEL[geometry]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 min-w-0 items-start gap-2.5 self-end rounded-md border border-border-subtle px-3 py-2 text-[13px] leading-5 text-muted-foreground md:min-h-10">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={state.matchCabin}
            onChange={(event) => onChange({ ...state, matchCabin: event.target.checked })}
          />
          <span className="min-w-0">
            <span className="text-foreground">Rank against my cabin</span>
            <span className="numeric block text-[12px] text-text-tertiary">{cabinSummary}</span>
          </span>
        </label>
      </div>

      <div id={narrowId} hidden={!narrowOpen} className="grid grid-cols-2 gap-3 md:max-w-xl">
        <label className={labelClass}>
          Record type
          <select
            className={fieldClass}
            value={filters.kind ?? ""}
            onChange={(event) => onChange({ ...state, filters: { ...filters, kind: isRecordKind(event.target.value) ? (event.target.value as RecordKind) : null } })}
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
            onChange={(event) => onChange({ ...state, filters: { ...filters, gravity: isGravityRegime(event.target.value) ? (event.target.value as GravityRegime) : null } })}
          >
            <option value="">Any gravity</option>
            {(Object.keys(GRAVITY_REGIMES) as GravityRegime[]).map((gravity) => (
              <option key={gravity} value={gravity}>
                {GRAVITY_REGIMES[gravity].label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
