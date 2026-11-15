"use client";

import { Download } from "lucide-react";
import { ActionLink, Stat, actionClass } from "@/components/design/kit";
import { ModelApplicability } from "@/components/simulation/model-applicability";
import { PHASE_LABEL, clock, formatPower } from "@/components/simulation/format";
import { FIRE_MODEL_VERSION, applicability } from "@/lib/fire/evidence";
import { downloadText } from "@/lib/research/export";
import { ROUTES } from "@/lib/routes";
import { fireRuntime, useFireSimStore } from "@/stores/fire-sim-store";

/** What happened in the latest run: key times, totals, what remains, and the event log. */
export function RunReview() {
  const snapshot = useFireSimStore((store) => store.snapshot);
  const history = useFireSimStore((store) => store.history);
  const events = useFireSimStore((store) => store.events);
  const input = fireRuntime.input;

  if (!snapshot || !input) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Run a fire scenario to review its heat release, detector response and the gases it leaves behind.
      </p>
    );
  }

  const remainingFuelG = Math.max(0, (snapshot.fuelTotalKg - snapshot.fuelPyrolysedKg) * 1000);

  function exportRun() {
    if (!snapshot || !input) return;
    const payload = {
      modelVersion: FIRE_MODEL_VERSION,
      evidence: applicability(input),
      input,
      finalState: snapshot,
      history,
      events,
      provenance: "IGNIS model output; not NASA measurements",
    };
    downloadText("ignis-fire-run.json", JSON.stringify(payload, null, 2), "application/json");
  }

  return (
    <section aria-label="Fire run review" className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat size="sm" label="Ignition" value={snapshot.ignitionTime === null ? "No ignition" : `T+${clock(snapshot.ignitionTime)}`} />
        <Stat size="sm" label="First alarm" value={snapshot.firstAlarmTime === null ? "No alarm" : `T+${clock(snapshot.firstAlarmTime)}`} />
        <Stat size="sm" label="Peak heat release" value={formatPower(snapshot.peakHrrW)} />
        <Stat size="sm" label="Chemical heat released" value={(snapshot.totalHeatJ / 1000).toFixed(1)} unit="kJ" />
        <Stat size="sm" label="Flame out" value={snapshot.extinctionTime === null ? "Not reached" : `T+${clock(snapshot.extinctionTime)}`} />
        <Stat size="sm" label="Fuel remaining" value={remainingFuelG.toFixed(1)} unit="g" />
      </dl>

      <div className="space-y-2 text-sm leading-6">
        <p>
          <span className="font-medium text-foreground">{PHASE_LABEL[snapshot.phase]}.</span>{" "}
          {snapshot.extinctionCause ? `Cause: ${snapshot.extinctionCause}. ` : ""}
          <span className="text-muted-foreground">
            Fuel surface {snapshot.surfaceTempC.toFixed(0)} °C, cabin smoke {snapshot.smokeMgM3.toFixed(1)} mg/m³, CO{" "}
            {snapshot.coPpm.toFixed(0)} ppm, total CO₂ {snapshot.co2TotalMmHg.toFixed(2)} mmHg. A flame going out can leave heat
            and combustion gases in the cabin.
          </span>
        </p>
      </div>

      <ModelApplicability input={input} />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportRun} className={actionClass("secondary")}>
          <Download className="size-4" aria-hidden="true" />
          Export this fire run
        </button>
        <ActionLink href={ROUTES.compare}>Compare gravity</ActionLink>
      </div>

      <details className="rounded-md border border-border-subtle">
        <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">
          Event timeline ({events.length})
        </summary>
        <ol className="space-y-2.5 border-t border-border-subtle px-3 py-3">
          {events.map((event, index) => (
            <li key={index} className="flex gap-3 text-[13px] leading-5">
              <span className="numeric shrink-0 text-ember-text">T+{clock(event.t)}</span>
              <span className="text-muted-foreground">{event.label}</span>
            </li>
          ))}
        </ol>
      </details>

      <p className="text-[12px] leading-4 text-text-tertiary">Model {FIRE_MODEL_VERSION}. Output of the IGNIS model, not a NASA measurement.</p>
    </section>
  );
}
