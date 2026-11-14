import Link from "next/link";
import { sourceById, type Cited } from "@/data/fire/sources";

const TONE = {
  nasa: "border-[#4E6E6A] text-[#A9D2CA]",
  "peer-reviewed": "border-[#4E6E6A] text-[#A9D2CA]",
  handbook: "border-[#5A5F66] text-[#B9BDC2]",
  assumption: "border-[#7A6537] text-[#E0C27A] border-dashed",
} as const;

const KIND_LABEL = {
  nasa: "NASA",
  "peer-reviewed": "Paper",
  handbook: "Handbook",
  assumption: "Assumed",
} as const;

/** A small provenance chip. NASA and journal sources open the record; the rest open the source list. */
export function Cite({ id, compact = false }: { id: string; compact?: boolean }) {
  const source = sourceById(id);
  const label = compact ? KIND_LABEL[source.kind] : source.short;
  const className = `inline-flex items-center border px-1 py-px align-baseline font-cond text-[11px] leading-3 tracking-[0.06em] uppercase hover:bg-[#30373C] ${TONE[source.kind]}`;
  if (source.url) {
    return (
      <a href={source.url} target="_blank" rel="noreferrer" title={`${source.title} (${source.year ?? "n.d."})`} className={className}>
        {label} ↗
      </a>
    );
  }
  return (
    <Link href={`/materials#source-${source.id}`} title={source.title} className={className}>
      {label}
    </Link>
  );
}

/** A value with its unit and provenance chip. */
export function CitedValue({
  cited,
  unit = "",
  digits,
}: {
  cited: Cited<number | null>;
  unit?: string;
  digits?: number;
}) {
  const value = cited.value;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-1.5" title={`${cited.note ?? ""} ? ${cited.locator ?? ""} ? ${cited.uncertainty ?? ""}`}>
      <span className="numeric">
        {value === null ? "—" : digits === undefined ? value : value.toFixed(digits)}
        {unit ? ` ${unit}` : ""}
      </span>
      <span className="text-[11px] text-muted-foreground">{cited.evidence ?? "unclassified"}</span><Cite id={cited.source} compact />
    </span>
  );
}
