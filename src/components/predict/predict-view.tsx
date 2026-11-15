"use client";

import { PageHeader } from "@/components/design/kit";
import { RouteTabs } from "@/components/design/route-tabs";
import { ScenarioForecast } from "@/components/predict/scenario-forecast";
import { SIMULATION_TABS } from "@/lib/routes";

/** Gravity comparison: one fire, three gravity levels. */
export function PredictView() {
  return (
    <div>
      <RouteTabs tabs={SIMULATION_TABS} label="Simulation views" className="mb-6" />
      <PageHeader
        title="Compare gravity"
        description="Run one fire at orbital, lunar and Martian gravity. Buoyancy is the only thing that changes: it decides how air reaches the flame and where the smoke goes."
      />
      <ScenarioForecast />
    </div>
  );
}
