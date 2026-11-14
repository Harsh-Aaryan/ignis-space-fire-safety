"use client";

import { useEffect, useMemo, useState } from "react";
import { parsePsiCsv, type PsiManifest } from "@/lib/fire/psi-data";
import { SaffireTelemetry } from "@/components/research/saffire-telemetry";

export function PsiDatasets() {
  const [manifest, setManifest] = useState<PsiManifest | null>(null);
  const [selectedId, setSelectedId] = useState("PSI-25");
  const [csv, setCsv] = useState<ReturnType<typeof parsePsiCsv> | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const dataset = manifest?.investigations.find((item) => item.id === selectedId);
  const table = dataset?.tables[0];
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/nasa-psi/manifest.json", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("NASA dataset manifest is unavailable.");
      return response.json() as Promise<PsiManifest>;
    }).then(setManifest).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!table) return;
    const controller = new AbortController();
    fetch(encodeURI(table.path), { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("NASA experiment table is unavailable.");
      return response.text();
    }).then((text) => setCsv(parsePsiCsv(text))).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [table]);
  const filtered = useMemo(() => csv?.rows.filter((row) => row.some((value) => value.toLowerCase().includes(query.toLowerCase()))) ?? [], [csv, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));

  return <section id="psi-datasets" className="min-w-0 scroll-mt-4 rounded border border-border bg-card p-4" aria-label="NASA PSI experimental datasets">
    <h2 className="text-lg">Downloaded NASA PSI experiment tables</h2>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
      {manifest?.investigations.length ?? "Eight"} public NASA records with original CSV files, metadata and checksums.
      Existing material tables and calibration values are retained. These experimental tables include run settings and summaries;
      they are not complete instrument time histories. Uncalibrated fan displays, ranges, missing cells and source notes remain as published.
    </p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-xs text-muted-foreground">Investigation<select aria-label="NASA PSI dataset" value={selectedId} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm" onChange={(event) => {
        setCsv(null); setError(""); setQuery(""); setPage(0); setSelectedId(event.target.value);
      }}>{manifest?.investigations.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label>
      <label className="text-xs text-muted-foreground">Search source cells<input aria-label="Search NASA data" type="search" value={query} placeholder="Material, sample, test or condition" className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>
    </div>
    {dataset ? <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <p><a href={dataset.sourceUrl} target="_blank" rel="noreferrer" className="text-ember-text underline">NASA record ↗</a> · <a href={`https://doi.org/${dataset.doi}`} target="_blank" rel="noreferrer" className="text-ember-text underline">{dataset.doi}</a> · version {dataset.version} · {dataset.license} · retrieved {manifest?.retrievedAt.slice(0, 10)}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">{table ? <a href={encodeURI(table.path)} download className="text-ember-text underline">Download original CSV</a> : null}<a href={dataset.metadataPath} download className="text-ember-text underline">Download NASA metadata</a><a href="/data/nasa-psi/manifest.json" download className="text-ember-text underline">Provenance manifest</a></p>
      {table ? <p className="break-all font-mono text-[10px]">CSV SHA-256: {table.sha256}</p> : null}
      {selectedId === "PSI-69" ? <p>FLEX studies liquid-fuel droplets and gaseous suppressants. Its data are context for extinction research; they do not validate this solid-material cabin model.</p> : null}
      {selectedId === "PSI-98" ? <p>Source dimensions and ranges are shown verbatim. Confirm the sample orientation and time origin against the flight documentation before fitting a model.</p> : null}
    </div> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : !csv ? <p role="status" className="mt-3 text-sm text-muted-foreground">Loading source table…</p> : <>
      <p className="mt-3 text-xs text-muted-foreground" data-testid="nasa-table-count">{filtered.length} matching source rows of {csv.rows.length}, including any notes.</p>
      <div className="mt-2 max-h-80 overflow-auto border border-border"><table className="w-full text-left text-xs" aria-label="Downloaded NASA PSI data">
        <thead className="sticky top-0 bg-secondary"><tr>{csv.headers.map((header, index) => <th key={index} scope="col" className="max-w-60 min-w-28 border-r border-border px-2 py-2 align-top">{header}</th>)}</tr></thead>
        <tbody>{filtered.slice(page * 20, (page + 1) * 20).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border">{Array.from({ length: Math.max(csv.headers.length, row.length) }, (_, column) => <td key={column} className="max-w-64 border-r border-border px-2 py-2 align-top whitespace-pre-wrap">{row[column]?.trim() ? row[column] : <span className="text-muted-foreground">Not recorded</span>}</td>)}</tr>)}</tbody>
      </table></div>
      {!filtered.length ? <p className="mt-2 text-xs text-muted-foreground">No source cells match that search.</p> : null}
      <div className="mt-3 flex items-center justify-between text-xs"><button type="button" className="border border-border px-3 py-2 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous rows</button><span>Page {page + 1} of {pages}</span><button type="button" className="border border-border px-3 py-2 disabled:opacity-40" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next rows</button></div>
    </>}
    {selectedId === "PSI-98" ? <SaffireTelemetry /> : null}
  </section>;
}
