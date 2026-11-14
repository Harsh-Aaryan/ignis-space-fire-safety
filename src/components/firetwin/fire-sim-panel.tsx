"use client";
import Link from "next/link";
import { useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { ScenarioSetup } from "@/components/fire/scenario-setup";
import { RunReview } from "@/components/fire/run-review";
import { AskIgnisButton } from "@/components/ai/scenario-assistant";
import { Cite, CitedValue } from "@/components/fire/cite";
import { FIRE_SENSORS, SUPPRESSION_ACTIONS, ignitionById } from "@/data/fire/options";
import { materialById } from "@/data/fire/materials";
import { objectById, roomById } from "@/data/habitat-interiors";
import { buildFireInput, fuelPackageFor, ventilationCfm } from "@/lib/fire/scenario";
import { applicability, MODEL_ASSUMPTIONS } from "@/lib/fire/evidence";
import { fireRuntime, useFireSimStore, type FireSpeed } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { clock, formatPower } from "./fire-hud";

const stages=["Set up","Run","Respond","Review"] as const;
const control="min-h-10 rounded border border-border bg-background px-3 py-2 text-sm";
export function FireSimPanel() {
  const mission=useMissionStore(),sim=useFireSimStore();
  const [stage,setStage]=useState<typeof stages[number]>("Set up");
  const locked=sim.status!=="idle",s=sim.snapshot;
  const object=objectById(locked?sim.activeObjectId:mission.selectedObjectId),room=roomById(object?.roomId??null);
  const pack=object?fuelPackageFor(object):null;
  const material=materialById(sim.config.materialId??pack?.materialId??"pmma");
  const ignition=ignitionById(sim.config.ignitionId??pack?.defaultIgnitionId??"hot-wire");
  const input=locked?fireRuntime.input:object&&room?buildFireInput(mission.scenario,room,object,sim.config):null;
  const evidence=input?applicability(input):null;
  function start(){if(!object||!room||!input)return;sim.start(input,room.id,object.id);setStage("Run");}
  return <aside aria-label="Fire scenario" className="flex min-h-0 flex-1 flex-col bg-card">
    <header className="shrink-0 space-y-3 border-b border-border p-4">
      <div><p className="text-xs text-ember-text">FIRE SIMULATION</p><h2 className="mt-1 text-lg font-medium">{object?.label??"Build a fire scenario"}</h2><p className="mt-1 text-xs text-muted-foreground">{room?.name??"Choose equipment"} · {mission.scenario.gravityG} g · {mission.scenario.oxygenPct}% O₂</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {!locked?<button type="button" disabled={!input} onClick={start} className="flex min-h-10 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"><Play className="size-4"/>Start scenario</button>:<><button type="button" onClick={sim.status==="running"?sim.pause:sim.resume} disabled={sim.status==="finished"} className={control}>{sim.status==="running"?<><Pause className="mr-1 inline size-4"/>Pause</>:"Resume"}</button><button type="button" onClick={()=>{sim.reset();setStage("Set up");}} className={control}><RotateCcw className="mr-1 inline size-4"/>Reset</button></>}
        <div role="group" aria-label="Simulation speed" className="ml-auto flex rounded border border-border">{([1,10,60] as FireSpeed[]).map(speed=><button type="button" key={speed} aria-pressed={speed===sim.speed} onClick={()=>sim.setSpeed(speed)} className={`min-h-9 px-2 text-xs ${speed===sim.speed?"bg-secondary text-foreground":"text-muted-foreground"}`}>{speed}×</button>)}</div>
      </div>
      {s?<p data-testid="fire-status" className="numeric text-sm" aria-live="off">T+{clock(s.t)} · {s.phase} · {formatPower(s.hrrW)}</p>:<p className="text-xs text-muted-foreground">Start applies heat. Ignition depends on material and local conditions.</p>}
      <nav aria-label="Scenario stages" className="grid grid-cols-4 gap-1">{stages.map((item,i)=><button type="button" key={item} onClick={()=>setStage(item)} aria-current={stage===item?"step":undefined} className={`rounded px-1 py-2 text-xs ${stage===item?"bg-primary/15 text-ember-text":"text-muted-foreground hover:bg-secondary"}`}><span className="mr-1 opacity-60">{i+1}</span>{item}</button>)}</nav>
    </header>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {stage==="Set up"?<>
        {locked?<p className="text-sm text-muted-foreground">This setup belongs to the active run. Reset to edit fuel or initial atmosphere.</p>:null}
        <ScenarioSetup compact/>
        <details className="rounded border border-border p-3"><summary className="cursor-pointer text-sm">Advanced atmosphere & material properties</summary><div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Oxygen (%)<input aria-label="Cabin oxygen percent" type="number" min={10} max={40} step={.5} disabled={locked} value={mission.scenario.oxygenPct} onChange={e=>mission.patchScenario({oxygenPct:Math.max(10,Math.min(40,Number(e.target.value)))})} className={`${control} mt-1 w-full`}/></label><label className="text-sm">Pressure (psi)<input aria-label="Cabin pressure psi" type="number" min={5} max={15} step={.1} disabled={locked} value={mission.scenario.pressurePsi} onChange={e=>mission.patchScenario({pressurePsi:Math.max(5,Math.min(15,Number(e.target.value)))})} className={`${control} mt-1 w-full`}/></label></div>
          <p className="text-xs text-muted-foreground">Baseline CO₂: 400 ppm assumed. Fuel grade, thermal properties and flow calibration require experimental matching.</p>
          <dl className="space-y-3 text-sm">{[["Ignition temperature",material.ignitionTempC,"°C"],["Heat of combustion",material.heatOfCombustionMJkg,"MJ/kg"],["Thermal inertia",material.thermalInertia,"(kW/m²K)² s"],["Igniter heat flux",ignition.heatFluxKwM2,"kW/m²"]].map(([label,value,unit])=><div key={label as string} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{label as string}</dt><dd><CitedValue cited={value as typeof material.ignitionTempC} unit={unit as string}/></dd></div>)}</dl>
        </div></details>
      </>:null}
      {stage==="Run"?<>
        <h3 className="text-base font-medium">Watch the cause and effect</h3><p className="text-sm leading-6 text-muted-foreground">Heat warms the fuel. Released vapor can burn when oxygen and heat feedback sustain a flame. The HUD shows cabin averages; the hottest gas stays near the source.</p>
        {s?<div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded border border-border p-3"><p className="text-xs text-muted-foreground">Chemical HRR</p><p className="numeric mt-1">{formatPower(s.chemicalHrrW)}</p></div><div className="rounded border border-border p-3"><p className="text-xs text-muted-foreground">Source heating</p><p className="numeric mt-1">{formatPower(s.sourceHeatW)}</p></div><div className="rounded border border-border p-3"><p className="text-xs text-muted-foreground">Fuel surface</p><p className="numeric mt-1">{s.surfaceTempC.toFixed(0)} °C</p></div><div className="rounded border border-border p-3"><p className="text-xs text-muted-foreground">Oxygen near fuel</p><p className="numeric mt-1">{s.localO2Pct.toFixed(1)}%</p></div></div>:<p className="text-sm text-muted-foreground">Start a scenario from Set up.</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={sim.showAirflow} onChange={e=>sim.setVisuals({showAirflow:e.target.checked})}/>Show airflow tracers</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={sim.enhanceVisibility} onChange={e=>sim.setVisuals({enhanceVisibility:e.target.checked})}/>Enhance flame visibility (1.5×)</label><p className="text-xs text-muted-foreground">{sim.enhanceVisibility?"Flame envelope enlarged for visibility.":"Flame envelope uses modeled scale."} Display color is illustrative.</p>
        <AskIgnisButton label="Explain this run" prompt="Explain this run"/>
        <button className={`${control} w-full text-ember-text`} onClick={()=>setStage("Respond")}>Open response controls →</button>
      </>:null}
      {stage==="Respond"?<>
        <h3 className="text-base font-medium">Detection & response</h3>
        <label className="block text-sm">Airflow <span className="numeric text-ember-text">{((s?.uForcedMs??mission.scenario.airflowMs)*100).toFixed(1)} cm/s</span><input aria-label="Ventilation speed" type="range" min={0} max={.5} step={.005} value={mission.scenario.airflowMs} onChange={e=>mission.patchScenario({airflowMs:Number(e.target.value)})} className="mt-3 w-full accent-orange-400"/></label><p className="text-xs text-muted-foreground">{room?`${ventilationCfm(s?.uForcedMs??mission.scenario.airflowMs,room).toFixed(0)} CFM · conceptual flow area` : "Select a room"}. Recirculation moves gases; it adds no fresh oxygen.</p>
        <div className="space-y-2">{SUPPRESSION_ACTIONS.map(a=>{const used=!!s&&(a.id==="power-off"?s.powerOff:a.id==="vent-off"?s.ventOff:a.id==="co2"?s.agent.co2Start!==null:a.id==="water-mist"?s.agent.mistStart!==null:s.agent.halonStart!==null);return <div key={a.id} className="rounded border border-border p-3"><button type="button" disabled={!locked||used} onClick={()=>sim.act(a.id)} className={`${control} w-full text-left disabled:opacity-50`}>{used?"✓ ":""}{a.name}</button><p className="mt-2 text-xs leading-5 text-muted-foreground">{a.mechanism}</p></div>;})}</div>
        <details><summary className="cursor-pointer text-sm">Sensors & automatic actions</summary><div className="mt-3 space-y-3">{FIRE_SENSORS.map(sensor=><label key={sensor.id} className="block text-sm"><input type="checkbox" checked={sim.config.sensors.includes(sensor.id)} onChange={()=>sim.toggleSensor(sensor.id)} className="mr-2"/>{sensor.name}<span className="ml-2 text-xs text-muted-foreground">{s?.sensors[sensor.id].alarmed?"Alarm":"Monitoring"}</span></label>)}<label className="block text-sm"><input type="checkbox" checked={sim.config.autoResponse} disabled={locked} onChange={e=>sim.patchConfig({autoResponse:e.target.checked})} className="mr-2"/>Isolate power and fans on alarm (2 s assumed delay)</label>
        <label className="block text-sm">Crew response after alarm<select aria-label="Automatic crew agent" disabled={locked} value={sim.config.crewAgent??"none"} onChange={e=>sim.patchConfig({crewAgent:e.target.value==="none"?null:e.target.value as "co2"|"water-mist"|"halon"})} className={`${control} mt-1 w-full`}><option value="none">Manual response</option><option value="co2">CO₂ extinguisher</option><option value="water-mist">Water mist</option><option value="halon">Chemical agent (exploratory)</option></select></label>
        <label className="block text-sm">Crew delay (seconds)<input aria-label="Crew response delay" type="number" min={0} max={600} disabled={locked} value={sim.config.crewResponseS} onChange={e=>sim.patchConfig({crewResponseS:Math.max(0,Math.min(600,Number(e.target.value)))})} className={`${control} mt-1 w-full`}/></label>
        </div></details>
        <p className="text-xs leading-5 text-muted-foreground">Agent delivery, capture and detector calibration are assumptions. Flame-out can leave hot material and combustion gases. <Cite id="fwm-pfe"/></p>
      </>:null}
      {stage==="Review"?<RunReview/>:null}
      <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm">Evidence & equations</summary><div className="mt-3 space-y-3 text-sm leading-6"><p>{evidence?.status??"Choose equipment to see applicability"}. {evidence?.reason}</p><p>Q̇ = ṁburn Δhc. Gas transport carries species and heat together. Thick-fuel conduction, radiation and surface cooling determine temperature. Nominal polymer stoichiometry constrains CO₂, CO, water and soot.</p><p>{material.nasaFinding}</p><p className="flex flex-wrap gap-2">{material.nasaSources.map(id=><Cite key={id} id={id}/>)}</p><ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">{MODEL_ASSUMPTIONS.map(text=><li key={text}>{text}</li>)}</ul><Link href="/materials" className="text-ember-text underline">Materials, measurements & original NASA data</Link></div></details>
      <Link href="/predict" className="inline-block text-sm text-ember-text underline">Compare gravity & conditions</Link>
    </div>
  </aside>;
}
