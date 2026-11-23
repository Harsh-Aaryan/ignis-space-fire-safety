"use client";

import { useState } from "react";
import { Download, Printer, Upload } from "lucide-react";
import { ActionLink, PageHeader, Panel, Stat, actionClass } from "@/components/design/kit";
import { RunReview } from "@/components/fire/run-review";
import { EvidenceBrief, EvidenceBriefPrompt } from "@/components/reports/evidence-brief";
import { useSelectedIds } from "@/components/research/compare-tray";
import { fieldClass } from "@/components/research/index-filter-bar";
import { missionById } from "@/data/missions";
import { INVESTIGATIONS } from "@/data/research/investigations";
import { formatGravity, formatNumber, formatOxygen, formatPsi } from "@/lib/format";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import { downloadText, parseScenarioFile, researchIndexCsv, scenariosToJson } from "@/lib/research/export";
import { ROUTES } from "@/lib/routes";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

/** Results: the latest fire run, the evidence brief for the picked investigations, saved cabin scenarios, and the current cabin. */
export function ReportView() {
  const scenario = useMissionStore((state) => state.scenario);
  const saved = useMissionStore((state) => state.savedScenarios);
  const save = useMissionStore((state) => state.saveScenario);
  const load = useMissionStore((state) => state.loadScenario);
  const remove = useMissionStore((state) => state.deleteScenario);
  const importScenarios = useMissionStore((state) => state.importScenarios);
  const notify = useMissionStore((state) => state.notify);
  const hasRun = useFireSimStore((store) => store.snapshot !== null);
  const hasBrief = useSelectedIds().length > 0;
  const [name, setName] = useState(`${scenario.name} scenario`);
  const partial = oxygenPartialPressurePsi(scenario.oxygenPct, scenario.pressurePsi);

  function downloadScenarios() {
    const items = saved.length
      ? saved
      : [{ id: "current", name, savedAt: new Date().toISOString(), scenario, notes: "" }];
    downloadText("ignis-scenarios.json", scenariosToJson(items), "application/json");
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importScenarios(parseScenarioFile(await file.text()));
    } catch (error) {
      notify(error instanceof Error ? error.message : "That file could not be imported.");
    }
    event.target.value = "";
  }

  function exportIndex() {
    downloadText("ignis-research-index.csv", researchIndexCsv(INVESTIGATIONS), "text/csv");
    notify("Research index downloaded.");
  }

  return (
    <div className="flex min-w-0 flex-col">
      <PageHeader
        title="Results and saved scenarios"
        description="Review the latest fire run, export an evidence brief for your research question, and keep the cabin setups you want to return to."
        actions={
          <>
            <button type="button" className={`${actionClass("secondary")} no-print`} onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Print or save as PDF
            </button>
            <button type="button" className={`${actionClass("secondary")} no-print`} onClick={exportIndex}>
              <Download className="size-4" aria-hidden="true" />
              Export research index (CSV)
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <Panel
          title="Latest fire run"
          className="report-sheet"
          actions={
            hasRun ? null : (
              <ActionLink href={ROUTES.simulation} variant="primary" onClick={() => useFireSimStore.getState().setOpen(true)} className="no-print">
                Run a fire scenario
              </ActionLink>
            )
          }
        >
          <RunReview />
        </Panel>

        {hasBrief ? <EvidenceBrief /> : <EvidenceBriefPrompt />}

        <Panel
          title="Saved cabin scenarios"
          description="Stored in this browser only. Nothing is uploaded. A saved scenario holds the cabin conditions, not a fire run."
          className="no-print"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-[12px] text-muted-foreground sm:max-w-xs">
              Name
              <input aria-label="Scenario name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
            </label>
            <button type="button" className={actionClass("primary")} onClick={() => save(name)}>
              Save scenario
            </button>
            <button type="button" className={actionClass("secondary")} onClick={downloadScenarios}>
              <Download className="size-4" aria-hidden="true" />
              Download JSON
            </button>
            <label className={`${actionClass("secondary")} cursor-pointer`}>
              <Upload className="size-4" aria-hidden="true" />
              Import JSON
              <input type="file" accept="application/json" className="sr-only" onChange={importFile} />
            </label>
          </div>

          {saved.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">No scenario has been saved in this browser yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-border-subtle rounded-md border border-border-subtle">
              {saved.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 text-sm text-foreground">
                    {item.name}
                    <span className="numeric ml-2 text-[12px] text-text-tertiary">
                      {item.scenario.oxygenPct}% O₂ · {item.scenario.pressurePsi} psi · {item.scenario.gravityG} g
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className={actionClass("secondary")} onClick={() => load(item.id)}>
                      Load
                    </button>
                    <button type="button" className={actionClass("secondary")} onClick={() => remove(item.id)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Cabin" description={missionById(scenario.missionId).name} className="report-sheet">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Gravity" value={formatGravity(scenario.gravityG)} unit="g" />
            <Stat label="Oxygen" value={formatOxygen(scenario.oxygenPct)} unit="%" />
            <Stat label="Cabin pressure" value={formatPsi(scenario.pressurePsi)} unit="psi" />
            <Stat label="Oxygen partial pressure" value={formatNumber(partial, 2)} unit="psi" />
            <Stat label="Airflow" value={(scenario.airflowMs * 100).toFixed(1)} unit="cm/s" />
          </dl>
        </Panel>
      </div>
    </div>
  );
}
