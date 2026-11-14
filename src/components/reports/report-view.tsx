"use client";

import { RunReview } from "@/components/fire/run-review";
import { useState } from "react";
import { CoverageChart, RelevanceChart } from "@/components/charts/evidence-charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GATEWAY_SCENE_LABEL } from "@/data/missions";
import { FUEL_LABEL, OBJECTIVE_LABEL } from "@/lib/labels";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import { downloadText, runsToCsv } from "@/lib/export-csv";
import { formatNumber, formatRelevance } from "@/lib/format";
import { exportScenarios, parseScenarios } from "@/services/scenario-repository";
import { getServices } from "@/services";
import { useAnalysis } from "@/hooks/use-analysis";
import { useMissionStore } from "@/stores/mission-store";

export function ReportView() {
  const analysis = useAnalysis();
  const scenario = useMissionStore((state) => state.scenario);
  const weights = useMissionStore((state) => state.weights);
  const saved = useMissionStore((state) => state.savedScenarios);
  const save = useMissionStore((state) => state.saveScenario);
  const load = useMissionStore((state) => state.loadScenario);
  const remove = useMissionStore((state) => state.deleteScenario);
  const importScenarios = useMissionStore((state) => state.importScenarios);
  const notify = useMissionStore((state) => state.notify);
  const [name, setName] = useState(`${scenario.name} scenario`);
  const services = getServices().evidence;
  const partial = oxygenPartialPressurePsi(scenario.oxygenPct, scenario.pressurePsi);
  const dataMode = useMissionStore((state) => state.dataMode);

  return (
    <div className="flex flex-col gap-4">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-cond text-[22px] font-semibold tracking-[0.04em]">Results & saved scenarios</h1>
          <p className="text-sm text-muted-foreground">
            Review the fire run, export its model inputs and save your cabin setup. Catalog exports are labeled separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>Print / PDF</Button>
          <Button
            variant="outline"
            onClick={() => {
              downloadText(
                "ignis-synthetic-runs.csv",
                runsToCsv(services.listRuns(), services.listInvestigations()),
                "text/csv",
              );
              notify("CSV export downloaded.");
            }}
          >
            Export CSV
          </Button>
        </div>
      </header>
      <div className="rounded border border-border bg-card p-4"><h2 className="mb-4 text-lg font-medium">Latest fire run</h2><RunReview /></div>
      <details><summary className="cursor-pointer text-sm text-muted-foreground">Research catalog report (demonstration records)</summary>
      <article className="report-sheet rounded-xl border border-border bg-card p-5">
        <p className="text-[11px] tracking-wide text-amber uppercase">
          {dataMode === "verified" ? "Prototype — verified NASA records, limited subset" : "Prototype — synthetic demonstration data"}
        </p>
        <h2 className="mt-2 text-xl font-semibold">{scenario.name}</h2>
        {scenario.missionId === "lunar-habitat" ? (
          <p className="mt-2 text-sm">
            A conceptual digital twin inspired by the 2013 Foster+Partners / ESA 3D-printed lunar habitation study. Official published dimensions and forms are adapted. The composite is not an official ESA or Foster+Partners design and is not a depiction of a flown or certified vehicle.
          </p>
        ) : null}
        {scenario.missionId === "mars-habitat" ? (
          <p className="mt-2 text-sm">
            A conceptual digital twin inspired by AI SpaceFactory’s MARSHA, winner of NASA’s 3D-Printed Habitat Challenge. Official published dimensions and forms are adapted. The composite is not an official AI SpaceFactory or NASA design and is not a depiction of a flown or certified vehicle.
          </p>
        ) : null}
        {scenario.missionId === "gateway-orbit" ? (
          <p className="mt-2 text-sm">
            {GATEWAY_SCENE_LABEL}. A conceptual digital twin inspired by published NASA Gateway and ESA Lunar I-Hab concepts. It is not official NASA geometry and is not a depiction of a flown or certified vehicle.
          </p>
        ) : null}
        <p className="mt-2 text-sm">
          Objective: {OBJECTIVE_LABEL[scenario.objective]}. Fuel: {FUEL_LABEL[scenario.fuelCategory]}.
          Atmosphere: {formatNumber(scenario.oxygenPct, 1)}% oxygen, {formatNumber(scenario.pressurePsi, 1)} psi total cabin pressure, pO₂ {formatNumber(partial, 2)} psi (fraction × cabin pressure),{" "}
          {scenario.gravityG} g, airflow {formatNumber(scenario.airflowMs, 2)} m/s. Evidence mode: {dataMode}.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Envelope coverage {formatNumber(analysis.coverage.percent, 0)}%. {analysis.coverage.formula}{" "}
          {analysis.relevantCount} dossiers score at least 55. {analysis.gaps.length} gaps are open.
        </p>
        <h3 className="mt-5 text-lg font-medium">Ranked dossiers</h3>
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {analysis.ranked.slice(0, 6).map((row) => (
            <li key={row.investigation.id}>
              <span className="numeric text-foreground">{formatRelevance(row.relevance)}</span>{" "}
              {row.investigation.family} — {row.investigation.title}{" "}
              <span className="numeric">({row.investigation.id.toUpperCase()})</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <RelevanceChart rows={analysis.ranked} />
          <CoverageChart contributions={analysis.coverage.contributions} />
        </div>
        <h3 className="mt-5 text-lg font-medium">Gaps</h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {analysis.gaps.slice(0, 5).map((gap) => (
            <li key={gap.id}>
              {gap.title}. {gap.distinguishesMissingFromNegative}
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-lg font-medium">Proposed studies</h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {analysis.recommendations.slice(0, 3).map((item) => (
            <li key={item.id}>
              {item.title} (priority {Math.round(item.priorityScore * 100)}). {item.gapExplanation}{" "}
              {item.limitations}
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-lg font-medium">Limitations and provenance</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          All runs are synthetic demonstration records with fictional identifiers. No NASA DOI is
          cited because none was used. Family names identify public investigation programs only.
          Rankings, coverage, and priorities are heuristics over that catalog. They are not hazard
          probabilities and they do not certify a habitat, rover, or detector.
        </p>
      </article></details>
      <section className="no-print rounded-xl border border-border bg-secondary p-4">
        <h2 className="text-lg font-medium">Save and load scenarios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved locally in this browser. Weights travel with the scenario. Nothing is uploaded.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input aria-label="Scenario name" value={name} onChange={(event) => setName(event.target.value)} className="max-w-xs" />
          <Button
            onClick={() => {
              save(name);
            }}
          >
            Save scenario
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadText("ignis-scenarios.json", exportScenarios(saved.length ? saved : [{
              id: "current",
              name,
              savedAt: new Date().toISOString(),
              scenario,
              weights,
              notes: "Synthetic demonstration scenario",
            }]), "application/json")}
          >
            Download JSON
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-1.5 text-sm">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  importScenarios(parseScenarios(await file.text()));
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Could not import that file.");
                }
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {saved.length === 0 ? (
            <li className="text-sm text-muted-foreground">No saved scenarios in this browser yet.</li>
          ) : (
            saved.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                <span>
                  {item.name}
                  <span className="numeric ml-2 text-xs text-muted-foreground">
                    {item.scenario.oxygenPct}% O₂ · {item.scenario.gravityG} g
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => load(item.id)}>
                    Load
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                    Delete
                  </Button>
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
