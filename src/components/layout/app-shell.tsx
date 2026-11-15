"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Box, FileText, LayoutGrid, Library, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { AskIgnisButton, ScenarioAssistant } from "@/components/ai/scenario-assistant";
import { ConditionControls } from "@/components/dashboard/controls";
import { Wordmark } from "@/components/design/marks";
import { HabitatSwitcher } from "@/components/layout/habitat-switcher";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatGravity, formatNumber, formatOxygen, formatPsi } from "@/lib/format";
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

function sectionLabel(pathname: string): string {
  const href = SECTION_HREF[sectionForPath(pathname)];
  return PRIMARY_NAV.find((item) => item.href === href)?.label ?? "Overview";
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
        <main
          id="main"
          className={cn(
            "min-h-0 flex-1 pb-20 md:pb-0",
            fullBleed ? "flex flex-col overflow-hidden" : "overflow-y-auto overflow-x-hidden",
          )}
        >
          {fullBleed ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8 xl:px-10">{children}</div>
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

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <div className="no-print hidden w-16 shrink-0 flex-col border-r border-border-subtle bg-elev-1 md:flex xl:w-60">
      <Link
        href={ROUTES.overview}
        className="flex h-16 shrink-0 items-center gap-3 px-6 xl:px-5"
      >
        <Wordmark compact />
        <span className="sr-only xl:not-sr-only">
          <span className="block text-[16px] leading-5 font-medium tracking-[0.04em] text-foreground">IGNIS</span>
          <span className="hidden text-[12px] leading-4 text-muted-foreground xl:block">Spacecraft fire safety research</span>
        </span>
      </Link>
      <nav aria-label="Sections" className="mt-2 flex flex-col gap-1 px-2 xl:px-3">
        {PRIMARY_NAV.map((item) => {
          const active = isSectionActive(pathname, item.href);
          const Icon = ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate(item.href)}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "relative flex h-9 items-center justify-center gap-3 rounded-md px-3 text-sm transition-colors xl:justify-start",
                active ? "bg-elev-3 text-foreground" : "text-muted-foreground hover:bg-elev-2 hover:text-foreground",
              )}
            >
              {active ? <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
              <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only xl:not-sr-only">{item.label}</span>
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TopBar({ pathname }: { pathname: string }) {
  return (
    <header className="no-print flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle bg-elev-1 px-4 py-2 md:min-h-16 md:px-6 md:py-3">
      <Link href={ROUTES.overview} className="order-1 flex min-h-11 items-center gap-3 md:hidden">
        <Wordmark compact />
        <span className="text-[16px] font-medium tracking-[0.04em]">IGNIS</span>
      </Link>
      <p className="order-1 hidden min-w-0 truncate text-[15px] font-medium text-foreground md:block">
        {sectionLabel(pathname)}
      </p>
      <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:flex-nowrap lg:order-2 lg:ml-auto lg:w-auto">
        <HabitatSwitcher />
        <CabinConditions />
      </div>
      <div className="order-2 ml-auto flex items-center lg:order-3 lg:ml-0">
        <AskIgnisButton />
      </div>
    </header>
  );
}

function airflowCmS(airflowMs: number): string {
  const cm = Number((airflowMs * 100).toFixed(1));
  return formatNumber(cm, Number.isInteger(cm) ? 0 : 1);
}

function CabinConditions() {
  const scenario = useMissionStore((state) => state.scenario);
  return (
    <Popover>
      <PopoverTrigger className="inline-flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-border-subtle bg-background px-3 py-2 text-[13px] transition-colors hover:border-border hover:bg-elev-2 sm:w-auto md:min-h-9 md:py-1.5">
        <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <span className="sr-only text-muted-foreground sm:not-sr-only">Cabin</span>
        <span className="numeric flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-left text-[12px] leading-5 text-foreground sm:text-[13px]">
          <span className="whitespace-nowrap">{formatOxygen(scenario.oxygenPct)}% O₂</span>{" "}
          <span className="whitespace-nowrap">{formatPsi(scenario.pressurePsi)} psi</span>{" "}
          <span className="whitespace-nowrap">{formatGravity(scenario.gravityG)} g</span>{" "}
          <span className="whitespace-nowrap">{airflowCmS(scenario.airflowMs)} cm/s</span>
        </span>
        <span className="sr-only">, edit</span>
      </PopoverTrigger>
      <PopoverContent className="max-h-[min(80vh,640px)] w-[420px] max-w-[calc(100vw-2rem)] overflow-y-auto border border-border bg-popover p-5">
        <p className="text-[15px] font-medium text-foreground">Cabin conditions</p>
        <p className="mt-1 mb-4 text-[13px] leading-5 text-muted-foreground">
          One set of conditions is shared across IGNIS. Changing it here changes it everywhere.
        </p>
        <ConditionControls />
      </PopoverContent>
    </Popover>
  );
}
