import { it } from "vitest";
import { SAFFIRE_BENCHMARKS } from "@/data/fire/options";
import { runFire } from "@/lib/fire/model";
import { genericFireInput, saffireInput } from "@/lib/fire/scenario";
// Integrates 19 full burns; allow for slower CI hosts and concurrent checks.
it("probe", () => {
  for (const b of SAFFIRE_BENCHMARKS) {
    const r = runFire(saffireInput(b), { durationS: b.burnDurationS + 20 });
    const s = r.state;
    console.log(b.id, "peak", s.peakHrrW.toFixed(0), "/", b.peakHeatW ?? b.avgHeatW, "totalkJ", (s.totalHeatJ/1e3).toFixed(0), "/", b.totalHeatKJ, "CO2ppm", (s.co2RisePct*1e4).toFixed(0), "/", b.co2RisePpm, "CO", s.coPpm.toFixed(0), "/", b.coRisePpm, "T", s.tempC.toFixed(1), "nearT", Math.max(...r.history.map(h=>h.tempC)).toFixed(1), "phase", s.phase, "ign", s.ignitionTime, "alarm", s.firstAlarmTime, "spread", s.spreadRateMmS.toFixed(2));
  }
  for (const g of [0, 0.165, 0.38]) for (const m of ["pmma","sibal","ldpe-wire","nylon","kapton"]) {
    const r = runFire(genericFireInput({gravityG:g, oxygenPct:32, pressurePsi:10.2, airflowMs:0.05}, m, m==="pmma"||m==="sibal"?"hot-wire":"overload-wire"), { durationS: 900 });
    const s = r.state;
    console.log("g",g,m,"ign",s.ignitionTime?.toFixed(0),"peak",s.peakHrrW.toFixed(0),"phase",s.phase,"cause",s.extinctionCause,"O2",s.o2Pct.toFixed(2),"T",s.tempC.toFixed(1),"CO",s.coPpm.toFixed(0),"CO2mmHg",s.co2RiseMmHg.toFixed(2),"smoke",s.smokeMgM3.toFixed(2),"layer",s.layerHeightM.toFixed(2),"alarm",s.firstAlarmTime?.toFixed(0),"tCO1h",r.timeToCo1h,"flameL",s.flame.lengthM.toFixed(2),s.flame.kind,"LOC",s.locPct.toFixed(1));
  }
}, 20_000);
