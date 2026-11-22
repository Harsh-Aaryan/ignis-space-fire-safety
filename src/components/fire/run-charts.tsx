"use client";

import { useMemo } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { table } from "@/components/design/kit";
import { clock, formatPower, formatSignificant } from "@/components/simulation/format";
import type { FireSample, FireState } from "@/lib/fire/model";
import {
  CO2_REFERENCES,
  CO_REFERENCES,
  FUEL_BAR_MIN_SHARE,
  axisPlan,
  chartRows,
  fuelBudget,
  runMarkers,
  shareLabel,
  signedPct,
  summarizeSeries,
  timeTicks,
  tornadoDomain,
  tornadoRows,
  type MarkerKind,
  type ReferenceLevel,
  type RunMarker,
  type TornadoRow,
} from "@/lib/fire/run-chart-data";
import type { SensitivityResult } from "@/lib/fire/sensitivity";
import { cn } from "@/lib/utils";

/**
 * Charts for the latest fire run. Every mark is read from the run history, the final state or the
 * sensitivity output of the IGNIS model; nothing is measured data and nothing is filled in.
 *
 * Colour: one neutral ink for every curve, the site's fire orange for heat release alone (the lead
 * chart), and the same two for the sensitivity bars and the fuel bar.
 */

const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };
const SYNC_ID = "ignis-run";
const ACCENT = "var(--primary)";
const INK = "var(--foreground)";
const INK_SOFT = "var(--muted-foreground)";

const TOOLTIP = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
  itemStyle: { color: "var(--foreground)" },
  cursor: { stroke: "var(--border)", strokeWidth: 1 },
};

/** Vertical event lines: one grey, told apart by dash pattern, and named on the lead chart. */
const MARKER_STYLE: Record<MarkerKind, { dash: string | undefined; width: number }> = {
  ignition: { dash: undefined, width: 1.5 },
  alarm: { dash: "5 3", width: 1.5 },
  flameOut: { dash: "1.5 3", width: 2 },
};
const MARKER_ROW_PX = 13;

/** The box recharts passes to a custom label: the line, or the dot, it belongs to. */
type Box = { x?: number; y?: number; width?: number; height?: number };

interface SeriesSpec {
  key: keyof Omit<FireSample, "t">;
  name: string;
  color: string;
  dashed?: boolean;
}

interface ChartSpec {
  id: string;
  title: string;
  series: SeriesSpec[];
  zeroBase: boolean;
  /** For padded ranges: the smallest span the axis shows, in the series unit. */
  minSpan?: number;
  /** For zero-based ranges: top of the axis as a multiple of the highest value. */
  headroom?: number;
  references?: ReferenceLevel[];
  /** Which end of the series the summary reads out. */
  extreme: "max" | "min";
  tick: (value: number) => string;
  value: (value: number) => string;
  /** Wording for the read-out ("Peak" or "Lowest"). */
  extremeWord: string;
}

