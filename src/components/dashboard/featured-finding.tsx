"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExternalLink, Tag, TextLink } from "@/components/design/kit";
import { IMPLICATION_LABEL, featuredFindings, primaryLinks } from "@/data/research/featured-findings";
import { KIND_LABEL } from "@/data/research/investigations";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ITEMS = featuredFindings();

const PAGER =
  "inline-flex size-10 items-center justify-center rounded-md border border-border-subtle text-muted-foreground transition-colors hover:border-border hover:bg-elev-3 hover:text-foreground md:size-9";

/**
 * One finding from the research index with what it means and where it comes
 * from. The text is the record's own; the source links are its NASA records.
 */
export function FeaturedFinding({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const item = ITEMS[index];
  if (!item) return null;
  const { record, finding, implication, source, links, ref } = item;
  const step = (delta: number) => setIndex((current) => (current + delta + ITEMS.length) % ITEMS.length);

  return (
    <section aria-labelledby="featured-finding-heading" className={cn("rounded-lg border border-border-subtle bg-card p-4 md:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="featured-finding-heading" className="micro text-muted-foreground">
          Featured finding
        </h2>
        {ITEMS.length > 1 ? (
          <div role="group" aria-label="Featured findings" className="flex items-center gap-1.5">
            <span className="numeric mr-1 text-[12px] leading-4 text-text-tertiary">
              {index + 1} of {ITEMS.length}
            </span>
            <button type="button" onClick={() => step(-1)} aria-label="Previous finding" className={PAGER}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next finding" className={PAGER}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div aria-live="polite" data-testid="featured-finding" data-record={record.id}>
        <p className="mt-3 text-[15px] leading-[22px] text-foreground md:text-[17px] md:leading-[26px]">{finding.text}</p>
        <p className="mt-2.5 text-[13px] leading-5 text-muted-foreground md:mt-3 md:text-[14px] md:leading-[22px]">
          <span className="font-medium text-foreground">{IMPLICATION_LABEL[ref.implication.field]}. </span>
          {implication}
        </p>
      </div>

      <div className="mt-3 border-t border-border-subtle pt-3 md:mt-4">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5">
          <span className="text-text-tertiary">Source</span>
          <TextLink href={ROUTES.investigation(record.id)} className="font-medium">
            {record.name}
          </TextLink>
          {primaryLinks(links).map((link) => (
            <ExternalLink key={link.href} href={link.href} className="numeric text-[12px]">
              {link.label}
            </ExternalLink>
          ))}
          <Tag className="hidden sm:inline-flex">{KIND_LABEL[record.kind]}</Tag>
        </p>
        {source ? (
          <p className="mt-1.5 hidden text-[12px] leading-4 text-text-tertiary sm:block">
            {source.title}. {source.venue}
            {source.year ? `, ${source.year}` : ""}.
          </p>
        ) : null}
      </div>
    </section>
  );
}
