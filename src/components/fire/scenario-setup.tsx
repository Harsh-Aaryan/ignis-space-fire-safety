"use client";
import { FIRE_MATERIALS, materialById } from "@/data/fire/materials";
import { IGNITION_SOURCES } from "@/data/fire/options";
import { objectById, roomsForHabitat } from "@/data/habitat-interiors";
import { fuelPackageFor } from "@/lib/fire/scenario";
import { useMissionStore } from "@/stores/mission-store";
import { useFireSimStore } from "@/stores/fire-sim-store";
const field = "mt-1 min-h-10 w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-60";
/** One editor for live simulation and comparisons. All choices use shared stores. */
export function ScenarioSetup({ compact = false }: { compact?: boolean }) {
  const mission = useMissionStore(), sim = useFireSimStore();
  const rooms = roomsForHabitat(mission.scenario.missionId), locked = sim.status !== "idle";
  const object = objectById(locked ? sim.activeObjectId : mission.selectedObjectId);
  const pack = object ? fuelPackageFor(object) : null;
  const material = materialById(sim.config.materialId ?? pack?.materialId ?? "pmma");
  function preset(materialId: string, ignitionId: string) {
    const room = rooms.find(r => r.equipment.some(e => e.type === "bench")) ?? rooms[0];
    const item = room?.equipment.find(e => e.type === "bench") ?? room?.equipment[0];
    if (item) mission.selectObject(item.id);
    sim.patchConfig({ materialId, ignitionId });
  }
  return <div className="space-y-4">
    {!locked ? <div><p className="mb-2 text-xs text-muted-foreground">Start with an example, or choose your own setup</p><div className="flex flex-wrap gap-2">{[["Acrylic ignition", "pmma", "hot-wire"], ["Bedding fabric", "sibal", "hot-wire"], ["Overheated wire", "kapton", "overheated-component"]].map(([label,material,ignition])=><button key={material} type="button" onClick={()=>preset(material,ignition)} className="rounded border border-border px-3 py-2 text-sm hover:border-primary">{label}</button>)}</div></div>:null}
    <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      <label className="text-sm">Where it starts<select aria-label={compact?"Fire origin":"Forecast origin"} disabled={locked} className={field} value={object?.id ?? ""} onChange={e=>{ const materialId=sim.config.materialId,ignitionId=sim.config.ignitionId; mission.selectObject(e.target.value); sim.patchConfig({materialId,ignitionId}); }}><option value="">Choose room / equipment</option>{rooms.map(room=><optgroup key={room.id} label={room.name}>{room.equipment.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</optgroup>)}</select></label>
      <label className="text-sm">Material<select aria-label={compact?"Material":"Prediction material"} disabled={locked} className={field} value={material.id} onChange={e=>sim.patchConfig({materialId:e.target.value})}>{FIRE_MATERIALS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="text-sm">Heat source<select aria-label={compact?"Ignition source":"Prediction ignition source"} disabled={locked} className={field} value={sim.config.ignitionId ?? pack?.defaultIgnitionId ?? "hot-wire"} onChange={e=>sim.patchConfig({ignitionId:e.target.value})}>{IGNITION_SOURCES.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label className="text-sm">Airflow relative to fuel<select aria-label="Flow orientation" disabled={locked} className={field} value={sim.config.flowOrientation ?? "concurrent"} onChange={e=>sim.patchConfig({flowOrientation:e.target.value as "concurrent"|"opposed"|"crossflow"})}><option value="concurrent">Along the flame spread</option><option value="opposed">Against the flame spread</option><option value="crossflow">Across the fuel</option></select></label>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{pack ? `${pack.label} · ${(pack.widthM*100).toFixed(0)} × ${(pack.lengthM*100).toFixed(0)} cm · ${pack.enclosed ? "inside an enclosure" : "open to cabin"}. Conceptual dimensions. ` : "Select a rendered item or use an example above. "}{!["pmma","sibal","paper","ldpe-wire"].includes(material.id) ? "This material supports exploratory heating and pyrolysis. Quantitative flaming chemistry is unavailable for this profile." : "Chemistry uses the nominal polymer composition; material grade and spread coefficients remain uncertain."}</p>
  </div>;
}
