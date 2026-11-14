"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SyntheticStamp } from "@/components/design/marks";
import { DATA_SERIES } from "@/design/palette";
import { RELEVANCE_DISCLAIMER } from "@/lib/format";
import type { RankedInvestigation } from "@/lib/evidence/selectors";
import type { ExperimentalRun } from "@/types/domain";

const tip = { background: "#292C30", border: "1px solid #3A3E44", color: "#EDEAE4", fontSize: 11 };
const axis = { stroke: "#3A3E44", fontSize: 10, fill: "#847F79" };

function ChartFrame({
  caption,
  table,
  children,
}: {
  caption: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure>
      <div className="mb-1 flex justify-end gap-3">
        <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setAsTable((value) => !value)}>
          {asTable ? "View as chart" : "View as table"}
        </button>
        <SyntheticStamp />
      </div>
      {asTable ? <div className="overflow-x-auto text-[13px]">{table}</div> : children}
      <figcaption className="text-[11px] text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export function RelevanceChart({ rows }: { rows: RankedInvestigation[] }) {
  const data = rows.slice(0, 8).map((row) => ({
    name: row.investigation.family,
    relevance: Number((row.relevance ?? 0).toFixed(2)),
  }));
  if (!data.length) return null;
  return (
    <ChartFrame
      caption={RELEVANCE_DISCLAIMER}
      table={
        <table className="w-full text-left">
          <thead>
            <tr className="text-[#847F79]">
              <th className="py-1 pr-3">Family</th>
              <th className="py-1">Relevance</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name} className="border-t border-[#2A2D32]">
                <td className="py-1 pr-3">{row.name}</td>
                <td className="numeric py-1">{row.relevance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#2A2D32" vertical={false} />
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} domain={[0, 1]} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="relevance" fill={DATA_SERIES[0]} radius={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function OxygenAirflowChart({ runs }: { runs: ExperimentalRun[] }) {
  const data = runs
    .filter((run) => run.oxygenConcentrationPct != null && run.airflowVelocityMs != null)
    .map((run) => ({
      oxygen: run.oxygenConcentrationPct,
      airflow: run.airflowVelocityMs,
      id: run.id,
    }));
  if (!data.length) {
    return <p className="text-[13px] text-muted-foreground italic">No rows report both oxygen and airflow.</p>;
  }
  return (
    <ChartFrame
      caption="Unreported oxygen or airflow is omitted, not plotted as zero."
      table={
        <table className="w-full text-left">
          <thead>
            <tr className="text-[#847F79]">
              <th className="py-1 pr-3">Run</th>
              <th className="py-1 pr-3">Oxygen %</th>
              <th className="py-1">Airflow m/s</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t border-[#2A2D32]">
                <td className="numeric py-1 pr-3">{row.id.toUpperCase()}</td>
                <td className="numeric py-1 pr-3">{row.oxygen}</td>
                <td className="numeric py-1">{row.airflow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid stroke="#2A2D32" vertical={false} />
            <XAxis dataKey="oxygen" name="Oxygen" unit=" %" {...axis} />
            <YAxis dataKey="airflow" name="Airflow" unit=" m/s" {...axis} />
            <Tooltip contentStyle={tip} />
            <Scatter data={data} fill={DATA_SERIES[1]} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function CoverageChart({
  contributions,
}: {
  contributions: Array<{ axis: string; score: number }>;
}) {
  const data = contributions.map((item) => ({
    name: item.axis.split(" ")[0],
    score: Number(item.score.toFixed(2)),
  }));
  return (
    <ChartFrame
      caption="Each bar is a coverage term from 0 to 1. A high bar is more synthetic runs, not a safer habitat."
      table={
        <table className="w-full text-left">
          <thead>
            <tr className="text-[#847F79]">
              <th className="py-1 pr-3">Term</th>
              <th className="py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name} className="border-t border-[#2A2D32]">
                <td className="py-1 pr-3">{row.name}</td>
                <td className="numeric py-1">{row.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#2A2D32" vertical={false} />
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} domain={[0, 1]} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="score" fill="#C57400" radius={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
