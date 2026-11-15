import { SAFFIRE_BENCHMARKS } from "@/data/fire/options";
import { runFire } from "@/lib/fire/model";
import { saffireInput } from "@/lib/fire/scenario";

/** Comparison residuals against published Saffire summaries, not a validation score. No flight fan schedule is inferred from summary rows. */
export function compareSaffireSummaries() {
  return SAFFIRE_BENCHMARKS.map((reference) => {
    const run = runFire(saffireInput(reference), { durationS: reference.burnDurationS });
    const hrrBasis = reference.peakHeatW === null ? "mean" : "peak";
    const measuredHrrW = reference.peakHeatW ?? reference.avgHeatW!;
    const modelHrrW = hrrBasis === "mean" ? run.state.totalHeatJ / reference.burnDurationS : run.state.peakHrrW;
    return {
      id: reference.id,
      hrrBasis,
      measuredHrrW,
      modelHrrW,
      measuredHeatKJ: reference.totalHeatKJ,
      modelHeatKJ: run.state.totalHeatJ / 1000,
      measuredCo2Ppm: reference.co2RisePpm,
      modelCo2Ppm: run.state.co2RisePct * 1e4,
      measuredCoPpm: reference.coRisePpm,
      modelCoPpm: run.state.coPpm,
    };
  });
}
