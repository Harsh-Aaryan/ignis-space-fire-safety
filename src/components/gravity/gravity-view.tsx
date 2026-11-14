"use client";

import { useEffect, useState } from "react";
import { CoverageChart } from "@/components/charts/evidence-charts";
import { Callout } from "@/components/dashboard/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COVERAGE_RAMP } from "@/design/palette";
import { ScoreDisclaimer } from "@/components/design/marks";
import { highlightCell } from "@/lib/analytics/coverage";
import { formatNumber, formatRelevance } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAnalysis } from "@/hooks/use-analysis";
import { useMissionStore, type HeatAxis } from "@/stores/mission-store";

const AXES: HeatAxis[] = ["gravity", "oxygen", "pressure", "airflow", "fuel"];

export function GravityView() {
  const analysis = useAnalysis();
  const scenario = useMissionStore((state) => state.scenario);
  const x = useMissionStore((state) => state.heatmapX);
  const y = useMissionStore((state) => state.heatmapY);
  const setAxes = useMissionStore((state) => state.setHeatmapAxes);
  const [showSketch, setShowSketch] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setCompact(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  const highlight = highlightCell(scenario, x, y);
  const filterNote = analysis.filterActive
    ? "The heatmap and nearest-row list follow Explorer filters. Gaps and the coverage score still use the full catalog."
    : analysis.dataMode === "verified"
      ? "Verified mode hides synthetic heatmap counts. Indexed NTRS records have no extracted measurements to bin."
      : "Heatmap counts are computed from the synthetic runs, not painted in by hand.";

  return (
    <div className="flex flex-col gap-4 pb-8 md:pb-0">
      <header>
        <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em]">GravityBridge</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Where the active catalog does and does not meet {scenario.name}. Reference gravities: Gateway and ISS ~0 g, Moon 0.165 g, Mars 0.38 g, Earth 1 g. An empty cell means this indexed subset has no row there. It does not mean NASA has never studied it.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <AxisSelect label="X axis" value={x} onChange={(value) => setAxes(value, y)} />
        <AxisSelect label="Y axis" value={y} onChange={(value) => setAxes(x, value)} />
      </div>
      <p className="text-xs text-muted-foreground">{filterNote}</p>
      <div className="overflow-x-auto rounded border border-border bg-card p-3">
        <p className="mb-2 font-cond text-[10px] tracking-[0.08em] text-[#847F79] uppercase md:hidden">
          Scroll for more bins →
        </p>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: compact
              ? `4.5rem repeat(${analysis.heatmap.xBins.length}, 36px)`
              : `7rem repeat(${analysis.heatmap.xBins.length}, 28px)`,
          }}
        >
          <div />
          {analysis.heatmap.xBins.map((bin) => (
            <div key={bin.id} className="px-1 text-center text-[11px] text-muted-foreground">
              {bin.label}
            </div>
          ))}
          {analysis.heatmap.yBins.map((yBin) => (
            <div key={yBin.id} className="contents">
              <div className="flex items-center text-xs text-muted-foreground">{yBin.label}</div>
              {analysis.heatmap.xBins.map((xBin) => {
                const cell = analysis.heatmap.cells.find((item) => item.x === xBin.id && item.y === yBin.id);
                const active = highlight.x === xBin.id && highlight.y === yBin.id;
                const max = Math.max(1, ...analysis.heatmap.cells.map((item) => item.count));
                const count = cell?.count ?? 0;
                const regimeTotal = analysis.heatmap.cells
                  .filter((item) => item.y === yBin.id)
                  .reduce((sum, item) => sum + item.count, 0);
                const noData = count === 0;
                const partial = !noData && (cell?.status === "partial" || (cell?.incompleteCount ?? 0) > 0);
                const step = count === 0 ? 0 : Math.min(8, Math.ceil((count / max) * 8));
                return (
                  <div
                    key={`${yBin.id}-${xBin.id}`}
                    className={cn(
                      "grid place-items-center",
                      compact ? "h-9 w-9" : "h-7 w-7",
                      noData && "cov-nodata",
                      partial && "cov-partial",
                      active && "outline outline-2 outline-offset-0 outline-[#EDEAE4]",
                    )}
                    style={noData ? undefined : { background: partial ? "#8A7040" : COVERAGE_RAMP[step] }}
                    title={
                      noData
                        ? `${yBin.label}, ${xBin.label}: no data — this regime has no synthetic runs. Missing, not zero.`
                        : `${yBin.label}, ${xBin.label}: ${count} synthetic runs, ${cell?.incompleteCount ?? 0} incomplete.`
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <p className="micro mb-1 text-[#847F79]">Run count (synthetic)</p>
            <div className="flex gap-0.5">
              {COVERAGE_RAMP.map((color, index) => (
                <div key={color} className="w-4">
                  <div className="h-4 w-4 rounded-[2px]" style={{ background: color }} />
                  <span className="numeric text-[10px] text-[#847F79]">{index === 0 ? "0" : index === 8 ? "max" : ""}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="cov-nodata grid h-4 w-4 place-items-center rounded-[2px] text-[10px]">—</div>
            <span className="font-cond text-[10px] tracking-[0.08em] text-[#847F79] uppercase">No data</span>
          </div>
          <div>
            <div className="cov-partial grid h-4 w-4 place-items-center rounded-[2px] text-[10px]" style={{ background: "#8A7040" }}>~</div>
            <span className="font-cond text-[10px] tracking-[0.08em] text-[#847F79] uppercase">Low confidence</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {analysis.heatmap.unreported} runs are unreported on one of these axes and are excluded from the
          grid. A dark umber cell is zero runs. A hatched cell is a regime with no observations. The bone outline is the active scenario. High counts are not green
          and are not a safety reading.
        </p>
        <ScoreDisclaimer kind="coverage" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-medium">Applicability</h2>
          <p className="mt-2 text-sm">{analysis.applicability.gravityMismatch}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {analysis.applicability.nearest.map((item) => (
              <li key={item.run.id} className="rounded-lg bg-secondary px-3 py-2">
                <span className="numeric text-foreground">{formatRelevance(item.relevance)}</span>{" "}
                {item.run.id} · {item.investigation.family}
                <span className="block text-xs text-muted-foreground">
                  Condition distance {item.distance.toFixed(2)}.
                  {item.excludedDimensions.length
                    ? ` Excluded unreported ${item.excludedDimensions.join(", ")}.`
                    : " All compared fields were reported."}
                </span>
              </li>
            ))}
          </ul>
          {analysis.applicability.outside.map((line) => (
            <Callout key={line} tone="warn" title="Outside reported range">
              {line}
            </Callout>
          ))}
          {analysis.applicability.missingMeasurements.slice(0, 3).map((line) => (
            <p key={line} className="mt-2 text-xs text-muted-foreground">
              {line}
            </p>
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <Callout tone="warn" title="What cannot be concluded">
            {analysis.gaps.find((gap) => gap.dimension === "gravity")?.explanation ??
              "Gravity coverage is present for this regime inside the synthetic catalog. That still does not certify a vehicle."}{" "}
            ISS and Earth rows do not automatically determine partial-gravity behavior.
            {scenario.missionId === "gateway-orbit"
              ? " Gateway orbit is ~0 g, so it shares the microgravity regime with ISS. That is not lunar surface gravity (0.165 g), and it is not a certification of the vehicle."
              : ""}
            {" "}
            {analysis.indexed.summary} {analysis.indexed.caveat}
          </Callout>
          <CoverageChart contributions={analysis.coverage.contributions} />
          <p className="text-xs text-muted-foreground">{analysis.coverage.formula}</p>
        </section>
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-medium">Evidence gaps</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {analysis.gaps.map((gap) => (
            <li key={gap.id} className="rounded-lg border border-border px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium">{gap.title}</h3>
                <span className="numeric text-sm text-amber">{formatNumber(gap.severity, 2)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{gap.explanation}</p>
              <p className="mt-1 text-xs text-muted-foreground">Rule: {gap.rule}</p>
              <p className="mt-1 text-xs">{gap.distinguishesMissingFromNegative}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-xl border border-border bg-secondary p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Illustrative oxygen sketch</h2>
          <button type="button" className="text-sm text-primary" onClick={() => setShowSketch((value) => !value)}>
            {showSketch ? "Hide" : "Show"} withheld fit
          </button>
        </div>
        {showSketch ? (
          <div className="mt-3 text-sm">
            <p>{analysis.sketch.reason}</p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {analysis.sketch.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2">
              Microgravity fit n={analysis.sketch.microgravity?.n ?? 0}, Earth fit n=
              {analysis.sketch.earth?.n ?? 0}.
              {analysis.sketch.withheld && analysis.sketch.withheldBlend != null
                ? ` A numeric blend of ${analysis.sketch.withheldBlend.toFixed(2)} mm/s was computed and withheld. It is not a lunar or Martian prediction.`
                : " No blend is offered as a result."}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Off by default. The sketch never becomes a validated combustion model.
          </p>
        )}
      </section>
    </div>
  );
}

function AxisSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HeatAxis;
  onChange: (value: HeatAxis) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      {label}
      <Select value={value} onValueChange={(next) => next && onChange(next as HeatAxis)}>
        <SelectTrigger className="w-36" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AXES.map((axis) => (
            <SelectItem key={axis} value={axis}>
              {axis}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
