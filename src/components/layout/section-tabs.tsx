"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The app has four working stages. Routes that used to be separate sidebar
 * entries are tabs inside the stage they belong to, so their URLs still work.
 */
export const STAGES = [
  {
    id: "research",
    label: "Research",
    blurb: "What NASA has measured",
    href: "/research",
    tabs: [
      { href: "/research", label: "NASA investigations", hint: "Search and rank the studies" },
      { href: "/materials", label: "Materials and measurements", hint: "Properties, limits and extracted NASA data" },
      { href: "/gravity-bridge", label: "Gravity coverage", hint: "Which gravity regimes the evidence reaches" },
      { href: "/firelab", label: "Gaps and briefing", hint: "Open questions and the briefing clerk" },
    ],
  },
  {
    id: "predict",
    label: "Predict",
    blurb: "What the model expects",
    href: "/predict",
    tabs: [],
  },
  {
    id: "simulate",
    label: "FireTwin",
    blurb: "Watch it in the habitat",
    href: "/firetwin",
    tabs: [],
  },
  {
    id: "report",
    label: "Reports",
    blurb: "Save and export",
    href: "/reports",
    tabs: [],
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function stageForPath(pathname: string): StageId | null {
  if (pathname.startsWith("/research") || pathname.startsWith("/materials") || pathname.startsWith("/gravity-bridge") || pathname.startsWith("/firelab")) {
    return "research";
  }
  if (pathname.startsWith("/predict")) return "predict";
  if (pathname.startsWith("/firetwin")) return "simulate";
  if (pathname.startsWith("/reports")) return "report";
  return null;
}

/** Research, Predict, FireTwin, Reports as one visible path, with the current stage's tabs underneath. */
export function SectionTabs({ pathname }: { pathname: string }) {
  const stageId = stageForPath(pathname);
  if (!stageId) return null;
  const stage = STAGES.find((item) => item.id === stageId)!;
  const index = STAGES.findIndex((item) => item.id === stageId);
  return (
    <div className="no-print mb-4">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px]" aria-label="Workflow">
        {STAGES.map((item, position) => (
          <li key={item.id} className="flex items-center gap-1">
            <Link
              href={item.href}
              aria-current={item.id === stageId ? "step" : undefined}
              className={cn(
                "flex items-baseline gap-1.5 border px-2 py-1 font-cond tracking-[0.08em] uppercase",
                item.id === stageId
                  ? "border-[#8D775F] bg-[#2A241C] text-[#F1E8D5]"
                  : position < index
                    ? "border-[#3A3E44] text-[#C9C5BD] hover:bg-[#292C30]"
                    : "border-[#2A2D32] text-muted-foreground hover:bg-[#292C30]",
              )}
            >
              <span className="numeric text-[10px] text-[#B89F7A]">{position + 1}</span>
              {item.label}
              <span className="hidden text-[10px] tracking-normal text-muted-foreground normal-case lg:inline">{item.blurb}</span>
            </Link>
            {position < STAGES.length - 1 ? <span aria-hidden="true" className="text-[#5A5F66]">→</span> : null}
          </li>
        ))}
      </ol>
      {stage.tabs.length ? (
        <nav aria-label={`${stage.label} views`} className="mt-3 flex overflow-x-auto border-b border-[#3A3E44]">
          {stage.tabs.map((tab) => {
            const active = tab.href === "/research" ? pathname === "/research" || pathname.startsWith("/research/") : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.hint}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative shrink-0 px-3 py-2 text-[13px]",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" /> : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
