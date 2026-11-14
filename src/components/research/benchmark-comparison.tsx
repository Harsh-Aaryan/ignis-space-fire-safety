"use client";

import { useMemo } from "react";
import { compareSaffireSummaries } from "@/lib/fire/benchmarks";
import { downloadText } from "@/lib/export-csv";

export function BenchmarkComparison() {
  const rows = useMemo(compareSaffireSummaries, []);
  return <details className="mt-4 border-t border-border pt-3">
    <summary className="cursor-pointer text-sm">Compare the model with these published summaries</summary>
    <p className="mt-3 text-xs text-muted-foreground">
      Each cell shows published / modeled values. The model runs for the reported duration with constant initial flow.
      These are calibration cases, not independent validation. Disagreement in total heat and gas yields is retained;
      matching a peak does not validate the full fire history or detector response.
    </p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs" aria-label="Saffire model comparison">
      <thead><tr>{["Test", "HRR basis", "HRR (W)", "Total heat (kJ)", "CO₂ rise (ppm)", "CO rise (ppm)"].map((header) => <th key={header} className="px-2 py-2 whitespace-nowrap">{header}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">
        <th scope="row" className="px-2 py-2 font-normal">{row.id}</th><td className="px-2 py-2">{row.hrrBasis}</td>
        {[[row.measuredHrrW, row.modelHrrW], [row.measuredHeatKJ, row.modelHeatKJ], [row.measuredCo2Ppm, row.modelCo2Ppm], [row.measuredCoPpm, row.modelCoPpm]].map(([measured, modeled], index) => <td key={index} className="numeric px-2 py-2 whitespace-nowrap">{measured.toFixed(0)} / {modeled.toFixed(0)}</td>)}
      </tr>)}</tbody>
    </table></div>
    <button type="button" className="mt-3 border border-border px-3 py-2 text-xs" onClick={() => downloadText("ignis-saffire-comparison.json", JSON.stringify({
      scope: "Calibration summary comparison; not independent validation or a reconstructed flight protocol",
      source: "https://ntrs.nasa.gov/citations/20240002981",
      rows,
    }, null, 2), "application/json")}>Export comparison (JSON)</button>
  </details>;
}
