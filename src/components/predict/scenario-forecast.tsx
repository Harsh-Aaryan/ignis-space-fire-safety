"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ActionLink, EvidenceTag, Note, Panel, Stat, TextLink, actionClass, table } from "@/components/design/kit";
import { Cite } from "@/components/fire/cite";
import { ScenarioSetup } from "@/components/fire/scenario-setup";
import { ApplicabilityTag } from "@/components/simulation/model-applicability";
import { PHASE_LABEL, clock, formatPower } from "@/components/simulation/format";
import { objectById, roomById } from "@/data/habitat-interiors";
import { FIRE_MODEL_VERSION, applicability } from "@/lib/fire/evidence";
import { runFire, type FireRun, type FireSample } from "@/lib/fire/model";
import { buildFireInput } from "@/lib/fire/scenario";
import { downloadText } from "@/lib/research/export";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

const REGIMES = [
  { g: 0, name: "Orbit, ~0 g" },
  { g: 0.165, name: "Moon, 0.165 g" },
  { g: 0.38, name: "Mars, 0.38 g" },
];

const DURATIONS = [300, 600, 1200];

const TRACE_COLOR = ["stroke-status-info", "stroke-ember", "stroke-status-caution"];
const TRACE_TEXT = ["text-status-info", "text-ember-text", "text-status-caution"];

