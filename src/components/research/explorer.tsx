"use client";

import Link from "next/link";
import { Cite } from "@/components/fire/cite";
import { AskIgnisButton } from "@/components/ai/scenario-assistant";
import { useState } from "react";
import { OxygenAirflowChart, RelevanceChart } from "@/components/charts/evidence-charts";
import { Callout, EmptyState } from "@/components/dashboard/controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { compareMeasurement } from "@/lib/analytics/compare";
import { catalogFacets } from "@/lib/evidence/filters";
import { COMPLETENESS_LABEL, FUEL_LABEL, OBJECTIVE_LABEL } from "@/lib/labels";
import { formatRelevance } from "@/lib/format";
import { DEFAULT_WEIGHTS, WEIGHT_LABELS } from "@/lib/ranking/score";
import { getServices } from "@/services";
import { VerifiedCitationList } from "@/components/research/verified-list";
import { citationById } from "@/data/verified";
import { useAnalysis } from "@/hooks/use-analysis";
import { useMissionStore } from "@/stores/mission-store";
import type { FuelCategory, RankingWeights, SortKey } from "@/types/domain";

const PAGE_SIZE = 20;

export function ResearchExplorer() {
  const analysis = useAnalysis();
  const filters = useMissionStore((state) => state.filters);
  const patchFilters = useMissionStore((state) => state.patchFilters);
  const sort = useMissionStore((state) => state.sort);
  const setSort = useMissionStore((state) => state.setSort);
  const page = useMissionStore((state) => state.page);
  const setPage = useMissionStore((state) => state.setPage);
  const comparison = useMissionStore((state) => state.comparisonIds);
  const toggle = useMissionStore((state) => state.toggleComparison);
  const weights = useMissionStore((state) => state.weights);
  const setWeights = useMissionStore((state) => state.setWeights);
  const resetWeights = useMissionStore((state) => state.resetWeights);
  const pages = Math.max(1, Math.ceil(analysis.ranked.length / PAGE_SIZE));
  const visible = analysis.ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const compared = analysis.ranked.filter((row) => comparison.includes(row.investigation.id));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded border border-border bg-card p-5" aria-label="NASA fire safety evidence">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-medium">NASA fire safety evidence</h1><p className="mt-2 text-sm text-muted-foreground">Follow the evidence from the material to the modeled fire and its response.</p></div><AskIgnisButton prompt="Which NASA experiment supports this?" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{[
          ["saffire-vi","Cabin-scale burning","Saffire links heat release with oxygen consumption, cabin gases and temperature. Its geometry and fan histories matter."],
          ["bass-ii","Spread & extinction","BASS tests show how fuel shape, oxygen and low-speed airflow change flame spread and quenching."],
          ["same-2","Smoke & detection","SAME characterizes particles from heated materials. Small aerosols can produce weak light-scattering signals."],
          ["fwm-pfe","Fire response","ISS studies describe power/ventilation isolation and extinguisher test configurations; hardware response needs its own calibration."],
        ].map(([id,title,text])=><article key={id} className="rounded border border-border p-3"><h2 className="text-base font-medium">{title}</h2><p className="my-2 text-sm leading-6 text-muted-foreground">{text}</p><Cite id={id}/></article>)}</div>
        <Link href="/materials" className="mt-4 inline-flex rounded border border-primary px-3 py-2 text-sm text-ember-text">Open materials, original tables & observed telemetry →</Link>
      </section>
      <details className="rounded border border-border p-4"><summary className="cursor-pointer text-sm">Advanced catalog rankings and research filters</summary>
      <div className="mt-4 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em]">Research Explorer</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Rankings use the live scenario. A score of 1.00 is the closest weighted match in this catalog, not a chance of ignition.
            {analysis.dataMode === "verified"
              ? " Verified mode is showing metadata only, so the synthetic ranking table is empty on purpose."
              : ""}
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Ranking weights</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Explainable weights</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {(Object.keys(DEFAULT_WEIGHTS) as Array<keyof RankingWeights>).map((key) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{WEIGHT_LABELS[key]}</span>
                    <span className="numeric">{Math.round(weights[key] * 100)}</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[Math.round(weights[key] * 100)]}
                    onValueChange={(value) => {
                      const next = Array.isArray(value) ? value[0] : value;
                      setWeights({ ...weights, [key]: next / 100 });
                    }}
                    aria-label={WEIGHT_LABELS[key]}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Factors with unreported inputs are dropped and the remaining weights are
                renormalized. Missing values are not scored as zero.
              </p>
              <Button variant="outline" onClick={resetWeights}>
                Reset weights
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden flex-col gap-3 rounded border border-border bg-card p-3 lg:flex">
          <FilterFields idPrefix="desk" />
        </aside>
        <div className="flex flex-col gap-3">
          <div className="lg:hidden">
            <details className="rounded border border-border bg-card p-3">
              <summary className="flex h-7 cursor-pointer items-center font-cond text-[11px] tracking-[0.08em] uppercase">
                Filters
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <FilterFields idPrefix="mob" />
              </div>
            </details>
          </div>
          <Label htmlFor="search">Keyword</Label>
          <Input
            id="search"
            value={filters.query}
            placeholder="Family, material, run id"
            onChange={(event) => patchFilters({ query: event.target.value })}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{analysis.ranked.length} dossiers in view</p>
            <Select value={sort} onValueChange={(value) => value && setSort(value as SortKey)}>
              <SelectTrigger className="w-44" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="runCount">Run count</SelectItem>
                <SelectItem value="completeness">Completeness</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              title="No dossiers match"
              body="Relax a filter or include unreported fields. An empty list is not a negative scientific result."
            />
          ) : (
            <>
            <p className="font-cond text-[10px] tracking-[0.08em] text-[#847F79] uppercase md:hidden">
              Scroll for more columns →
            </p>
            <div className="overflow-x-auto border border-[#2A2D32]">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-[#1F2125]">
                  <tr className="h-8 border-b border-[#3A3E44] font-cond text-[11px] font-medium tracking-[0.08em] text-[#847F79] uppercase">
                    <th className="px-3">ID</th>
                    <th className="px-3">Family</th>
                    <th className="px-3">Title</th>
                    <th className="px-3">Completeness</th>
                    <th className="px-3 text-right">Relevance</th>
                    <th className="px-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const on = comparison.includes(row.investigation.id);
                    return (
                      <tr
                        key={row.investigation.id}
                        data-selected={on}
                        className="h-10 border-b border-[#2A2D32] hover:bg-[#36383C] data-[selected=true]:bg-[#36383C] data-[selected=true]:shadow-[inset_2px_0_0_0_#E07A3D] md:h-8"
                      >
                        <td className="numeric px-3 font-medium whitespace-nowrap">
                          <Link href={`/research/${row.investigation.id}`} className="text-ember-text">
                            {row.investigation.id.toUpperCase()}
                          </Link>
                        </td>
                        <td className="px-3">
                          <span className="status-chip status-category">{row.investigation.family}</span>
                        </td>
                        <td className="px-3">{row.investigation.title}</td>
                        <td className="px-3">
                          <CompletenessMark complete={row.completeRuns} total={row.runs.length} />
                        </td>
                        <td className="numeric px-3 text-right text-foreground">{formatRelevance(row.relevance)}</td>
                        <td className="px-3 whitespace-nowrap">
                          <button type="button" className="mr-2 text-[12px] text-foreground" onClick={() => toggle(row.investigation.id)}>
                            {on ? "In comparison" : "Compare"}
                          </button>
                          <Link href={`/research/${row.investigation.id}`} className="text-[12px] text-muted-foreground">
                            Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Relevance is a weighted match in this catalog, not a chance of ignition.
          </p>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="numeric text-xs text-muted-foreground">
              {analysis.ranked.length === 0 ? "0 of 0" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, analysis.ranked.length)} of ${analysis.ranked.length}`}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
          <RelevanceChart rows={analysis.ranked} />
        </div>
      </div>
      {analysis.dataMode !== "synthetic" ? (
        <VerifiedCitationList citations={analysis.citations} query={filters.query} />
      ) : null}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-medium">Side-by-side comparison</h2>
        {compared.length < 2 ? (
          <p className="mt-2 text-sm text-muted-foreground">Select two or three dossiers to compare conditions.</p>
        ) : (
          <ComparisonTable rows={compared} />
        )}
      </section>
      </div></details>
    </div>
  );
}

function FilterFields({ idPrefix }: { idPrefix: string }) {
  const analysis = useAnalysis();
  const filters = useMissionStore((state) => state.filters);
  const patchFilters = useMissionStore((state) => state.patchFilters);
  const resetFilters = useMissionStore((state) => state.resetFilters);
  const includeMissing = useMissionStore((state) => state.includeMissingInFilters);
  const setIncludeMissing = useMissionStore((state) => state.setIncludeMissing);
  const services = getServices().evidence;
  const facets = catalogFacets(services.listInvestigations(), services.listRuns());
  return (
    <>
      <Label>Fuel</Label>
      {facets.fuels.map((fuel) => (
        <label key={fuel} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={filters.fuelCategories.includes(fuel as FuelCategory)}
            onCheckedChange={(checked) => {
              const current = filters.fuelCategories;
              patchFilters({
                fuelCategories: checked
                  ? [...current, fuel as FuelCategory]
                  : current.filter((item) => item !== fuel),
              });
            }}
          />
          {FUEL_LABEL[fuel as FuelCategory]}
        </label>
      ))}
      <Label htmlFor={`${idPrefix}-family`}>Family</Label>
      <Select
        value={filters.families[0] ?? "all"}
        items={{ all: "All families", ...Object.fromEntries(facets.families.map((family) => [family, family])) }}
        onValueChange={(value) => patchFilters({ families: !value || value === "all" ? [] : [value] })}
      >
        <SelectTrigger id={`${idPrefix}-family`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All families</SelectItem>
          {facets.families.map((family) => (
            <SelectItem key={family} value={family}>
              {family}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor={`${idPrefix}-objective`}>Objective</Label>
      <Select
        value={filters.objectives[0] ?? "all"}
        onValueChange={(value) => {
          const next = value as string | null;
          patchFilters({
            objectives: !next || next === "all" ? [] : [next as (typeof filters.objectives)[number]],
          });
        }}
      >
        <SelectTrigger id={`${idPrefix}-objective`} className="w-full">
          <SelectValue placeholder="All objectives" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All objectives</SelectItem>
          {Object.entries(OBJECTIVE_LABEL).map(([id, label]) => (
            <SelectItem key={id} value={id}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor={`${idPrefix}-completeness`}>Completeness</Label>
      <Select
        value={filters.completeness[0] ?? "all"}
        onValueChange={(value) => {
          const next = value as string | null;
          patchFilters({
            completeness: !next || next === "all" ? [] : [next as (typeof filters.completeness)[number]],
          });
        }}
      >
        <SelectTrigger id={`${idPrefix}-completeness`} className="w-full">
          <SelectValue placeholder="Any completeness" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any completeness</SelectItem>
          {facets.completeness.map((item) => (
            <SelectItem key={item} value={item}>
              {COMPLETENESS_LABEL[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeMissing} onCheckedChange={(checked) => setIncludeMissing(Boolean(checked))} />
        Include rows with unreported filtered fields
      </label>
      <Button variant="outline" onClick={resetFilters}>
        Clear filters
      </Button>
      {analysis.withheldForMissing > 0 ? (
        <p className="text-xs text-amber">
          {analysis.withheldForMissing} rows withheld because a filtered field is unreported, not because the value is zero.
        </p>
      ) : null}
    </>
  );
}

function CompletenessMark({ complete, total }: { complete: number; total: number }) {
  const fraction = total ? complete / total : 0;
  const missing = total - complete;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-[#3A3E44]" title="Completeness is metadata presence, not a safety probability.">
        <div className="h-full bg-[#EDEAE4]" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      {missing > 0 ? (
        <span
          className="text-[11px] leading-none text-[#EDEAE4]"
          title={`${missing} of ${total} runs are missing a measurement. Incomplete metadata is unknown information, not a negative result.`}
        >
          ▲
        </span>
      ) : null}
    </div>
  );
}

function ComparisonMismatch({
  left,
  right,
}: {
  left: ReturnType<typeof useAnalysis>["ranked"][number]["runs"][number]["run"];
  right: ReturnType<typeof useAnalysis>["ranked"][number]["runs"][number]["run"];
}) {
  const result = compareMeasurement(left, right, "flame-spread-rate");
  if (result.status === "consistent") return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground" title={result.reason}>
      <span aria-hidden="true">▲ </span>
      {result.reason}
    </p>
  );
}

function ComparisonTable({ rows }: { rows: ReturnType<typeof useAnalysis>["ranked"] }) {
  const runs = rows.flatMap((row) => row.runs.map((item) => item.run));
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">Field</th>
            {rows.map((row) => (
              <th key={row.investigation.id} className="py-2 pr-3">
                {row.investigation.family}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-2 pr-3 text-muted-foreground">Relevance</td>
            {rows.map((row) => (
              <td key={row.investigation.id} className="numeric py-2 pr-3">
                {formatRelevance(row.relevance)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 pr-3 text-muted-foreground">Completeness</td>
            {rows.map((row) => {
              const fraction = row.runs.length ? row.completeRuns / row.runs.length : 0;
              return (
                <td key={row.investigation.id} className="py-2 pr-3">
                  <div className="h-1.5 w-16 bg-[#3A3E44]" title="Completeness is metadata presence, not a safety probability.">
                    <div className="h-full bg-[#EDEAE4]" style={{ width: `${Math.round(fraction * 100)}%` }} />
                  </div>
                </td>
              );
            })}
          </tr>
          <tr>
            <td className="py-2 pr-3 text-muted-foreground">Fuels</td>
            {rows.map((row) => (
              <td key={row.investigation.id} className="py-2 pr-3">
                {row.investigation.fuelCategories.map((fuel) => FUEL_LABEL[fuel]).join(", ")}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <OxygenAirflowChart runs={runs} />
      {rows.length >= 2 && rows[0].runs[0] && rows[1].runs[0] ? (
        <ComparisonMismatch left={rows[0].runs[0].run} right={rows[1].runs[0].run} />
      ) : null}
    </div>
  );
}

export function InvestigationDetail({ id }: { id: string }) {
  const verified = citationById(id);
  const services = getServices().evidence;
  const investigation = services.getInvestigation(id);
  const analysis = useAnalysis();
  const [showLimits, setShowLimits] = useState(true);
  if (verified) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-ember-text">Verified NASA metadata · {verified.indexHint}</p>
        <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em]">{verified.title}</h1>
        <Callout tone="warn" title="No measurements extracted">
          {verified.note} Hint basis: {verified.hintBasis}. Retrieved {verified.retrievedAt}.
        </Callout>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{verified.abstractExcerpt}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Authors</dt>
            <dd>{verified.authors.length ? verified.authors.join(", ") : "Not in the retrieved metadata."}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source</dt>
            <dd>
              <a href={verified.sourceUrl} className="text-ember-text">
                {verified.sourceUrl}
              </a>
            </dd>
          </div>
        </dl>
        <Button nativeButton={false} render={<Link href="/research" />}>
          Back to explorer
        </Button>
      </div>
    );
  }
  if (!investigation) {
    return (
      <EmptyState
        title="Dossier not in the catalog"
        body="That identifier is not one of the synthetic dossiers."
        action={
          <Button nativeButton={false} render={<Link href="/research" />}>
            Back to explorer
          </Button>
        }
      />
    );
  }
  const row = analysis.ranked.find((item) => item.investigation.id === id);
  const runs = row?.runs ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-cyan">{investigation.family}</p>
      <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em]">{investigation.title}</h1>
      <Callout tone="warn" title="Synthetic dossier">
        {investigation.officialNameNote}
      </Callout>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{investigation.description}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Objectives</dt>
          <dd>{investigation.researchObjectives.map((item) => OBJECTIVE_LABEL[item]).join(", ")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Hardware stand-ins</dt>
          <dd>{investigation.hardware.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Provenance</dt>
          <dd>{investigation.evidenceSource.note} DOI: none.</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Source status</dt>
          <dd>{investigation.sourceStatus}</dd>
        </div>
      </dl>
      <button type="button" className="text-left text-sm text-primary" onClick={() => setShowLimits((value) => !value)}>
        {showLimits ? "Hide" : "Show"} synthetic findings
      </button>
      {showLimits
        ? investigation.findings.map((finding) => (
            <Callout key={finding.id} title="Synthetic finding">
              {finding.statement} {finding.limitations}
            </Callout>
          ))
        : null}
      <h2 className="text-lg font-medium">Runs ranked for the current scenario</h2>
      {runs.length === 0 ? (
        <EmptyState title="No runs in the current filter" body="Clear Explorer filters to see this dossier's rows." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Relevance</th>
                <th className="px-3 py-2">O₂ %</th>
                <th className="px-3 py-2">psi</th>
                <th className="px-3 py-2">g</th>
                <th className="px-3 py-2">m/s</th>
                <th className="px-3 py-2">Completeness</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((item) => (
                <tr key={item.run.id} className="border-t border-border">
                  <td className="numeric px-3 py-2 text-ember-text">{item.run.id.toUpperCase()}</td>
                  <td className="numeric px-3 py-2">{formatRelevance(item.relevance)}</td>
                  <td className="numeric px-3 py-2">{item.run.oxygenConcentrationPct ?? "unreported"}</td>
                  <td className="numeric px-3 py-2">{item.run.pressurePsi ?? "unreported"}</td>
                  <td className="numeric px-3 py-2">{item.run.gravityG ?? "unreported"}</td>
                  <td className="numeric px-3 py-2">{item.run.airflowVelocityMs ?? "unreported"}</td>
                  <td className="px-3 py-2">{item.run.evidenceCompleteness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
