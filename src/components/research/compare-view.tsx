"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import { ActionLink, EmptyState, Note, Panel, Tag, actionClass, table } from "@/components/design/kit";
import { useHydrated } from "@/components/research/compare-tray";
import { fieldClass } from "@/components/research/index-filter-bar";
import { EvidenceQualityTag } from "@/components/research/investigation-card";
import { GravityChips } from "@/components/research/record-meta";
import { INVESTIGATIONS } from "@/data/research/investigations";
import { runsForRecord } from "@/data/research/runs";
import {
  EXAMPLE_COMPARISON,
  MAX_COMPARE,
  NOT_REPORTED,
  VERDICT_LABEL,
  compareRecords,
  idsFromParam,
  idsToParam,
  recordsForIds,
  type Citation,
  type Comparability,
  type CompareColumn,
  type Verdict,
} from "@/lib/research/compare";
import { RUN_TOLERANCE_TEXT } from "@/lib/research/envelope";
import { GEOMETRY_SHORT } from "@/lib/research/materials";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useResearchBriefStore } from "@/stores/research-brief-store";

function writeIds(ids: string[]) {
  const path = window.location.pathname;
  window.history.replaceState(null, "", ids.length ? `${path}?ids=${idsToParam(ids)}` : path);
}

/** Reads ?ids=a,b,c. The URL wins over the selection saved in this browser. Render inside a Suspense boundary. */
export function CompareViewFromQuery() {
  const params = useSearchParams();
  const param = params.get("ids");
  const urlIds = useMemo(() => idsFromParam(param), [param]);
  const hydrated = useHydrated();
  const storeIds = useResearchBriefStore((state) => state.selectedIds);
  const setSelected = useResearchBriefStore((state) => state.setSelected);

  useEffect(() => {
    if (!hydrated) return;
    const stored = useResearchBriefStore.getState().selectedIds;
    if (urlIds.length) {
      if (idsToParam(urlIds) !== idsToParam(stored)) setSelected(urlIds);
    } else if (stored.length) {
      writeIds(stored);
    }
  }, [hydrated, urlIds, setSelected]);

  const ids = urlIds.length ? urlIds : hydrated ? storeIds : [];
  return (
    <CompareView
      ids={ids}
      onChange={(next) => {
        setSelected(next);
        writeIds(next);
      }}
    />
  );
}

/** Two or three investigations side by side, and where their results can and cannot be compared. */
export function CompareView({ ids, onChange }: { ids: string[]; onChange?: (ids: string[]) => void }) {
  const records = useMemo(() => recordsForIds(ids), [ids]);
  const comparison = useMemo(() => compareRecords(records), [records]);
  const change = onChange ?? (() => {});
  const available = INVESTIGATIONS.filter((record) => !ids.includes(record.id));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section aria-label="Investigations to compare" className="flex flex-wrap items-end gap-3">
        <ul className="flex min-w-0 flex-wrap gap-2">
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => change(ids.filter((id) => id !== record.id))}
                aria-label={`Remove ${record.name} from comparison`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-elev-2 px-3 text-[13px] text-foreground hover:bg-elev-3"
              >
                {record.name}
                <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-[12px] text-muted-foreground sm:max-w-xs">
          Add an investigation
          <select
            className={fieldClass}
            value=""
            disabled={ids.length >= MAX_COMPARE}
            onChange={(event) => event.target.value && change([...ids, event.target.value].slice(0, MAX_COMPARE))}
          >
            <option value="">{ids.length >= MAX_COMPARE ? `Up to ${MAX_COMPARE} at a time` : "Choose a record"}</option>
            {available.map((record) => (
              <option key={record.id} value={record.id}>
                {record.name}
              </option>
            ))}
          </select>
        </label>
        {ids.length ? (
          <button type="button" className={actionClass("secondary")} onClick={() => change([])}>
            Clear
          </button>
        ) : null}
        {records.length >= 2 ? (
          <ActionLink href={ROUTES.results} variant="primary" className="no-print">
            Open evidence brief
          </ActionLink>
        ) : null}
      </section>

      {records.length < 2 ? (
        <EmptyState
          title={records.length ? "Pick one more investigation" : "Pick two or three investigations"}
          body={
            <>
              Add records here, or use “Add to comparison” on any record in the <Link href={ROUTES.research} className="text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">investigations index</Link>.
            </>
          }
          action={
            <button type="button" className={actionClass("secondary")} onClick={() => change(EXAMPLE_COMPARISON)}>
              Example: Saffire VI, Saffire I–III and BASS-II
            </button>
          }
        />
      ) : null}

      {records.length ? <SideBySide columns={comparison.columns} /> : null}

      {comparison.pairs.length ? (
        <Panel
          title="Where the results can be compared"
          description="Worked out by IGNIS from the tested conditions, materials and gravity in the index, and from the tabulated runs. Derived, not stated by the sources."
        >
          <div className="flex flex-col gap-4">
            {comparison.all ? <PairCard pair={comparison.all} heading="All three" /> : null}
            {comparison.pairs.map((pair) => (
              <PairCard key={pair.recordIds.join("+")} pair={pair} heading={pair.names.join(" and ")} />
            ))}
          </div>
          <Note className="mt-5">
            Overlap compares the reported range of each condition separately, so an overlap does not show that both investigations ran the same combination. Run pairs do:{" "}
            {RUN_TOLERANCE_TEXT}
          </Note>
        </Panel>
      ) : null}
    </div>
  );
}

