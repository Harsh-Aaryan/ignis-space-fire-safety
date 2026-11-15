"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check, Plus, X } from "lucide-react";
import { actionClass } from "@/components/design/kit";
import { investigationById } from "@/data/research/investigations";
import { ROUTES, researchCompareHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { MAX_COMPARE, useResearchBriefStore } from "@/stores/research-brief-store";

const subscribeToHydration = () => () => {};

/** False during server render and hydration, true after: the selection lives in this browser only. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

/** The investigations picked for comparison, once the browser's saved selection is available. */
export function useSelectedIds(): string[] {
  const hydrated = useHydrated();
  const ids = useResearchBriefStore((state) => state.selectedIds);
  return hydrated ? ids : [];
}

/** Adds a record to, or removes it from, the comparison. At most three. */
export function CompareToggle({ id, name, className }: { id: string; name: string; className?: string }) {
  const selected = useSelectedIds();
  const toggle = useResearchBriefStore((state) => state.toggleSelected);
  const included = selected.includes(id);
  const full = !included && selected.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      aria-pressed={included}
      disabled={full}
      title={full ? `Up to ${MAX_COMPARE} investigations can be compared. Remove one first.` : undefined}
      onClick={() => toggle(id)}
      aria-label={`${included ? "Remove" : "Add"} ${name} ${included ? "from" : "to"} comparison`}
      className={cn(
        "no-print inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        included ? "border-primary/60 bg-elev-3 text-foreground" : "border-border text-muted-foreground hover:bg-elev-3 hover:text-foreground",
        className,
      )}
    >
      {included ? <Check className="size-4 text-ember-text" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      {included ? "In comparison" : "Add to comparison"}
    </button>
  );
}

/** A compact bar listing the picked investigations, with the way to compare them and build the brief. */
export function CompareTray({ className }: { className?: string }) {
  const selected = useSelectedIds();
  const toggle = useResearchBriefStore((state) => state.toggleSelected);
  const clear = useResearchBriefStore((state) => state.clearSelected);
  if (!selected.length) return null;
  return (
    <aside
      aria-label="Comparison"
      className={cn(
        "no-print sticky bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-30 rounded-lg border border-border bg-elev-2 p-3 shadow-lg md:bottom-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-muted-foreground">
          <span className="text-foreground">{selected.length}</span> of {MAX_COMPARE} picked
        </p>
        <ul className="flex min-w-0 flex-1 basis-full flex-wrap gap-1.5 sm:basis-auto">
          {selected.map((id) => {
            const name = investigationById(id)?.name ?? id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${name} from comparison`}
                  className="inline-flex min-h-8 max-w-[14rem] items-center gap-1 rounded-sm border border-border-subtle px-2 text-[12px] text-foreground hover:bg-elev-3"
                >
                  <span className="truncate">{name}</span>
                  <X className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {selected.length < 2 ? (
            <button type="button" disabled className={cn(actionClass("primary"), "min-h-10")}>
              Compare
            </button>
          ) : (
            <Link href={researchCompareHref(selected)} className={cn(actionClass("primary"), "min-h-10")}>
              Compare
            </Link>
          )}
          <Link href={ROUTES.results} className={cn(actionClass("secondary"), "min-h-10")}>
            Evidence brief
          </Link>
          <button type="button" onClick={clear} className={cn(actionClass("secondary"), "min-h-10")}>
            Clear
          </button>
        </div>
      </div>
      {selected.length < 2 ? <p className="mt-2 text-[12px] text-text-tertiary">Pick one more investigation to compare.</p> : null}
    </aside>
  );
}
