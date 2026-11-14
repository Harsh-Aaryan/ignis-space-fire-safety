"use client";

import dynamic from "next/dynamic";
import { Component, useState, useSyncExternalStore } from "react";
import { FireHud } from "@/components/firetwin/fire-hud";
import { FireSimPanel } from "@/components/firetwin/fire-sim-panel";
import { InteriorInspector } from "@/components/firetwin/interior-inspector";
import {
  roomsForHabitat,
  roomById,
  objectById,
  type NavigationMode,
} from "@/data/habitat-interiors";
import { equipmentLabel } from "@/lib/labels";
import { formatGravity, formatNumber } from "@/lib/format";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import type { EquipmentId } from "@/types/domain";

const HabitatCanvas = dynamic(
  () =>
    import("@/components/three/habitat-canvas").then((m) => m.HabitatCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading habitat…
      </div>
    ),
  },
);
const MODES: Array<[NavigationMode, string]> = [
  ["orbit", "Orbit view"],
  ["cutaway", "Cutaway view"],
  ["interior", "Interior view"],
  ["floor", "Floor view"],
  ["equipment", "Equipment focus"],
];

export function FireTwinView() {
  const state = useMissionStore();
  const {
    scenario,
    selectedEquipment: selected,
    cutaway,
    exploded,
    marsDusk,
    navigationMode: mode,
  } = state;
  const simOpen = useFireSimStore((store) => store.open);
  const setSimOpen = useFireSimStore((store) => store.setOpen);
  const simStatus = useFireSimStore((store) => store.status);
  function toggleSim() {
    const next = !simOpen;
    setSimOpen(next);
    // The scenario needs an interior to burn in.
    if (next && !state.selectedRoomId) state.navigate("interior");
  }
  const rooms = roomsForHabitat(scenario.missionId);
  const room = roomById(state.selectedRoomId);
  const object = objectById(state.selectedObjectId);
  const levels = [...new Set(rooms.map((r) => r.level))];
  const name =
    scenario.missionId === "gateway-orbit"
      ? "Gateway"
      : scenario.missionId === "mars-habitat"
        ? "Mars"
        : "Moon";
  const partial = oxygenPartialPressurePsi(
    scenario.oxygenPct,
    scenario.pressurePsi,
  );
  function focus() {
    if (object) state.selectObject(object.id);
    else if (room) state.selectRoom(room.id);
    else if (selected) state.selectEquipment(selected);
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-auto xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:overflow-hidden">
      <div
        data-testid="habitat-viewport"
        className="relative min-h-[580px] w-full shrink-0 bg-black md:min-h-[620px] xl:min-h-0"
      >
        <div className="absolute inset-0 z-0">
          <HabitatMount
            fallback={
              <Schematic onSelect={state.selectEquipment} selected={selected} />
            }
          />
        </div>
        <div className="pointer-events-none absolute top-3 right-3 left-3 z-20">
          <p className="inline-block bg-[#171C20]/85 px-2 py-1 font-mono text-[10px] text-[#D0D3CC]">
            Cabin {scenario.oxygenPct}% O₂ · {scenario.pressurePsi} psi · pO₂{" "}
            {formatNumber(partial, 2)} psi · {formatGravity(scenario.gravityG)}{" "}
            g
          </p>
          <p
            aria-label="Interior breadcrumb"
            className="mt-1 truncate text-[11px] text-[#D9DDD5]"
          >
            FireTwin / {name}
            {room
              ? ` / ${scenario.missionId === "gateway-orbit" ? "Module" : `Level ${room.level}`} / ${room.name}`
              : cutaway
                ? " / All levels"
                : " / Exterior"}
            {object ? ` / ${object.label}` : ""}
          </p>
        </div>
        <nav
          aria-label="Habitat view controls"
          className="absolute top-[76px] right-3 left-3 z-20 max-w-[770px] space-y-2"
        >
          <div className="flex w-fit max-w-full overflow-x-auto border border-[#465057] bg-[#171C20]/95 p-0.5">
            {MODES.map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={mode === id}
                onClick={() => state.navigate(id)}
                className={`min-h-8 shrink-0 px-2.5 font-cond text-[11px] tracking-[0.04em] ${mode === id ? "bg-[#394346] text-[#F1E8D5]" : "text-[#AEB6B6] hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 border border-[#465057] bg-[#171C20]/95 px-2 py-1 text-[11px] text-[#BFC8C5]">
              {scenario.missionId === "gateway-orbit" ? "Module" : "Room"}
              <select
                aria-label="Select room"
                value={room?.id ?? ""}
                onChange={(e) => {
                  if (e.target.value) state.selectRoom(e.target.value);
                  else state.navigate("orbit");
                }}
                className="max-w-[240px] bg-[#171C20] py-1 text-[#E7E8DE]"
              >
                <option value="">Exterior overview</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {scenario.missionId !== "gateway-orbit"
                      ? `L${r.level} · `
                      : ""}
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {levels.length > 1 ? (
              <label className="flex items-center gap-2 border border-[#465057] bg-[#171C20]/95 px-2 py-1 text-[11px] text-[#BFC8C5]">
                Deck
                <select
                  aria-label="Select floor"
                  value={state.selectedLevel ?? "all"}
                  onChange={(e) =>
                    state.setLevel(
                      e.target.value === "all" ? null : Number(e.target.value),
                    )
                  }
                  className="bg-[#171C20] py-1 text-[#E7E8DE]"
                >
                  <option value="all">All levels</option>
                  {levels.map((l) => (
                    <option key={l} value={l}>
                      Level {l}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </nav>
        <div className="absolute right-3 bottom-3 left-3 z-20 space-y-2">
          <p className="pointer-events-none w-fit bg-[#171C20]/85 px-2 py-1 text-[10px] text-[#D0D3CC]">
            {cutaway
              ? "Select equipment to inspect research · drag to orbit · scroll to fit"
              : "Drag to orbit · scroll to zoom · open a cutaway to explore"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <div className="flex border border-[#465057] bg-[#171C20]/95 p-0.5">
              {(["evidence", "scenario"] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={state.firetwinMode === item}
                  onClick={() => state.setMode(item)}
                  className={`px-2 py-1 font-cond text-[10px] uppercase ${state.firetwinMode === item ? "bg-[#394346] text-white" : "text-[#AEB6B6]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            {cutaway ? (
              <>
                <HudButton onClick={() => state.setHideRoof(!state.hideRoof)}>
                  {state.hideRoof ? "Show roof" : "Hide roof"}
                </HudButton>
                <HudButton
                  onClick={() => state.setHideFrontWalls(!state.hideFrontWalls)}
                >
                  {state.hideFrontWalls
                    ? "Show front walls"
                    : "Hide front walls"}
                </HudButton>
              </>
            ) : null}
            {scenario.missionId !== "gateway-orbit" ? (
              <HudButton onClick={() => state.setExploded(!exploded)}>
                {exploded ? "Assemble levels" : "Explode levels"}
              </HudButton>
            ) : null}
            {scenario.missionId === "mars-habitat" ? (
              <HudButton onClick={() => state.setMarsDusk(!marsDusk)}>
                {marsDusk ? "Afternoon" : "Dusk"}
              </HudButton>
            ) : null}
            <HudButton onClick={focus}>Fit selected</HudButton>
            <HudButton
              onClick={() => {
                state.resetCamera();
                if (cutaway) state.navigate("cutaway");
              }}
            >
              Reset view
            </HudButton>
            {cutaway ? (
              <HudButton onClick={() => state.navigate("orbit")}>
                Return to exterior
              </HudButton>
            ) : null}
            <HudButton
              onClick={toggleSim}
              className={simOpen ? "border-[#C8794A] text-[#FFD9BE]" : ""}
            >
              {simOpen ? "Close fire scenario" : "Fire scenario"}
            </HudButton>
          </div>
          <p className="pointer-events-none font-cond text-[9px] tracking-[0.08em] text-[#B8B9AC] uppercase">
            {name} ·{" "}
            {scenario.missionId === "gateway-orbit"
              ? "NASA Gateway exterior / conceptual interior"
              : scenario.missionId === "mars-habitat"
                ? "MARSHA-inspired conceptual habitat"
                : "Foster+Partners / ESA-inspired conceptual habitat"}{" "}
            · Illustrative digital twin
          </p>
        </div>
      </div>
      {simOpen ? <FireHud /> : null}
      <div className="flex min-h-0 shrink-0 flex-col border-t border-[#343A40] bg-[#1F2125] xl:overflow-hidden xl:border-t-0 xl:border-l">
        <div role="tablist" aria-label="FireTwin panel" className="flex shrink-0 border-b border-[#343A40] bg-[#171C20]">
          {(
            [
              [false, "Research"],
              [true, "Fire scenario"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={simOpen === value}
              onClick={() => (value === simOpen ? null : toggleSim())}
              className={`relative min-h-9 flex-1 px-3 font-cond text-[11px] tracking-[0.1em] uppercase ${simOpen === value ? "bg-[#1F2125] text-[#F1E8D5]" : "text-[#8F9A9A] hover:text-white"}`}
            >
              {simOpen === value ? <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
              {label}
              {value && simStatus === "running" ? <span className="ml-1.5 inline-block size-1.5 rounded-full bg-[#F67A6C]" aria-label="running" /> : null}
            </button>
          ))}
        </div>
        {simOpen ? <FireSimPanel /> : <InteriorInspector />}
      </div>
    </div>
  );
}
function HudButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center border border-[#3A3E44] bg-[#1F2125]/92 px-2.5 font-cond text-[11px] tracking-[0.08em] text-muted-foreground uppercase md:h-7 md:min-h-0 ${className}`}
    >
      {children}
    </button>
  );
}

const emptySubscribe = () => () => {};
function HabitatMount({ fallback }: { fallback: React.ReactNode }) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [webgl] = useState(() => {
    if (typeof document === "undefined") return true;
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      return false;
    }
  });
  if (!hydrated)
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading habitat?</div>
    );
  if (!webgl) return <>{fallback}</>;
  return (
    <Boundary fallback={fallback}>
      <HabitatCanvas />
    </Boundary>
  );
}

class Boundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const PLAN: Array<{
  id: EquipmentId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}> = [
  { id: "airlock-oxygen", x: 28, y: 118, w: 58, h: 44, label: "AIRLOCK / O₂" },
  {
    id: "living-quarters",
    x: 108,
    y: 96,
    w: 132,
    h: 88,
    label: "LIVING QUARTERS",
  },
  { id: "shell", x: 268, y: 78, w: 196, h: 124, label: "PRESSURE SHELL" },
  { id: "laboratory", x: 318, y: 118, w: 96, h: 36, label: "LABORATORY" },
  {
    id: "material-storage",
    x: 492,
    y: 104,
    w: 96,
    h: 72,
    label: "MATERIAL STORAGE",
  },
  { id: "ventilation", x: 330, y: 48, w: 120, h: 22, label: "VENTILATION" },
  {
    id: "smoke-detection",
    x: 400,
    y: 168,
    w: 28,
    h: 18,
    label: "SMOKE DETECTION",
  },
  {
    id: "fire-suppression",
    x: 430,
    y: 168,
    w: 28,
    h: 18,
    label: "FIRE SUPPRESSION",
  },
];

function Schematic({
  selected,
  onSelect,
}: {
  selected: EquipmentId | null;
  onSelect: (id: EquipmentId) => void;
}) {
  return (
    <div className="flex h-full min-h-80 flex-col justify-center gap-3 p-4">
      <p className="text-[13px] text-[#E8C15A]">
        WebGL is unavailable. This 2D cutaway uses the same systems as the 3D
        habitat.
      </p>
      <svg
        viewBox="0 0 620 250"
        className="h-auto w-full max-w-3xl"
        role="img"
        aria-label="Habitat plan"
      >
        <rect x="0" y="0" width="620" height="250" fill="#07080B" />
        <line
          x1="86"
          y1="140"
          x2="108"
          y2="140"
          stroke="#8A8E94"
          strokeWidth="6"
        />
        <line
          x1="240"
          y1="140"
          x2="268"
          y2="140"
          stroke="#8A8E94"
          strokeWidth="6"
        />
        <line
          x1="464"
          y1="140"
          x2="492"
          y2="140"
          stroke="#8A8E94"
          strokeWidth="6"
        />
        {PLAN.map((node) => {
          const on = selected === node.id;
          return (
            <g
              key={node.id}
              onClick={() => onSelect(node.id)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                fill={on ? "#2A241C" : "#1F2125"}
                stroke={on ? "#E07A3D" : "#3A3E44"}
                strokeWidth={on ? 2 : 1}
              />
              <text
                x={node.x + 6}
                y={node.y + 14}
                fill="#EDEAE4"
                fontSize="9"
                fontFamily="IBM Plex Sans Condensed, sans-serif"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
