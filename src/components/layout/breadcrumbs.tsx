"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { investigationById } from "@/data/research/investigations";
import { RESEARCH_TABS, ROUTES, breadcrumbsForPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const RESEARCH_PAGES = new Set<string>(RESEARCH_TABS.map((tab) => tab.href));

/** The investigation title for a record page, or nothing for any other path. */
function recordTitle(pathname: string): string | undefined {
  const prefix = `${ROUTES.research}/`;
  if (!pathname.startsWith(prefix) || RESEARCH_PAGES.has(pathname)) return undefined;
  const segment = pathname.slice(prefix.length).split("/")[0] ?? "";
  try {
    const id = decodeURIComponent(segment);
    return id ? investigationById(id)?.name : undefined;
  } catch {
    return undefined;
  }
}

export function Breadcrumbs({ pathname, className }: { pathname: string; className?: string }) {
  const crumbs = breadcrumbsForPath(pathname, recordTitle(pathname));
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-[15px] leading-5">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          // Below 1280px the top bar also holds the habitat switcher and cabin chip, so a long
          // trail keeps only its first and last crumbs; the page's own back link covers the middle.
          const middle = index > 0 && !last;
          return (
            <li
              key={`${crumb.label}-${index}`}
              className={cn("items-center gap-1.5", last ? "flex min-w-0" : "shrink-0", !last && (middle ? "hidden xl:flex" : "flex"))}
            >
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> : null}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="rounded-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" title={crumb.label} className="truncate font-medium text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
