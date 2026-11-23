import {
  GRAVITY_REGIMES,
  HOLDING_LABEL,
  KIND_LABEL,
  type EnvironmentLink,
  type InvestigationRecord,
} from "@/data/research/investigations";
import { Tag } from "@/components/design/kit";
import { Term } from "@/components/design/term";

/** Small shared pieces for showing a research record. Hook-free: usable on the server and the client. */

export const BASIS_LABEL: Record<EnvironmentLink["basis"], string> = {
  tested: "Tested",
  applies: "Applies",
  transferable: "Transferable",
};

export const BASIS_HINT: Record<EnvironmentLink["basis"], string> = {
  tested: "Conditions of this environment were part of the test.",
  applies: "A standard or system in force in this environment.",
  transferable: "Informs this environment, with the stated caveat.",
};

/** Definitions for <Term>, in wording the site already uses. */
export const TERM_DEFINITIONS = {
  /** From the evidence-quality hints, EVIDENCE_GRADE_HINT in src/lib/research/rank.ts. */
  heldHere: "What IGNIS holds for this record: an original NASA data file, values published in the record's papers, or a citation record and no values.",
  /** From the Saffire IV–VI notes: src/lib/fire/accuracy.ts (Far Field Diagnostics beside the air intake) and saffire-detection.tsx (read next to the cabin air intake). */
  farField: "Saffire's Far Field Diagnostics: point readings taken next to the cabin air intake.",
} as const;

/** `define` turns the label into a defined term: use it at the first appearance of each basis on a page. */
export function BasisTag({ basis, define = false }: { basis: EnvironmentLink["basis"] | null; define?: boolean }) {
  if (!basis) return <Tag className="border-dashed">Not addressed</Tag>;
  if (define) {
    return (
      <Tag tone={basis === "transferable" ? "neutral" : "positive"}>
        <Term definition={BASIS_HINT[basis]}>{BASIS_LABEL[basis]}</Term>
      </Tag>
    );
  }
  return (
    <span title={BASIS_HINT[basis]}>
      <Tag tone={basis === "transferable" ? "neutral" : "positive"}>{BASIS_LABEL[basis]}</Tag>
    </span>
  );
}

export function KindTag({ record }: { record: InvestigationRecord }) {
  return <Tag>{KIND_LABEL[record.kind]}</Tag>;
}

export function GravityChips({ record, label = "Gravity tested" }: { record: InvestigationRecord; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {record.gravity.map((gravity) => (
        <li key={gravity}>
          <Tag>{GRAVITY_REGIMES[gravity].label}</Tag>
        </li>
      ))}
    </ul>
  );
}

/** Distinct holding kinds with their labels, e.g. "NASA experiment table (3)". */
export function holdingSummary(record: InvestigationRecord): string[] {
  const counts = new Map<string, number>();
  for (const holding of record.holdings) counts.set(HOLDING_LABEL[holding.kind], (counts.get(HOLDING_LABEL[holding.kind]) ?? 0) + 1);
  return [...counts.entries()].map(([label, count]) => (count > 1 ? `${label} (${count})` : label));
}

export function formatRange(range: [number, number] | undefined, unit: string): string {
  if (!range) return "Not tabulated";
  const [low, high] = range;
  const join = unit.startsWith("%") ? "" : " ";
  return low === high ? `${low}${join}${unit}` : `${low}–${high}${join}${unit}`;
}