const kw = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10} kW` : `${Math.round(v)} W`);
const rounded = (v: number) => String(Math.round(v * 100) / 100);

const LEAD: ChartSpec = { id: "hrr", title: "Heat release rate", series: [{ key: "hrrW", name: "Heat release rate", color: ACCENT }], zeroBase: true, headroom: 1.3, extreme: "max", extremeWord: "Peak", tick: kw, value: (v) => formatPower(v) };

const SMALL: ChartSpec[] = [
  { id: "temp", title: "Cabin temperature, °C", series: [{ key: "tempC", name: "Cabin temperature", color: INK }], zeroBase: false, minSpan: 2, extreme: "max", extremeWord: "Peak", tick: (v) => String(Math.round(v * 10) / 10), value: (v) => `${v.toFixed(1)} °C` },
  { id: "o2", title: "Cabin O₂, %", series: [{ key: "o2Pct", name: "Cabin O₂", color: INK }], zeroBase: false, minSpan: 1, extreme: "min", extremeWord: "Lowest", tick: rounded, value: (v) => `${v.toFixed(2)} %` },
  { id: "co", title: "Carbon monoxide, ppm", series: [{ key: "coPpm", name: "Carbon monoxide", color: INK }], zeroBase: true, references: CO_REFERENCES, extreme: "max", extremeWord: "Peak", tick: (v) => String(Math.round(v)), value: (v) => `${formatSignificant(v, 3)} ppm` },
  { id: "co2", title: "CO₂ rise, mmHg", series: [{ key: "co2RiseMmHg", name: "CO₂ rise", color: INK }], zeroBase: true, references: CO2_REFERENCES, extreme: "max", extremeWord: "Peak", tick: rounded, value: (v) => `${v.toFixed(2)} mmHg` },
  {
    id: "smoke",
    title: "Smoke, mg/m³",
    series: [
      { key: "smokeMgM3", name: "Cabin", color: INK },
      { key: "detectorSmokeMgM3", name: "At the detector", color: INK_SOFT, dashed: true },
    ],
    zeroBase: true,
    extreme: "max",
    extremeWord: "Peak",
    tick: rounded,
    value: (v) => `${formatSignificant(v, 3)} mg/m³`,
  },
];

/** Name of a vertical line, set in the band above the lead chart's plot. */
function MarkerLabel({ viewBox, text, row, rows, atEnd }: { viewBox?: Box; text: string; row: number; rows: number; atEnd: boolean }) {
  const x = viewBox?.x ?? 0;
  // Rows stack upward from the plot, the latest moment lowest, so each name sits close to its line.
  const y = (viewBox?.y ?? 0) - 6 - (rows - 1 - row) * MARKER_ROW_PX;
  return (
    <text x={atEnd ? x - 4 : x + 4} y={y} textAnchor={atEnd ? "end" : "start"} fill="var(--muted-foreground)" fontSize={12}>
      {text}
    </text>
  );
}

/** A reference level's name on its line, on a card-coloured plate, at the end the curve is not near. */
function ReferenceLabel({ viewBox, text, below, atLeft }: { viewBox?: Box; text: string; below: boolean; atLeft: boolean }) {
  const width = text.length * 6.3 + 10;
  const left = atLeft ? (viewBox?.x ?? 0) + 4 : (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 4 - width;
  const y = (viewBox?.y ?? 0) + (below ? 16 : -5);
  return (
    <g>
      <rect x={left} y={y - 12} width={width} height={16} rx={3} fill="var(--card)" />
      <text x={left + 5} y={y} textAnchor="start" fill="var(--muted-foreground)" fontSize={12}>
        {text}
      </text>
    </g>
  );
}

/** "Peak 2.8 kW" and its time, in two short lines beside the dot on the heat release curve. */
function PeakLabel({ viewBox, value, time, leftOf }: { viewBox?: Box; value: string; time: string; leftOf: boolean }) {
  const cx = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) / 2;
  const cy = (viewBox?.y ?? 0) + (viewBox?.height ?? 0) / 2;
  const x = leftOf ? cx - 9 : cx + 9;
  return (
    <text x={x} y={cy - 21} textAnchor={leftOf ? "end" : "start"} fontSize={12}>
      <tspan x={x} fill="var(--foreground)">{value}</tspan>
      <tspan x={x} dy={13} fill="var(--muted-foreground)">{time}</tspan>
    </text>
  );
}

/** Time at which the series comes closest to a level; its label goes on the other half of the line. */
function closestApproach(rows: FireSample[], key: keyof Omit<FireSample, "t">, level: number): number {
  let best = rows[0];
  for (const row of rows) if (Math.abs(row[key] - level) < Math.abs(best[key] - level)) best = row;
  return best.t;
}

function SeriesChart({
  spec,
  rows,
  markers,
  tMax,
  ticks,
  lead = false,
}: {
  spec: ChartSpec;
  rows: FireSample[];
  markers: RunMarker[];
  tMax: number;
  ticks: number[];
  lead?: boolean;
}) {
  const plan = useMemo(
    () => axisPlan(rows.flatMap((row) => spec.series.map((s) => row[s.key])), { zeroBase: spec.zeroBase, references: spec.references, minSpan: spec.minSpan, headroom: spec.headroom }),
    [rows, spec],
  );
  const first = spec.series[0];
  const summary = summarizeSeries(rows, first.key, spec.extreme);
  const readout = summary ? `${spec.extremeWord} ${spec.value(summary.peak)} at T+${clock(summary.peakAtS)}, last sample ${spec.value(summary.final)}.` : "";
  const hiddenNote = plan.offScale.length
    ? `${spec.extremeWord} ${spec.value(plan.max)}. Reference ${plan.offScale.length > 1 ? "levels" : "level"} ${plan.offScale.map((ref) => ref.label).join(" and ")} ${plan.offScale.length > 1 ? "lie" : "lies"} above this scale.`
    : "";
  const markerText = lead && markers.length ? ` ${markers.map((m) => `${m.label} at T+${clock(m.t)}`).join(", ")}.` : "";
  const label = `${spec.title} over simulated time. ${readout}${markerText} ${hiddenNote}`.trim();
  const single = spec.series.length === 1;
  const topMargin = lead ? 8 + MARKER_ROW_PX * Math.max(1, markers.length) : 6;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] leading-5 text-muted-foreground">
        <span className={lead ? "text-foreground" : undefined}>{spec.title}</span>
        {single ? null : (
          <span className="flex gap-3 text-[12px]">
            {spec.series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <svg width="18" height="8" aria-hidden="true">
                  <line x1="1" x2="17" y1="4" y2="4" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinecap="round" />
                </svg>
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className={lead ? "h-60 sm:h-72" : "h-36 sm:h-44"} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} syncId={SYNC_ID} accessibilityLayer={false} margin={{ top: topMargin, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, tMax]}
              ticks={ticks}
              tickFormatter={(value: number) => clock(value)}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} domain={plan.domain} ticks={plan.ticks} interval={0} tickFormatter={spec.tick} />
            <Tooltip
              {...TOOLTIP}
              labelFormatter={(value) => `T+${clock(Number(value))}`}
              formatter={(value) => (typeof value === "number" ? spec.value(value) : String(value))}
            />
            {markers.map((marker, index) => {
              const style = MARKER_STYLE[marker.kind];
              return (
                <ReferenceLine
                  key={marker.kind}
                  x={marker.t}
                  stroke={INK_SOFT}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  ifOverflow="hidden"
                  label={lead ? { content: (props) => <MarkerLabel viewBox={props.viewBox as Box | undefined} text={marker.label} row={index} rows={markers.length} atEnd={marker.t / tMax > 0.82} /> } : undefined}
                />
              );
            })}
            {plan.shown.map((ref) => (
              <ReferenceLine
                key={ref.value}
                y={ref.value}
                stroke={INK_SOFT}
                strokeDasharray="2 3"
                strokeOpacity={0.7}
                zIndex={1500}
                label={{ content: (props) => <ReferenceLabel viewBox={props.viewBox as Box | undefined} text={ref.label} below={ref.value / plan.domain[1] > 0.85} atLeft={closestApproach(rows, first.key, ref.value) > 0.5 * tMax} /> }}
              />
            ))}
            {spec.series.map((s) =>
              lead ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={s.color}
                  fillOpacity={0.08}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeOpacity={s.color === INK ? 0.9 : 1}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ),
            )}
            {lead && summary && summary.peak > 0 ? (
              <ReferenceDot
                x={summary.peakAtS}
                y={summary.peak}
                r={4}
                fill={ACCENT}
                stroke="var(--card)"
                strokeWidth={2}
                ifOverflow="visible"
                label={{ content: (props) => <PeakLabel viewBox={props.viewBox as Box | undefined} value={`Peak ${spec.value(summary.peak)}`} time={`at T+${clock(summary.peakAtS)}`} leftOf={summary.peakAtS / tMax > 0.6} /> }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hiddenNote ? <p className="mt-1 text-[12px] leading-4 text-text-tertiary">{hiddenNote}</p> : null}
    </figure>
  );
}

/** Heat release as the lead chart, five smaller ones below, all on one time axis. */
export function RunTimeCharts({ snapshot, history }: { snapshot: FireState; history: FireSample[] }) {
  const rows = useMemo(() => chartRows(history), [history]);
  const tMax = rows.length ? rows[rows.length - 1].t : 0;
  const markers = useMemo(() => runMarkers(snapshot, tMax), [snapshot, tMax]);
  const ticks = useMemo(() => timeTicks(tMax), [tMax]);

  if (rows.length < 2 || !(tMax > 0)) {
    return <p className="text-[13px] leading-5 text-muted-foreground">Not enough samples to draw the run yet. Charts appear once the simulation has recorded two or more points.</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-[12px] leading-4 text-muted-foreground">
        Simulated time, mm:ss.
        {markers.length ? " Vertical lines on the smaller charts mark the moments named on the heat release chart." : ""}
      </p>
      <SeriesChart spec={LEAD} rows={rows} markers={markers} tMax={tMax} ticks={ticks} lead />
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {SMALL.map((spec) => (
          <SeriesChart key={spec.id} spec={spec} rows={rows} markers={markers} tMax={tMax} ticks={ticks} />
        ))}
      </div>
    </div>
  );
}

/** Peak (or lowest) value, its time and the last sample of every charted quantity. */
export function ValuesDisclosure({ history, className }: { history: FireSample[]; className?: string }) {
  const rows = useMemo(() => chartRows(history), [history]);
  if (rows.length < 2) return null;
  const lines = [LEAD, ...SMALL].flatMap((spec) => spec.series.map((s) => ({ spec, s, summary: summarizeSeries(rows, s.key, spec.extreme) })));
  return (
    <details className={className}>
      <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">Values behind the charts</summary>
      <div className="border-t border-border-subtle p-3">
        <div className={table.wrap}>
          <table className={table.root} aria-label="Peak and final values of each charted quantity">
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Quantity</th>
                <th scope="col" className={cn(table.th, "text-right")}>Peak or lowest</th>
                <th scope="col" className={cn(table.th, "text-right")}>At</th>
                <th scope="col" className={cn(table.th, "text-right")}>Last sample</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ spec, s, summary }) =>
                summary ? (
                  <tr key={s.key} className={table.tr}>
                    <th scope="row" className={cn(table.td, "font-normal text-foreground")}>
                      {spec.series.length > 1 ? `Smoke, ${s.name.toLowerCase()}` : s.name}
                      <span className="ml-1.5 text-text-tertiary">{spec.extreme === "min" ? "(lowest)" : "(peak)"}</span>
                    </th>
                    <td className={table.num}>{spec.value(summary.peak)}</td>
                    <td className={table.num}>T+{clock(summary.peakAtS)}</td>
                    <td className={table.num}>{spec.value(summary.final)}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

/** Fuel pyrolysed against fuel left: a segmented bar, or one line when the share is too small to draw. */
export function FuelBudgetBar({ snapshot }: { snapshot: Pick<FireState, "fuelTotalKg" | "fuelPyrolysedKg"> }) {
  const budget = fuelBudget(snapshot);
  if (!budget) return null;
  const usedPct = shareLabel(budget.usedFraction);
  const g = (value: number) => `${formatSignificant(value, 3)} g`;
  if (budget.usedFraction < FUEL_BAR_MIN_SHARE) {
    return (
      <p className="text-[13px] leading-5 text-muted-foreground">
        Fuel pyrolysed <span className="numeric text-foreground">{formatSignificant(budget.usedG, 3)}</span> g of{" "}
        <span className="numeric text-foreground">{formatSignificant(budget.totalG, 3)}</span> g ({usedPct} %).
      </p>
    );
  }
  const label = `Fuel budget: ${g(budget.usedG)} pyrolysed (${usedPct} %), ${g(budget.remainingG)} remaining, ${g(budget.totalG)} in total.`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-[13px] leading-5 text-muted-foreground">Fuel budget</figcaption>
      <div role="img" aria-label={label} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {budget.usedG > 0 ? <span className="h-full rounded-full" style={{ width: `${budget.usedFraction * 100}%`, background: ACCENT }} /> : null}
        {budget.remainingG > 0 ? <span className="h-full flex-1 rounded-full bg-elev-4" /> : null}
      </div>
      <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[13px] leading-5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: ACCENT }} aria-hidden="true" />
          <dt className="text-muted-foreground">Pyrolysed</dt>
          <dd className="numeric text-foreground">{g(budget.usedG)} <span className="text-text-tertiary">({usedPct} %)</span></dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-elev-4" aria-hidden="true" />
          <dt className="text-muted-foreground">Remaining</dt>
          <dd className="numeric text-foreground">{g(budget.remainingG)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="numeric text-foreground">{g(budget.totalG)}</dd>
        </div>
      </dl>
    </figure>
  );
}

const LOW_COLOR = INK;
const HIGH_COLOR = ACCENT;

interface BarShapeProps { x?: number; y?: number; width?: number; height?: number; fill?: string; value?: number | null; payload?: TornadoRow }

/** Bar square at the zero line, 4 px rounded at the data end, whichever way it points. */
function TornadoBarShape({ x = 0, y = 0, width = 0, height = 0, fill, value }: BarShapeProps) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const left = Math.min(x, x + width);
  const w = Math.abs(width);
  if (w < 0.5) return <rect x={left - 0.5} y={y} width={1} height={height} fill={fill} />;
  const r = Math.min(4, w, height / 2);
  const path = value >= 0
    ? `M${left},${y} H${left + w - r} Q${left + w},${y} ${left + w},${y + r} V${y + height - r} Q${left + w},${y + height} ${left + w - r},${y + height} H${left} Z`
    : `M${left + w},${y} H${left + r} Q${left},${y} ${left},${y + r} V${y + height - r} Q${left},${y + height} ${left + r},${y + height} H${left + w} Z`;
  return <path d={path} fill={fill} />;
}

/** The value at the tip of each bar, outside it, in the text colour. */
function TornadoLabel({ x = 0, y = 0, width = 0, height = 0, value }: { x?: number; y?: number; width?: number; height?: number; value?: number | string | null }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const left = Math.min(x, x + width);
  const w = Math.abs(width);
  const positive = value >= 0;
  return (
    <text x={positive ? left + w + 6 : left - 6} y={y + height / 2} dy="0.35em" textAnchor={positive ? "start" : "end"} fill="var(--foreground)" fontSize={12} className="numeric">
      {signedPct(value)}
    </text>
  );
}

function describeTornado(rows: TornadoRow[], title: string): string {
  const parts = rows.map((row) => `${row.label}: lowered ${signedPct(row.low)}, raised ${signedPct(row.high)}`);
  return `${title}. ${parts.join("; ")}.`;
}

function TornadoChart({ rows, title }: { rows: TornadoRow[]; title: string }) {
  const domain = useMemo(() => tornadoDomain(rows), [rows]);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 text-[13px] leading-5 text-muted-foreground">{title}</figcaption>
      <div className="h-[200px]" role="img" aria-label={describeTornado(rows, title)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" accessibilityLayer={false} margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="26%">
            <CartesianGrid stroke="var(--border-subtle)" horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${value}`}
              unit=" %"
            />
            <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={64} />
            <ReferenceLine x={0} stroke="var(--border)" />
            <Tooltip
              contentStyle={TOOLTIP.contentStyle}
              labelStyle={TOOLTIP.labelStyle}
              itemStyle={TOOLTIP.itemStyle}
              cursor={{ fill: "var(--elev-3)", fillOpacity: 0.5 }}
              formatter={(value, _name, item) => {
                const row = item.payload as TornadoRow;
                const lowered = item.dataKey === "low";
                const at = lowered ? row.lowText : row.highText;
                return [signedPct(typeof value === "number" ? value : null), `${lowered ? "Lowered" : "Raised"}${at ? ` to ${at}` : ""}`];
              }}
            />
            <Bar dataKey="low" name="Input lowered" fill={LOW_COLOR} barSize={12} shape={<TornadoBarShape />} isAnimationActive={false} label={<TornadoLabel />} />
            <Bar dataKey="high" name="Input raised" fill={HIGH_COLOR} barSize={12} shape={<TornadoBarShape />} isAnimationActive={false} label={<TornadoLabel />} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Peak heat release and cabin CO change when each input is lowered or raised, one bar per case. */
export function SensitivityChart({ results, horizonS }: { results: readonly SensitivityResult[]; horizonS: number }) {
  const hrr = useMemo(() => tornadoRows(results, "hrr"), [results]);
  const co = useMemo(() => tornadoRows(results, "co"), [results]);
  if (!results.length) return null;
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] leading-4 text-muted-foreground" aria-label="Bar colours">
        <li className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm" style={{ background: LOW_COLOR }} aria-hidden="true" />
          Input lowered
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm" style={{ background: HIGH_COLOR }} aria-hidden="true" />
          Input raised
        </li>
        <li className="text-text-tertiary">Change against the unperturbed run, model output</li>
      </ul>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <TornadoChart rows={hrr} title={`Peak heat release over ${horizonS} s`} />
        <TornadoChart rows={co} title={`Cabin CO at ${horizonS} s`} />
      </div>
    </div>
  );
}
