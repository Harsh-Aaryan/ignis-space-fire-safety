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
      { href: "/firelab", label: "Coverage gaps", hint: "Open questions and the briefing clerk" },
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

  return (
    <div className="no-print mb-4">
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