/** The same fuel, heat source and cabin, run at three gravity levels. */
export function ScenarioForecast() {
  const mission = useMissionStore();
  const sim = useFireSimStore();
  const [durationS, setDurationS] = useState(600);
  const locked = sim.status !== "idle";
  const object = objectById(locked ? sim.activeObjectId : mission.selectedObjectId);
  const room = roomById(object?.roomId ?? null);
  const input = useMemo(
    () => (room && object ? buildFireInput(mission.scenario, room, object, sim.config) : null),
    [mission.scenario, room, object, sim.config],
  );
  const runs = useMemo(
    () => (input ? REGIMES.map((regime) => ({ ...regime, input: { ...input, gravityG: regime.g }, run: runFire({ ...input, gravityG: regime.g }, { durationS }) })) : []),
    [input, durationS],
  );

  if (!input || !object || !room) {
    return (
      <Panel
        title="Choose a setup"
        description={
          <>
            Pick where the fire starts. The same setup is then run at each gravity level.
            <span className="mt-1 block">Results appear below as soon as you choose a setup</span>
          </>
        }
      >
        <ScenarioSetup />
      </Panel>
    );
  }

  function openInHabitat() {
    if (!object || !input) return;
    mission.selectObject(object.id);
    sim.patchConfig({ materialId: input.material.id, ignitionId: input.ignition.id });
    sim.setOpen(true);
  }

  function exportForecast() {
    if (!input) return;
    const payload = {
      modelVersion: FIRE_MODEL_VERSION,
      provenance: "IGNIS reduced-order model output, not NASA measurements",
      durationS,
      regimes: runs.map((item) => ({
        gravityG: item.g,
        applicability: applicability(item.input),
        input: item.input,
        history: item.run.history,
        events: item.run.state.events,
      })),
    };
    downloadText("ignis-gravity-comparison.json", JSON.stringify(payload, null, 2), "application/json");
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Setup"
        description={
          locked ? (
            <>
              A run in the habitat is using this setup.{" "}
              <button type="button" onClick={sim.reset} className="text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">
                Reset the run to edit it
              </button>
            </>
          ) : (
            "The same fuel, heat source and cabin atmosphere are used for every gravity level."
          )
        }
        actions={
          <ActionLink href={ROUTES.simulation} onClick={openInHabitat}>
            Open in 3D simulation
          </ActionLink>
        }
      >
        <ScenarioSetup />
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="text-sm text-foreground">
            Duration
            <select
              aria-label="Prediction duration"
              value={durationS}
              onChange={(event) => setDurationS(Number(event.target.value))}
              className="mt-1.5 block min-h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {DURATIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds / 60} minutes
                </option>
              ))}
            </select>
          </label>
          <p className="min-w-0 flex-1 basis-72 text-[13px] leading-5 text-muted-foreground">
            {room.name}: {input.roomVolumeM3.toFixed(1)} m³ of air in the room, {input.habitatVolumeM3.toFixed(1)} m³ connected.{" "}
            {input.oxygenPct}% O₂, {mission.scenario.pressurePsi} psi, {(input.ventilationMs * 100).toFixed(1)} cm/s. Fuel
            dimensions and air volume are conceptual.
          </p>
        </div>
      </Panel>

      <Panel title="Result by gravity" flush>
        <div className="overflow-x-auto">
          <table className={table.root} aria-label="Gravity regime comparison">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>
                  Gravity
                </th>
                <th scope="col" className={table.th}>
                  Basis
                </th>
                {["Peak heat release", "Final O₂", "Final CO", "CO₂ rise", "First alarm", "Final state"].map((label) => (
                  <th key={label} scope="col" className={cn(table.th, "text-right")}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(({ g, name, run, input: regimeInput }) => (
                <tr key={g} className={cn(table.tr, g === mission.scenario.gravityG ? "bg-elev-2" : "")}>
                  <th scope="row" className={cn(table.td, "font-medium whitespace-nowrap text-foreground")}>
                    {name}
                    {g === mission.scenario.gravityG ? <span className="ml-2 text-[12px] font-normal text-text-tertiary">current habitat</span> : null}
                  </th>
                  <td className={table.td}>
                    <ApplicabilityTag input={regimeInput} />
                  </td>
                  <td className={table.num}>{formatPower(run.state.peakHrrW)}</td>
                  <td className={table.num}>{run.state.o2Pct.toFixed(2)}%</td>
                  <td className={table.num}>{run.state.coPpm.toFixed(0)} ppm</td>
                  <td className={table.num}>{run.state.co2RiseMmHg.toFixed(2)} mmHg</td>
                  <td className={table.num}>{run.state.firstAlarmTime === null ? "No alarm" : `T+${clock(run.state.firstAlarmTime)}`}</td>
                  <td className={cn(table.td, "text-right whitespace-nowrap")}>{PHASE_LABEL[run.state.phase]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Heat release over time" description="Each line is the same fire at a different gravity level.">
        <ComparisonTrace runs={runs.map((item) => ({ name: item.name, run: item.run }))} durationS={durationS} />
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="forecast-summary">
          {runs.map((item, index) => (
            <Stat
              key={item.g}
              label={item.name}
              value={formatPower(item.run.state.peakHrrW)}
              note={<span className={TRACE_TEXT[index]}>Peak heat release</span>}
            />
          ))}
        </dl>
      </Panel>

      <Note>
        Lunar and Martian results are <EvidenceTag kind="extrapolated" className="mx-0.5 align-middle" /> : no cabin-scale fire has
        been measured in partial gravity. {input.material.nasaFinding}{" "}
        <span className="inline-flex flex-wrap gap-1.5 align-middle">
          {input.material.nasaSources.map((id) => (
            <Cite key={id} id={id} compact />
          ))}
        </span>{" "}
        <TextLink href={`${ROUTES.modelingData}?view=check`}>How the model compares with Saffire</TextLink>
      </Note>

      <div>
        <button type="button" onClick={exportForecast} className={actionClass("secondary")}>
          <Download className="size-4" aria-hidden="true" />
          Export comparison (JSON)
        </button>
      </div>
    </div>
  );
}

function ComparisonTrace({ runs, durationS }: { runs: Array<{ name: string; run: FireRun }>; durationS: number }) {
  const width = 600;
  const height = 140;
  const peak = Math.max(1, ...runs.flatMap((item) => item.run.history.map((point) => point.hrrW)));
  const path = (history: FireSample[]) =>
    history
      .map((point, index) => {
        const x = (point.t / Math.max(1, durationS)) * width;
        const y = height - 4 - (point.hrrW / peak) * (height - 12);
        return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Modeled heat release rate over time at three gravity levels">
        <line x1="0" y1={height - 4} x2={width} y2={height - 4} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {runs.map((item, index) => (
          <path key={item.name} d={path(item.run.history)} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" className={TRACE_COLOR[index]} />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[12px] leading-4 text-muted-foreground">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {runs.map((item, index) => (
            <span key={item.name} className={TRACE_TEXT[index]}>
              {item.name}
            </span>
          ))}
        </span>
        <span>
          0 to {clock(durationS)}, vertical scale to {formatPower(peak)}
        </span>
      </figcaption>
    </figure>
  );
}
