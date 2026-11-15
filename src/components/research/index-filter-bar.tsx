import { useState } from "react";
import { GRAVITY_REGIMES, KIND_LABEL, TOPICS, type GravityRegime, type RecordKind, type Topic } from "@/data/research/investigations";
import { cn } from "@/lib/utils";
import { isGravityRegime, isMaterialId, isRecordKind, isSpecimenGeometry, isTopic, type ExplorerState } from "@/lib/research/filter";
import { GEOMETRY_LABEL, MATERIAL_TERMS, type SpecimenGeometry } from "@/lib/research/materials";

export const fieldClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-input focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary md:min-h-10";

const labelClass = "flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground";

/**
 * Ranking criteria (topic, material, specimen, the cabin's conditions) in one compact row, and the two
 * filters that narrow the list (record type, gravity tested) folded below.
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
  const narrowed = Boolean(filters.kind || filters.gravity);
  const criteria = [filters.topic, state.material, state.geometry, state.matchCabin || null].filter(Boolean).length;
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 space-y-3">
      {/* On a phone the criteria fold behind one button so the results stay near the top. */}
      {criteria > 0 ? null : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="ranking-criteria"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-border-subtle px-3 text-[13px] text-muted-foreground hover:text-foreground md:hidden"
        >
          <span>Refine the ranking: topic, material, specimen, cabin</span>
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      )}
      <div
        id="ranking-criteria"
        className={cn("grid-cols-2 gap-3 md:grid lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.3fr)]", open || criteria > 0 ? "grid" : "hidden")}
      >
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

      <details className="group rounded-md border border-border-subtle" open={narrowed || undefined}>
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[13px] text-muted-foreground hover:text-foreground">
          <span>
            Narrow the list
            {narrowed ? <span className="ml-2 text-ember-text">filters on</span> : <span className="ml-2 text-text-tertiary">record type, gravity tested</span>}
          </span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-3 border-t border-border-subtle p-3">
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
      </details>
    </div>
  );
}
