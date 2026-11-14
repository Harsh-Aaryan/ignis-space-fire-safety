"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Cite, CitedValue } from "@/components/fire/cite";
import { clock, formatPower } from "@/components/firetwin/fire-hud";
import { FIRE_MATERIALS, materialById } from "@/data/fire/materials";
import {
  FIRE_SENSORS,
  IGNITION_SOURCES,
  SUPPRESSION_ACTIONS,
  ignitionById,
  type SuppressionId,
} from "@/data/fire/options";
import { objectById, roomById, roomsForHabitat } from "@/data/habitat-interiors";
import { formatGravity } from "@/lib/format";
import {
  buoyantBaseVelocity,
  ignitionDelayS,
  limitingOxygenPct,
} from "@/lib/fire/model";
import {
  buildFireInput,
  fuelPackageFor,
  firePoint,
  nearestDetector,
  speedFromCfm,
  ventilationCfm,
} from "@/lib/fire/scenario";
import { KPA_PER_PSI } from "@/lib/physics/atmosphere";
import { useFireSimStore, type FireSpeed } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

const SPEEDS: FireSpeed[] = [1, 10, 60];
const PREFERRED = ["bench", "samples", "bed", "rack", "cabinet"];

function Stage({
  step,
  title,
  children,
  open = true,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="border-b border-[#343A40] py-3">
      <summary className="flex cursor-pointer items-baseline gap-2 font-cond text-[12px] tracking-[0.1em] text-[#D5D4CC] uppercase">
        <span className="numeric text-[10px] text-[#B89F7A]">{step}</span>
        {title}
      </summary>
      <div className="mt-3 space-y-3 text-[12px] leading-5">{children}</div>
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#2C3237] py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

const fieldClass = "w-full rounded-sm border border-[#465057] bg-[#171C20] px-2 py-1.5 text-[12px] text-[#E7E8DE] disabled:opacity-60";

export function FireSimPanel() {
  const mission = useMissionStore();
  const { scenario } = mission;
  const sim = useFireSimStore();
  const { config, status, snapshot } = sim;
  const locked = status !== "idle";

  const room = roomById(locked ? sim.activeRoomId : mission.selectedRoomId);
  const object = objectById(locked ? sim.activeObjectId : mission.selectedObjectId);
  const rooms = roomsForHabitat(scenario.missionId);

  const pack = object ? fuelPackageFor(object) : null;
  const material = materialById(config.materialId ?? pack?.materialId ?? "pmma");
  const ignition = ignitionById(config.ignitionId ?? pack?.defaultIgnitionId ?? "overload-wire");
  const pressureKpa = scenario.pressurePsi * KPA_PER_PSI;

  const preview = useMemo(() => {
    const localFlow = scenario.airflowMs * (pack?.enclosed ? 0.3 : 1);
    const buoyant = buoyantBaseVelocity(scenario.gravityG, pressureKpa);
    const base = Math.hypot(localFlow, buoyant);
    const limit = limitingOxygenPct(material, base, pressureKpa);
    return {
      buoyant,
      base,
      limit,
      delay: ignitionDelayS(material, ignition, 22, base),
      flammable: scenario.oxygenPct >= limit,
    };
  }, [scenario.airflowMs, scenario.gravityG, scenario.oxygenPct, pressureKpa, material, ignition, pack?.enclosed]);

  const detector = room && object ? nearestDetector(room, firePoint(object, room)) : null;
  const cfm = room ? ventilationCfm(scenario.airflowMs, room) : 0;
  const liveSpeed = snapshot ? snapshot.uForcedMs : scenario.airflowMs;

  function pickDefault() {
    const target = room ?? rooms[0];
    if (!target) return;
    const item =
      PREFERRED.map((type) => target.equipment.find((entry) => entry.type === type)).find(Boolean) ??
      target.equipment[0];
    if (item) mission.selectObject(item.id);
  }

  function start() {
    if (!room || !object) return;
    sim.start(buildFireInput(scenario, room, object, config), room.id, object.id);
    mission.pushActivity(`Fire scenario started at ${object.label} in ${room.name}.`, "firetwin");
  }

  function setAirflow(speedMs: number) {
    const value = Math.max(0, Math.min(1, speedMs));
    mission.patchScenario({ airflowMs: Number(value.toFixed(3)) });
    sim.setVentilation(value);
  }

  const running = status === "running" || status === "paused";

  return (
    <aside
      aria-label="Fire scenario"
      className="min-h-0 shrink-0 bg-[#1F2125] xl:flex-1 xl:overflow-y-auto"
    >
      <header className="z-10 border-b border-[#343A40] bg-[#1F2125] px-4 py-3 xl:sticky xl:top-0">
        <p className="font-cond text-[10px] tracking-[0.16em] text-[#B89F7A] uppercase">FireTwin / fire scenario</p>
        <h2 aria-live="polite" className="mt-1 text-[17px] font-medium">
          {object ? object.label : "Choose where the fire starts"}
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {room ? room.name : "No room selected"} · {formatGravity(scenario.gravityG)} g · {scenario.oxygenPct} % O₂ ·{" "}
          {scenario.pressurePsi} psi
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {status === "idle" ? (
            <button
              type="button"
              disabled={!object}
              onClick={start}
              className="min-h-8 border border-[#C8794A] bg-[#4A2A1A] px-3 font-cond text-[11px] tracking-[0.08em] text-[#FFD9BE] uppercase disabled:opacity-50"
            >
              Start fire scenario
            </button>
          ) : (
            <>
              {status === "running" ? (
                <SimButton onClick={sim.pause}>Pause</SimButton>
              ) : status === "paused" ? (
                <SimButton onClick={sim.resume}>Resume</SimButton>
              ) : null}
              <SimButton onClick={sim.reset}>Reset</SimButton>
            </>
          )}
          <div className="ml-auto flex border border-[#465057] p-0.5" role="group" aria-label="Simulation speed">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={sim.speed === value}
                onClick={() => sim.setSpeed(value)}
                className={`px-2 py-0.5 font-cond text-[10px] ${sim.speed === value ? "bg-[#394346] text-white" : "text-[#AEB6B6]"}`}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
        {snapshot ? (
          <p className="numeric mt-2 text-[11px] text-[#D0D3CC]" data-testid="fire-status">
            T+{clock(snapshot.t)} · {snapshot.phase} · {formatPower(snapshot.hrrW)} · O₂ {snapshot.o2Pct.toFixed(2)} %
          </p>
        ) : null}
      </header>

      <div className="px-4 pb-6">
        {!object ? (
          <div className="mt-3 border border-[#465057] bg-[#171C20] p-3 text-[12px] leading-5">
            <p>Pick a piece of equipment in the cutaway, or start from a suggested one.</p>
            <button type="button" onClick={pickDefault} className="mt-2 border border-[#8D775F] px-2 py-1.5 text-[#E4C09B] hover:bg-[#38332D]">
              Use {room ? "this room" : rooms[0]?.name ?? "the first room"}
            </button>
          </div>
        ) : null}

        <Stage step="01" title="Ignition and fuel">
          {room ? (
            <label className="block">
              <span className="text-muted-foreground">Fire origin</span>
              <select
                aria-label="Fire origin"
                disabled={locked}
                value={object?.id ?? ""}
                onChange={(event) => event.target.value && mission.selectObject(event.target.value)}
                className={fieldClass}
              >
                <option value="">Select equipment</option>
                {room.equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {pack ? (
            <p className="text-muted-foreground">
              Burning item: {pack.label}, {(pack.widthM * 100).toFixed(0)} × {(pack.lengthM * 100).toFixed(0)} cm
              {pack.enclosed ? ", behind a panel" : ", open to the cabin"}. Conceptual size.
            </p>
          ) : null}
          <label className="block">
            <span className="text-muted-foreground">Ignition source</span>
            <select
              aria-label="Ignition source"
              disabled={locked}
              value={ignition.id}
              onChange={(event) => sim.patchConfig({ ignitionId: event.target.value })}
              className={fieldClass}
            >
              {IGNITION_SOURCES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p>{ignition.description}</p>
          <label className="block">
            <span className="text-muted-foreground">Material</span>
            <select
              aria-label="Material"
              disabled={locked}
              value={material.id}
              onChange={(event) => sim.patchConfig({ materialId: event.target.value })}
              className={fieldClass}
            >
              {FIRE_MATERIALS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <dl>
            <Row label="Source heat flux">
              <CitedValue cited={ignition.heatFluxKwM2} unit="kW/m²" />
            </Row>
            <Row label="Source duration">
              {ignition.durationS.value === null ? "until power is removed" : <CitedValue cited={ignition.durationS} unit="s" />}
            </Row>
            <Row label="Ignition temperature">
              <CitedValue cited={material.ignitionTempC} unit="°C" />
            </Row>
            <Row label="Thermal inertia kρc">
              <CitedValue cited={material.thermalInertia} unit="(kW/m²K)²s" />
            </Row>
            <Row label="Critical heat flux">
              <CitedValue cited={material.criticalHeatFluxKwM2} unit="kW/m²" />
            </Row>
            <Row label="Heat of combustion">
              <CitedValue cited={material.heatOfCombustionMJkg} unit="MJ/kg" />
            </Row>
            <Row label="Oxygen limit in 1 g">
              <CitedValue cited={material.loc1gPct} unit="% O₂" />
            </Row>
            <Row label="Burns this far below it at low flow">
              <CitedValue cited={material.lowFlowMarginPct} unit="% O₂" />
            </Row>
          </dl>
          <div className={`border-l-2 pl-2 ${preview.flammable && preview.delay !== null ? "border-[#F67A6C]" : "border-[#3DCC8D]"}`}>
            <p>
              Predicted ignition:{" "}
              <strong className="numeric font-medium">
                {preview.delay === null ? "source cannot ignite this material" : `${preview.delay.toFixed(1)} s`}
              </strong>
              .
            </p>
            <p>
              Oxygen limit here: <strong className="numeric font-medium">{preview.limit.toFixed(1)} %</strong> at{" "}
              {(preview.base * 100).toFixed(1)} cm/s. Cabin has {scenario.oxygenPct} %, so a flame{" "}
              {preview.flammable ? "can be sustained" : "cannot be sustained"}.
            </p>
          </div>
        </Stage>

        <Stage step="02" title="Atmosphere and ventilation">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-muted-foreground">Oxygen (%)</span>
              <input
                aria-label="Scenario oxygen (%)"
                type="number"
                min={15}
                max={45}
                step={0.5}
                disabled={locked}
                value={scenario.oxygenPct}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(value) && value >= 15 && value <= 45) mission.patchScenario({ oxygenPct: value });
                }}
                className={`numeric ${fieldClass}`}
              />
            </label>
            <label>
              <span className="text-muted-foreground">Pressure (psi)</span>
              <input
                aria-label="Scenario cabin pressure (psi)"
                type="number"
                min={5}
                max={20}
                step={0.1}
                disabled={locked}
                value={scenario.pressurePsi}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(value) && value >= 5 && value <= 20) mission.patchScenario({ pressurePsi: value });
                }}
                className={`numeric ${fieldClass}`}
              />
            </label>
          </div>
          <label className="block">
            <span className="flex justify-between text-muted-foreground">
              <span>Ventilation</span>
              <span className="numeric text-[#E7E8DE]">
                {cfm.toFixed(0)} CFM · {(scenario.airflowMs * 100).toFixed(1)} cm/s
              </span>
            </span>
            <input
              aria-label="Ventilation flow"
              type="range"
              min={0}
              max={room ? Math.round(ventilationCfm(0.4, room)) : 1000}
              step={10}
              value={Math.round(cfm)}
              onChange={(event) => room && setAirflow(speedFromCfm(event.currentTarget.valueAsNumber, room))}
              className="w-full accent-[#7FD6C4]"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["Fans off", 0],
                ["5 cm/s", 0.05],
                ["8 cm/s (SAME)", 0.08],
                ["20 cm/s (Saffire)", 0.2],
              ] as const
            ).map(([label, value]) => (
              <button key={label} type="button" onClick={() => setAirflow(value)} className="border border-[#41494E] px-2 py-1 text-[11px] text-[#BCC1BE] hover:bg-[#30373C]">
                {label}
              </button>
            ))}
          </div>
          <dl>
            <Row label="Gravity">{formatGravity(scenario.gravityG)} g</Row>
            <Row label="Buoyant flow at the flame base">
              <span className="numeric">{((snapshot?.uBuoyantMs ?? preview.buoyant) * 100).toFixed(1)} cm/s</span>
            </Row>
            <Row label="Forced flow now">
              <span className="numeric">{(liveSpeed * 100).toFixed(1)} cm/s</span>
            </Row>
            <Row label="Flame shape">
              {scenario.gravityG < 0.01
                ? "Dome hugging the fuel, steady, blue at low flow"
                : "Buoyant plume, flickering, smoke rises to a ceiling layer"}
            </Row>
            {snapshot ? (
              <>
                <Row label="Smoke layer height">
                  <span className="numeric">
                    {scenario.gravityG < 0.01 ? "no layer without gravity" : `${snapshot.layerHeightM.toFixed(2)} m`}
                  </span>
                </Row>
                <Row label="Smoke travel time to sensor">
                  <span className="numeric">
                    {snapshot.transportS > 36000 ? "diffusion only, hours" : `${snapshot.transportS.toFixed(0)} s`}
                  </span>
                </Row>
              </>
            ) : null}
          </dl>
          <p className="text-muted-foreground">
            Without gravity, ventilation dominates oxygen supply and smoke transport. With no flow, smoke
            diffuses about 4 cm a minute <Cite id="same-2" />. BASS-II PMMA film quenched below about 2 cm/s;
            other fuel geometries have different limits <Cite id="bass-ii" />.
          </p>
        </Stage>

        <Stage step="03" title="Detection">
          <p className="text-muted-foreground">
            {detector?.inRoom
              ? `Nearest detector is ${detector.distanceM.toFixed(1)} m from the fuel.`
              : "This room has no detector. The model uses one in the return duct of the next compartment."}
          </p>
          <ul className="space-y-2">
            {FIRE_SENSORS.map((sensor) => {
              const on = config.sensors.includes(sensor.id);
              const cell = snapshot?.sensors[sensor.id];
              const level = cell ? Math.min(1, cell.signal / sensor.threshold.value) : 0;
              return (
                <li key={sensor.id} className="border border-[#343A40] p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={on} onChange={() => sim.toggleSensor(sensor.id)} className="mt-1 accent-[#7FD6C4]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[#E7E8DE]">{sensor.name}</span>
                        {cell?.alarmed ? (
                          <span className="numeric text-[11px] text-[#F67A6C]">ALARM T+{clock(cell.alarmTime ?? 0)}</span>
                        ) : cell ? (
                          <span className="numeric text-[11px] text-muted-foreground">
                            {cell.signal.toFixed(2)} / {sensor.threshold.value} {sensor.unit.split(" ")[0]}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{sensor.principle}</span>
                      <span className="mt-1 block h-1 bg-[#343A40]">
                        <span
                          className={`block h-full ${cell?.alarmed ? "bg-[#F67A6C]" : "bg-[#7FD6C4]"}`}
                          style={{ width: `${level * 100}%`, opacity: on ? 1 : 0.35 }}
                        />
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                        {sensor.heritage}
                        {sensor.sources.map((id) => (
                          <Cite key={id} id={id} compact />
                        ))}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {snapshot ? (
            <p className="text-muted-foreground">
              Smoke at the sensor: count mean {snapshot.smokeCountMeanUm.toFixed(2)} µm, mass mean{" "}
              {snapshot.smokeMassMeanUm.toFixed(2)} µm <Cite id={material.smokeCountMeanUm.source} />. Small particles favour
              ionization; large ones favour light scattering.
            </p>
          ) : null}
        </Stage>

        <Stage step="04" title="Suppression and response">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={config.autoResponse}
              onChange={(event) => {
                sim.patchConfig({ autoResponse: event.currentTarget.checked });
              }}
              disabled={locked}
              className="mt-1 accent-[#7FD6C4]"
            />
            <span>
              Automatic response on alarm: remove power, stop fans, close intermodule ventilation <Cite id="iss-fds-2001" />
            </span>
          </label>
          <div className="grid grid-cols-[1fr_88px] gap-2">
            <label>
              <span className="text-muted-foreground">Crew agent</span>
              <select
                aria-label="Crew agent"
                disabled={locked}
                value={config.crewAgent ?? ""}
                onChange={(event) => sim.patchConfig({ crewAgent: (event.target.value || null) as SuppressionId | null })}
                className={fieldClass}
              >
                <option value="">None, manual only</option>
                <option value="co2">CO₂ extinguisher</option>
                <option value="water-mist">Fine water mist</option>
                <option value="halon">Halon 1301</option>
              </select>
            </label>
            <label>
              <span className="text-muted-foreground">After (s)</span>
              <input
                aria-label="Crew response time (s)"
                type="number"
                min={10}
                max={600}
                step={10}
                disabled={locked}
                value={config.crewResponseS}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(value) && value >= 10 && value <= 600) sim.patchConfig({ crewResponseS: value });
                }}
                className={`numeric ${fieldClass}`}
              />
            </label>
          </div>
          <div className="grid gap-2">
            {SUPPRESSION_ACTIONS.map((action) => {
              const used =
                !!snapshot &&
                ((action.id === "power-off" && snapshot.powerOff) ||
                  (action.id === "vent-off" && snapshot.ventOff) ||
                  (action.id === "co2" && snapshot.agent.co2Start !== null) ||
                  (action.id === "water-mist" && snapshot.agent.mistStart !== null) ||
                  (action.id === "halon" && snapshot.agent.halonStart !== null));
              return (
                <div key={action.id} className="border border-[#343A40] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={!running || used}
                      onClick={() => sim.act(action.id)}
                      className="min-h-8 border border-[#4B555B] px-2 text-left text-[#E7E8DE] hover:bg-[#30373C] disabled:opacity-50"
                    >
                      {used ? "✓ " : ""}
                      {action.name}
                    </button>
                    <span className="flex gap-1">
                      {action.sources.map((id) => (
                        <Cite key={id} id={id} compact />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{action.mechanism}</p>
                  <p className="text-[11px] text-[#D9B978]">{action.caution}</p>
                </div>
              );
            })}
          </div>
        </Stage>

        <Stage step="LOG" title="Event timeline">
          {sim.events.length ? (
            <ol className="space-y-1.5" aria-live="polite">
              {[...sim.events].reverse().map((event, index) => (
                <li key={`${event.t}-${index}`} className="grid grid-cols-[52px_1fr] gap-2">
                  <span className="numeric text-[11px] text-muted-foreground">T+{clock(event.t)}</span>
                  <span
                    className={
                      event.kind === "hazard" || event.kind === "ignition"
                        ? "text-[#F3A99F]"
                        : event.kind === "detection"
                          ? "text-[#E8C15A]"
                          : event.kind === "extinction"
                            ? "text-[#8FE0BC]"
                            : ""
                    }
                  >
                    {event.label} {event.source ? <Cite id={event.source} compact /> : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Start the scenario to see ignition, alarms, actions and extinction in order.</p>
          )}
        </Stage>

        <Stage step="REF" title="Research behind this scenario">
          <p>{material.nasaFinding}</p>
          <p className="flex flex-wrap gap-1">
            {material.nasaSources.map((id) => (
              <Cite key={id} id={id} />
            ))}
          </p>
          <p className="text-muted-foreground">
            {scenario.gravityG > 0.01
              ? "Partial gravity: flame spread peaks and the oxygen limit is lowest near lunar gravity, so a habitat fire is expected to be worse than in orbit. "
              : "Microgravity: flames reach a limiting size and depend on ventilation, but materials burn at lower oxygen than the 1 g test shows. "}
            <Cite id={scenario.gravityG > 0.01 ? "ferkul-2026" : "saffire-iv-v"} />
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/materials" className="border border-[#4B555B] px-2 py-2 text-center hover:bg-[#30373C]">
              Materials and NASA data
            </Link>
            <Link href="/predict" className="border border-[#4B555B] px-2 py-2 text-center hover:bg-[#30373C]">
              Open the predictor
            </Link>
          </div>
          <p className="border-l-2 border-[#B29361] pl-2 text-[11px] text-muted-foreground">
            A reduced-order zone model with published correlations, calibrated using selected Saffire IV to VI results. It is not CFD and not a
            certification tool. No cabin-scale partial-gravity measurements are loaded; those cases are model predictions.
            Flames are drawn 1.5× their modelled size.
          </p>
        </Stage>
      </div>
    </aside>
  );
}

function SimButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-8 border border-[#4B555B] px-3 font-cond text-[11px] tracking-[0.08em] text-[#E7E8DE] uppercase hover:bg-[#30373C]"
    >
      {children}
    </button>
  );
}
