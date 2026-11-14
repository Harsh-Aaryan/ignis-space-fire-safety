"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cite } from "@/components/fire/cite";
import { clock, formatPower } from "@/components/firetwin/fire-hud";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import { IGNITION_SOURCES } from "@/data/fire/options";
import { objectById, roomById, roomsForHabitat } from "@/data/habitat-interiors";
import { runFire, type FireSample } from "@/lib/fire/model";
import { buildFireInput } from "@/lib/fire/scenario";
import { downloadText } from "@/lib/export-csv";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

const field = "mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm disabled:opacity-60";
const regimes = [{ g: 0, name: "Orbit / 0 g" }, { g: 0.165, name: "Moon / 0.165 g" }, { g: 0.38, name: "Mars / 0.38 g" }];

export function ScenarioForecast() {
  const mission = useMissionStore();
  const sim = useFireSimStore();
  const [durationS, setDurationS] = useState(600);
  const rooms = roomsForHabitat(mission.scenario.missionId);
  const locked = sim.status !== "idle";
  const fallback = rooms[0]?.equipment.find((item) => item.type === "bench") ?? rooms[0]?.equipment[0];
  const object = objectById(locked ? sim.activeObjectId : mission.selectedObjectId) ?? fallback;
  const room = roomById(object?.roomId ?? null);
  const input = useMemo(() => room && object ? buildFireInput(mission.scenario, room, object, sim.config) : null,
    [mission.scenario, room, object, sim.config]);
  const runs = useMemo(() => input ? regimes.map((regime) => ({ ...regime, run: runFire({ ...input, gravityG: regime.g }, { durationS }) })) : [], [input, durationS]);
  const current = runs.find((item) => item.g === mission.scenario.gravityG);
  if (!input || !object || !room) return <p className="text-sm">Choose a Moon, Mars or Gateway habitat to forecast a fire scenario.</p>;
  const active = current?.run ?? runFire(input, { durationS });

  function openInTwin() {
    if (!object || !input) return;
    mission.selectObject(object.id);
    sim.patchConfig({ materialId: input.material.id, ignitionId: input.ignition.id });
    sim.setOpen(true);
  }

  return <section className="rounded border border-border bg-card p-4" aria-label="Physics-based scenario forecast">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="micro text-ember-text">Research → Predict → FireTwin</p><h2 className="mt-1 text-lg font-medium">Habitat fire forecast</h2></div>
      <Link href="/firetwin" onClick={openInTwin} className="border border-primary px-3 py-2 text-sm text-ember-text">Open this scenario in FireTwin</Link>
    </header>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">The same ignition, HRR, gas balance, smoke transport and response model drives this forecast and the live 3D simulation. This is a reduced-order model; partial-gravity results are extrapolations.</p>
    {locked ? <p className="mt-3 text-xs text-muted-foreground">An existing run owns this setup. <button type="button" onClick={sim.reset} className="text-ember-text underline">Reset fire run to edit</button></p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-muted-foreground">Habitat equipment<select aria-label="Forecast origin" className={field} value={object.id} disabled={locked} onChange={(event) => {
        const materialId = sim.config.materialId;
        mission.selectObject(event.target.value);
        sim.patchConfig({ materialId });
      }}>{rooms.map((item) => <optgroup key={item.id} label={item.name}>{item.equipment.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.label}</option>)}</optgroup>)}</select></label>
      <label className="text-xs text-muted-foreground">Material<select aria-label="Prediction material" className={field} value={input.material.id} disabled={locked} onChange={(event) => sim.patchConfig({ materialId: event.target.value })}>{FIRE_MATERIALS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs text-muted-foreground">Ignition source<select aria-label="Prediction ignition source" className={field} value={input.ignition.id} disabled={locked} onChange={(event) => sim.patchConfig({ ignitionId: event.target.value })}>{IGNITION_SOURCES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs text-muted-foreground">Forecast duration<select aria-label="Prediction duration" className={field} value={durationS} onChange={(event) => setDurationS(Number(event.target.value))}>{[300, 600, 1200].map((seconds) => <option key={seconds} value={seconds}>{seconds / 60} minutes</option>)}</select></label>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">{room.name} · {input.roomVolumeM3.toFixed(1)} m³ room / {input.habitatVolumeM3.toFixed(1)} m³ connected air · {input.oxygenPct}% O₂ · {mission.scenario.pressurePsi} psi · {(input.ventilationMs * 100).toFixed(1)} cm/s. Fuel dimensions and free-air volume are conceptual assumptions. <Cite id="model" /></p>
    <div className="mt-4 grid gap-3 sm:grid-cols-4" data-testid="forecast-summary">
      {[["Peak HRR", formatPower(active.state.peakHrrW)], ["Final O₂", `${active.state.o2Pct.toFixed(2)} %`], ["Final cabin temperature", `${active.state.tempC.toFixed(1)} °C`], ["First alarm", active.state.firstAlarmTime === null ? "No alarm in window" : `T+${clock(active.state.firstAlarmTime)}`]].map(([label, value]) => <div key={label} className="border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="numeric mt-1 text-lg">{value}</p></div>)}
    </div>
    <ForecastTrace history={active.history} />
    <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs" aria-label="Gravity regime comparison">
      <thead><tr>{["Same fuel and cabin; gravity varies", "Peak HRR", "Final O₂", "Final CO", "CO₂ rise", "First alarm", "Final phase"].map((label) => <th key={label} className="px-2 py-2 whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{runs.map(({ g, name, run }) => <tr key={g} className={`border-t border-border ${g === input.gravityG ? "bg-secondary" : ""}`}><th scope="row" className="px-2 py-2 font-normal whitespace-nowrap">{name}</th>{[formatPower(run.state.peakHrrW), `${run.state.o2Pct.toFixed(2)} %`, `${run.state.coPpm.toFixed(0)} ppm`, `${run.state.co2RiseMmHg.toFixed(2)} mmHg`, run.state.firstAlarmTime === null ? "No alarm" : clock(run.state.firstAlarmTime), run.state.phase].map((value, index) => <td key={index} className="numeric px-2 py-2 whitespace-nowrap">{value}</td>)}</tr>)}</tbody>
    </table></div>
    <p className="mt-3 text-xs text-muted-foreground">{input.material.nasaFinding} {input.material.nasaSources.map((id) => <Cite key={id} id={id} compact />)}</p>
    <details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer text-sm">Equations, assumptions and export</summary>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <p>Q̇ = ṁfuel ΔHc; oxygen use = Q̇ / (13.1 MJ/kg O₂). Cabin gas follows the ideal-gas law. Heat input is balanced against wall losses; buoyant flame-base speed scales as (g α ΔT/T)⅓ and vanishes in 0 g. <Cite id="saffire-vi" /> <Cite id="sfpe" /></p>
        <p>Sensor thresholds, enclosure leakage, heat-transfer coefficients and some material properties are assumptions. A predicted alarm time is not a NASA detector validation result. Crew response: {input.autoResponse ? "power and ventilation isolation on alarm" : "manual"}; agent {input.crewAgent ?? "none"}. <Cite id="model" /></p>
        <p>Published Saffire summary results constrain selected coefficients. Independent time histories and partial-gravity validation data are still needed. <Link href="/materials" className="text-ember-text underline">Inspect measured values and sources</Link></p>
        <button type="button" className="border border-border px-3 py-2 text-foreground" onClick={() => downloadText("ignis-fire-forecast.json", JSON.stringify({ provenance: "IGNIS reduced-order model output, not NASA measurements", input, durationS, history: active.history, events: active.state.events }, null, 2), "application/json")}>Export model forecast (JSON)</button>
      </div>
    </details>
  </section>;
}

function ForecastTrace({ history }: { history: FireSample[] }) {
  const peak = Math.max(1, ...history.map((point) => point.hrrW));
  const duration = Math.max(1, history.at(-1)?.t ?? 1);
  const path = history.map((point, index) => `${index ? "L" : "M"}${(point.t / duration * 600).toFixed(1)},${(96 - point.hrrW / peak * 88).toFixed(1)}`).join(" ");
  return <figure className="mt-4 border border-border p-3"><svg viewBox="0 0 600 100" className="h-28 w-full" role="img" aria-label="Predicted heat release rate over time"><path d={path} fill="none" stroke="#E07A3D" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><figcaption className="flex justify-between text-xs text-muted-foreground"><span>Model HRR · peak {formatPower(peak)}</span><span>0–{clock(duration)} simulated time</span></figcaption></figure>;
}
