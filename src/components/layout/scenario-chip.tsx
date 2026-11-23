"use client";

import { SlidersHorizontal } from "lucide-react";
import { ConditionControls } from "@/components/dashboard/controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatGravity, formatNumber, formatOxygen, formatPsi } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/stores/mission-store";

function airflowCmS(airflowMs: number): string {
  const cm = Number((airflowMs * 100).toFixed(1));
  return formatNumber(cm, Number.isInteger(cm) ? 0 : 1);
}

const DOT = (
  <span className="text-text-tertiary" aria-hidden="true">
    ·
  </span>
);

/**
 * The cabin conditions shared across IGNIS. The chip reads them out and opens the condition
 * controls. The habitat itself is chosen with the Moon / Mars / Gateway switcher beside it.
 * On a phone the chip keeps oxygen and drops the rest; on narrower desktops the trailing
 * readouts truncate.
 */
export function ScenarioChip({ className }: { className?: string }) {
  const scenario = useMissionStore((state) => state.scenario);
  const oxygen = `${formatOxygen(scenario.oxygenPct)}% O₂`;
  const pressure = `${formatPsi(scenario.pressurePsi)} psi`;
  const gravity = `${formatGravity(scenario.gravityG)} g`;
  const airflow = `${airflowCmS(scenario.airflowMs)} cm/s`;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Cabin conditions: ${oxygen}, ${pressure}, ${gravity}, ${airflow}. Edit`}
        className={cn(
          "inline-flex h-11 min-w-0 items-center gap-2 rounded-md border border-border-subtle bg-background px-2.5 text-[13px] leading-5 transition-colors hover:border-border hover:bg-elev-2 md:h-9 md:px-3",
          className,
        )}
      >
        <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <span className="hidden shrink-0 text-muted-foreground sm:inline">Cabin</span>
        <span className="numeric flex min-w-0 items-center gap-1.5 whitespace-nowrap text-foreground">
          <span data-slot="scenario-readout" className="shrink-0">
            {oxygen}
          </span>
          <span className="hidden min-w-0 truncate sm:block">
            {DOT} {pressure} {DOT} {gravity} {DOT} {airflow}
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(80vh,640px)] w-[420px] max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto border border-border bg-popover p-5"
      >
        <p className="text-[15px] font-medium text-foreground">Cabin conditions</p>
        <p className="mt-1 mb-4 text-[13px] leading-5 text-muted-foreground">
          Shared across IGNIS. Changing them here changes every page.
        </p>
        <ConditionControls />
      </PopoverContent>
    </Popover>
  );
}
