"use client";

import { roomById } from "@/data/habitat-interiors";
import { formatGravity } from "@/lib/format";
import { accuracyCue, significantFigures, type AccuracyCue, type CueQuantity } from "@/lib/fire/accuracy";
import { ventilationCfm } from "@/lib/fire/scenario";
import type { FireSample } from "@/lib/fire/model";
import { cn } from "@/lib/utils";
import { fireRuntime, useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { PHASE_LABEL, PHASE_TONE, clock, formatPower, formatSignificant } from "./format";
import "./telemetry-strip.css";

/** Live readouts, docked along the bottom edge of the viewport so the scene stays clear. */
export function TelemetryStrip({ className }: { className?: string }) {
  const snapshot = useFireSimStore((store) => store.snapshot);
  const history = useFireSimStore((store) => store.history);
  const status = useFireSimStore((store) => store.status);
  const speed = useFireSimStore((store) => store.speed);
  const activeRoomId = useFireSimStore((store) => store.activeRoomId);
  const scenario = useMissionStore((store) => store.scenario);
  const selectedRoomId = useMissionStore((store) => store.selectedRoomId);
  const room = roomById(activeRoomId ?? selectedRoomId);
  const speedMs = snapshot ? snapshot.uForcedMs : scenario.airflowMs;
  const cfm = room ? ventilationCfm(speedMs, room) : null;
  // Accuracy against Saffire for the running scenario; readings carry matching significant figures.
  const input = snapshot ? fireRuntime.input : null;
  const cue = (quantity: CueQuantity) => (input ? accuracyCue(quantity, input) : null);
  const hrrCue = cue("hrr"), tempCue = cue("temperature"), coCue = cue("co"), co2Cue = cue("co2");
  const sig = (c: AccuracyCue | null) => significantFigures(c?.relative ?? null);

  const runState =
    status === "running"
      ? `Running at ${speed}×`
      : status === "paused"
        ? "Run paused"
        : status === "finished"
          ? "Run finished"
          : "Ready to start";

  return (
    <section
      aria-label="Fire scenario telemetry"
      data-testid="fire-hud"
      className={cn("telemetry-strip", "shrink-0 border-t border-border bg-elev-1", className)}
    >
      <div className="telemetry-layout">
        <dl className="telemetry-readouts-left">
          <Readout
            label="Heat release"
            abbr="HRR"
            value={snapshot ? formatPower(snapshot.hrrW, sig(hrrCue)) : "0 W"}
            note={snapshot ? `Peak ${formatPower(snapshot.peakHrrW, sig(hrrCue))}` : undefined}
            cue={hrrCue}
          />
          <Readout
            label="Oxygen"
            value={(snapshot?.o2Pct ?? scenario.oxygenPct).toFixed(2)}
            unit="%"
            note={snapshot ? `Near fuel ${snapshot.localO2Pct.toFixed(1)}%` : undefined}
          />
          <Readout
            label="Cabin temperature"
            value={snapshot ? snapshot.tempC.toFixed(0) : "22"}
            unit="°C"
            note={snapshot ? `Near fire ${snapshot.nearFireTempC.toFixed(0)} °C` : undefined}
            cue={tempCue}
          />
          <Readout
            label="Ventilation"
            value={cfm === null ? "–" : cfm.toFixed(0)}
            unit="CFM"
            note={`${(speedMs * 100).toFixed(1)} cm/s`}
          />
        </dl>
        <div className="telemetry-center">
          <div className="telemetry-state">
            <p className={cn("text-[13px] font-medium", snapshot ? PHASE_TONE[snapshot.phase] : "text-muted-foreground")}>
              {snapshot ? PHASE_LABEL[snapshot.phase] : "No fire"}
            </p>
            <p className="numeric text-[13px] leading-5 text-foreground">T+{clock(snapshot?.t ?? 0)}</p>
          </div>
          <Trace history={history} />
          <p className={cn("telemetry-run-state", "text-[12px] leading-4 text-muted-foreground")}>{runState}</p>
        </div>
        <dl className="telemetry-readouts-right">
          <Readout
            label="Gravity"
            value={formatGravity(scenario.gravityG)}
            unit="g"
            note={snapshot ? `Buoyant flow ${(snapshot.uBuoyantMs * 100).toFixed(0)} cm/s` : undefined}
          />
          <Readout
            label="Carbon monoxide"
            abbr="CO"
            value={snapshot ? formatSignificant(snapshot.coPpm, sig(coCue)) : "0"}
            unit="ppm"
            cue={coCue}
          />
          <Readout
            label="CO₂ rise"
            value={snapshot ? formatSignificant(snapshot.co2RiseMmHg, sig(co2Cue)) : "0"}
            unit="mmHg"
            note={snapshot ? `Total ${snapshot.co2TotalMmHg.toFixed(2)} mmHg` : "400 ppm baseline assumed"}
            cue={co2Cue}
          />
          <Readout
            label="Smoke"
            value={(snapshot?.smokeMgM3 ?? 0).toFixed(1)}
            unit="mg/m³"
            note={snapshot ? `At sensor ${snapshot.detectorSmokeMgM3.toFixed(1)}` : undefined}
          />
        </dl>
      </div>
      <p className="border-t border-border-subtle px-3 py-1 text-[12px] leading-4 text-text-tertiary">
        Instantaneous readings; exposure averages are not calculated. ± is the held-out error against Saffire flight tests.
      </p>
    </section>
  );
}

function Readout({
  label,
  abbr,
  value,
  unit,
  note,
  cue,
}: {
  label: string;
  abbr?: string;
  value: string;
  unit?: string;
  note?: string;
  /** Accuracy against Saffire, shown after the note. */
  cue?: AccuracyCue | null;
}) {
  return (
    <div className="telemetry-readout">
      <dt className="text-[12px] leading-4 text-muted-foreground">
        {label}
        {abbr ? <span className="ml-1 text-text-tertiary">{abbr}</span> : null}
      </dt>
      <dd className="numeric flex flex-wrap items-baseline gap-x-1 text-[15px] leading-5 text-foreground">
        <span>{value}</span>
        {unit ? <span className="font-sans text-[12px] text-muted-foreground">{unit}</span> : null}
      </dd>
      {note || cue ? (
        <p className="text-[12px] leading-4 text-text-tertiary">
          {note}
          {cue ? (
            <>
              {note ? " · " : null}
              <span className={cue.tested ? undefined : "text-status-caution"} title={cue.long}>
                {cue.short}
              </span>
              <span className="sr-only">. {cue.long}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Heat release and cabin oxygen on one small plot. */
function Trace({ history }: { history: FireSample[] }) {
  const hasHistory = history.length >= 3;
  const width = 200;
  const height = 48;
  const t0 = history[0]?.t ?? 0;
  const span = Math.max(1, (history.at(-1)?.t ?? t0) - t0);
  const peak = Math.max(50, ...history.map((point) => point.hrrW));
  const o2 = history.map((point) => point.o2Pct);
  const o2High = Math.max(0, ...o2);
  const o2Low = Math.min(o2High - 0.5, ...o2);
  const path = (pick: (point: FireSample) => number) =>
    history
      .map((point, index) => {
        const x = ((point.t - t0) / span) * width;
        const y = height - 2 - pick(point) * (height - 4);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("");
  return (
    <figure className="telemetry-trace" data-testid="telemetry-graph">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full"
        role="img"
        aria-label={hasHistory ? "Heat release rate and oxygen over time" : "Heat release and oxygen graph, no run history yet"}
      >
        <path d={`M0,2H${width}M0,${height - 2}H${width}`} fill="none" strokeWidth="1" className="stroke-border-subtle" />
        {hasHistory ? (
          <>
            <path d={path((point) => point.hrrW / peak)} fill="none" strokeWidth="1.4" className="stroke-ember" />
            <path
              d={path((point) => (point.o2Pct - o2Low) / (o2High - o2Low))}
              fill="none"
              strokeWidth="1.2"
              strokeDasharray="3 2"
              className="stroke-status-info"
            />
          </>
        ) : (
          <text x={width / 2} y={height / 2 + 4} textAnchor="middle" className="fill-text-tertiary text-[12px]">No run history</text>
        )}
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-center gap-x-3 text-[11px] leading-4">
        <span className="text-ember-text">Heat release</span>
        <span className="text-status-info">
          {hasHistory ? `O₂ ${o2Low.toFixed(1)} to ${o2High.toFixed(1)}%` : "Cabin oxygen"}
        </span>
      </figcaption>
    </figure>
  );
}
