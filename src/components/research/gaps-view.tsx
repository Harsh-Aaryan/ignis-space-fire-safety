"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { Note, Panel, Tag, TextLink, evidenceHint, table } from "@/components/design/kit";
import { Term } from "@/components/design/term";
import { TERM_DEFINITIONS } from "@/components/research/record-meta";
import { GRAVITY_REGIMES, TOPICS, type GravityRegime, type Topic } from "@/data/research/investigations";
import { formatGravity, formatOxygen, formatPsi } from "@/lib/format";
import { KPA_PER_PSI } from "@/lib/physics/atmosphere";
import { GRAVITY_ORDER, coverageMatrix, isCellEmpty } from "@/lib/research/coverage";
import { fieldClass } from "@/components/research/index-filter-bar";
import { Cite } from "@/components/fire/cite";
import { FIRE_MATERIALS } from "@/data/fire/materials";
import { EVALUATION_SNAPSHOT } from "@/lib/fire/accuracy";
import {
  EVIDENCE_MATCH_HINT,
  EVIDENCE_MATCH_LABEL,
  EVIDENCE_MATCH_ORDER,
  RUN_TOLERANCE_TEXT,
  countByStatus,
  gravityRegimeFor,
  matchCabinWithIndex,
  type CabinSpecimen,
  type EvidenceMatchStatus,
  type RangeCheck,
} from "@/lib/research/envelope";
import { materialForFireMaterial } from "@/lib/research/materials";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

/** Open questions, shown only while the coverage cell they come from is empty. */
const OPEN_QUESTIONS: Array<{ topic: Topic; question: string; missing: string; recordId?: string; recordNote?: string }> = [
  {
    topic: "cabin-scale-fire",
    question: "How large does a cabin fire grow in partial gravity, and what does it do to the air?",
    missing: "A burn of practical size at lunar or Martian gravity, with heat release and cabin gases recorded as Saffire did in microgravity.",
    recordId: "lunar-martian-flammability",
    recordNote: "A partial-gravity habitat fire is expected to be substantially worse than in 0 g; long burns await a lunar-surface experiment.",
  },
  {
    topic: "smoke",
    question: "What smoke does an overheated material make in partial gravity, and where does it go?",
    missing: "Particle sizes and smoke transport measured at lunar or Martian gravity. The SAME measurements were made in microgravity.",
    recordId: "same-2",
    recordNote: "In microgravity smoke stays near its source; in partial gravity a weak plume carries it upward.",
  },
  {
    topic: "detection",
    question: "Where does a detector belong when a weak plume competes with the ventilation?",
    missing: "Detector response measured in a partial-gravity cabin. Current placement follows the ventilation path, as on the ISS.",
    recordId: "iss-fire-detection-suppression",
    recordNote: "Duct-mounted detection assumes forced flow carries the smoke.",
  },
  {
    topic: "suppression",
    question: "Does an extinguishing agent reach a fire the same way in partial gravity?",
    missing: "Agent delivery and extinction measured at lunar or Martian gravity.",
    recordId: "fine-water-mist",
    recordNote: "Droplet transport in partial gravity was not tested.",
  },
];

/** Evidence gaps: what has been tested at each gravity level, and how the current cabin compares. */
export function GapsView() {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <CoverageMatrix />
      <CabinComparison />
      <OpenQuestions />
      <ModelGaps />
    </div>
  );
}

