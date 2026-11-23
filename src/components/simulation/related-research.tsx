"use client";

import { useId } from "react";
import Link from "next/link";
import { Tag } from "@/components/design/kit";
import { KIND_LABEL, investigationById, type InvestigationRecord } from "@/data/research/investigations";
import { ROUTES } from "@/lib/routes";

/** The investigations that bear on a piece of equipment, each linking to its research page. */
export function RelatedResearch({ investigations }: { investigations: readonly string[] }) {
  const headingId = useId();
  const records = investigations.map(investigationById).filter((record): record is InvestigationRecord => record !== null);
  if (!records.length) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-[15px] leading-5 font-medium text-foreground">
        Related research
      </h3>
      <ul className="space-y-2">
        {records.map((record) => (
          <li key={record.id}>
            <Link
              href={ROUTES.investigation(record.id)}
              className="block rounded-md border border-border-subtle p-3 transition-colors hover:border-border hover:bg-elev-3"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{record.name}</span>
                <Tag>{KIND_LABEL[record.kind]}</Tag>
              </span>
              <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{record.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
