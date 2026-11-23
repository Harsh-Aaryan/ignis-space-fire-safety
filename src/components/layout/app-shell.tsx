"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Box, FileText, LayoutGrid, Library, X, type LucideIcon } from "lucide-react";
import { AskIgnisButton, ScenarioAssistant } from "@/components/ai/scenario-assistant";
import { Wordmark } from "@/components/design/marks";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HabitatSwitcher } from "@/components/layout/habitat-switcher";
import { ScenarioChip } from "@/components/layout/scenario-chip";
import { useResearchPickCount } from "@/components/layout/use-research-picks";
import { PRIMARY_NAV, ROUTES, sectionForPath, type SectionId } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { syncFireMission, useFireSimDriver, useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";

const ICONS: Record<string, LucideIcon> = {
  [ROUTES.overview]: LayoutGrid,
  [ROUTES.simulation]: Box,
  [ROUTES.research]: Library,
  [ROUTES.results]: FileText,
};

const SECTION_HREF: Record<SectionId, string> = {
  overview: ROUTES.overview,
  simulation: ROUTES.simulation,
  research: ROUTES.research,
  results: ROUTES.results,
};

const PSI_REPO = "https://psi.nasa.gov/physci/repo/";
const NTRS = "https://ntrs.nasa.gov/";

function isSectionActive(pathname: string, href: string): boolean {
  return SECTION_HREF[sectionForPath(pathname)] === href;
}

/** Opening the Simulation section also opens its scenario panel. */
function onNavigate(href: string) {
  if (href === ROUTES.simulation) useFireSimStore.getState().setOpen(true);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useFireSimDriver();
  useEffect(() => useMissionStore.subscribe(syncFireMission), []);
  const pathname = usePathname();
  const clearSelection = useMissionStore((state) => state.selectEquipment);
  const refreshSaved = useMissionStore((state) => state.refreshSaved);
  const toast = useMissionStore((state) => state.toast);
  const dismiss = useMissionStore((state) => state.dismissToast);
  const fullBleed = pathname === ROUTES.simulation;

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") clearSelection(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pathname={pathname} />
        {/* `relative` makes <main> the containing block for absolutely positioned
            descendants (sr-only labels in particular). Without it they anchor to the
            page, escape this scroll container's clipping and stretch the document,
            which adds a second scrollbar and an empty band under the shell. */}
        <main
          id="main"
          className={cn(
            "relative min-h-0 flex-1 pb-20 md:pb-0",
            fullBleed ? "flex flex-col overflow-hidden" : "overflow-y-auto overflow-x-hidden",
          )}
        >
          {fullBleed ? (
            children
          ) : (
            <div className={pathname === ROUTES.overview ? "w-full" : "mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8 xl:px-10"}>{children}</div>
          )}
        </main>
      </div>
      <ScenarioAssistant />
      <MobileNav pathname={pathname} />
      {toast ? (
        <div
          role="status"
          className="no-print fixed right-3 bottom-[5.5rem] left-3 z-50 rounded-md border border-border bg-popover px-4 py-3 text-sm shadow-lg sm:left-auto sm:max-w-sm md:right-4 md:bottom-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="leading-6">{toast.message}</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-elev-4 hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The research pick count, read out in the link's name and shown as a quiet figure. */
function PickCount({ href, className }: { href: string; className?: string }) {
  const picks = useResearchPickCount();
  if (href !== ROUTES.research || picks === 0) return null;
  return (
    <>
      <span className={cn("numeric text-[11px] leading-4 text-text-tertiary", className)} aria-hidden="true">
        {picks}
      </span>
      <span className="sr-only">, {picks} picked</span>
    </>
  );
}

/**
 * Narrow rail with a small label under each icon from md, full labels from lg.
 * The rail is 72px so the longest label ("Simulation") fits at 11px.
 */
function Sidebar({ pathname }: { pathname: string }) {
  return (
    <div className="no-print hidden w-[72px] shrink-0 flex-col border-r border-border-subtle bg-elev-1 md:flex xl:w-60">
      <Link
        href={ROUTES.overview}
        className="flex h-16 shrink-0 items-center justify-center gap-3 px-3 xl:justify-start xl:px-5"
      >
        <Wordmark compact />
        <span className="sr-only xl:not-sr-only">
          <span className="block text-[16px] leading-5 font-medium tracking-[0.04em] text-foreground">IGNIS</span>
          <span className="hidden text-[12px] leading-4 text-muted-foreground xl:block">Spacecraft fire safety research</span>
        </span>
      </Link>
      <nav aria-label="Sections" className="mt-2 flex flex-col gap-1 px-1 xl:px-3">
        {PRIMARY_NAV.map((item) => {
          const active = isSectionActive(pathname, item.href);
          const Icon = ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-0 py-2 text-center text-[11px] leading-4 whitespace-nowrap transition-colors",
                "xl:h-9 xl:min-h-0 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:py-0 xl:text-sm",
                active ? "bg-elev-3 text-foreground" : "text-muted-foreground hover:bg-elev-2 hover:text-foreground",
              )}
            >
              {active ? <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
              <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{item.label}</span>
              <PickCount href={item.href} className="absolute top-1.5 right-2 xl:static xl:ml-auto xl:text-[12px]" />
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto hidden border-t border-border-subtle px-5 py-4 text-[12px] leading-5 text-text-tertiary xl:block">
        Data:{" "}
        <a href={PSI_REPO} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
          NASA PSI
        </a>{" "}
        ·{" "}
        <a href={NTRS} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
          NTRS
        </a>
      </p>
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Sections"
      className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-border-subtle bg-elev-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {PRIMARY_NAV.map((item) => {
        const active = isSectionActive(pathname, item.href);
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate(item.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[12px] leading-4",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {active ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
            <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex items-baseline gap-1">
              {item.label}
              <PickCount href={item.href} />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * One row at every width. Phones: the mark, the scenario chip and an icon-only Ask IGNIS,
 * within 56px. From md: the breadcrumb trail, then the scenario chip and Ask IGNIS; when
 * space runs short the chip's trailing readouts truncate first, then the last crumb.
 */
function TopBar({ pathname }: { pathname: string }) {
  return (
    // Phone: logo, cabin chip and Ask IGNIS on one row, the habitat switcher full width below.
    // Tablet: the breadcrumb takes the logo's place. Desktop: everything on one row.
    <header className="no-print flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-border-subtle bg-elev-1 px-4 py-2 md:min-h-16 md:gap-x-4 md:px-6 lg:flex-nowrap">
      <Link href={ROUTES.overview} className="order-1 flex min-h-11 shrink-0 items-center gap-2.5 md:hidden">
        <Wordmark compact />
        <span className="text-[16px] font-medium tracking-[0.04em] max-[359px]:sr-only">IGNIS</span>
      </Link>
      <Breadcrumbs pathname={pathname} className="order-1 hidden min-w-0 flex-1 md:block lg:max-w-[40%] lg:flex-initial" />
      <div className="order-4 w-full lg:order-2 lg:ml-auto lg:w-auto lg:shrink-0">
        <HabitatSwitcher />
      </div>
      <ScenarioChip className="order-2 flex-1 md:flex-initial lg:order-3" />
      <div className="order-3 shrink-0 lg:order-4">
        <AskIgnisButton compact />
      </div>
    </header>
  );
}
