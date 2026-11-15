import { it } from "vitest";
import { SAFFIRE_BENCHMARKS } from "@/data/fire/options";
import { createFireState, runFire, stepFire } from "@/lib/fire/model";
import { genericFireInput, saffireInput } from "@/lib/fire/scenario";
// Diagnostic print-out (run with --silent=false). Integrates the four Saffire burns and
// 15 generic burns at 0, 0.165 and 0.38 g; allow for slower CI hosts.
it("probe", () => {
  for (const b of SAFFIRE_BENCHMARKS) {
    const input = saffireInput(b);
    const s = createFireState(input);
    let atPublished: { heat: number; peak: number; co2: number; co: number } | null = null;
    while (s.t < 3 * b.burnDurationS && (s.phase === "heating" || s.phase === "pyrolysis" || s.phase === "flaming")) {
      stepFire(s, input, 0.25);
      if (!atPublished && s.ignitionTime !== null && s.t >= s.ignitionTime + b.burnDurationS) atPublished = { heat: s.totalHeatJ / 1e3, peak: s.peakHrrW, co2: s.co2RisePct * 1e4, co: s.coPpm };
    }
    const at = atPublished ?? { heat: s.totalHeatJ / 1e3, peak: s.peakHrrW, co2: s.co2RisePct * 1e4, co: s.coPpm };
    const duration = s.extinctionTime !== null && s.ignitionTime !== null ? s.extinctionTime - s.ignitionTime : null;
    console.log(b.id, "peak", at.peak.toFixed(0), "/", b.peakHeatW ?? b.avgHeatW, "heatkJ", at.heat.toFixed(0), "/", b.totalHeatKJ, "CO2ppm", at.co2.toFixed(0), "/", b.co2RisePpm, "CO", at.co.toFixed(0), "/", b.coRisePpm,
      "CO/CO2", (at.co / at.co2 * 100).toFixed(2), "/", (b.coRisePpm / b.co2RisePpm * 100).toFixed(2), "dur", duration?.toFixed(0), "/", b.burnDurationS, "phase", s.phase, "front", s.pyroLengthM.toFixed(3), "burnout", s.burnoutFrontM.toFixed(3), "T", s.tempC.toFixed(1), "spread", s.spreadRateMmS.toFixed(3));
  }
  for (const g of [0, 0.165, 0.38]) for (const m of ["pmma","sibal","ldpe-wire","nylon","kapton"]) {
    const r = runFire(genericFireInput({gravityG:g, oxygenPct:32, pressurePsi:10.2, airflowMs:0.05}, m, m==="pmma"||m==="sibal"?"hot-wire":"overload-wire"), { durationS: 900 });
    const s = r.state;
    console.log("g",g,m,"ign",s.ignitionTime?.toFixed(0),"peak",s.peakHrrW.toFixed(0),"phase",s.phase,"cause",s.extinctionCause,"O2",s.o2Pct.toFixed(2),"T",s.tempC.toFixed(1),"CO",s.coPpm.toFixed(0),"CO2mmHg",s.co2RiseMmHg.toFixed(2),"smoke",s.smokeMgM3.toFixed(2),"layer",s.layerHeightM.toFixed(2),"alarm",s.firstAlarmTime?.toFixed(0),"tCO1h",r.timeToCo1h,"flameL",s.flame.lengthM.toFixed(2),s.flame.kind,"LOC",s.locPct.toFixed(1));
  }
}, 60_000);
