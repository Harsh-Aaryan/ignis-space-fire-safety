import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CREW_ENVIRONMENTS, type CrewEnvironment, type InvestigationRecord } from "@/data/research/investigations";
import { CompareToggle } from "@/components/research/compare-tray";
import { BasisTag, GravityChips, KindTag, holdingSummary } from "@/components/research/record-meta";
import { environmentLink } from "@/lib/research/filter";
import { EVIDENCE_GRADE_HINT, evidenceQuality, type EvidenceQuality, type RankReason, type RankedRecord } from "@/lib/research/rank";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const EVIDENCE_DOT: Record<EvidenceQuality["grade"], string> = {
  "measured-table": "bg-status-nominal",
  "flight-summary": "bg-status-info",
  "ground-summary": "bg-status-caution",
  "citation-only": "bg-text-tertiary",
  standard: "bg-border",
};

/** What IGNIS holds for a record. Shown on every card, separate from relevance. */
export function EvidenceQualityTag({ evidence, className }: { evidence: EvidenceQuality; className?: string }) {
  return (
    <span
      title={`${EVIDENCE_GRADE_HINT[evidence.grade]} ${evidence.basis.join(" ")}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border border-border-subtle px-2 py-0.5 text-[12px] leading-4 whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", EVIDENCE_DOT[evidence.grade])} aria-hidden="true" />
      <span className="sr-only">Evidence quality: </span>
      {evidence.label}
    </span>
  );
}

/** "+30", "−5", "±0". */
export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "±0";
}

/** The environment note is shown in its own line on the card, so the reason keeps only its first clause. */
function reasonText(reason: RankReason, environmentShown: boolean): string {
  if (reason.factor === "environment" && environmentShown) return reason.detail.split(":")[0] + ".";
  return reason.detail;
}

/** The two or three reasons that moved a record most, with their points. */
export function WhyItRanks({ ranked, environmentShown, limit = 3 }: { ranked: RankedRecord; environmentShown: boolean; limit?: number }) {
  const shown = ranked.reasons.slice(0, limit);
  const rest = ranked.reasons.length - shown.length;
  return (
    <div className="rounded-md border border-border-subtle bg-background/40 px-3 py-2">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-[12px] leading-4 text-text-tertiary">
        <span>Why it ranks here</span>
        <span className="numeric">
          Relevance <span className="text-foreground">{formatPoints(ranked.relevance)}</span>
        </span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {shown.map((reason, index) => (
          <li key={`${reason.factor}-${index}`} className="flex gap-2 text-[13px] leading-5">
            <span
              className={cn(
                "numeric w-9 shrink-0 text-right",
                reason.points > 0 ? "text-status-nominal" : reason.points < 0 ? "text-status-warning" : "text-text-tertiary",
              )}
            >
              {formatPoints(reason.points)}
            </span>
            <span className="min-w-0 text-muted-foreground">{reasonText(reason, environmentShown)}</span>
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[12px] text-text-tertiary hover:text-foreground">
            {rest} more reason{rest > 1 ? "s" : ""}
          </summary>
          <ul className="mt-1 space-y-1">
            {ranked.reasons.slice(limit).map((reason, index) => (
              <li key={`more-${reason.factor}-${index}`} className="flex gap-2 text-[13px] leading-5">
                <span className={cn("numeric w-9 shrink-0 text-right", reason.points > 0 ? "text-status-nominal" : reason.points < 0 ? "text-status-warning" : "text-text-tertiary")}>
                  {formatPoints(reason.points)}
                </span>
                <span className="min-w-0 text-muted-foreground">{reasonText(reason, environmentShown)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * One record in the research index. With an environment chosen it says on what basis the record bears
 * on it; when the index is ranked it shows the record's position and why. Evidence quality is always
 * shown, apart from relevance.
 */
export function InvestigationCard({
  record,
  environment,
  ranked = null,
  muted = false,
}: {
  record: InvestigationRecord;
  environment: CrewEnvironment | null;
  ranked?: RankedRecord | null;
  /** Less related: shorter, quieter card. */
  muted?: boolean;
}) {
  const link = environment ? environmentLink(record, environment) : null;
  const held = holdingSummary(record);
  const evidence = ranked?.evidence ?? evidenceQuality(record);

  return (
    <article
      className={cn(
        "rounded-lg border border-border-subtle bg-card p-4 transition-colors hover:border-border focus-within:border-ring md:p-5",
        muted && "bg-card/60",
      )}
    >
      <div className="flex items-start gap-3">
        {ranked ? (
          <span
            className={cn(
              "numeric mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-[13px]",
              muted ? "border-border-subtle text-text-tertiary" : "border-border text-foreground",
            )}
          >
            <span className="sr-only">Rank </span>
            {ranked.position}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[16px] leading-6 font-medium text-foreground">
                <Link href={ROUTES.investigation(record.id)} className={cn("underline-offset-4 hover:underline", muted && "text-muted-foreground")}>
                  {record.name}
                </Link>
                <KindTag record={record} />
                <EvidenceQualityTag evidence={evidence} />
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-text-tertiary">
                {record.platform} · {record.period}
              </p>
            </div>
          </div>

          {muted ? null : <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">{record.summary}</p>}

          {environment ? (
            <p className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-md bg-elev-2 px-3 py-2 text-[13px] leading-5">
              <BasisTag basis={link?.basis ?? null} />
              <span className="min-w-0 flex-1 basis-60 text-muted-foreground">
                <span className="text-foreground">{CREW_ENVIRONMENTS[environment].label}. </span>
                {link ? link.note : "This record does not address this environment."}
              </span>
            </p>
          ) : null}

          {ranked && ranked.reasons.length ? (
            <div className="mt-3">
              <WhyItRanks ranked={ranked} environmentShown={Boolean(environment)} limit={muted ? 2 : 3} />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
              <GravityChips record={record} />
              <p className="text-[13px] leading-5 text-muted-foreground">
                <span className="text-text-tertiary">Held here: </span>
                {held.join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompareToggle id={record.id} name={record.name} />
              <Link
                href={ROUTES.investigation(record.id)}
                className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-[13px] text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
                aria-label={`Open the ${record.name} record`}
              >
                Open record
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
