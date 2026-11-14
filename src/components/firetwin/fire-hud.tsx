"use client";

import { HAZARD_LIMITS } from "@/data/fire/options";
import { roomById } from "@/data/habitat-interiors";
import { formatGravity } from "@/lib/format";
import { ventilationCfm } from "@/lib/fire/scenario";
import type { FireSample, FireState } from "@/lib/fire/model";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

const PHASE_LABEL: Record<FireState["phase"], string> = {
  heating: "Heating",
  smoldering: "Smouldering",
  flaming: "Flaming",
  extinguished: "Flame out",
  "burned-out": "Burned out",
  "no-ignition": "No ignition",
};

const PHASE_TONE: Record<FireState["phase"], string> = {
  heating: "text-[#E8C15A]",
  smoldering: "text-[#E8C15A]",
  flaming: "text-[#F67A6C]",
  extinguished: "text-[#3DCC8D]",
  "burned-out": "text-[#A39E96]",
  "no-ignition": "text-[#3DCC8D]",
};

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

export function formatPower(watts: number): string {
  return watts >= 1000 ? `${(watts / 1000).toFixed(2)} kW` : `${watts.toFixed(0)} W`;
}

function Readout({
  label,
  value,
  unit,
  note,
  tone = "",
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 border-t border-[#343A40] px-2 py-1.5">
      <dt className="font-cond text-[9px] tracking-[0.1em] text-[#8F9A9A] uppercase">{label}</dt>
      <dd className={`numeric truncate text-[15px] leading-5 ${tone || "text-[#F1E8D5]"}`}>
        {value}
        {unit ? <span className="ml-1 font-cond text-[10px] text-[#8F9A9A]">{unit}</span> : null}
      </dd>
      {note ? <p className="truncate text-[9px] leading-3 text-[#8F9A9A]">{note}</p> : null}
    </div>
  );
}

/** Two traces on one small plot: heat release and cabin oxygen. */
function Trace({ history }: { history: FireSample[] }) {
  if (history.length < 3) return null;
  const width = 236;
  const height = 54;
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
    <figure className="border-t border-[#343A40] px-2 pt-1.5 pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[54px] w-full" role="img" aria-label="Heat release rate and oxygen over time">
        <path d={path((point) => point.hrrW / peak)} fill="none" stroke="#E07A3D" strokeWidth="1.4" />
        <path d={path((point) => (point.o2Pct - o2Low) / (o2High - o2Low))} fill="none" stroke="#6BA3C7" strokeWidth="1.2" strokeDasharray="3 2" />
      </svg>
      <figcaption className="flex justify-between font-cond text-[9px] tracking-[0.06em] text-[#8F9A9A] uppercase">
        <span className="text-[#E9A679]">Heat release, peak {formatPower(peak)}</span>
        <span className="text-[#9CC3DD]">O₂ {o2Low.toFixed(1)}–{o2High.toFixed(1)} %</span>
      </figcaption>
    </figure>
  );
}

export function FireHud() {
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

  const co = snapshot?.coPpm ?? 0;
  const co2 = snapshot?.co2RiseMmHg ?? 0;
  const coTone = co >= HAZARD_LIMITS.co1hPpm.value ? "text-[#F67A6C]" : co >= HAZARD_LIMITS.co24hPpm.value ? "text-[#E8C15A]" : "";
  const co2Tone = co2 >= HAZARD_LIMITS.co2MmHg.value ? "text-[#F67A6C]" : "";
  const margin = snapshot ? snapshot.localO2Pct - snapshot.locPct : null;

  return (
    <section
      aria-label="Fire scenario telemetry"
      data-testid="fire-hud"
      className="pointer-events-none relative z-20 mx-3 mb-3 shrink-0 border border-[#465057] bg-[#171C20]/92 md:absolute md:top-[150px] md:right-3 md:mx-0 md:mb-0 md:w-[260px] xl:right-[392px]"
    >
      <header className="flex items-center justify-between gap-2 px-2 py-1.5">
        <p className="font-cond text-[10px] tracking-[0.14em] text-[#B89F7A] uppercase">Live telemetry</p>
        <p className="numeric text-[12px] text-[#F1E8D5]">
          T+{clock(snapshot?.t ?? 0)}
          <span className="ml-1.5 font-cond text-[9px] text-[#8F9A9A] uppercase">
            {status === "running" ? `${speed}×` : status}
          </span>
        </p>
      </header>
      <p className={`border-t border-[#343A40] px-2 py-1 font-cond text-[11px] tracking-[0.08em] uppercase ${snapshot ? PHASE_TONE[snapshot.phase] : "text-[#8F9A9A]"}`}>
        {snapshot ? PHASE_LABEL[snapshot.phase] : "Ready"}
        {snapshot?.extinctionCause ? <span className="ml-1 text-[#A39E96] normal-case tracking-normal">· {snapshot.extinctionCause}</span> : null}
      </p>
      <dl className="grid grid-cols-3 md:grid-cols-2">
        <Readout label="Heat release" value={snapshot ? formatPower(snapshot.hrrW) : "0 W"} note={snapshot ? `peak ${formatPower(snapshot.peakHrrW)}` : undefined} />
        <Readout
          label="Oxygen"
          value={(snapshot?.o2Pct ?? scenario.oxygenPct).toFixed(2)}
          unit="%"
          note={margin === null ? undefined : `${margin >= 0 ? "+" : ""}${margin.toFixed(1)} vs ${snapshot!.locPct.toFixed(1)} % limit`}
        />
        <Readout
          label="Cabin temp"
          value={(snapshot?.tempC ?? 22).toFixed(1)}
          unit="°C"
          note={snapshot ? `near fire ${snapshot.nearFireTempC.toFixed(0)} °C` : undefined}
        />
        <Readout label="Gravity" value={formatGravity(scenario.gravityG)} unit="g" note={snapshot ? `buoyant ${(snapshot.uBuoyantMs * 100).toFixed(0)} cm/s` : undefined} />
        <Readout
          label="Ventilation"
          value={cfm === null ? "—" : cfm.toFixed(0)}
          unit="CFM"
          note={`${(speedMs * 100).toFixed(1)} cm/s`}
        />
        <Readout label="CO" value={co.toFixed(0)} unit="ppm" tone={coTone} note={`1 h limit ${HAZARD_LIMITS.co1hPpm.value}`} />
        <Readout label="CO₂ rise" value={co2.toFixed(2)} unit="mmHg" tone={co2Tone} note={`1 h limit ${HAZARD_LIMITS.co2MmHg.value}`} />
        <Readout
          label="Smoke"
          value={(snapshot?.smokeMgM3 ?? 0).toFixed(1)}
          unit="mg/m³"
          note={snapshot ? `at sensor ${snapshot.detectorSmokeMgM3.toFixed(1)}` : undefined}
        />
      </dl>
      <Trace history={history} />
      <p className="border-t border-[#343A40] px-2 py-1 text-[9px] text-[#8F9A9A]">Instantaneous gases; exposure averages are not calculated.</p>
    </section>
  );
}