function CoverageMatrix() {
  const rows = coverageMatrix();
  return (
    <Panel
      title="Coverage by gravity"
      description="Which indexed experiments and tests addressed each topic, at each gravity level. Standards are left out: they are requirements, not tests."
      flush
    >
      <div className="overflow-x-auto">
        <table className={cn(table.root, "min-w-[760px]")}>
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Topic
              </th>
              {GRAVITY_ORDER.map((gravity) => (
                <th key={gravity} scope="col" className={table.th}>
                  {GRAVITY_REGIMES[gravity].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.topic} className="border-b border-border-subtle last:border-b-0">
                <th scope="row" className={cn(table.td, "w-48 font-normal")}>
                  <span className="font-medium text-foreground">{TOPICS[row.topic].label}</span>
                  <span className="mt-0.5 block text-[12px] leading-4 text-text-tertiary">{TOPICS[row.topic].description}</span>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.gravity} className={cn(table.td, cell.records.length ? "" : "bg-background/60")}>
                    {cell.records.length ? (
                      <ul className="space-y-1">
                        {cell.records.map((record) => (
                          <li key={record.id}>
                            <Link href={ROUTES.investigation(record.id)} className="text-foreground underline-offset-4 hover:underline">
                              {record.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-text-tertiary">None indexed</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border-subtle px-5 py-3">
        <Note>An empty cell means no such test is indexed here. It does not mean that none exists.</Note>
      </div>
    </Panel>
  );
}

function rangeText(check: RangeCheck, unit: string): string {
  if (!check.range) return "Not tabulated";
  const [low, high] = check.range;
  const join = unit.startsWith("%") ? "" : " ";
  return low === high ? `${low}${join}${unit}` : `${low}–${high}${join}${unit}`;
}

function RangeCell({ check, unit }: { check: RangeCheck; unit: string }) {
  if (check.status === "not-tabulated") {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-tertiary">
        <Minus className="size-3.5" aria-hidden="true" />
        Not tabulated
      </span>
    );
  }
  const inside = check.status === "inside";
  return (
    <span className="inline-flex items-start gap-1.5">
      {inside ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-status-nominal" aria-hidden="true" />
      ) : (
        <X className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden="true" />
      )}
      <span>
        <span className={inside ? "text-foreground" : "text-status-warning"}>{inside ? "Inside" : check.status === "below" ? "Below" : "Above"}</span>
        <span className="numeric block text-[12px] text-text-tertiary">tested {rangeText(check, unit)}</span>
      </span>
    </span>
  );
}

const STATUS_TONE: Record<EvidenceMatchStatus, string> = {
  "matching-run": "border-status-nominal/50 text-status-nominal",
  "within-ranges": "border-status-info/50 text-status-info",
  insufficient: "border-dashed border-border text-muted-foreground",
  outside: "border-status-warning/50 text-status-warning",
};

/** One of the four evidence statuses, as a quiet chip. */
export function EvidenceMatchTag({ status, className }: { status: EvidenceMatchStatus; className?: string }) {
  return (
    <span
      title={EVIDENCE_MATCH_HINT[status]}
      className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-[12px] leading-4 whitespace-nowrap", STATUS_TONE[status], className)}
    >
      {EVIDENCE_MATCH_LABEL[status]}
    </span>
  );
}

function CabinComparison() {
  const scenario = useMissionStore((state) => state.scenario);
  const simMaterial = useFireSimStore((state) => state.config.materialId);
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const fireMaterialId = chosen === undefined ? simMaterial : chosen;
  const fireMaterial = fireMaterialId ? FIRE_MATERIALS.find((item) => item.id === fireMaterialId) ?? null : null;
  const specimen: CabinSpecimen | undefined = fireMaterial
    ? { materialId: materialForFireMaterial(fireMaterial.id)?.id ?? null, geometry: fireMaterial.form }
    : undefined;
  const cabin = {
    oxygenPct: scenario.oxygenPct,
    pressureKpa: scenario.pressurePsi * KPA_PER_PSI,
    flowCmS: scenario.airflowMs * 100,
    gravityG: scenario.gravityG,
  };
  const rows = matchCabinWithIndex(cabin, specimen);
  const counts = countByStatus(rows.map((row) => row.match));
  const regime = gravityRegimeFor(cabin.gravityG);

  return (
    <Panel
      title="Your cabin against the tested conditions"
      description={
        <>
          The cabin set in the top bar: <span className="numeric text-foreground">{formatOxygen(scenario.oxygenPct)}% O₂</span>,{" "}
          <span className="numeric text-foreground">
            {formatPsi(scenario.pressurePsi)} psi ({cabin.pressureKpa.toFixed(1)} kPa)
          </span>
          , <span className="numeric text-foreground">{cabin.flowCmS.toFixed(1)} cm/s</span>,{" "}
          <span className="numeric text-foreground">{formatGravity(scenario.gravityG)} g</span>. Each row is a record that tabulates at least one
          condition or holds a table of individual runs.
        </>
      }
      flush
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-border-subtle px-5 py-3">
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-[12px] text-muted-foreground sm:max-w-xs">
          Material burning in the cabin
          <select
            className={fieldClass}
            value={fireMaterialId ?? ""}
            onChange={(event) => setChosen(event.target.value || null)}
          >
            <option value="">Not specified</option>
            {FIRE_MATERIALS.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
        </label>
        <p className="min-w-0 max-w-[62ch] flex-1 basis-64 text-[13px] leading-5 text-muted-foreground" role="status">
          {counts["matching-run"] ? (
            <>
              <span className="font-medium text-foreground">
                {counts["matching-run"]} of {rows.length} records hold a tabulated run that matches this cabin.
              </span>{" "}
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">No tabulated run matches this combination.</span> Model results for this cabin are{" "}
              <Term definition={evidenceHint("extrapolated")}>extrapolations</Term>.{" "}
            </>
          )}
          {EVIDENCE_MATCH_ORDER.filter((status) => status !== "matching-run")
            .map((status) => `${counts[status]} ${EVIDENCE_MATCH_LABEL[status].toLowerCase()}`)
            .join(" · ")}
          .
        </p>
      </div>
      <dl className="grid gap-x-6 gap-y-2 border-b border-border-subtle px-5 py-3 text-[12px] leading-4 sm:grid-cols-2">
        {EVIDENCE_MATCH_ORDER.map((status) => (
          <div key={status} className="flex min-w-0 items-start gap-2">
            <dt className="shrink-0">
              <EvidenceMatchTag status={status} />
            </dt>
            <dd className="min-w-0 text-text-tertiary">{EVIDENCE_MATCH_HINT[status]}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className={cn(table.root, "min-w-[760px]")} aria-label="Cabin conditions compared with tested conditions">
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Record and evidence status
              </th>
              <th scope="col" className={table.th}>
                Gravity
              </th>
              <th scope="col" className={table.th}>
                Oxygen
              </th>
              <th scope="col" className={table.th}>
                Pressure
              </th>
              <th scope="col" className={table.th}>
                Airflow
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ record, match }) => {
              const comparison = match.comparison;
              return (
                <tr key={record.id} className={table.tr}>
                  <th scope="row" className={cn(table.td, "w-[34%] min-w-60 font-normal")}>
                    <Link href={ROUTES.investigation(record.id)} className="font-medium text-foreground underline-offset-4 hover:underline">
                      {record.name}
                    </Link>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <EvidenceMatchTag status={match.status} />
                      {match.material ? (
                        <Tag tone={match.material.status === "same" ? "positive" : "neutral"} className={match.material.status === "same" ? "" : "border-dashed"}>
                          {match.material.status === "same" ? "Same material" : match.material.status === "different" ? "Different material" : "Materials not itemized"}
                        </Tag>
                      ) : null}
                      {match.geometry && match.geometry.status !== "same" ? (
                        <Tag className="border-dashed">{match.geometry.status === "different" ? "Different geometry" : "Geometry not stated"}</Tag>
                      ) : null}
                    </span>
                    <ul className="mt-1.5 space-y-1 text-[12px] leading-4 text-muted-foreground">
                      {match.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </th>
                  <td className={table.td}>
                    <span className="inline-flex items-start gap-1.5">
                      {comparison.gravity.tested ? (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-status-nominal" aria-hidden="true" />
                      ) : (
                        <X className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden="true" />
                      )}
                      <span>
                        <span className={comparison.gravity.tested ? "text-foreground" : "text-status-warning"}>
                          {comparison.gravity.tested ? "Tested" : "Not tested"}
                        </span>
                        <span className="block text-[12px] text-text-tertiary">
                          {record.gravity.map((gravity: GravityRegime) => GRAVITY_REGIMES[gravity].label).join("; ")}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={table.td}>
                    <RangeCell check={comparison.oxygen} unit="% O₂" />
                  </td>
                  <td className={table.td}>
                    <RangeCell check={comparison.pressure} unit="kPa" />
                  </td>
                  <td className={table.td}>
                    <RangeCell check={comparison.airflow} unit="cm/s" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 border-t border-border-subtle px-5 py-3">
        <Note>
          {regime
            ? `This cabin is at ${GRAVITY_REGIMES[regime].label.toLowerCase()}.`
            : "This cabin's gravity lies between the indexed regimes."}{" "}
          The per-condition columns check each published range on its own; that alone does not show the combination was tested. The status uses
          the tabulated runs: {RUN_TOLERANCE_TEXT} Material and geometry are reported beside the status and do not change it. Change the
          habitat or the cabin conditions in the top bar to compare another case.
        </Note>
      </div>
    </Panel>
  );
}

/** Where the simulator's output and NASA's flight measurements differ, from the committed model evaluation. */
function ModelGaps() {
  const growth = EVALUATION_SNAPSHOT.thickGrowth;
  const check = (id: string) => EVALUATION_SNAPSHOT.independent.find((item) => item.id === id);
  const smoke = check("VI-3 smoke alarm 2 mg/m³"), pressure = check("IV-1 / VI-2 / VI-3 / VI-4 pressure rise"), temperature = check("IV-1 / VI-2 / VI-3 / VI-4 temperature rise");
  return (
    <Panel
      title="Model notes against Saffire IV–VI"
      description="Quantities from the Saffire IV–VI flights that the model was not fitted to, recorded for future calibration."
      actions={<Cite id="saffire-iv-vi-emission" />}
    >
      <ul className="grid gap-4 md:grid-cols-2">
        <li className="flex flex-col rounded-md border border-border-subtle p-4">
          <p className="text-[12px] leading-4 text-text-tertiary">Thick acrylic · growth of the burning length</p>
          <h3 className="mt-1.5 text-[15px] leading-6 font-medium text-foreground">Linear, non-accelerating growth in flight and in the model</h3>
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
            Flight flames on flat acrylic grew linearly at 0.22–0.38 mm/s and the one-sided samples levelled off. The model&apos;s burning length also grows without accelerating
            (second-half rate ÷ first-half rate {growth.map((g) => `${g.accelerationRatio.toFixed(2)} for ${g.id}`).join(", ")}), at{" "}
            {growth.map((g) => `${g.modelRateMmS.toFixed(2)} mm/s for ${g.id}`).join(" and ")} against {growth.map((g) => `${g.measuredGrowthMmS.toFixed(2)} mm/s`).join(" and ")} measured.
            The model tracks the length of burning surface and NASA the visible flame, and the model growth rate is fitted to heat release rather than to flame length.
            The modeled burning length keeps growing until it reaches the end of the 180 mm sample, {growth.map((g) => g.reachesSampleEndS === null ? "never" : `${g.reachesSampleEndS.toFixed(0)} s`).join(" and ")} after ignition,
            with no earlier plateau; the measured flames peaked at {growth.map((g) => `${g.measuredMaxFlameLengthMm} mm`).join(" and ")}.
          </p>
        </li>
        {smoke ? (
          <li className="flex flex-col rounded-md border border-border-subtle p-4">
            <p className="text-[12px] leading-4 text-text-tertiary">Smoke detection time · VI-3</p>
            <h3 className="mt-1.5 text-[15px] leading-6 font-medium text-foreground">Far-field smoke arrival</h3>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
              The <Term definition={TERM_DEFINITIONS.farField}>far-field detector</Term> reached 2 mg/m³ {smoke.measured} s after ignition; the model reaches it at {smoke.model} s. The soot yield is a handbook value not yet fitted to
              a flight test, so modeled detection times are earlier than measured.
            </p>
          </li>
        ) : null}
        {pressure && temperature ? (
          <li className="flex flex-col rounded-md border border-border-subtle p-4 md:col-span-2">
            <p className="text-[12px] leading-4 text-text-tertiary">Cabin pressure and temperature · IV-1, VI-2, VI-3, VI-4</p>
            <h3 className="mt-1.5 text-[15px] leading-6 font-medium text-foreground">Cabin-wide pressure and temperature response</h3>
            <p className="mt-2 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
              Measured pressure rise {pressure.measured} mbar against {pressure.model} mbar modeled; far-field temperature rise {temperature.measured} K against {temperature.model} K modeled
              (tests in that order). The flight cabin held cargo bags and trash that may absorb heat; the model&apos;s only heat sink is an assumed lumped wall, and the flight temperature is a point reading beside the air intake.
            </p>
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

function OpenQuestions() {
  const open = OPEN_QUESTIONS.filter((item) => isCellEmpty(item.topic, "lunar") || isCellEmpty(item.topic, "mars"));
  return (
    <Panel
      title="Open questions"
      description="Each follows from an empty cell above. They are stated as questions with what would answer them; no priority is assigned."
    >
      <ol className="grid gap-4 md:grid-cols-2">
        {open.map((item) => (
          <li key={item.topic} className="flex flex-col rounded-md border border-border-subtle p-4">
            <p className="text-[12px] leading-4 text-text-tertiary">{TOPICS[item.topic].label} · lunar and Martian gravity</p>
            <h3 className="mt-1.5 text-[15px] leading-6 font-medium text-foreground">{item.question}</h3>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
              <span className="text-foreground">What would answer it. </span>
              {item.missing}
            </p>
            {item.recordId ? (
              <p className="mt-auto pt-3 text-[13px] leading-5 text-muted-foreground">
                {item.recordNote} <TextLink href={ROUTES.investigation(item.recordId)}>Related record</TextLink>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <Note className="mt-5">
        Material flammability is the one area with partial-gravity tests, and only for seconds at a time: 24 s and 33 s per parabola
        for wires, 5 s in drop towers and about 25 s in aircraft for materials.{" "}
        <TextLink href={ROUTES.investigation("lunar-martian-flammability")}>Flammability at lunar and Martian gravity</TextLink>
      </Note>
    </Panel>
  );
}
