import {
  GRAVITY_REGIMES,
  HOLDING_LABEL,
  KIND_LABEL,
  type EnvironmentLink,
  type InvestigationRecord,
} from "@/data/research/investigations";
import { Tag } from "@/components/design/kit";

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

export function BasisTag({ basis }: { basis: EnvironmentLink["basis"] | null }) {
  if (!basis) return <Tag className="border-dashed">Not addressed</Tag>;
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
