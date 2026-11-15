"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { INVESTIGATIONS, RESEARCH_INDEX_SUMMARY } from "@/data/research/investigations";
import { EmptyState, actionClass } from "@/components/design/kit";
import { EnvironmentPicker } from "@/components/research/environment-picker";
import { IndexFilterBar } from "@/components/research/index-filter-bar";
import { InvestigationCard } from "@/components/research/investigation-card";
import { NO_FILTERS, filterInvestigations, filtersFromQuery, filtersToQuery, type IndexFilters } from "@/lib/research/filter";

/** Reads the initial filters from the URL. Render inside a Suspense boundary. */
export function ResearchExplorerFromQuery() {
  const params = useSearchParams();
  const initial = useMemo(() => filtersFromQuery(params), [params]);
  return <ResearchExplorer key={params.toString()} initialFilters={initial} />;
}

/** Investigations: the research index, filtered by crew environment and a few light filters. */
export function ResearchExplorer({ initialFilters = NO_FILTERS }: { initialFilters?: IndexFilters }) {
  const [filters, setFilters] = useState<IndexFilters>(initialFilters);
  const records = useMemo(() => filterInvestigations(INVESTIGATIONS, filters), [filters]);
  const active = filters.topic || filters.kind || filters.gravity || filters.query.trim();

  function update(patch: Partial<IndexFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    const query = filtersToQuery(next);
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  return (
    <div className="min-w-0 space-y-6">
      <EnvironmentPicker selected={filters.environment} onSelect={(environment) => update({ environment })} />

      <section aria-labelledby="index-heading" className="min-w-0 space-y-4">
        <div>
          <h2 id="index-heading" className="text-[17px] leading-6 font-medium text-foreground">
            Research index
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {RESEARCH_INDEX_SUMMARY.investigations} records: {RESEARCH_INDEX_SUMMARY.flightExperiments} flight experiments,{" "}
            {RESEARCH_INDEX_SUMMARY.psiTables} NASA experiment tables held here, and {RESEARCH_INDEX_SUMMARY.partialGravity} records with
            tests at lunar or Martian gravity. The index covers what this project holds and has checked, not all fire-safety research.
          </p>
        </div>

        <IndexFilterBar filters={filters} onChange={update} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-[13px] text-muted-foreground" data-testid="research-index-count">
            Showing {records.length} of {INVESTIGATIONS.length} records
          </p>
          {active ? (
            <button type="button" className={actionClass("secondary")} onClick={() => update({ topic: null, kind: null, gravity: null, query: "" })}>
              Clear filters
            </button>
          ) : null}
        </div>

        {records.length ? (
          <ul className="space-y-3">
            {records.map((record) => (
              <li key={record.id}>
                <InvestigationCard record={record} environment={filters.environment} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No record matches these filters" body="Clear a filter or choose another crew environment." />
        )}
      </section>
    </div>
  );
}
