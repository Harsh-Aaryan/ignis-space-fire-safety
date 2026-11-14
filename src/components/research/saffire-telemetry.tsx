"use client";

import { useEffect, useState } from "react";
import type { ObservedSensorHistory } from "@/lib/fire/psi-data";

export function SaffireTelemetry() {
  const [history, setHistory] = useState<ObservedSensorHistory | null>(null);
  const [channelId, setChannelId] = useState("temperature");
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/nasa-psi/saffire-i-sensor-history.json", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("The observed sensor history is unavailable.");
      return response.json() as Promise<ObservedSensorHistory>;
    }).then(setHistory).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>;
  if (!history) return <p role="status" className="mt-3 text-sm text-muted-foreground">Loading measured Saffire-I sensors…</p>;
  const channel = history.channels.find((item) => item.id === channelId)!;
  const points = channel.points;
  const selected = points[Math.min(cursor, points.length - 1)];
  const minT = Math.min(...points.map((point) => point.timeS));
  const maxT = Math.max(...points.map((point) => point.timeS));
  const minY = Math.min(...points.map((point) => point.value));
  const maxY = Math.max(...points.map((point) => point.value));
  const x = (value: number) => 52 + (value - minT) / Math.max(1, maxT - minT) * 520;
  const y = (value: number) => 150 - (value - minY) / Math.max(1e-9, maxY - minY) * 128;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.timeS).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");

  return <section className="mt-4 border-t border-border pt-4" aria-label="Observed Saffire-I telemetry">
    <h3 className="text-base font-medium">Measured Saffire-I sensor history</h3>
    <p className="mt-1 text-xs text-muted-foreground">NASA observed data · {channel.points.length} readings in this channel · no simulation output.</p>
    <label className="mt-3 block max-w-sm text-xs text-muted-foreground">Sensor channel<select aria-label="Observed NASA sensor" className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm" value={channelId} onChange={(event) => { setChannelId(event.target.value); setCursor(0); }}>{history.channels.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
    <figure className="mt-3 border border-border bg-background p-2">
      <svg viewBox="0 0 600 180" role="img" aria-label={`Observed NASA ${channel.name} over workbook relative time`} className="h-48 w-full">
        <path d="M52 18V150H572" fill="none" stroke="#5A5F66" />
        <path d={path} fill="none" stroke="#7FD6C4" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1={x(selected.timeS)} x2={x(selected.timeS)} y1="18" y2="150" stroke="#E9A679" strokeDasharray="3 3" />
        <circle cx={x(selected.timeS)} cy={y(selected.value)} r="3" fill="#E9A679" />
        <g fill="#AEB6B6" fontSize="10"><text x="2" y="25">{maxY.toPrecision(4)}</text><text x="2" y="150">{minY.toPrecision(4)}</text><text x="52" y="170">{minT.toFixed(1)} s</text><text x="572" y="170" textAnchor="end">{maxT.toFixed(1)} s</text><text x="300" y="170" textAnchor="middle">Workbook relative time (s)</text></g>
      </svg>
      <figcaption className="text-xs text-muted-foreground">{channel.valueColumn} · source sheet: {channel.sheet}</figcaption>
    </figure>
    <label className="mt-3 block text-xs text-muted-foreground" htmlFor="observed-nasa-reading">Inspect reading<input id="observed-nasa-reading" aria-label="Observed NASA reading" type="range" className="mt-2 w-full accent-[#7FD6C4]" min={0} max={points.length - 1} step={1} value={Math.min(cursor, points.length - 1)} onChange={(event) => setCursor(Number(event.target.value))} /></label>
    <output htmlFor="observed-nasa-reading" className="numeric mt-1 block text-sm" data-testid="observed-nasa-value">{selected.timeS} s · {selected.value} {channel.unit} · workbook row {selected.sourceRow}</output>
    <p className="mt-2 text-xs text-muted-foreground">{history.limits}</p>
    <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Extraction method and provenance</summary><p className="mt-2">{history.method}</p><p className="mt-1 break-all">Original workbook SHA-256: {history.workbookSha256}</p></details>
    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"><a href={encodeURI(history.workbookPath)} download className="text-ember-text underline">Download original telemetry workbook</a><a href="/data/nasa-psi/saffire-i-sensor-history.json" download className="text-ember-text underline">Download extracted sensor data (JSON)</a><a href={history.sourceUrl} target="_blank" rel="noreferrer" className="text-ember-text underline">NASA record and DOI ↗</a></p>
  </section>;
}
