"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FIRETWIN_HABITATS, MISSIONS } from "@/data/missions";
import { FUEL_LABEL, OBJECTIVE_LABEL } from "@/lib/labels";
import { formatNumber } from "@/lib/format";
import {
  GRAVITY_G,
  LUNAR_EXTERIOR,
  MARS_EXTERIOR,
  mbarToPsi,
  oxygenPartialPressurePsi,
  psiToKpa,
} from "@/lib/physics/atmosphere";
import { useMissionStore } from "@/stores/mission-store";
import type { DataMode, FuelCategory, ResearchObjective } from "@/types/domain";

const FUELS = Object.entries(FUEL_LABEL) as Array<[FuelCategory, string]>;
const OBJECTIVES = Object.entries(OBJECTIVE_LABEL) as Array<[ResearchObjective, string]>;

const DATA_MODES: Array<[DataMode, string]> = [
  ["synthetic", "Synthetic demo"],
  ["verified", "Verified metadata"],
  ["combined", "Combined"],
];

export function ConditionControls() {
  const scenario = useMissionStore((state) => state.scenario);
  const dataMode = useMissionStore((state) => state.dataMode);
  const setDataMode = useMissionStore((state) => state.setDataMode);
  const selectMission = useMissionStore((state) => state.selectMission);
  const patch = useMissionStore((state) => state.patchScenario);
  const partial = oxygenPartialPressurePsi(scenario.oxygenPct, scenario.pressurePsi);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {MISSIONS.filter((mission) => FIRETWIN_HABITATS.includes(mission.id)).map((mission) => {
          const active = scenario.missionId === mission.id;
          return (
            <button
              key={mission.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectMission(mission.id)}
              className={`rounded-xl border px-3 py-3 text-left transition-panel ${
                active
                  ? "border-primary bg-card"
                  : "border-border bg-secondary hover:border-primary/50"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{mission.id === "gateway-orbit" ? mission.short : mission.name}</span>
                <span className="numeric text-xs text-foreground">{mission.gravityLabel}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{mission.summary}</span>
            </button>
          );
        })}
      </div>
      <FieldSlider
        id="oxygen"
        label="Oxygen concentration"
        hint="Scenario input, not a certified cabin setpoint."
        unit="%"
        min={15}
        max={45}
        step={0.5}
        digits={1}
        value={scenario.oxygenPct}
        onChange={(value) => patch({ oxygenPct: value })}
        onCommit={(value) =>
          patch({ oxygenPct: value }, `Set oxygen to ${formatNumber(value, 1)}%.`)
        }
      />
      <FieldSlider
        id="pressure"
        label="Atmospheric pressure"
        hint="Total cabin pressure. This is not the pressure outside the habitat."
        unit="psi"
        min={5}
        max={20}
        step={0.1}
        digits={1}
        value={scenario.pressurePsi}
        onChange={(value) => patch({ pressurePsi: value })}
        onCommit={(value) =>
          patch({ pressurePsi: value }, `Set pressure to ${formatNumber(value, 1)} psi.`)
        }
      />
      <div className="rounded-lg border border-border bg-secondary px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">Oxygen partial pressure</span>
          <span className="numeric text-sm text-foreground">
            {formatNumber(partial, 2)} psi · {formatNumber(psiToKpa(partial), 2)} kPa
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          pO₂ = oxygen fraction × total cabin pressure. It is not typed separately, so it cannot
          disagree with the two inputs.
        </p>
      </div>
      {scenario.missionId === "mars-habitat" ? (
        <p className="text-xs text-muted-foreground">
          Exterior Mars atmosphere, not the cabin: {MARS_EXTERIOR.statement} About{" "}
          {formatNumber(mbarToPsi(MARS_EXTERIOR.surfacePressureMbar), 3)} psi. Source{" "}
          {MARS_EXTERIOR.sourceUrl}, retrieved {MARS_EXTERIOR.retrievedAt}.
        </p>
      ) : null}
      {scenario.missionId === "lunar-habitat" || scenario.missionId === "lunar-rover" ? (
        <p className="text-xs text-muted-foreground">{LUNAR_EXTERIOR}</p>
      ) : null}
      {scenario.missionId === "gateway-orbit" ? (
        <p className="text-xs text-muted-foreground">
          This vehicle is in lunar orbit at ~{GRAVITY_G.microgravity.toFixed(3)} g. Lunar surface
          gravity is {GRAVITY_G.moon} g and is not used here.
        </p>
      ) : null}
      <div className="rounded-lg border border-border bg-secondary px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">Gravity environment</span>
          <span className="numeric text-sm text-foreground">{scenario.gravityG} g</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Gravity follows the selected mission. Moon {GRAVITY_G.moon} g, Mars {GRAVITY_G.mars} g,
          Gateway and ISS ~{GRAVITY_G.microgravity} g, Earth {GRAVITY_G.earth} g. These are physical
          context values, not catalog measurements.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Evidence mode">
        {DATA_MODES.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={dataMode === mode}
            onClick={() => setDataMode(mode)}
            className={`h-7 border px-2 font-cond text-[10px] tracking-[0.08em] uppercase ${dataMode === mode ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <FieldSlider
        id="airflow"
        label="Airflow velocity"
        hint="Bulk velocity imposed on the scenario. Unreported catalog airflow is not treated as zero."
        unit="m/s"
        min={0}
        max={1}
        step={0.01}
        digits={2}
        value={scenario.airflowMs}
        onChange={(value) => patch({ airflowMs: value })}
        onCommit={(value) =>
          patch({ airflowMs: value }, `Set airflow to ${formatNumber(value, 2)} m/s.`)
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fuel">Material / fuel category</Label>
          <Select
            value={scenario.fuelCategory}
            items={Object.fromEntries(FUELS)}
            onValueChange={(value) => {
              if (!value) return;
              patch(
                { fuelCategory: value as FuelCategory },
                `Fuel category set to ${FUEL_LABEL[value as FuelCategory]}.`,
              );
            }}
          >
            <SelectTrigger id="fuel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUELS.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="objective">Research objective</Label>
          <Select
            value={scenario.objective}
            items={Object.fromEntries(OBJECTIVES)}
            onValueChange={(value) => {
              if (!value) return;
              patch(
                { objective: value as ResearchObjective },
                `Objective set to ${OBJECTIVE_LABEL[value as ResearchObjective]}.`,
              );
            }}
          >
            <SelectTrigger id="objective" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function FieldSlider({
  id,
  label,
  hint,
  unit,
  min,
  max,
  step,
  digits,
  value,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  hint: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  digits: number;
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const display = `${formatNumber(value, digits)} ${unit}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="gap-1">
          {label}
          <Tooltip>
            <TooltipTrigger
              render={
                <button type="button" className="text-muted-foreground" aria-label={`About ${label}`}>
                  <Info className="size-3.5" />
                </button>
              }
            />
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        </Label>
        <span className="numeric text-sm text-primary">{display}</span>
      </div>
      <Slider
        id={id}
        aria-label={label}
        aria-valuetext={display}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(asNumber(next))}
        onValueCommitted={(next) => onCommit(asNumber(next))}
      />
    </div>
  );
}

function asNumber(value: number | readonly number[]): number {
  return typeof value === "number" ? value : value[0];
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="bg-card">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-1 text-xs font-normal tracking-wide text-muted-foreground uppercase">
          {label}
          <Tooltip>
            <TooltipTrigger
              render={
                <button type="button" className="text-muted-foreground" aria-label={`How ${label} is calculated`}>
                  <Info className="size-3.5" />
                </button>
              }
            />
            <TooltipContent className="max-w-xs">{detail}</TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="numeric text-2xl text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/60 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "critical";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "critical"
        ? "border-[#F67A6C] text-[#F67A6C]"
        : tone === "warn"
          ? "border-[#8A7040] bg-[#2A2418] text-foreground"
          : "border-border text-foreground";
  return (
    <div className={`rounded-lg border bg-secondary px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-medium tracking-wide uppercase">{title}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button nativeButton={false} render={<Link href={href} />} variant="outline">
      {children}
    </Button>
  );
}
