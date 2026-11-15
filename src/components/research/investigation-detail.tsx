import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExternalLink, PageHeader, Panel, Tag, TextLink, table } from "@/components/design/kit";
import { Cite } from "@/components/fire/cite";
import { CompareToggle } from "@/components/research/compare-tray";
import { BasisTag, GravityChips, KindTag, formatRange } from "@/components/research/record-meta";
import { FIRE_SOURCES } from "@/data/fire/sources";
import {
  CREW_ENVIRONMENTS,
  HOLDING_LABEL,
  PILLARS,
  TOPICS,
  ntrsUrl,
  psiUrl,
  type CrewEnvironment,
  type InvestigationRecord,
} from "@/data/research/investigations";
import { citationById } from "@/data/verified";
import { environmentLink } from "@/lib/research/filter";
import { ROUTES } from "@/lib/routes";

const ENVIRONMENT_ORDER = Object.keys(CREW_ENVIRONMENTS) as CrewEnvironment[];

/** Everything IGNIS holds on one record: findings, tested conditions, where it applies, and its sources. */
export function InvestigationDetail({ record }: { record: InvestigationRecord }) {
  return (
    <div className="min-w-0">
      <Link href={ROUTES.research} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All investigations
      </Link>

      <PageHeader
        meta={`${record.organization} · ${record.period}`}
        title={record.name}
        description={record.summary}
        actions={<CompareToggle id={record.id} name={record.name} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <KindTag record={record} />
        <GravityChips record={record} />
        <p className="text-[13px] text-muted-foreground">{record.platform}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Key findings" description={record.title}>
            <ul className="space-y-3">
              {record.findings.map((finding) => (
                <li key={finding.text} className="flex max-w-[62ch] gap-3 text-sm leading-6">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />
                  <span>
                    {finding.text} {finding.sourceId ? <Cite id={finding.sourceId} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Relevance by crew environment" description="Whether this record's conditions match where a crew would live." flush>
            <div className="overflow-x-auto">
              <table className={table.root}>
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>
                      Environment
                    </th>
                    <th scope="col" className={table.th}>
                      Basis
                    </th>
                    <th scope="col" className={table.th}>
                      Why
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ENVIRONMENT_ORDER.map((id) => {
                    const link = environmentLink(record, id);
                    return (
                      <tr key={id} className={table.tr}>
                        <th scope="row" className={`${table.td} font-normal whitespace-nowrap`}>
                          <span className="text-foreground">{CREW_ENVIRONMENTS[id].label}</span>
                          <span className="numeric block text-[12px] text-text-tertiary">{CREW_ENVIRONMENTS[id].gravityLabel}</span>
                        </th>
                        <td className={table.td}>
                          <BasisTag basis={link?.basis ?? null} />
                        </td>
                        <td className={`${table.td} min-w-56 text-muted-foreground`}>{link?.note ?? "This record does not address this environment."}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title="Use in the IGNIS model">
              <UseList items={record.modelUse} empty="The fire model does not use this record." />
            </Panel>
            <Panel title="What it means for detection, suppression and controls">
              <UseList items={record.controlsUse} empty="This record makes no statement about controls." />
            </Panel>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Tested conditions">
            <dl className="space-y-3 text-sm">
              <ConditionRow label="Oxygen">{formatRange(record.conditions.oxygenPct, "% O₂")}</ConditionRow>
              <ConditionRow label="Pressure">{formatRange(record.conditions.pressureKpa, "kPa")}</ConditionRow>
              <ConditionRow label="Airflow">{formatRange(record.conditions.flowCmS, "cm/s")}</ConditionRow>
              <div>
                <dt className="text-[12px] text-muted-foreground">Fuels</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {record.conditions.fuels.map((fuel) => (
                    <Tag key={fuel} className="whitespace-normal">
                      {fuel}
                    </Tag>
                  ))}
                </dd>
              </div>
            </dl>
            {record.conditions.note ? <p className="mt-4 text-[13px] leading-5 text-muted-foreground">{record.conditions.note}</p> : null}
          </Panel>

          <Panel title="Addresses">
            <dl className="space-y-3">
              <div>
                <dt className="text-[12px] text-muted-foreground">Challenge questions</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {record.pillars.map((pillar) => (
                    <Tag key={pillar} tone="accent">
                      {PILLARS[pillar].label}
                    </Tag>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">Topics</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {record.topics.map((topic) => (
                    <Tag key={topic}>{TOPICS[topic].label}</Tag>
                  ))}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Data held here">
            <ul className="space-y-3 text-sm leading-6">
              {record.holdings.map((holding) => (
                <li key={`${holding.kind}-${holding.label}`}>
                  <span className="block text-[12px] text-text-tertiary">{HOLDING_LABEL[holding.kind]}</span>
                  {holding.psiId ? (
                    <TextLink href={`${ROUTES.modelingData}?view=tables&table=${holding.psiId}`}>{holding.label}</TextLink>
                  ) : (
                    <span className="text-foreground">{holding.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Source records">
            <SourceRecords record={record} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function UseList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex max-w-[62ch] gap-3 text-sm leading-6 text-foreground">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-border" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ConditionRow({ label, children }: { label: string; children: string }) {
  const missing = children === "Not tabulated";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={missing ? "text-text-tertiary" : "numeric text-foreground"}>{children}</dd>
    </div>
  );
}

function SourceRecords({ record }: { record: InvestigationRecord }) {
  const sources = FIRE_SOURCES.filter((source) => record.links.sources.includes(source.id));
  return (
    <ul className="space-y-4 text-[13px] leading-5">
      {record.links.psi.map((id) => (
        <li key={id}>
          <span className="block text-[12px] text-text-tertiary">NASA Physical Sciences Informatics</span>
          <ExternalLink href={psiUrl(id)}>{id}</ExternalLink>
        </li>
      ))}
      {record.links.doi ? (
        <li>
          <span className="block text-[12px] text-text-tertiary">Dataset DOI</span>
          <ExternalLink href={`https://doi.org/${record.links.doi}`}>{record.links.doi}</ExternalLink>
        </li>
      ) : null}
      {record.links.ntrs.map((id) => {
        const citation = citationById(id);
        return (
          <li key={id}>
            <span className="block text-[12px] text-text-tertiary">NASA Technical Reports Server</span>
            <ExternalLink href={ntrsUrl(id)} className="items-start">
              {citation ? citation.title : `NTRS ${id}`}
            </ExternalLink>
            {citation ? (
              <span className="mt-0.5 block text-muted-foreground">
                {citation.authors.slice(0, 3).join("; ")}
                {citation.authors.length > 3 ? " et al." : ""}
                {citation.stiType ? ` · ${citation.stiType}` : ""}
              </span>
            ) : null}
          </li>
        );
      })}
      {sources.map((source) => (
        <li key={source.id}>
          <span className="block text-[12px] text-text-tertiary">Read for the fire model</span>
          {source.url ? (
            <ExternalLink href={source.url} className="items-start">
              {source.title}
            </ExternalLink>
          ) : (
            <span className="text-foreground">{source.title}</span>
          )}
          <span className="mt-0.5 block text-muted-foreground">
            {source.authors} · {source.venue}
            {source.year ? ` · ${source.year}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
