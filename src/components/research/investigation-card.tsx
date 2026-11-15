import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CREW_ENVIRONMENTS, type CrewEnvironment, type InvestigationRecord } from "@/data/research/investigations";
import { BasisTag, GravityChips, KindTag, holdingSummary } from "@/components/research/record-meta";
import { environmentLink } from "@/lib/research/filter";
import { ROUTES } from "@/lib/routes";

/** One record in the research index. With an environment chosen it also says on what basis the record bears on it. */
export function InvestigationCard({ record, environment }: { record: InvestigationRecord; environment: CrewEnvironment | null }) {
  const link = environment ? environmentLink(record, environment) : null;
  const held = holdingSummary(record);

  return (
    <article className="rounded-md border border-border-subtle bg-card transition-colors hover:border-border">
      <Link href={ROUTES.investigation(record.id)} className="block p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[16px] leading-6 font-medium text-foreground">
              {record.name}
              <KindTag record={record} />
            </h3>
            <p className="mt-0.5 text-[13px] leading-5 text-text-tertiary">
              {record.platform} · {record.period}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] text-ember-text">
            Open record
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">{record.summary}</p>

        {environment ? (
          <p className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-md bg-elev-2 px-3 py-2 text-[13px] leading-5">
            <BasisTag basis={link?.basis ?? null} />
            <span className="min-w-0 flex-1 basis-60 text-muted-foreground">
              <span className="text-foreground">{CREW_ENVIRONMENTS[environment].label}. </span>
              {link ? link.note : "This record does not address this environment."}
            </span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <GravityChips record={record} />
          <p className="text-[13px] leading-5 text-muted-foreground">
            <span className="text-text-tertiary">Held here: </span>
            {held.join(", ")}
          </p>
        </div>
      </Link>
    </article>
  );
}
