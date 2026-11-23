"use client";

import { useId, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Note, Panel, Tag, table } from "@/components/design/kit";
import { fieldClass } from "@/components/research/index-filter-bar";
import { cn } from "@/lib/utils";
import { cfastTemperatureGap } from "@/lib/fire/accuracy";
import {
  CFAST_REFERENCE,
  cfastCases,
  cfastChartRows,
  cfastComparison,
  hasCfastReference,
  type CfastCase,
} from "@/lib/fire/cfast";

/** Series colours, validated together on the card surface (OKLCH lightness band,
 * colour-vision separation, 3:1 contrast). CFAST uses the site's --data-5; IGNIS
 * a darker step of the --data-1 hue so both sit in the same lightness band. */
const CFAST_COLOR = "var(--data-5)";
const IGNIS_COLOR = "#C98500";
const AXIS = { fill: "var(--muted-foreground)", fontSize: 12 };

const rise = (value: number) => (Math.abs(value) < 1 ? value.toFixed(2) : value.toFixed(1));
const points = (value: number) => value.toFixed(2);
const dash = <span className="text-text-tertiary">–</span>;

/** The shipped CFAST cases were generated before the habitats took their current display names. */
const LEGACY_HABITAT_NAMES: Array<[string, string]> = [
  ["Lunar Habitat", "Moon habitat"],
  ["Mars Habitat", "Mars habitat"],
];

function caseLabel(item: CfastCase): string {
  return LEGACY_HABITAT_NAMES.reduce((label, [from, to]) => (label.startsWith(`${from} · `) ? to + label.slice(from.length) : label), item.label);
}

function zoneLabel(item: CfastCase) {
  return item.zoneModel === "single-zone" ? "Single zone" : "Two-zone bound";
}

function sourceLabel(item: CfastCase) {
  return item.hrrSource === "ignis" ? "IGNIS" : "Published";
}

function tooltipStyle() {
  return {
    contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 },
    labelStyle: { color: "var(--muted-foreground)" },
    itemStyle: { color: "var(--foreground)" },
    cursor: { stroke: "var(--border)", strokeWidth: 1 },
  };
}

