"use client";

import { useState } from "react";
import { ArrowRight, Check, Pause, Play, RotateCcw } from "lucide-react";
import { AskIgnisButton } from "@/components/ai/scenario-assistant";
import { Note, Stat, TextLink, actionClass } from "@/components/design/kit";
import { Cite, CitedValue } from "@/components/fire/cite";
import { RunReview } from "@/components/fire/run-review";
import { ScenarioSetup } from "@/components/fire/scenario-setup";
import { materialById } from "@/data/fire/materials";
import { FIRE_SENSORS, SUPPRESSION_ACTIONS, ignitionById, type SuppressionId } from "@/data/fire/options";
import type { Cited } from "@/data/fire/sources";
import { objectById, roomById, type HabitatRoomConfig } from "@/data/habitat-interiors";
import { MODEL_ASSUMPTIONS } from "@/lib/fire/evidence";
import type { FireInput, FireState } from "@/lib/fire/model";
import { buildFireInput, fuelPackageFor, ventilationCfm } from "@/lib/fire/scenario";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { fireRuntime, useFireSimStore, type FireSpeed } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { PHASE_EXPLANATION, PHASE_LABEL, clock, fieldClass, formatPower } from "./format";
import { ModelApplicability } from "./model-applicability";

const STAGES = ["Set up", "Run", "Respond", "Review"] as const;
type Stage = (typeof STAGES)[number];

const SPEEDS: FireSpeed[] = [1, 10, 60];

