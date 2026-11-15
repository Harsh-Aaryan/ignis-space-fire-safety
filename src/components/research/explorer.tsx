"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { INVESTIGATIONS, RESEARCH_INDEX_SUMMARY } from "@/data/research/investigations";
import { EmptyState, Note, Tag, TextLink, actionClass } from "@/components/design/kit";
import { CompareTray } from "@/components/research/compare-tray";
import { EnvironmentPicker } from "@/components/research/environment-picker";
import { IndexFilterBar, fieldClass } from "@/components/research/index-filter-bar";
import { InvestigationCard } from "@/components/research/investigation-card";
import { KPA_PER_PSI } from "@/lib/physics/atmosphere";
import {
  NO_EXPLORER_STATE,
  NO_FILTERS,
  explorerQuestion,
  explorerStateFromQuery,
  explorerStateFromQuestion,
  explorerStateToQuery,
  filterInvestigations,
  hasExplorerQuery,
  type ExplorerState,
} from "@/lib/research/filter";
import { RANK_POINTS, describeQuestion, isEmptyQuestion, questionGaps, rankInvestigations, resolveQuestion } from "@/lib/research/rank";
import { ROUTES } from "@/lib/routes";
import type { CabinConditions } from "@/lib/research/envelope";
import { useMissionStore } from "@/stores/mission-store";
import { useResearchBriefStore } from "@/stores/research-brief-store";

const EXAMPLE_QUESTION = "Which NASA investigations are most relevant to lunar-habitat fire detection?";

/** The last query string the explorer wrote to the URL, so its own updates are not mistaken for navigation. */
let lastWrittenQuery: string | null = null;

/**
 * Reads the starting state from the URL, or from the question saved in this browser when the URL has none.
 * Render inside a Suspense boundary.
 */
