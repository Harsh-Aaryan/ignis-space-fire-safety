"use client";

import { useEffect, useRef } from "react";
import { FIRETWIN_HABITATS, missionById } from "@/data/missions";
import { formatGravity } from "@/lib/format";
import { useMissionStore } from "@/stores/mission-store";
const ORDER = ["lunar-habitat", "mars-habitat", "gateway-orbit"] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  "lunar-habitat": "Moon",
  "mars-habitat": "Mars",
  "gateway-orbit": "Gateway",
};

const MOBILE: Record<(typeof ORDER)[number], string> = {
  "lunar-habitat": "Moon",
  "mars-habitat": "Mars",
  "gateway-orbit": "Orbit",
};

const ARIA: Record<(typeof ORDER)[number], string> = {
  "lunar-habitat": "Moon, 0.165 g",
  "mars-habitat": "Mars, 0.38 g",
  "gateway-orbit": "Gateway-inspired lunar orbit habitat, about 0 g, conceptual digital twin",
};

export function HabitatSwitcher() {
  const missionId = useMissionStore((state) => state.scenario.missionId);
  const gravity = useMissionStore((state) => state.scenario.gravityG);
  const select = useMissionStore((state) => state.selectMission);
  const active = FIRETWIN_HABITATS.includes(missionId) ? missionId : "lunar-habitat";
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const fromKey = useRef(false);

  useEffect(() => {
    if (!fromKey.current) return;
    fromKey.current = false;
    const index = ORDER.indexOf(active as (typeof ORDER)[number]);
    refs.current[index]?.focus({ preventScroll: true });
  }, [active]);

  function move(next: number) {
    fromKey.current = true;
    const index = (next + ORDER.length) % ORDER.length;
    select(ORDER[index]);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Habitat"
      className="flex h-7 w-full border border-[#3A3E44] bg-[#16181C] md:w-auto"
      onKeyDown={(event) => {
        const index = ORDER.indexOf(active as (typeof ORDER)[number]);
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(index + 1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(index - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          select(ORDER[0]);
        } else if (event.key === "End") {
          event.preventDefault();
          select(ORDER[ORDER.length - 1]);
        }
      }}
    >
      {ORDER.map((id, index) => {
        const selected = active === id;
        return (
          <button
            key={id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ARIA[id]}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(id)}
            className={`relative h-full flex-1 border-r border-[#2A2D32] px-3 font-cond text-[11px] font-semibold tracking-[0.08em] uppercase last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E07A3D] md:flex-none ${selected ? "bg-[#1F2125] text-[#EDEAE4]" : "text-[#A39E96] hover:bg-[#1F2125] hover:text-[#EDEAE4]"}`}
          >
            <span className="md:hidden">{MOBILE[id]}</span>
            <span className="hidden md:inline">{LABEL[id]}</span>
            <span className="sr-only">{missionById(id).gravityLabel}</span>
            {selected ? <span className="absolute inset-x-1 bottom-0 h-0.5 bg-[#E07A3D]" /> : null}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {ARIA[active as (typeof ORDER)[number]]}, {formatGravity(gravity)} g
      </span>
    </div>
  );
}