/** The fire scenario: set it up, run it, respond to it, review it. */
export function ScenarioPanel() {
  const mission = useMissionStore();
  const sim = useFireSimStore();
  const [stage, setStage] = useState<Stage>("Set up");
  const locked = sim.status !== "idle";
  const snapshot = sim.snapshot;
  const object = objectById(locked ? sim.activeObjectId : mission.selectedObjectId);
  const room = roomById(object?.roomId ?? null);
  const pack = object ? fuelPackageFor(object) : null;
  const material = materialById(sim.config.materialId ?? pack?.materialId ?? "pmma");
  const ignition = ignitionById(sim.config.ignitionId ?? pack?.defaultIgnitionId ?? "hot-wire");
  const input = locked ? fireRuntime.input : object && room ? buildFireInput(mission.scenario, room, object, sim.config) : null;

  function start() {
    if (!object || !room || !input) return;
    sim.start(input, room.id, object.id);
    setStage("Run");
  }

  function reset() {
    sim.reset();
    setStage("Set up");
  }

  return (
    <aside aria-label="Fire scenario" className="flex min-h-0 flex-1 flex-col bg-card">
      <header className="shrink-0 space-y-3 border-b border-border-subtle p-4">
        <div>
          <h2 className="text-[17px] leading-6 font-medium text-foreground">{object?.label ?? "Fire scenario"}</h2>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            {room ? `${room.name}. ` : "Choose where the fire starts. "}
            {mission.scenario.gravityG} g, {mission.scenario.oxygenPct}% O₂, {mission.scenario.pressurePsi} psi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {locked ? (
            <>
              <button
                type="button"
                onClick={sim.status === "running" ? sim.pause : sim.resume}
                disabled={sim.status === "finished"}
                className={actionClass("secondary")}
              >
                {sim.status === "running" ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                {sim.status === "running" ? "Pause" : "Resume"}
              </button>
              <button type="button" onClick={reset} className={actionClass("secondary")}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </button>
            </>
          ) : (
            <button type="button" disabled={!input} onClick={start} className={actionClass("primary")}>
              <Play className="size-4" aria-hidden="true" />
              Start scenario
            </button>
          )}
          <div role="group" aria-label="Simulation speed" className="ml-auto flex rounded-md border border-border p-0.5">
            {SPEEDS.map((speed) => (
              <button
                type="button"
                key={speed}
                aria-pressed={speed === sim.speed}
                onClick={() => sim.setSpeed(speed)}
                className={cn(
                  "numeric min-h-9 rounded-[3px] px-2.5 text-[13px]",
                  speed === sim.speed ? "bg-elev-4 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>

        {snapshot ? (
          <p data-testid="fire-status" className="numeric text-sm text-foreground">
            T+{clock(snapshot.t)} · {PHASE_LABEL[snapshot.phase]} · {formatPower(snapshot.hrrW)}
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-muted-foreground">
            Starting applies heat to the fuel. Whether it ignites depends on the material and the cabin conditions.
          </p>
        )}

        <nav aria-label="Scenario stages" className="grid grid-cols-4 gap-1 rounded-md border border-border-subtle p-0.5">
          {STAGES.map((item, index) => (
            <button
              type="button"
              key={item}
              onClick={() => setStage(item)}
              aria-current={stage === item ? "step" : undefined}
              className={cn(
                "flex min-h-10 items-center justify-center gap-1.5 rounded-[3px] px-1 text-[13px] transition-colors",
                stage === item ? "bg-elev-4 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("numeric text-[12px]", stage === item ? "text-ember-text" : "text-text-tertiary")}>{index + 1}</span>
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {stage === "Set up" ? <SetUpStage locked={locked} input={input} material={material} ignition={ignition} /> : null}
        {stage === "Run" ? <RunStage snapshot={snapshot} onRespond={() => setStage("Respond")} /> : null}
        {stage === "Respond" ? <RespondStage locked={locked} snapshot={snapshot} room={room} /> : null}
        {stage === "Review" ? <RunReview /> : null}

        <details className="rounded-md border border-border-subtle">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">Model basis and assumptions</summary>
          <div className="space-y-3 border-t border-border-subtle px-3 py-3 text-[13px] leading-5 text-muted-foreground">
            <p>
              Heat release is the burning rate times the heat of combustion. Gas moves between the fire, the room and the rest of
              the habitat carrying its species and heat together. Conduction into the fuel, radiation and surface cooling set its
              temperature. Carbon, hydrogen and oxygen balances set the CO₂, CO, water and soot produced.
            </p>
            <p className="text-foreground">{material.nasaFinding}</p>
            <p className="flex flex-wrap gap-1.5">
              {material.nasaSources.map((id) => (
                <Cite key={id} id={id} />
              ))}
            </p>
            <ul className="list-disc space-y-1.5 pl-4">
              {MODEL_ASSUMPTIONS.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        </details>

        <Note>
          This is a reduced-order model, not a certified prediction. Results at lunar and Martian gravity are extrapolations: no
          cabin-scale fire has been measured there.{" "}
          <TextLink href={`${ROUTES.modelingData}?view=check`}>How the model compares with Saffire</TextLink>
        </Note>
      </div>
    </aside>
  );
}

function StageHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[15px] leading-5 font-medium text-foreground">{title}</h3>
      {children ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{children}</p> : null}
    </div>
  );
}

function SetUpStage({
  locked,
  input,
  material,
  ignition,
}: {
  locked: boolean;
  input: FireInput | null;
  material: ReturnType<typeof materialById>;
  ignition: ReturnType<typeof ignitionById>;
}) {
  const scenario = useMissionStore((state) => state.scenario);
  const patchScenario = useMissionStore((state) => state.patchScenario);
  const clampTo = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const properties: Array<[string, Cited<number | null>, string]> = [
    ["Ignition temperature", material.ignitionTempC, "°C"],
    ["Heat of combustion", material.heatOfCombustionMJkg, "MJ/kg"],
    ["Thermal inertia", material.thermalInertia, "(kW/m²K)² s"],
    ["Oxygen limit in Earth gravity", material.loc1gPct, "% O₂"],
    ["Heat source flux", ignition.heatFluxKwM2, "kW/m²"],
  ];

  return (
    <>
      <section className="space-y-3">
        <StageHeading title="What burns, and where">
          {locked ? "This setup belongs to the current run. Reset to change it." : undefined}
        </StageHeading>
        <ScenarioSetup compact />
      </section>

      <section className="space-y-3">
        <StageHeading title="Cabin atmosphere">
          Oxygen, pressure and airflow decide whether a material burns. Gravity follows the habitat chosen in the top bar.
        </StageHeading>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-foreground">
            Oxygen (%)
            <input
              aria-label="Cabin oxygen percent"
              type="number"
              min={10}
              max={40}
              step={0.5}
              disabled={locked}
              value={scenario.oxygenPct}
              onChange={(event) => patchScenario({ oxygenPct: clampTo(Number(event.target.value), 10, 40) })}
              className={cn(fieldClass, "numeric mt-1.5")}
            />
          </label>
          <label className="text-sm text-foreground">
            Pressure (psi)
            <input
              aria-label="Cabin pressure psi"
              type="number"
              min={5}
              max={15}
              step={0.1}
              disabled={locked}
              value={scenario.pressurePsi}
              onChange={(event) => patchScenario({ pressurePsi: clampTo(Number(event.target.value), 5, 15) })}
              className={cn(fieldClass, "numeric mt-1.5")}
            />
          </label>
        </div>
        <AirflowSlider label="Cabin airflow" ariaLabel="Cabin airflow" />
        {input ? <ModelApplicability input={input} /> : null}
      </section>

      <details className="rounded-md border border-border-subtle">
        <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">
          Material properties and sources
        </summary>
        <dl className="space-y-3 border-t border-border-subtle px-3 py-3 text-[13px]">
          {properties.map(([label, cited, unit]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>
                <CitedValue cited={cited} unit={unit} />
              </dd>
            </div>
          ))}
          <p className="text-[12px] leading-4 text-text-tertiary">Baseline CO₂ of 400 ppm is assumed.</p>
        </dl>
      </details>
    </>
  );
}

function AirflowSlider({ label, ariaLabel, live }: { label: string; ariaLabel: string; live?: number }) {
  const airflowMs = useMissionStore((state) => state.scenario.airflowMs);
  const patchScenario = useMissionStore((state) => state.patchScenario);
  return (
    <label className="block text-sm text-foreground">
      <span className="flex items-baseline justify-between gap-3">
        {label}
        <span className="numeric text-ember-text">{((live ?? airflowMs) * 100).toFixed(1)} cm/s</span>
      </span>
      <input
        aria-label={ariaLabel}
        type="range"
        min={0}
        max={0.5}
        step={0.005}
        value={airflowMs}
        onChange={(event) => patchScenario({ airflowMs: Number(event.target.value) })}
        className="mt-3 w-full accent-primary"
      />
    </label>
  );
}

function RunStage({ snapshot, onRespond }: { snapshot: FireState | null; onRespond: () => void }) {
  const showAirflow = useFireSimStore((store) => store.showAirflow);
  const enhanceVisibility = useFireSimStore((store) => store.enhanceVisibility);
  const setVisuals = useFireSimStore((store) => store.setVisuals);

  return (
    <>
      <section className="space-y-3">
        <StageHeading title={snapshot ? PHASE_LABEL[snapshot.phase] : "Not started"}>
          {snapshot ? PHASE_EXPLANATION[snapshot.phase] : "Choose where the fire starts in Set up, then start the scenario."}
        </StageHeading>
        {snapshot ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-md border border-border-subtle p-3">
            <Stat size="sm" label="Heat from burning" value={formatPower(snapshot.chemicalHrrW)} />
            <Stat size="sm" label="Heat from the source" value={formatPower(snapshot.sourceHeatW)} />
            <Stat size="sm" label="Fuel surface" value={snapshot.surfaceTempC.toFixed(0)} unit="°C" />
            <Stat size="sm" label="Oxygen at the fuel" value={snapshot.localO2Pct.toFixed(1)} unit="%" />
          </dl>
        ) : null}
        <p className="text-[13px] leading-5 text-muted-foreground">
          The strip under the habitat shows cabin averages. The hottest gas stays close to the fire.
        </p>
      </section>

      <section className="space-y-2">
        <StageHeading title="Display" />
        <label className="flex min-h-10 items-center gap-2.5 text-sm text-foreground">
          <input type="checkbox" checked={showAirflow} onChange={(event) => setVisuals({ showAirflow: event.target.checked })} className="size-4 accent-primary" />
          Show airflow tracers
        </label>
        <label className="flex min-h-10 items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enhanceVisibility}
            onChange={(event) => setVisuals({ enhanceVisibility: event.target.checked })}
            className="size-4 accent-primary"
          />
          Enlarge the flame 1.5× for visibility
        </label>
        <p className="text-[12px] leading-4 text-text-tertiary">
          {enhanceVisibility ? "The flame is drawn larger than modeled." : "The flame is drawn at its modeled size."} Flame color is
          illustrative.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <AskIgnisButton label="Explain this run" prompt="Explain this run" />
        <button type="button" onClick={onRespond} className={actionClass("secondary")}>
          Respond to the fire
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function isUsed(snapshot: FireState | null, id: SuppressionId): boolean {
  if (!snapshot) return false;
  if (id === "power-off") return snapshot.powerOff;
  if (id === "vent-off") return snapshot.ventOff;
  if (id === "co2") return snapshot.agent.co2Start !== null;
  if (id === "water-mist") return snapshot.agent.mistStart !== null;
  return snapshot.agent.halonStart !== null;
}

function RespondStage({ locked, snapshot, room }: { locked: boolean; snapshot: FireState | null; room: HabitatRoomConfig | null }) {
  const sim = useFireSimStore();
  const airflowMs = useMissionStore((state) => state.scenario.airflowMs);
  const liveMs = snapshot?.uForcedMs ?? airflowMs;

  return (
    <>
      <section className="space-y-3">
        <StageHeading title="Detection">Sensors that are switched on can raise the alarm.</StageHeading>
        <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
          {FIRE_SENSORS.map((sensor) => {
            const enabled = sim.config.sensors.includes(sensor.id);
            const alarmed = Boolean(snapshot?.sensors[sensor.id].alarmed);
            return (
              <li key={sensor.id}>
                <label className="flex min-h-11 items-center gap-2.5 px-3 text-sm text-foreground">
                  <input type="checkbox" checked={enabled} onChange={() => sim.toggleSensor(sensor.id)} className="size-4 accent-primary" />
                  <span className="min-w-0 flex-1">{sensor.name}</span>
                  <span className={cn("text-[12px]", alarmed ? "text-status-warning" : "text-text-tertiary")}>
                    {alarmed ? "Alarm" : enabled ? "Monitoring" : "Off"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <StageHeading title="Ventilation">Recirculated air moves smoke and gases. It adds no fresh oxygen.</StageHeading>
        <AirflowSlider label="Airflow" ariaLabel="Ventilation speed" live={liveMs} />
        {room ? (
          <p className="numeric text-[13px] text-muted-foreground">{ventilationCfm(liveMs, room).toFixed(0)} CFM through a conceptual flow area</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <StageHeading title="Actions">{locked ? undefined : "Start the scenario to act on it."}</StageHeading>
        <ul className="space-y-2">
          {SUPPRESSION_ACTIONS.map((action) => {
            const used = isUsed(snapshot, action.id);
            return (
              <li key={action.id} className="rounded-md border border-border-subtle p-3">
                <button
                  type="button"
                  disabled={!locked || used}
                  onClick={() => sim.act(action.id)}
                  className={cn(actionClass("secondary"), "w-full justify-start text-left")}
                >
                  {used ? <Check className="size-4 text-status-nominal" aria-hidden="true" /> : null}
                  {action.name}
                </button>
                <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{action.mechanism}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="rounded-md border border-border-subtle">
        <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">Automatic response</summary>
        <div className="space-y-3 border-t border-border-subtle px-3 py-3">
          <label className="flex min-h-10 items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              checked={sim.config.autoResponse}
              disabled={locked}
              onChange={(event) => sim.patchConfig({ autoResponse: event.target.checked })}
              className="size-4 accent-primary"
            />
            Remove power and stop the fans on alarm
          </label>
          <label className="block text-sm text-foreground">
            Crew action after the alarm
            <select
              aria-label="Automatic crew agent"
              disabled={locked}
              value={sim.config.crewAgent ?? "none"}
              onChange={(event) =>
                sim.patchConfig({ crewAgent: event.target.value === "none" ? null : (event.target.value as "co2" | "water-mist" | "halon") })
              }
              className={cn(fieldClass, "mt-1.5")}
            >
              <option value="none">Manual only</option>
              <option value="co2">CO₂ extinguisher</option>
              <option value="water-mist">Water mist</option>
              <option value="halon">Chemical agent (exploratory)</option>
            </select>
          </label>
          <label className="block text-sm text-foreground">
            Crew delay (seconds)
            <input
              aria-label="Crew response delay"
              type="number"
              min={0}
              max={600}
              disabled={locked}
              value={sim.config.crewResponseS}
              onChange={(event) => sim.patchConfig({ crewResponseS: Math.max(0, Math.min(600, Number(event.target.value))) })}
              className={cn(fieldClass, "numeric mt-1.5")}
            />
          </label>
          <p className="text-[12px] leading-4 text-text-tertiary">The automatic isolation acts 2 s after the alarm, an assumed delay.</p>
        </div>
      </details>

      <p className="text-[13px] leading-5 text-muted-foreground">
        Agent delivery, capture and detector calibration are assumptions. <Cite id="fwm-pfe" />
      </p>
    </>
  );
}
