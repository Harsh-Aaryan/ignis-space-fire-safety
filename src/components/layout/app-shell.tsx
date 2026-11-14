"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  FileText,
  LayoutDashboard,
  Library,
  Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AskIgnisButton, ScenarioAssistant } from "@/components/ai/scenario-assistant";
import { PrototypeBadge, Wordmark } from "@/components/design/marks";
import { ConditionControls } from "@/components/dashboard/controls";
import { HabitatSwitcher } from "@/components/layout/habitat-switcher";
import { SectionTabs, stageForPath } from "@/components/layout/section-tabs";
import { DataDrawer } from "@/components/research/data-drawer";
import { objectById, roomById } from "@/data/habitat-interiors";
import { GATEWAY_SCENE_LABEL } from "@/data/missions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FUEL_LABEL } from "@/lib/labels";
import { formatAir, formatGravity, formatOxygen, formatPsi } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/stores/mission-store";
import { syncFireMission, useFireSimDriver, useFireSimStore } from "@/stores/fire-sim-store";

const NAV = [
  { href: "/", label: "Home", short: "Home", icon: LayoutDashboard },
  { href: "/firetwin", label: "Fire simulation", short: "Simulate", icon: Box },
  { href: "/research", label: "NASA research", short: "Research", icon: Library },
  { href: "/reports", label: "Results", short: "Results", icon: FileText },
];
const MOBILE = NAV;

