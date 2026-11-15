"use client";

import { useEffect, useRef } from "react";
import { FIRETWIN_HABITATS, missionById } from "@/data/missions";
import { formatGravity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/stores/mission-store";

const ORDER = ["lunar-habitat", "mars-habitat", "gateway-orbit"] as const;

const LABEL: Record<(typeof ORDER)[number], string> = {
  "lunar-habitat": "Moon",
  "mars-habitat": "Mars",
  "gateway-orbit": "Gateway",
};

/** Accessible names. Browser tests select the radios by these strings; keep them exactly. */
const ARIA: Record<(typeof ORDER)[number], string> = {
  "lunar-habitat": "Moon, 0.165 g",
  "mars-habitat": "Mars, 0.38 g",
  "gateway-orbit": "Gateway, about 0 g",
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
      className="flex h-10 w-full rounded-md border border-border-subtle bg-background p-0.5 md:h-9 md:w-auto"
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
            className={cn(
              "relative h-full flex-1 rounded-sm px-3 text-[13px] transition-colors md:flex-none",
              selected ? "bg-elev-3 text-foreground" : "text-muted-foreground hover:bg-elev-2 hover:text-foreground",
            )}
          >
            {LABEL[id]}
            <span className="sr-only">{missionById(id).gravityLabel}</span>
            {selected ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {ARIA[active as (typeof ORDER)[number]]}, {formatGravity(gravity)} g
      </span>
    </div>
  );
}