function CaseChart({ item, kind }: { item: CfastCase; kind: "temperature" | "oxygen" }) {
  const rows = cfastChartRows(item);
  const temperature = kind === "temperature";
  const title = temperature ? "Cabin temperature rise, K" : "Cabin O₂, mol %";
  const hasIgnis = temperature ? Boolean(item.series.ignisTempRiseC) : Boolean(item.series.ignisO2Pct);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-[13px] text-muted-foreground">{title}</figcaption>
      <div className="h-56" role="img" aria-label={`${title} over time, ${caseLabel(item)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, "dataMax"]}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              unit=" s"
            />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={temperature ? [0, "auto"] : ["auto", "auto"]}
              tickFormatter={(value: number) => (temperature ? String(Math.round(value * 10) / 10) : value.toFixed(1))}
            />
            <Tooltip
              {...tooltipStyle()}
              labelFormatter={(value) => `${value} s`}
              formatter={(value) => (typeof value === "number" ? (temperature ? `${rise(value)} K` : `${value.toFixed(2)} %`) : String(value))}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            <Line
              type="monotone"
              dataKey={temperature ? "cfastTempRiseC" : "cfastO2Pct"}
              name={item.zoneModel === "two-zone" && temperature ? "CFAST, cabin mean" : "CFAST"}
              stroke={CFAST_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {temperature && item.series.cfastUpperTempRiseC ? (
              <Line
                type="monotone"
                dataKey="cfastUpperTempRiseC"
                name="CFAST, hot layer"
                stroke={CFAST_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ) : null}
            {hasIgnis ? (
              <Line
                type="monotone"
                dataKey={temperature ? "ignisTempRiseC" : "ignisO2Pct"}
                name="IGNIS"
                stroke={IGNIS_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/**
 * IGNIS cabin temperature and oxygen checked against NIST CFAST, run offline on
 * the same heat release. Renders nothing until scripts/cfast/run_cases.py has
 * written results.
 */
export function CfastCrosscheck() {
  const selectId = useId();
  const cases = cfastCases();
  const [selectedId, setSelectedId] = useState(() => cases.find((item) => item.hrrSource === "ignis")?.id ?? cases[0]?.id ?? "");
  if (!hasCfastReference() || cases.length === 0) return null;
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];
  const generated = CFAST_REFERENCE.generatedAt ? new Date(CFAST_REFERENCE.generatedAt) : null;
  const solver = CFAST_REFERENCE.cfastVersion?.match(/CFAST-(\d+\.\d+\.\d+)/)?.[1];
  const initialC = cases.find((item) => item.measured)?.measured?.assumedInitialC;
  const temperatureGap = cfastTemperatureGap();

  return (
    <Panel
      aria-label="NIST CFAST cross-check"
      title="NIST CFAST cross-check"
      description="Cabin gas temperature and oxygen from CFAST, the NIST compartment fire model, given the same heat release as IGNIS. Published rows use a heat-release shape fitted to the Saffire peak and total heat."
      actions={solver ? <Tag>CFAST {solver}</Tag> : null}
    >
      <div className={table.wrap}>
        <table className={cn(table.root, "min-w-[880px]")}>
          <caption className="sr-only">CFAST and IGNIS peak cabin temperature rise and final oxygen depletion for each case</caption>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>Case</th>
              <th scope="col" className={table.th}>Heat release</th>
              <th scope="col" className={table.th}>Zones</th>
              <th scope="col" className={cn(table.th, "text-right")}>Heat, kJ</th>
              <th scope="col" className={cn(table.th, "text-right")}>Peak rise CFAST, K</th>
              <th scope="col" className={cn(table.th, "text-right")}>Peak rise IGNIS, K</th>
              <th scope="col" className={cn(table.th, "text-right")}>O₂ drop CFAST, pts</th>
              <th scope="col" className={cn(table.th, "text-right")}>O₂ drop IGNIS, pts</th>
              <th scope="col" className={cn(table.th, "text-right")}>Far field measured / CFAST, °C</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => {
              const c = cfastComparison(item.id)!;
              return (
                <tr key={item.id} className={table.tr}>
                  <th scope="row" className={cn(table.td, "font-normal text-foreground")}>
                    {caseLabel(item).split(" · ").slice(0, -1).join(" · ")}
                  </th>
                  <td className={table.td}>{sourceLabel(item)}</td>
                  <td className={table.td}>{zoneLabel(item)}</td>
                  <td className={table.num}>{Math.round(c.totalHeatKJ)}</td>
                  <td className={table.num}>
                    {rise(c.cfastPeakRiseC)}
                    {c.cfastUpperLayerRiseC !== null ? (
                      <span className="block text-[12px] text-muted-foreground">hot layer {rise(c.cfastUpperLayerRiseC)}</span>
                    ) : null}
                  </td>
                  <td className={table.num}>{c.ignisPeakRiseC === null ? dash : rise(c.ignisPeakRiseC)}</td>
                  <td className={table.num}>{points(c.cfastO2DepletionPts)}</td>
                  <td className={table.num}>{c.ignisO2DepletionPts === null ? dash : points(c.ignisO2DepletionPts)}</td>
                  <td className={table.num}>
                    {c.measuredFarFieldC === null ? dash : `${c.measuredFarFieldC} / ${c.cfastPeakC.toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex max-w-md flex-col gap-1">
        <label htmlFor={selectId} className="text-[12px] text-muted-foreground">
          Case history
        </label>
        <select id={selectId} className={fieldClass} value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
          {cases.map((item) => (
            <option key={item.id} value={item.id}>
              {caseLabel(item)}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <CaseChart item={selected} kind="temperature" />
        <CaseChart item={selected} kind="oxygen" />
      </div>
      {selected.notes.length ? (
        <ul className="mt-3 space-y-1 text-[12px] leading-5 text-muted-foreground">
          {selected.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 space-y-2">
        <Note title="Zones.">
          0 g cabins are one well-mixed zone; lunar and Martian two-zone runs only bound the hot layer.
        </Note>
        <Note title="Gravity.">
          CFAST has no gravity input: its plume and wall-convection correlations assume 1 g.
        </Note>
        <Note title="Walls (assumed).">
          A 5 mm aluminium shell backed by insulation that gives 0.3 W/m²K loss to the structure, emissivity 0.9, in a closed cabin with no
          vents or leakage.
        </Note>
        {temperatureGap ? (
          <Note title="Temperature gap.">
            On identical heat release CFAST gives {temperatureGap.low.toFixed(0)}–{temperatureGap.high.toFixed(0)} times the IGNIS cabin
            temperature rise for the Saffire cases. The difference comes mostly from how each model splits heat between cabin air and walls,
            which both assume, and the 0–5 K Saffire far-field readings cannot decide between them. Cabin temperature is therefore not an
            established output of either model; oxygen depletion, which follows from stoichiometry, agrees within about 10 %.
          </Note>
        ) : null}
      </div>
      {generated ? (
        <p className="mt-4 text-[12px] text-text-tertiary">
          {initialC !== undefined ? `CFAST far-field values start from an assumed ${initialC} °C cabin. ` : null}Computed{" "}
          {generated.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}.
        </p>
      ) : null}
    </Panel>
  );
}
