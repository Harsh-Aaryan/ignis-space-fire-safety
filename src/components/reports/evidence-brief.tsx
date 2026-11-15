"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Download, Printer } from "lucide-react";
import { Note, Panel, Tag, TextLink, actionClass, table } from "@/components/design/kit";
import { useSelectedIds } from "@/components/research/compare-tray";
import { EvidenceMatchTag } from "@/components/research/gaps-view";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import { KPA_PER_PSI } from "@/lib/physics/atmosphere";
import { UNCERTAINTY_LABEL, briefFilename, briefToJson, briefToMarkdown, buildEvidenceBrief, type BriefCabin } from "@/lib/research/brief";
import { VERDICT_LABEL, recordsForIds, type Citation, type Verdict } from "@/lib/research/compare";
import { downloadText } from "@/lib/research/export";
import { materialForFireMaterial } from "@/lib/research/materials";
import { ROUTES, researchCompareHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { useResearchBriefStore } from "@/stores/research-brief-store";

function round(value: number, digits = 1): string {
  return Number(value.toFixed(digits)).toString();
}

function CitationLink({ citation }: { citation: Citation }) {
  if (!citation.url) return <span>{citation.label}</span>;
  return (
    <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">
      <span>{citation.label}</span>
      <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

const VERDICT_TONE: Record<Verdict, string> = {
  comparable: "border-status-nominal/50 text-status-nominal",
  partial: "border-status-caution/50 text-status-caution",
  "not-comparable": "border-status-warning/50 text-status-warning",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[15px] leading-6 font-medium text-foreground">{children}</h3>;
}

/** Shown on Results when nothing is picked yet. */
export function EvidenceBriefPrompt() {
  return (
    <Panel title="Evidence brief" description="A brief for a research decision: your question, two or three investigations, how they compare, what their findings support and what stays open." className="no-print">
      <p className="text-sm leading-6 text-muted-foreground">
        No investigation is picked in this browser. Use “Add to comparison” on records under Research, then return here to export the brief.
      </p>
      <p className="mt-3">
        <TextLink href={ROUTES.research}>Go to investigations</TextLink>
      </p>
    </Panel>
  );
}

/** The evidence brief for the picked investigations, with Markdown, JSON and print exports. */
export function EvidenceBrief() {
  const ids = useSelectedIds();
  const question = useResearchBriefStore((state) => state.question);
  const clear = useResearchBriefStore((state) => state.clearSelected);
  const scenario = useMissionStore((state) => state.scenario);
  const materialId = useFireSimStore((state) => state.config.materialId);
  const [generatedAt] = useState(() => new Date().toISOString());

  const records = useMemo(() => recordsForIds(ids), [ids]);
  const cabin = useMemo<BriefCabin>(() => {
    const material = materialId ? FIRE_MATERIALS.find((item) => item.id === materialId) ?? null : null;
    return {
      name: scenario.name,
      conditions: {
        oxygenPct: scenario.oxygenPct,
        pressureKpa: scenario.pressurePsi * KPA_PER_PSI,
        flowCmS: scenario.airflowMs * 100,
        gravityG: scenario.gravityG,
      },
      specimen: material ? { materialId: materialForFireMaterial(material.id)?.id ?? null, geometry: material.form } : undefined,
    };
  }, [scenario.name, scenario.oxygenPct, scenario.pressurePsi, scenario.airflowMs, scenario.gravityG, materialId]);
  const brief = useMemo(() => buildEvidenceBrief({ question, records, cabin, generatedAt }), [question, records, cabin, generatedAt]);

  if (!records.length) return null;

  function exportMarkdown() {
    downloadText(briefFilename(brief, "md"), briefToMarkdown(brief, window.location.origin), "text/markdown");
  }
  function exportJson() {
    downloadText(briefFilename(brief, "json"), briefToJson(brief), "application/json");
  }

  return (
    <Panel
      title="Evidence brief"
      description={`Built from the IGNIS research index on ${brief.generatedAt.slice(0, 10)}. Conclusions are recorded findings with their sources; derived statements are marked.`}
      className="report-sheet"
      aria-label="Evidence brief"
      actions={
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" className={actionClass("primary")} onClick={exportMarkdown}>
            <Download className="size-4" aria-hidden="true" />
            Markdown
          </button>
          <button type="button" className={actionClass("secondary")} onClick={exportJson}>
            <Download className="size-4" aria-hidden="true" />
            JSON
          </button>
          <button type="button" className={actionClass("secondary")} onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </button>
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Question" className="min-w-0">
          <SectionTitle>Question</SectionTitle>
          {brief.question.text ? (
            <blockquote className="mt-1.5 border-l-2 border-primary/60 pl-3 text-sm leading-6 text-foreground">{brief.question.text}</blockquote>
          ) : (
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              No question was entered. <Link href={ROUTES.research} className="text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">Add one on Investigations</Link>.
            </p>
          )}
          {brief.question.criteria.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {brief.question.criteria.map((part) => (
                <li key={`${part.factor}-${part.value}`}>
                  <Tag className="whitespace-normal">
                    {part.label}: {part.value}
                    {part.source === "question" ? <span className="ml-1 text-text-tertiary">(from the question)</span> : null}
                  </Tag>
                </li>
              ))}
            </ul>
          ) : null}
          {brief.cabin ? (
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
              Cabin: <span className="text-foreground">{brief.cabin.name}</span>,{" "}
              <span className="numeric">
                {round(brief.cabin.oxygenPct)}% O₂, {round(brief.cabin.pressureKpa)} kPa, {round(brief.cabin.flowCmS)} cm/s, {round(brief.cabin.gravityG, 3)} g
              </span>
              {brief.cabin.material ? `, ${brief.cabin.material}` : ""}
              {brief.cabin.geometry ? `, ${brief.cabin.geometry} specimen` : ""}.
            </p>
          ) : null}
        </section>

        <section aria-label="Selected investigations" className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle>Selected investigations</SectionTitle>
            <span className="no-print flex flex-wrap gap-3 text-[13px]">
              <Link href={researchCompareHref(ids)} className="text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">
                Change the selection
              </Link>
              <button type="button" onClick={clear} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Clear the selection
              </button>
            </span>
          </div>
          <ol className="mt-2 space-y-3">
            {brief.investigations.map((item, index) => (
              <li key={item.id} className="flex gap-3 text-sm leading-6">
                <span className="numeric w-5 shrink-0 text-text-tertiary">{index + 1}.</span>
                <div className="min-w-0">
                  <Link href={item.path} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {item.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">{item.title}</span>
                  <span className="block text-[13px] leading-5 text-text-tertiary">
                    {item.kind} · {item.platform} · {item.period}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Tag>Evidence: {item.evidence.label}</Tag>
                    {item.cabinMatch ? <EvidenceMatchTag status={item.cabinMatch.status} /> : null}
                  </span>
                  {item.cabinMatch ? <span className="mt-1 block text-[12px] leading-4 text-muted-foreground">{item.cabinMatch.reasons.join(" ")}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Side-by-side comparison" className="min-w-0">
          <SectionTitle>Side-by-side comparison</SectionTitle>
          <div className={cn(table.wrap, "mt-2")}>
            <table className={cn(table.root, "min-w-[640px] table-fixed")} aria-label="Selected investigations side by side">
              <colgroup>
                <col className="w-36" />
                {brief.investigations.map((item) => (
                  <col key={item.id} />
                ))}
              </colgroup>
              <thead className={table.head}>
                <tr>
                  <th scope="col" className={table.th}>
                    <span className="sr-only">Property</span>
                  </th>
                  {brief.investigations.map((item) => (
                    <th key={item.id} scope="col" className={cn(table.th, "whitespace-normal")}>
                      {item.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brief.comparison.rows.map((row) => (
                  <tr key={row.label} className="border-b border-border-subtle last:border-b-0">
                    <th scope="row" className={cn(table.td, "font-medium text-muted-foreground")}>
                      {row.label}
                      {row.basis === "derived" ? <span className="ml-1 text-[12px] font-normal text-text-tertiary">derived</span> : null}
                    </th>
                    {row.cells.map((value, index) => (
                      <td key={`${row.label}-${index}`} className={cn(table.td, "break-words", value === "Not reported" && "text-text-tertiary")}>
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {brief.comparison.pairs.length ? (
            <div className="mt-3 space-y-3">
              <p className="text-[12px] text-text-tertiary">Where the results can be compared. Derived by IGNIS from the index and the run table.</p>
              {brief.comparison.pairs.map((pair) => (
                <div key={pair.between.join("+")} className="rounded-md border border-border-subtle p-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {pair.between.length > 2 ? "All three" : pair.between.join(" and ")}
                    <span className={cn("inline-flex rounded-sm border px-2 py-0.5 text-[12px] leading-4 font-normal", VERDICT_TONE[pair.verdict as Verdict])}>
                      {VERDICT_LABEL[pair.verdict as Verdict]}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{pair.summary}</p>
                  <ul className="mt-1.5 space-y-0.5 text-[12px] leading-4 text-text-tertiary">
                    {pair.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section aria-label="Supported conclusions" className="min-w-0">
          <SectionTitle>Supported conclusions</SectionTitle>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Each statement is a finding recorded for a selected investigation, quoted as recorded, with its source. Nothing here is inferred.
          </p>
          <ul className="mt-2 space-y-2.5">
            {brief.conclusions.map((item) => (
              <li key={`${item.recordId}-${item.text}`} className="text-sm leading-6">
                <span className="font-medium text-foreground">{item.recordName}: </span>
                {item.text}
                <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-4">
                  <span className="text-text-tertiary">{item.direct ? "Source:" : "Record sources:"}</span>
                  {item.citations.map((citation) => (
                    <CitationLink key={citation.label} citation={citation} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Unresolved uncertainties" className="min-w-0">
          <SectionTitle>Unresolved uncertainties</SectionTitle>
          {brief.uncertainties.length ? (
            <ul className="mt-2 space-y-1.5">
              {brief.uncertainties.map((item) => (
                <li key={item.text} className="flex gap-2 text-[13px] leading-5">
                  <span className="w-32 shrink-0 text-text-tertiary">{UNCERTAINTY_LABEL[item.kind]}</span>
                  <span className="min-w-0 text-muted-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">None identified from the index.</p>
          )}
        </section>

        <section aria-label="Citations" className="min-w-0">
          <SectionTitle>Citations</SectionTitle>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-5">
            {brief.citations.map((citation) => (
              <li key={citation.url ?? citation.label} className="break-words">
                <CitationLink citation={citation} />
              </li>
            ))}
          </ul>
        </section>

        <Note title="Method.">{brief.method.join(" ")}</Note>
      </div>
    </Panel>
  );
}
