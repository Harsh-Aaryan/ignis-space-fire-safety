import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EvidenceTag, type EvidenceClass } from "@/components/design/kit";
import { sourceById, type Cited } from "@/data/fire/sources";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TONE = {
  nasa: "border-status-info/50 text-status-info",
  "peer-reviewed": "border-status-info/50 text-status-info",
  handbook: "border-border text-muted-foreground",
  assumption: "border-dashed border-border text-muted-foreground",
} as const;

const KIND_LABEL = {
  nasa: "NASA",
  "peer-reviewed": "Paper",
  handbook: "Handbook",
  assumption: "Assumed",
} as const;

const chip =
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 align-baseline text-[11px] leading-4 whitespace-nowrap transition-colors hover:bg-elev-3";

/** A source chip. NASA and journal sources open the record; the rest open the source list. */
export function Cite({ id, compact = false }: { id: string; compact?: boolean }) {
  const source = sourceById(id);
  const label = compact ? KIND_LABEL[source.kind] : source.short;
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        title={`${source.title} (${source.year ?? "n.d."})`}
        className={cn(chip, TONE[source.kind])}
      >
        {label}
        <ArrowUpRight className="size-3" aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link href={`${ROUTES.modelingData}?view=sources#source-${source.id}`} title={source.title} className={cn(chip, TONE[source.kind])}>
      {label}
    </Link>
  );
}

/** Maps a parameter's recorded evidence to the five classes used across the site. */
export function evidenceClass(cited: Pick<Cited<unknown>, "evidence">): EvidenceClass {
  return cited.evidence ?? "assumed";
}

/** A value with its unit, where it comes from, and its source chip. */
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
  const detail = [cited.note, cited.locator, cited.uncertainty].filter(Boolean).join(" · ");
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5" title={detail}>
      <span className="numeric text-foreground">
        {value === null ? "–" : digits === undefined ? value : value.toFixed(digits)}
        {unit ? ` ${unit}` : ""}
      </span>
      <EvidenceTag kind={evidenceClass(cited)} />
      <Cite id={cited.source} compact />
    </span>
  );
}
