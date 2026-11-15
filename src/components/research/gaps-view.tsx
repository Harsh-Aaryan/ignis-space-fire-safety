"use client";

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { Note, Panel, Tag, TextLink, table } from "@/components/design/kit";
import { GRAVITY_REGIMES, TOPICS, type GravityRegime, type Topic } from "@/data/research/investigations";
import { formatGravity, formatOxygen, formatPsi } from "@/lib/format";
import { KPA_PER_PSI } from "@/lib/physics/atmosphere";
import { GRAVITY_ORDER, coverageMatrix, isCellEmpty } from "@/lib/research/coverage";
import { compareCabinWithIndex, gravityRegimeFor, type RangeCheck } from "@/lib/research/envelope";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
                            <Link href={ROUTES.investigation(record.id)} className="text-ember-text underline-offset-4 hover:underline">
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

function CabinComparison() {
  const scenario = useMissionStore((state) => state.scenario);
  const cabin = {
    oxygenPct: scenario.oxygenPct,
    pressureKpa: scenario.pressurePsi * KPA_PER_PSI,
    flowCmS: scenario.airflowMs * 100,
    gravityG: scenario.gravityG,
  };
  const comparisons = compareCabinWithIndex(cabin);
  const regime = gravityRegimeFor(cabin.gravityG);
  const matching = comparisons.filter((item) => item.comparison.outside.length === 0);

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
          <span className="numeric text-foreground">{formatGravity(scenario.gravityG)} g</span>. Each row is a record that tabulates
          at least one range.
        </>
      }
      flush
    >
      <p className="border-b border-border-subtle px-5 py-3 text-sm leading-6" role="status">
        {matching.length ? (
          <>
            <span className="font-medium text-foreground">
              {matching.length} of {comparisons.length} records tested conditions that include this cabin
            </span>{" "}
            in every dimension they tabulate.
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">No indexed record tested this combination.</span> Every record below
            differs from this cabin in at least one dimension, so model results for it are extrapolations.
          </>
        )}
      </p>
      <div className="overflow-x-auto">
        <table className={cn(table.root, "min-w-[760px]")} aria-label="Cabin conditions compared with tested conditions">
          <thead className={table.head}>
            <tr>
              <th scope="col" className={table.th}>
                Record
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
            {comparisons.map(({ record, comparison }) => (
              <tr key={record.id} className={table.tr}>
                <th scope="row" className={cn(table.td, "min-w-44 font-normal")}>
                  <Link href={ROUTES.investigation(record.id)} className="font-medium text-ember-text underline-offset-4 hover:underline">
                    {record.name}
                  </Link>
                  {comparison.outside.length === 0 ? (
                    <Tag tone="positive" className="ml-2">
                      Includes this cabin
                    </Tag>
                  ) : null}
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
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border-subtle px-5 py-3">
        <Note>
          {regime
            ? `This cabin is at ${GRAVITY_REGIMES[regime].label.toLowerCase()}.`
            : "This cabin's gravity lies between the indexed regimes."}{" "}
          Change the habitat or the cabin conditions in the top bar to compare another case. No score is computed: a record either
          tested a condition or it did not.
        </Note>
      </div>
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