const ROWS: Array<{ label: string; derived?: boolean; render: (column: CompareColumn) => React.ReactNode }> = [
  {
    label: "Platform and type",
    render: (c) => (
      <>
        <span className="text-foreground">{c.kind}</span>
        <span className="block text-muted-foreground">{c.platform}</span>
        <span className="block text-text-tertiary">{c.period}</span>
      </>
    ),
  },
  { label: "Gravity tested", render: (c) => <GravityChips record={c.record} /> },
  { label: "Oxygen", render: (c) => <Value text={c.oxygen} /> },
  { label: "Pressure", render: (c) => <Value text={c.pressure} /> },
  { label: "Airflow", render: (c) => <Value text={c.airflow} /> },
  {
    label: "Materials tested",
    render: (c) => (
      <span className="flex flex-wrap gap-1.5">
        {c.materials.map((fuel) => (
          <Tag key={fuel} className="whitespace-normal">
            {fuel}
          </Tag>
        ))}
      </span>
    ),
  },
  {
    label: "Specimen geometry",
    derived: true,
    render: (c) => (c.geometry.length ? c.geometry.map((g) => GEOMETRY_SHORT[g]).join(", ") : <span className="text-text-tertiary">Not stated in the index</span>),
  },
  {
    label: "Held in IGNIS",
    render: (c) => (
      <ul className="space-y-1">
        {c.holdings.map((holding) => (
          <li key={holding}>{holding}</li>
        ))}
        {c.runs ? <li className="text-muted-foreground">{c.runs}</li> : null}
      </ul>
    ),
  },
  {
    label: "Evidence quality",
    derived: true,
    render: (c) => (
      <>
        <EvidenceQualityTag evidence={c.evidence} />
        <span className="mt-1 block text-[12px] leading-4 text-text-tertiary">{c.evidence.basis.join(" ")}</span>
      </>
    ),
  },
  {
    label: "Key findings",
    render: (c) => (
      <ul className="space-y-2">
        {c.findings.map((finding) => (
          <li key={finding.text} className="leading-5">
            {finding.text} <Citations items={finding.citations} direct={finding.direct} />
          </li>
        ))}
      </ul>
    ),
  },
  {
    label: "Limitations",
    derived: true,
    render: (c) => (
      <ul className="space-y-1.5">
        {c.limitations.map((item) => (
          <li key={item.text} className="leading-5 text-muted-foreground">
            {item.text} <span className="text-[12px] text-text-tertiary">{item.basis === "index" ? "(index)" : "(derived)"}</span>
          </li>
        ))}
      </ul>
    ),
  },
];

function Value({ text }: { text: string }) {
  return text === NOT_REPORTED ? <span className="text-text-tertiary">Not reported</span> : <span className="numeric text-foreground">{text}</span>;
}

function Citations({ items, direct }: { items: Citation[]; direct: boolean }) {
  if (!items.length) return <span className="text-[12px] text-text-tertiary">(source not recorded)</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-baseline">
      {!direct ? <span className="text-[12px] text-text-tertiary">record sources:</span> : null}
      {items.map((item) =>
        item.url ? (
          <a
            key={item.label}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title={item.label}
            className="inline-flex max-w-[16rem] items-center gap-1 rounded-sm border border-border-subtle px-1.5 py-0.5 text-[12px] leading-4 text-muted-foreground hover:bg-elev-3 hover:text-foreground"
          >
            <span className="truncate">{item.label}</span>
            <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span key={item.label} className="rounded-sm border border-border px-1.5 py-0.5 text-[12px] text-muted-foreground">
            {item.label}
          </span>
        ),
      )}
    </span>
  );
}