export function ResearchExplorerFromQuery() {
  const params = useSearchParams();
  const query = params.toString();
  const [seed, setSeed] = useState({ query, key: 0 });
  if (query !== seed.query) {
    // The explorer's own URL updates keep its state; any other change (a link, back or forward) starts again from the URL.
    setSeed({ query, key: query === lastWrittenQuery ? seed.key : seed.key + 1 });
  }
  const initial = useMemo(() => {
    const fromUrl = new URLSearchParams(seed.query);
    if (hasExplorerQuery(fromUrl) || seed.key > 0) return explorerStateFromQuery(fromUrl);
    const stored = useResearchBriefStore.getState();
    return explorerStateFromQuestion(stored.question, stored.matchCabin);
  }, [seed.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ResearchExplorer key={seed.key} initialState={initial} syncUrl />;
}

function writeUrl(state: ExplorerState) {
  const query = explorerStateToQuery(state);
  lastWrittenQuery = query;
  window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

function round(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

/** Investigations: a question box, a compact environment selector and ranking criteria over the research index. */
/** `pending` renders the server shell shown until the URL-aware explorer hydrates: it is read-only and inert, so input typed before hydration is never discarded. */
export function ResearchExplorer({ initialState = NO_EXPLORER_STATE, syncUrl = false, pending = false }: { initialState?: ExplorerState; syncUrl?: boolean; pending?: boolean }) {
  const [state, setState] = useState<ExplorerState>(initialState);
  const scenario = useMissionStore((store) => store.scenario);
  const setQuestion = useResearchBriefStore((store) => store.setQuestion);
  const setMatchCabin = useResearchBriefStore((store) => store.setMatchCabin);

  const cabin = useMemo<CabinConditions>(
    () => ({ oxygenPct: scenario.oxygenPct, pressureKpa: scenario.pressurePsi * KPA_PER_PSI, flowCmS: scenario.airflowMs * 100, gravityG: scenario.gravityG }),
    [scenario.oxygenPct, scenario.pressurePsi, scenario.airflowMs, scenario.gravityG],
  );
  const cabinSummary = `${round(cabin.oxygenPct)}% O₂, ${round(cabin.pressureKpa)} kPa (${round(scenario.pressurePsi)} psi), ${round(cabin.flowCmS)} cm/s, ${round(cabin.gravityG, 3)} g`;

  const explicit = useMemo(() => explorerQuestion(state, cabin), [state, cabin]);
  const resolved = useMemo(() => resolveQuestion(explicit), [explicit]);
  const ranking = !isEmptyQuestion(resolved);
  const pool = useMemo(
    () => filterInvestigations(INVESTIGATIONS, { ...NO_FILTERS, kind: state.filters.kind, gravity: state.filters.gravity }),
    [state.filters.kind, state.filters.gravity],
  );
  const ranked = useMemo(() => rankInvestigations(resolved, pool), [resolved, pool]);
  const related = ranking ? ranked.filter((row) => row.related) : ranked;
  const less = ranking ? ranked.filter((row) => !row.related) : [];
  const parts = describeQuestion(explicit);
  const gaps = ranking ? questionGaps(explicit) : [];
  const narrowed = Boolean(state.filters.kind || state.filters.gravity);

  // Reflect a question restored from this browser in the URL, so the view can be shared as it is.
  useEffect(() => {
    if (syncUrl && explorerStateToQuery(initialState) !== new URLSearchParams(window.location.search).toString() && !hasExplorerQuery(new URLSearchParams(window.location.search))) {
      writeUrl(initialState);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(next: ExplorerState) {
    setState(next);
    setQuestion(explorerQuestion(next, null));
    setMatchCabin(next.matchCabin);
    if (syncUrl) writeUrl(next);
  }

  function clearAll() {
    update(NO_EXPLORER_STATE);
  }

  return (
    <div className="min-w-0 space-y-5" inert={pending || undefined} aria-busy={pending || undefined}>
      <section aria-labelledby="question-label" className="min-w-0">
        <label id="question-label" htmlFor="research-question" className="text-[15px] leading-5 font-medium text-foreground">
          Research question
        </label>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted-foreground">
          State the decision or question. IGNIS ranks the indexed records by how directly they address it and lists the reasons.
        </p>
        <div className="relative mt-2 max-w-3xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <input
            id="research-question"
            type="search"
            className={`${fieldClass} pl-9`}
            value={state.filters.query}
            placeholder="e.g. fire detection in a lunar habitat"
            autoComplete="off"
            readOnly={pending}
            onChange={(event) => update({ ...state, filters: { ...state.filters, query: event.target.value } })}
          />
        </div>
        {!state.filters.query.trim() ? (
          <p className="mt-2 text-[12px] leading-5 text-text-tertiary">
            Example:{" "}
            <button
              type="button"
              className="text-left text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
              onClick={() => update({ ...state, filters: { ...state.filters, query: EXAMPLE_QUESTION } })}
            >
              {EXAMPLE_QUESTION}
            </button>
          </p>
        ) : null}
      </section>

      <EnvironmentPicker selected={state.filters.environment} onSelect={(environment) => update({ ...state, filters: { ...state.filters, environment } })} />

      <IndexFilterBar state={state} onChange={update} cabinSummary={cabinSummary} />

      <section aria-labelledby="index-heading" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border-subtle pt-4">
          <div className="min-w-0">
            <h2 id="index-heading" className="text-[17px] leading-6 font-medium text-foreground">
              {ranking ? "Ranked for your question" : "Research index"}
            </h2>
            <p role="status" className="mt-1 text-[13px] leading-5 text-muted-foreground" data-testid="research-index-count">
              {ranking
                ? `Ranked ${pool.length} of ${INVESTIGATIONS.length} records by relevance: ${related.length} related, ${less.length} less related. Evidence quality is shown on each record and only breaks ties.`
                : `Showing ${pool.length} of ${INVESTIGATIONS.length} records. Index order. Ask a question or pick an environment to rank.`}
            </p>
          </div>
          {ranking || narrowed ? (
            <button type="button" className={actionClass("secondary")} onClick={clearAll}>
              <X className="size-4" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>

        {parts.length ? (
          <ul aria-label="Ranking on" className="flex flex-wrap gap-1.5">
            {parts.map((part) => (
              <li key={`${part.factor}-${part.value}`}>
                <Tag tone={part.source === "question" ? "neutral" : "accent"} className="whitespace-normal">
                  {part.label}: {part.value}
                  {part.source === "question" ? <span className="ml-1 text-text-tertiary">(from your question)</span> : null}
                </Tag>
              </li>
            ))}
          </ul>
        ) : null}

        {gaps.length ? (
          <Note title="Evidence gap.">
            {gaps.join(" ")} An empty cell means no such test is indexed here, not that none exists.{" "}
            <TextLink href={ROUTES.gaps}>Evidence gaps</TextLink>
          </Note>
        ) : null}

        {pool.length ? (
          <>
            {related.length ? (
              <ul className="space-y-3">
                {related.map((row) => (
                  <li key={row.record.id}>
                    <InvestigationCard record={row.record} environment={resolved.environment} ranked={ranking ? row : null} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No record addresses this question directly" body="Every record below is less related. Try another topic, material or environment." />
            )}
            {less.length ? (
              <section aria-labelledby="less-related-heading" className="space-y-3 pt-2">
                <h3 id="less-related-heading" className="text-[15px] leading-6 font-medium text-muted-foreground">
                  Less related ({less.length})
                </h3>
                <p className="text-[13px] leading-5 text-text-tertiary">Relevance at or below zero for this question. Shown for completeness, with the reasons.</p>
                <ul className="space-y-2">
                  {less.map((row) => (
                    <li key={row.record.id}>
                      <InvestigationCard record={row.record} environment={resolved.environment} ranked={row} muted />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState title="No record matches these filters" body="Change the record type or gravity under Narrow the list." />
        )}

        <details className="rounded-md border border-border-subtle px-4 py-3 text-[13px] leading-5 text-muted-foreground">
          <summary className="cursor-pointer text-foreground">How the ranking works</summary>
          <ul className="mt-2 space-y-1">
            <li>
              Crew environment: tested there {pts(RANK_POINTS.environment.tested)}, applies there {pts(RANK_POINTS.environment.applies)}, transferable{" "}
              {pts(RANK_POINTS.environment.transferable)}, not linked {pts(RANK_POINTS.environment.notLinked)}; averaged when the question names several environments. The
              record&apos;s note for that environment concerns the topic {pts(RANK_POINTS.environment.noteOnTopic)}.
            </li>
            <li>
              Gravity of that environment: tested at it {pts(RANK_POINTS.gravity.tested)}, not tested {pts(RANK_POINTS.gravity.notTested)}.
            </li>
            <li>
              Topic: addresses it {pts(RANK_POINTS.topic.match)}, does not {pts(RANK_POINTS.topic.mismatch)}. Listed first among its topics {pts(RANK_POINTS.topic.primary)};
              each finding or control statement on the topic {pts(RANK_POINTS.topic.perStatement)}, up to {pts(RANK_POINTS.topic.statementsMax)}.
            </li>
            <li>
              Material: among the tested fuels {pts(RANK_POINTS.material.tested)}, mentioned only {pts(RANK_POINTS.material.mentioned)}, other materials tested{" "}
              {pts(RANK_POINTS.material.notTested)}.
            </li>
            <li>
              Specimen shape: same {pts(RANK_POINTS.geometry.match)}, other shapes {pts(RANK_POINTS.geometry.mismatch)}.
            </li>
            <li>
              Your cabin: matching experimental run {pts(RANK_POINTS.conditions["matching-run"])}, within reported ranges {pts(RANK_POINTS.conditions["within-ranges"])},
              insufficient information {pts(RANK_POINTS.conditions.insufficient)}, outside {pts(RANK_POINTS.conditions.outside)}.
            </li>
            <li>
              Other words of the question found in the record: {pts(RANK_POINTS.text.perTerm)} each, up to {pts(RANK_POINTS.text.max)}.
            </li>
          </ul>
          <p className="mt-2">
            Evidence quality never adds points. It orders records with equal relevance, then index order does. Criteria typed in the question are read with fixed word lists and
            shown above as tags, so a misreading can be seen and overridden with the controls.
          </p>
        </details>

        <p className="text-[12px] leading-5 text-text-tertiary">
          {RESEARCH_INDEX_SUMMARY.investigations} records: {RESEARCH_INDEX_SUMMARY.flightExperiments} flight experiments, {RESEARCH_INDEX_SUMMARY.psiTables} NASA experiment
          tables held here, and {RESEARCH_INDEX_SUMMARY.partialGravity} records with tests at lunar or Martian gravity. The index covers what IGNIS holds and has checked, not
          all fire-safety research.
        </p>
      </section>

      <CompareTray />
    </div>
  );
}

function pts(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "±0";
}
