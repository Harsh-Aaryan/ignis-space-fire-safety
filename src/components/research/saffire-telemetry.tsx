"use client";

import { useEffect, useState } from "react";
import { EvidenceTag, ExternalLink, Note, Panel } from "@/components/design/kit";
import { fieldClass } from "@/components/research/index-filter-bar";
import type { ObservedSensorHistory } from "@/lib/fire/psi-data";

const downloadLink = "text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground";

/** Sensor readings recorded during Saffire I, plotted exactly as extracted from the NASA workbook. */
export function SaffireTelemetry() {
  const [history, setHistory] = useState<ObservedSensorHistory | null>(null);
  const [channelId, setChannelId] = useState("temperature");
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/nasa-psi/saffire-i-sensor-history.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The recorded sensor history is unavailable.");
        return response.json() as Promise<ObservedSensorHistory>;
      })
      .then(setHistory)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!history) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading the Saffire I sensor history…
      </p>
    );
  }

  const channel = history.channels.find((item) => item.id === channelId) ?? history.channels[0];
  const points = channel.points;
  const selected = points[Math.min(cursor, points.length - 1)];
  const minT = Math.min(...points.map((point) => point.timeS));
  const maxT = Math.max(...points.map((point) => point.timeS));
  const minY = Math.min(...points.map((point) => point.value));
  const maxY = Math.max(...points.map((point) => point.value));
  const x = (value: number) => 52 + ((value - minT) / Math.max(1, maxT - minT)) * 520;
  const y = (value: number) => 150 - ((value - minY) / Math.max(1e-9, maxY - minY)) * 128;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.timeS).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");

  return (
    <Panel
      aria-label="Observed Saffire-I telemetry"
      title="Saffire I sensor history"
      description={`${channel.points.length} readings in this channel, recorded in flight.`}
      actions={<EvidenceTag kind="measured" />}
    >
      <label className="flex max-w-sm flex-col gap-1 text-[12px] text-muted-foreground">
        Sensor channel
        <select
          aria-label="Observed NASA sensor"
          className={fieldClass}
          value={channel.id}
          onChange={(event) => {
            setChannelId(event.target.value);
            setCursor(0);
          }}
        >
          {history.channels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit})
            </option>
          ))}
        </select>
      </label>

      <figure className="mt-4 rounded-md border border-border-subtle bg-background p-2">
        <svg viewBox="0 0 600 180" role="img" aria-label={`Recorded ${channel.name} against workbook relative time`} className="h-48 w-full">
          <path d="M52 18V150H572" fill="none" className="stroke-border" />
          <path d={path} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="stroke-status-info" />
          <line x1={x(selected.timeS)} x2={x(selected.timeS)} y1="18" y2="150" strokeDasharray="3 3" className="stroke-ember" />
          <circle cx={x(selected.timeS)} cy={y(selected.value)} r="3" className="fill-ember" />
          <g fontSize="10" className="fill-muted-foreground">
            <text x="2" y="25">
              {maxY.toPrecision(4)}
            </text>
            <text x="2" y="150">
              {minY.toPrecision(4)}
            </text>
            <text x="52" y="170">
              {minT.toFixed(1)} s
            </text>
            <text x="572" y="170" textAnchor="end">
              {maxT.toFixed(1)} s
            </text>
            <text x="300" y="170" textAnchor="middle">
              Workbook relative time (s)
            </text>
          </g>
        </svg>
        <figcaption className="px-1 text-[12px] text-text-tertiary">
          {channel.valueColumn} · source sheet {channel.sheet}
        </figcaption>
      </figure>

      <label className="mt-4 block text-[12px] text-muted-foreground" htmlFor="observed-nasa-reading">
        Inspect a reading
        <input
          id="observed-nasa-reading"
          aria-label="Observed NASA reading"
          type="range"
          className="mt-2 w-full accent-primary"
          min={0}
          max={points.length - 1}
          step={1}
          value={Math.min(cursor, points.length - 1)}
          onChange={(event) => setCursor(Number(event.target.value))}
        />
      </label>
      <output htmlFor="observed-nasa-reading" className="numeric mt-1 block text-sm text-foreground" data-testid="observed-nasa-value">
        {selected.timeS} s · {selected.value} {channel.unit} · workbook row {selected.sourceRow}
      </output>

      <Note className="mt-4">{history.limits}</Note>

      <details className="mt-4 rounded-md border border-border-subtle">
        <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">Extraction method and provenance</summary>
        <div className="space-y-2 border-t border-border-subtle px-3 py-3 text-[13px] leading-5 text-muted-foreground">
          <p>{history.method}</p>
          <p className="numeric text-[12px] break-all text-text-tertiary">Workbook SHA-256 {history.workbookSha256}</p>
        </div>
      </details>

      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
        <a href={encodeURI(history.workbookPath)} download className={downloadLink}>
          Download original workbook
        </a>
        <a href="/data/nasa-psi/saffire-i-sensor-history.json" download className={downloadLink}>
          Download extracted readings (JSON)
        </a>
        <ExternalLink href={history.sourceUrl}>NASA record and DOI</ExternalLink>
      </p>
    </Panel>
  );
}
