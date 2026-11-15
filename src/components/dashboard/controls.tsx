"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatGravity, formatNumber } from "@/lib/format";
import { oxygenPartialPressurePsi, psiToKpa } from "@/lib/physics/atmosphere";
import { useMissionStore } from "@/stores/mission-store";

/** The cabin atmosphere shared by every section: oxygen, pressure and airflow. Gravity follows the habitat. */
export function ConditionControls() {
  const scenario = useMissionStore((state) => state.scenario);
  const patch = useMissionStore((state) => state.patchScenario);
  const partial = oxygenPartialPressurePsi(scenario.oxygenPct, scenario.pressurePsi);

  return (
    <div className="flex flex-col gap-5">
      <FieldSlider
        id="oxygen"
        label="Oxygen"
        display={`${formatNumber(scenario.oxygenPct, 1)}%`}
        min={10}
        max={40}
        step={0.5}
        value={scenario.oxygenPct}
        onChange={(value) => patch({ oxygenPct: value })}
      />
      <FieldSlider
        id="pressure"
        label="Cabin pressure"
        display={`${formatNumber(scenario.pressurePsi, 1)} psi`}
        min={5}
        max={15}
        step={0.1}
        value={scenario.pressurePsi}
        onChange={(value) => patch({ pressurePsi: value })}
      />
      <FieldSlider
        id="airflow"
        label="Airflow"
        display={`${formatNumber(scenario.airflowMs * 100, 1)} cm/s`}
        min={0}
        max={0.5}
        step={0.005}
        value={scenario.airflowMs}
        onChange={(value) => patch({ airflowMs: value })}
      />

      <dl className="divide-y divide-border-subtle rounded-md border border-border-subtle text-sm">
        <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted-foreground">Oxygen partial pressure</dt>
          <dd className="numeric text-foreground" data-testid="oxygen-partial-pressure">
            {formatNumber(partial, 2)} psi · {formatNumber(psiToKpa(partial), 1)} kPa
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted-foreground">Gravity</dt>
          <dd className="numeric text-foreground">{formatGravity(scenario.gravityG)} g</dd>
        </div>
      </dl>

      <p className="text-[12px] leading-4 text-text-tertiary">
        Oxygen partial pressure is the oxygen fraction times cabin pressure. Gravity follows the habitat you select. These are
        scenario inputs, not approved cabin settings.
      </p>
    </div>
  );
}

function FieldSlider({
  id,
  label,
  display,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="numeric text-sm text-ember-text">{display}</span>
      </div>
      <Slider
        id={id}
        aria-label={label}
        aria-valuetext={display}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(typeof next === "number" ? next : next[0])}
      />
    </div>
  );
}