function RowLabel({ label, derived }: { label: string; derived?: boolean }) {
  return (
    <>
      {label}
      {derived ? <span className="ml-1 text-[12px] font-normal text-text-tertiary">derived</span> : null}
    </>
  );
}

function SideBySide({ columns }: { columns: CompareColumn[] }) {
  return (
    <>
      {/* Wide screens: one column per investigation. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border-subtle bg-card md:block">
        <table className={cn(table.root, "table-fixed")} aria-label="Investigations side by side">
          <colgroup>
            <col className="w-40" />
            {columns.map((column) => (
              <col key={column.record.id} />
            ))}
          </colgroup>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                <span className="sr-only">Property</span>
              </th>
              {columns.map((column) => (
                <th key={column.record.id} scope="col" className={cn(table.th, "whitespace-normal")}>
                  <Link href={ROUTES.investigation(column.record.id)} className="text-[14px] text-foreground underline-offset-4 hover:underline">
                    {column.record.name}
                  </Link>
                  <span className="block font-normal text-text-tertiary">{column.record.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border-subtle last:border-b-0">
                <th scope="row" className={cn(table.td, "font-medium text-muted-foreground")}>
                  <RowLabel label={row.label} derived={row.derived} />
                </th>
                {columns.map((column) => (
                  <td key={column.record.id} className={cn(table.td, "break-words")}>
                    {row.render(column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per investigation, stacked. */}
      <ul className="flex flex-col gap-4 md:hidden" aria-label="Investigations side by side">
        {columns.map((column) => (
          <li key={column.record.id} className="rounded-lg border border-border-subtle bg-card p-4">
            <h3 className="text-[16px] leading-6 font-medium">
              <Link href={ROUTES.investigation(column.record.id)} className="text-foreground underline-offset-4 hover:underline">
                {column.record.name}
              </Link>
            </h3>
            <p className="text-[12px] leading-4 text-text-tertiary">{column.record.title}</p>
            <dl className="mt-3 space-y-3 text-[13px] leading-5">
              {ROWS.map((row) => (
                <div key={row.label} className="border-t border-border-subtle pt-2">
                  <dt className="text-[12px] text-muted-foreground">
                    <RowLabel label={row.label} derived={row.derived} />
                  </dt>
                  <dd className="mt-1 break-words">{row.render(column)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

const VERDICT_TONE: Record<Verdict, string> = {
  comparable: "border-status-nominal/50 text-status-nominal",
  partial: "border-status-caution/50 text-status-caution",
  "not-comparable": "border-status-warning/50 text-status-warning",
};

function PairCard({ pair, heading }: { pair: Comparability; heading: string }) {
  const facts: Array<[string, string]> = [
    ["Gravity", pair.gravity.text],
    ["Oxygen", pair.oxygen.text],
    ["Pressure", pair.pressure.text],
    ["Airflow", pair.airflow.text],
    ["Materials", pair.materials.text],
    ["Specimen", pair.geometry.text],
  ];
  return (
    <article className="rounded-md border border-border-subtle p-4">
      <h3 className="flex flex-wrap items-center gap-2 text-[15px] leading-6 font-medium text-foreground">
        {heading}
        <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-[12px] leading-4 font-normal whitespace-nowrap", VERDICT_TONE[pair.verdict])}>
          {VERDICT_LABEL[pair.verdict]}
        </span>
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{pair.summary}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] leading-5 sm:grid-cols-2">
        {facts.map(([label, text]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[12px] text-text-tertiary">{label}</dt>
            <dd className="text-foreground">{text}</dd>
          </div>
        ))}
      </dl>
      {pair.runPairs.length ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="text-[12px] text-text-tertiary">Tabulated runs that line up</p>
          <ul className="mt-1 space-y-1 text-[13px] leading-5 text-muted-foreground">
            {pair.runPairs.map((run) => (
              <li key={`${run.a.id}+${run.b.id}`}>{run.text}</li>
            ))}
          </ul>
        </div>
      ) : pair.recordIds.length === 2 ? (
        <p className="mt-3 border-t border-border-subtle pt-3 text-[12px] leading-5 text-text-tertiary">
          {(() => {
            const without = pair.recordIds.filter((id) => runsForRecord(id).length === 0).map((id) => pair.names[pair.recordIds.indexOf(id)]);
            return without.length
              ? `Run level: IGNIS holds no table of individual runs for ${without.join(" or ")}.`
              : "Run level: no pair of tabulated runs shares two or more conditions within tolerance.";
          })()}
        </p>
      ) : null}
    </article>
  );
}
