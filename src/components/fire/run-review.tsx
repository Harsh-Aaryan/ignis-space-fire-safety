"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ActionLink, Stat, actionClass, table } from "@/components/design/kit";
import { ModelApplicability } from "@/components/simulation/model-applicability";
import { PHASE_LABEL, clock, formatPower, formatSignificant } from "@/components/simulation/format";
import { ACCURACY_SUMMARY, accuracyCue, significantFigures, type AccuracyCue } from "@/lib/fire/accuracy";
import { FIRE_MODEL_VERSION, applicability } from "@/lib/fire/evidence";
import type { FireInput } from "@/lib/fire/model";
import { supportedSensitivities, type SensitivityResult, type Support } from "@/lib/fire/sensitivity";
import { downloadText } from "@/lib/research/export";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
  const cue = { hrr: accuracyCue("hrr", input), heat: accuracyCue("heat", input), co: accuracyCue("co", input), co2: accuracyCue("co2", input) };
  const sig = (c: AccuracyCue) => significantFigures(c.relative);

  function exportRun() {
    if (!snapshot || !input) return;
    const payload = {
      modelVersion: FIRE_MODEL_VERSION,
      evidence: applicability(input),
      accuracyAgainstSaffire: ACCURACY_SUMMARY,
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
        <Stat size="sm" label="Peak heat release" value={formatPower(snapshot.peakHrrW, sig(cue.hrr))} note={<CueNote cue={cue.hrr} />} />
        <Stat size="sm" label="Chemical heat released" value={formatSignificant(snapshot.totalHeatJ / 1000, sig(cue.heat))} unit="kJ" note={<CueNote cue={cue.heat} />} />
        <Stat size="sm" label="Carbon monoxide" value={formatSignificant(snapshot.coPpm, sig(cue.co))} unit="ppm" note={<CueNote cue={cue.co} />} />
        <Stat size="sm" label="CO₂ rise" value={formatSignificant(snapshot.co2RiseMmHg, sig(cue.co2))} unit="mmHg" note={<CueNote cue={cue.co2} />} />
        <Stat size="sm" label="Flame out" value={snapshot.extinctionTime === null ? "Not reached" : `T+${clock(snapshot.extinctionTime)}`} />
        <Stat size="sm" label="Fuel remaining" value={formatSignificant(remainingFuelG, 3)} unit="g" />
      </dl>

      <div className="space-y-2 text-sm leading-6">
        <p>
          <span className="font-medium text-foreground">{PHASE_LABEL[snapshot.phase]}.</span>{" "}
          {snapshot.extinctionCause ? `Cause: ${snapshot.extinctionCause}. ` : ""}
          <span className="text-muted-foreground">
            Fuel surface {snapshot.surfaceTempC.toFixed(0)} °C, cabin smoke {formatSignificant(snapshot.smokeMgM3, 2)} mg/m³, total CO₂{" "}
            {snapshot.co2TotalMmHg.toFixed(2)} mmHg. A flame going out can leave heat and combustion gases in the cabin.
          </span>
        </p>
      </div>

      <ModelApplicability input={input} />

      <Sensitivities input={input} />

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
              <span className="numeric shrink-0 text-muted-foreground">T+{clock(event.t)}</span>
              <span className="text-muted-foreground">{event.label}</span>
            </li>
          ))}
        </ol>
      </details>

      <p className="text-[12px] leading-4 text-text-tertiary">Output of the IGNIS model, not a NASA measurement.</p>
    </section>
  );
}

function CueNote({ cue }: { cue: AccuracyCue }) {
  return (
    <span title={cue.long} className={cue.tested ? undefined : "text-status-caution"}>
      {cue.label}
    </span>
  );
}

const SUPPORT_LABEL: Record<Support, string> = {
  supported: "Direction supported",
  contradicted: "Direction contradicted",
  "not resolvable": "Not resolvable from the data",
  untested: "Not tested by data",
};

function signed(value: number | null) {
  if (value === null) return "–";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} %`;
}

function change(result: SensitivityResult) {
  const digits = result.parameter === "airflow" ? 3 : 1;
  const parts = [result.low, result.high].filter((v): v is number => v !== null).map((v) => v.toFixed(digits));
  return `${parts.join(" / ")} ${result.unit}`;
}

/** Oxygen, pressure and airflow sensitivities, shown only where a pair of Saffire tests can check them. */
function Sensitivities({ input }: { input: FireInput }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => (open ? supportedSensitivities(input) : null), [open, input]);
  return (
    <details className="rounded-md border border-border-subtle" onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-foreground">Sensitivity checked against flight data</summary>
      <div className="space-y-3 border-t border-border-subtle px-3 py-3 text-[13px] leading-5 text-muted-foreground">
        {report === null ? null : !report.supported ? (
          <p>Not supported by data. {report.reason}</p>
        ) : (
          <>
            <p>
              Change in peak heat release and cabin CO over {report.horizonS} s when each input moves within the neighbourhood of
              Saffire VI test {report.nearestTest}. The last column says whether a pair of published tests can resolve the direction.
            </p>
            <div className={table.wrap}>
              <table className={table.root} aria-label="Supported sensitivities">
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>Input</th>
                    <th scope="col" className={cn(table.th, "text-right")}>Low / high</th>
                    <th scope="col" className={cn(table.th, "text-right")}>Heat release</th>
                    <th scope="col" className={cn(table.th, "text-right")}>CO</th>
                    <th scope="col" className={table.th}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((result) => (
                    <tr key={result.parameter} className={table.tr}>
                      <th scope="row" className={cn(table.td, "font-normal text-foreground")}>{result.label}</th>
                      <td className={cn(table.num, "whitespace-nowrap")}>{change(result)}</td>
                      <td className={cn(table.num, "whitespace-nowrap")}>{signed(result.hrrPct.low)} / {signed(result.hrrPct.high)}</td>
                      <td className={cn(table.num, "whitespace-nowrap")}>{signed(result.coPct.low)} / {signed(result.coPct.high)}</td>
                      <td className={table.td} title={result.evidence}>{SUPPORT_LABEL[result.hrrSupport]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-[12px] leading-4 text-text-tertiary">
              {report.results.map((result) => (
                <li key={result.parameter}>{result.evidence}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
