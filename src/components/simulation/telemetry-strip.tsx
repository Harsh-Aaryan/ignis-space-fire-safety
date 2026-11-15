"use client";

import { roomById } from "@/data/habitat-interiors";
import { formatGravity } from "@/lib/format";
import { ventilationCfm } from "@/lib/fire/scenario";
import type { FireSample } from "@/lib/fire/model";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { PHASE_LABEL, PHASE_TONE, clock, formatPower } from "./format";

/** Live readouts, docked along the bottom edge of the viewport so the scene stays clear. */
export function TelemetryStrip() {
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
      className="shrink-0 border-t border-border bg-elev-1"
    >
      <div className="flex overflow-x-auto">
        <div className="flex min-w-[148px] shrink-0 flex-col justify-center px-3 py-2">
          <p className={cn("text-[13px] font-medium", snapshot ? PHASE_TONE[snapshot.phase] : "text-muted-foreground")}>
            {snapshot ? PHASE_LABEL[snapshot.phase] : "No fire"}
          </p>
          <p className="numeric text-[15px] leading-5 text-foreground">T+{clock(snapshot?.t ?? 0)}</p>
          <p className="text-[12px] text-muted-foreground">{runState}</p>
        </div>
        <dl className="flex">
          <Readout
            label="Heat release"
            abbr="HRR"
            value={snapshot ? formatPower(snapshot.hrrW) : "0 W"}
            note={snapshot ? `Peak ${formatPower(snapshot.peakHrrW)}` : undefined}
          />
          <Readout
            label="Oxygen"
            value={(snapshot?.o2Pct ?? scenario.oxygenPct).toFixed(2)}
            unit="%"
            note={snapshot ? `Near fuel ${snapshot.localO2Pct.toFixed(1)}%` : undefined}
          />
          <Readout
            label="Cabin temperature"
            value={(snapshot?.tempC ?? 22).toFixed(1)}
            unit="°C"
            note={snapshot ? `Near fire ${snapshot.nearFireTempC.toFixed(0)} °C` : undefined}
          />
          <Readout
            label="Ventilation"
            value={cfm === null ? "–" : cfm.toFixed(0)}
            unit="CFM"
            note={`${(speedMs * 100).toFixed(1)} cm/s`}
          />
          <Readout
            label="Gravity"
            value={formatGravity(scenario.gravityG)}
            unit="g"
            note={snapshot ? `Buoyant flow ${(snapshot.uBuoyantMs * 100).toFixed(0)} cm/s` : undefined}
          />
          <Readout label="Carbon monoxide" abbr="CO" value={(snapshot?.coPpm ?? 0).toFixed(0)} unit="ppm" />
          <Readout
            label="CO₂ rise"
            value={(snapshot?.co2RiseMmHg ?? 0).toFixed(2)}
            unit="mmHg"
            note={snapshot ? `Total ${snapshot.co2TotalMmHg.toFixed(2)} mmHg` : "400 ppm baseline assumed"}
          />
          <Readout
            label="Smoke"
            value={(snapshot?.smokeMgM3 ?? 0).toFixed(1)}
            unit="mg/m³"
            note={snapshot ? `At sensor ${snapshot.detectorSmokeMgM3.toFixed(1)}` : undefined}
          />
        </dl>
        <Trace history={history} />
      </div>
      <p className="border-t border-border-subtle px-3 py-1 text-[12px] leading-4 text-text-tertiary">
        Gas values are instantaneous readings; exposure averages are not calculated.
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
}: {
  label: string;
  abbr?: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="min-w-[118px] shrink-0 border-l border-border-subtle px-3 py-2">
      <dt className="text-[12px] leading-4 whitespace-nowrap text-muted-foreground">
        {label}
        {abbr ? <span className="ml-1 text-text-tertiary">{abbr}</span> : null}
      </dt>
      <dd className="numeric text-[16px] leading-6 whitespace-nowrap text-foreground">
        {value}
        {unit ? <span className="ml-1 font-sans text-[12px] text-muted-foreground">{unit}</span> : null}
      </dd>
      {note ? <p className="text-[12px] leading-4 whitespace-nowrap text-text-tertiary">{note}</p> : null}
    </div>
  );
}

/** Heat release and cabin oxygen on one small plot. */
function Trace({ history }: { history: FireSample[] }) {
  if (history.length < 3) return null;
  const width = 200;
  const height = 40;
  const t0 = history[0].t;
  const span = Math.max(1, history[history.length - 1].t - t0);
  const peak = Math.max(50, ...history.map((point) => point.hrrW));
  const o2 = history.map((point) => point.o2Pct);
  const o2High = Math.max(...o2);
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
    <figure className="flex min-w-[220px] shrink-0 flex-col justify-center border-l border-border-subtle px-3 py-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-10 w-full"
        role="img"
        aria-label="Heat release rate and oxygen over time"
      >
        <path d={path((point) => point.hrrW / peak)} fill="none" strokeWidth="1.4" className="stroke-ember" />
        <path
          d={path((point) => (point.o2Pct - o2Low) / (o2High - o2Low))}
          fill="none"
          strokeWidth="1.2"
          strokeDasharray="3 2"
          className="stroke-status-info"
        />
      </svg>
      <figcaption className="mt-1 flex justify-between gap-3 text-[12px] leading-4 whitespace-nowrap">
        <span className="text-ember-text">Heat release</span>
        <span className="text-status-info">
          O₂ {o2Low.toFixed(1)} to {o2High.toFixed(1)}%
        </span>
      </figcaption>
    </figure>
  );
}
