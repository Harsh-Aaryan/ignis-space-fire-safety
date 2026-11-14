"use client";
import Link from "next/link";
import { fireRuntime, useFireSimStore } from "@/stores/fire-sim-store";
import { FIRE_MODEL_VERSION, applicability } from "@/lib/fire/evidence";
import { downloadText } from "@/lib/export-csv";
import { clock, formatPower } from "@/components/firetwin/fire-hud";
export function RunReview() {
  const sim=useFireSimStore(),s=sim.snapshot,input=fireRuntime.input;
  if(!s||!input)return <p className="text-sm leading-6 text-muted-foreground">Run a fire scenario to review its heat release, detector response and remaining gases.</p>;
  const evidence=applicability(input);
  const values=[["Ignition",s.ignitionTime===null?"No ignition":clock(s.ignitionTime)],["First alarm",s.firstAlarmTime===null?"No alarm":clock(s.firstAlarmTime)],["Peak chemical HRR",formatPower(s.peakHrrW)],["Chemical heat",`${(s.totalHeatJ/1000).toFixed(1)} kJ`],["Flame out",s.extinctionTime===null?"Not reached":clock(s.extinctionTime)],["Remaining fuel",`${Math.max(0,(s.fuelTotalKg-s.fuelPyrolysedKg)*1000).toFixed(1)} g`]];
  return <section aria-label="Fire run review" className="space-y-4"><div className="grid grid-cols-2 gap-2">{values.map(([label,value])=><div key={label} className="rounded border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="numeric mt-1 text-base">{value}</p></div>)}</div>
    <p className="text-sm leading-6">Current phase: <strong>{s.phase}</strong>. Surface {s.surfaceTempC.toFixed(0)} °C · cabin smoke {s.smokeMgM3.toFixed(1)} mg/m³ · CO {s.coPpm.toFixed(0)} ppm · total CO₂ {s.co2TotalMmHg.toFixed(2)} mmHg. Flame-out can leave residual heat and gases.</p>
    <p className="rounded border border-border p-3 text-xs leading-5 text-muted-foreground">{evidence.status} · {evidence.reason} Model {FIRE_MODEL_VERSION}. Numerical checks do not establish predictive accuracy.</p>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>downloadText("ignis-fire-run.json",JSON.stringify({modelVersion:FIRE_MODEL_VERSION,evidence,input,finalState:s,history:sim.history,events:sim.events,provenance:"IGNIS model output; not NASA measurements"},null,2),"application/json")} className="rounded border border-primary px-3 py-2 text-sm text-ember-text">Export this fire run</button><Link href="/predict" className="rounded border border-border px-3 py-2 text-sm">Compare conditions</Link></div>
    <details><summary className="cursor-pointer text-sm">Event timeline ({sim.events.length})</summary><ol className="mt-3 space-y-3">{sim.events.map((event,i)=><li key={i} className="text-sm leading-5"><span className="numeric mr-2 text-xs text-ember-text">T+{clock(event.t)}</span>{event.label}</li>)}</ol></details>
  </section>;
}
