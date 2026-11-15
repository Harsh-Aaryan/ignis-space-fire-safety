"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Note, Panel, actionClass, table as tableClass } from "@/components/design/kit";
import { fieldClass } from "@/components/research/index-filter-bar";
import { SaffireTelemetry } from "@/components/research/saffire-telemetry";
import { parsePsiCsv, type PsiManifest } from "@/lib/fire/psi-data";

const PAGE_SIZE = 20;

const downloadLink = "text-ember-text underline underline-offset-4 hover:text-foreground";

/** The NASA PSI experiment tables held here, shown cell for cell as published. */
export function PsiDatasets({ initialId = "PSI-25" }: { initialId?: string }) {
  const [manifest, setManifest] = useState<PsiManifest | null>(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [csv, setCsv] = useState<ReturnType<typeof parsePsiCsv> | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const dataset = manifest?.investigations.find((item) => item.id === selectedId);
  const source = dataset?.tables[0];

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/nasa-psi/manifest.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The NASA dataset manifest is unavailable.");
        return response.json() as Promise<PsiManifest>;
      })
      .then(setManifest)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    fetch(encodeURI(source.path), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The NASA experiment table is unavailable.");
        return response.text();
      })
      .then((text) => setCsv(parsePsiCsv(text)))
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [source]);

  const filtered = useMemo(
    () => csv?.rows.filter((row) => row.some((value) => value.toLowerCase().includes(query.toLowerCase()))) ?? [],
    [csv, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function selectDataset(id: string) {
    setCsv(null);
    setError("");
    setQuery("");
    setPage(0);
    setSelectedId(id);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Panel
        id="psi-datasets"
        aria-label="NASA PSI experimental datasets"
        title="NASA experiment tables"
        description={`${manifest?.investigations.length ?? "Eight"} public records from NASA's Physical Sciences Informatics repository, with the original files, metadata and checksums.`}
        className="min-w-0 scroll-mt-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground">
            Investigation
            <select aria-label="NASA PSI dataset" value={selectedId} className={fieldClass} onChange={(event) => selectDataset(event.target.value)}>
              {manifest?.investigations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[12px] text-muted-foreground">
            Search the table
            <input
              aria-label="Search NASA data"
              type="search"
              value={query}
              placeholder="Material, sample, test or condition"
              className={fieldClass}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>

        {dataset ? (
          <div className="mt-4 space-y-2 text-[13px] leading-5 text-muted-foreground">
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <ExternalLink href={dataset.sourceUrl}>NASA record</ExternalLink>
              <ExternalLink href={`https://doi.org/${dataset.doi}`}>{dataset.doi}</ExternalLink>
              <span>
                Version {dataset.version} · {dataset.license} · retrieved {manifest?.retrievedAt.slice(0, 10)}
              </span>
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {source ? (
                <a href={encodeURI(source.path)} download className={downloadLink}>
                  Download original CSV
                </a>
              ) : null}
              <a href={dataset.metadataPath} download className={downloadLink}>
                Download NASA metadata
              </a>
              <a href="/data/nasa-psi/manifest.json" download className={downloadLink}>
                Provenance manifest
              </a>
            </p>
            {source ? <p className="numeric text-[11px] break-all text-text-tertiary">SHA-256 {source.sha256}</p> : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : !csv ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Loading the table…
          </p>
        ) : (
          <>
            <p className="mt-4 mb-2 text-[13px] text-muted-foreground" data-testid="nasa-table-count">
              {filtered.length} matching rows of {csv.rows.length}, including any notes in the source.
            </p>
            <div className={`${tableClass.wrap} max-h-[26rem] overflow-y-auto`}>
              <table className={tableClass.root} aria-label="Downloaded NASA PSI data">
                <thead className={`${tableClass.head} sticky top-0`}>
                  <tr>
                    {csv.headers.map((header, index) => (
                      <th key={index} scope="col" className="max-w-60 min-w-28 border-b border-border px-3 py-2 align-top font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row, rowIndex) => (
                    <tr key={rowIndex} className={tableClass.tr}>
                      {Array.from({ length: Math.max(csv.headers.length, row.length) }, (_, column) => (
                        <td key={column} className="max-w-64 px-3 py-2 align-top whitespace-pre-wrap">
                          {row[column]?.trim() ? row[column] : <span className="text-text-tertiary">Not recorded</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length ? <p className="mt-2 text-[13px] text-muted-foreground">No cell matches that search.</p> : null}
            <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
              <button type="button" className={actionClass("secondary")} disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous rows
              </button>
              <span>
                Page {page + 1} of {pages}
              </span>
              <button type="button" className={actionClass("secondary")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Next rows
              </button>
            </div>
          </>
        )}

        <Note className="mt-5">
          These tables list run settings and summaries as NASA published them. They are not complete instrument time histories.
          Uncalibrated fan settings, ranges, missing cells and source notes are shown unchanged.
          {selectedId === "PSI-69" ? " FLEX burned liquid droplets; its results are not used for the solid-fuel model." : ""}
          {selectedId === "PSI-98" ? " Confirm sample orientation and time origin against the flight documentation before fitting a model." : ""}
        </Note>
      </Panel>

      {selectedId === "PSI-98" ? <SaffireTelemetry /> : null}
    </div>
  );
}
