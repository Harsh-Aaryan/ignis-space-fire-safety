"use client";

import { RouteTabs } from "@/components/design/route-tabs";
import { SIMULATION_TABS } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { EquipmentPanel } from "./equipment-panel";
import { HabitatMount, Schematic } from "./habitat-mount";
import { ScenarioPanel } from "./scenario-panel";
import { TelemetryStrip } from "./telemetry-strip";
import { ViewToolbar, ViewportFootnote } from "./view-toolbar";

const PANEL_TABS = [
  { scenario: true, label: "Fire scenario" },
  { scenario: false, label: "Equipment" },
] as const;

/** The habitat in 3D with a fire scenario beside it. */
export function SimulationView() {
  const selectedEquipment = useMissionStore((state) => state.selectedEquipment);
  const selectEquipment = useMissionStore((state) => state.selectEquipment);
  const scenarioOpen = useFireSimStore((store) => store.open);
  const status = useFireSimStore((store) => store.status);

  function showPanel(scenario: boolean) {
    if (scenario === scenarioOpen) return;
    useFireSimStore.getState().setOpen(scenario);
    // A fire needs an interior to burn in.
    const mission = useMissionStore.getState();
    if (scenario && !mission.selectedRoomId) mission.navigate("interior");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RouteTabs tabs={SIMULATION_TABS} label="Simulation views" className="shrink-0 bg-elev-1 px-2 md:px-4" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:overflow-hidden">
        <div className="flex min-h-0 shrink-0 flex-col xl:shrink">
          <div data-testid="habitat-viewport" className="relative min-h-[56dvh] w-full flex-1 bg-black xl:min-h-0">
            <div className="absolute inset-0">
              <HabitatMount fallback={<Schematic onSelect={selectEquipment} selected={selectedEquipment} />} />
            </div>
            <ViewToolbar />
            <ViewportFootnote />
          </div>
          {scenarioOpen || status !== "idle" ? <TelemetryStrip /> : null}
        </div>

        <div className="flex min-h-[60dvh] shrink-0 flex-col border-t border-border-subtle bg-card xl:min-h-0 xl:overflow-hidden xl:border-t-0 xl:border-l">
          <div role="tablist" aria-label="Side panel" className="flex shrink-0 border-b border-border-subtle bg-elev-1">
            {PANEL_TABS.map((tab) => {
              const selected = scenarioOpen === tab.scenario;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => showPanel(tab.scenario)}
                  className={cn(
                    "relative flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-sm transition-colors",
                    selected ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {selected ? <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" aria-hidden="true" /> : null}
                  {tab.label}
                  {tab.scenario && status === "running" ? (
                    <span className="size-1.5 rounded-full bg-status-warning" aria-label="running" />
                  ) : null}
                </button>
              );
            })}
          </div>
          {scenarioOpen ? <ScenarioPanel /> : <EquipmentPanel />}
        </div>
      </div>
    </div>
  );
}