export function AppShell({ children }: { children: React.ReactNode }) {
  useFireSimDriver();
  useEffect(() => useMissionStore.subscribe(syncFireMission), []);
  const pathname = usePathname();
  const clearSelection = useMissionStore((state) => state.selectEquipment);
  const refreshSaved = useMissionStore((state) => state.refreshSaved);
  const toast = useMissionStore((state) => state.toast);
  const dismiss = useMissionStore((state) => state.dismissToast);
  const fullBleed = pathname === "/firetwin";

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
    <div className="flex h-dvh bg-void text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main
      </a>
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pathname={pathname} />
        <main
          id="main"
          className={cn(
            "min-h-0 flex-1 overflow-auto pb-16 md:pb-0",
            fullBleed ? "flex flex-col overflow-hidden md:p-0" : "p-4 xl:p-6",
          )}
        >
          {!fullBleed ? <><SectionTabs pathname={pathname} /><InteriorResearchContext /></> : null}
          {children}
        </main>
      </div>
      <ScenarioAssistant />
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex h-14 border-t border-[#2A2D32] bg-[#16181C] md:hidden" aria-label="Modules">
        {MOBILE.map((item) => {
          const active = navActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { if (item.href === "/firetwin") useFireSimStore.getState().setOpen(true); }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 font-cond text-[10px] tracking-[0.08em] uppercase",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("h-0.5 w-4", active ? "bg-primary" : "bg-transparent")} />
              <Icon className="size-4" strokeWidth={1.5} />
              {item.short}
            </Link>
          );
        })}
      </nav>
      {toast ? (
        <div role="status" className="no-print fixed right-2 bottom-16 z-50 max-w-sm border border-border bg-popover px-3 py-2 text-[13px] md:bottom-2">
          <div className="flex items-start justify-between gap-3">
            <p>{toast.message}</p>
            <button type="button" className="text-muted-foreground" onClick={dismiss}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="no-print hidden w-[52px] shrink-0 flex-col border-r border-[#2A2D32] bg-[#16181C] md:flex xl:w-[220px]">
      <div className="flex h-12 items-center gap-2 px-4">
        <span className="xl:hidden">
          <Wordmark compact />
        </span>
        <span className="hidden xl:block">
          <Wordmark />
        </span>
      </div>
      <Nav pathname={pathname} />
      <p className="mt-auto hidden px-4 py-4 font-cond text-[10px] tracking-[0.08em] text-[#847F79] uppercase xl:block">
        V3 · interactive interiors + NASA research
      </p>
    </aside>
  );
}

function Nav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Modules" className="flex flex-col gap-0.5 px-2">
      {NAV.map((item) => {
        const active = navActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={cn(
              "relative flex h-10 items-center gap-2.5 rounded px-3 text-[13px] text-muted-foreground hover:bg-[#36383C] hover:text-foreground",
              active && "text-foreground",
            )}
          >
            {active ? <span className="absolute top-2 bottom-2 left-0 w-0.5 bg-primary" /> : null}
            <Icon className="size-4 shrink-0" strokeWidth={1.5} />
            <span className="hidden xl:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function navActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/firetwin" && pathname === "/predict") return true;
  if (href === "/research") return stageForPath(pathname) === "research";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumb(pathname: string, missionId: string): string {
  if (pathname.startsWith("/research/")) return "Research / Dossier";
  if (pathname.startsWith("/materials")) return "Research / Materials and measurements";
  if (pathname.startsWith("/firetwin") && missionId === "gateway-orbit") {
    return "FireTwin / Gateway-inspired  ·  Conceptual";
  }
  if (pathname.startsWith("/firetwin") && missionId === "mars-habitat") {
    return "FireTwin / Mars  ·  Inspired by MARSHA  ·  Conceptual";
  }
  if (pathname.startsWith("/firetwin") && missionId === "lunar-habitat") {
    return "FireTwin / Moon  ·  Inspired by Foster+Partners / ESA  ·  Conceptual";
  }
  if (pathname.startsWith("/firetwin")) return "FireTwin";
  if (pathname.startsWith("/research")) return "Research";
  if (pathname.startsWith("/predict")) return "Predict";
  if (pathname.startsWith("/gravity-bridge")) return "GravityBridge";
  if (pathname.startsWith("/firelab")) return "FireLab";
  if (pathname.startsWith("/reports")) return "Report";
  return "Overview";
}

export function TopBar({ pathname }: { pathname: string }) {
  const scenario = useMissionStore((state) => state.scenario);
  const equipment = useMissionStore((state) => state.selectedEquipment);
  const [open, setOpen] = useState(false);
  const tail =
    pathname.startsWith("/firetwin") && equipment
      ? ` / ${equipment.replaceAll("-", " ")}`
      : "";
  return (
    <header className="no-print flex h-auto min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#2A2D32] bg-[#16181C] px-3 py-1.5 md:h-12 md:flex-nowrap md:px-5 md:py-0">
      <MobileMenu pathname={pathname} open={open} setOpen={setOpen} />
      <p className="hidden max-w-60 truncate font-cond text-[11px] tracking-[0.08em] text-muted-foreground uppercase sm:block">
        {crumb(pathname, scenario.missionId)}
        <span className="text-foreground">{tail}</span>
      </p>
      <div className="order-last w-full md:order-none md:w-auto">
        <HabitatSwitcher />
      </div>
      <Popover>
        <PopoverTrigger
          className="hidden h-7 items-center gap-2 border border-[#2A2D32] bg-card px-2.5 lg:inline-flex"
          aria-label="Edit mission conditions"
        >
          <Strip scenarioName={scenario.name} />
        </PopoverTrigger>
        <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] border border-border bg-popover p-4">
          <p className="micro mb-3 text-[#847F79]">Mission conditions</p>
          <ConditionControls />
        </PopoverContent>
      </Popover>
      <p className="basis-full text-[13px] leading-[18px] text-muted-foreground lg:hidden" aria-live="polite">
        <span className="block">{scenario.missionId === "gateway-orbit" ? GATEWAY_SCENE_LABEL : scenario.name}</span>
        <span className="numeric">
          {formatGravity(scenario.gravityG)} g · {formatOxygen(scenario.oxygenPct)} % O₂ · {formatPsi(scenario.pressurePsi)} psi
        </span>
      </p>
      <div className="ml-auto flex items-center gap-2">
        <AskIgnisButton />
        <DataDrawer />
        <span className="hidden 2xl:inline"><PrototypeBadge researchModel={pathname === "/firetwin" || pathname === "/predict" || pathname === "/materials"} /></span>
      </div>
    </header>
  );
}

function Strip({ scenarioName }: { scenarioName: string }) {
  const scenario = useMissionStore((state) => state.scenario);
  const fuel = FUEL_LABEL[scenario.fuelCategory].split(" ")[0];
  return (
    <span className="flex items-center gap-2">
      <span className="sr-only">{scenarioName}</span>
      <Num value={formatGravity(scenario.gravityG)} unit="g" />
      <Tick />
      <Num value={formatOxygen(scenario.oxygenPct)} unit="% O₂" />
      <Tick />
      <Num value={formatPsi(scenario.pressurePsi)} unit="psi" />
      <Tick />
      <Num value={formatAir(scenario.airflowMs)} unit="m/s" />
      <Tick />
      <span className="font-cond text-[11px] tracking-[0.08em] text-[#847F79] uppercase">{fuel}</span>
    </span>
  );
}

function Num({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="numeric text-[13px] text-foreground">{value}</span>
      <span className="font-cond text-[11px] tracking-[0.06em] text-[#847F79]">{unit}</span>
    </span>
  );
}

function Tick() {
  return <span className="inline-block h-px w-2 bg-border" />;
}

function MobileMenu({
  pathname,
  open,
  setOpen,
}: {
  pathname: string;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" />}
      >
        <Menu strokeWidth={1.5} />
      </SheetTrigger>
      <SheetContent side="left" className="bg-[#16181C]">
        <SheetHeader>
          <SheetTitle>
            <Wordmark />
          </SheetTitle>
        </SheetHeader>
        <div onClick={() => setOpen(false)}>
          <Nav pathname={pathname} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
function InteriorResearchContext() {
  const objectId = useMissionStore(s => s.selectedObjectId);
  const roomId = useMissionStore(s => s.selectedRoomId);
  const object = objectById(objectId); const room = roomById(roomId);
  if (!room) return null;
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border border-[#475455] bg-[#252F31] px-3 py-2 text-[12px]"><span>FireTwin context · {room.name}{object ? " / " + object.label : ""} · shared cabin conditions</span><Link href="/firetwin" className="text-[#D8B58D] underline">Return to selected equipment</Link></div>;
}
