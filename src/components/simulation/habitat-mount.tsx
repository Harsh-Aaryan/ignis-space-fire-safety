"use client";

import dynamic from "next/dynamic";
import { Component, useState, useSyncExternalStore } from "react";
import type { EquipmentId } from "@/types/domain";

const HabitatCanvas = dynamic(
  () => import("@/components/three/habitat-canvas").then((m) => m.HabitatCanvas),
  {
    ssr: false,
    loading: () => <LoadingHabitat />,
  },
);

function LoadingHabitat() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading habitat…
    </div>
  );
}

const emptySubscribe = () => () => {};

/** Mounts the 3D habitat, or the 2D schematic when WebGL is missing or the scene fails. */
export function HabitatMount({ fallback }: { fallback: React.ReactNode }) {
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
  if (!hydrated) return <LoadingHabitat />;
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
  { id: "living-quarters", x: 108, y: 96, w: 132, h: 88, label: "LIVING QUARTERS" },
  { id: "shell", x: 268, y: 78, w: 196, h: 124, label: "PRESSURE SHELL" },
  { id: "laboratory", x: 318, y: 118, w: 96, h: 36, label: "LABORATORY" },
  { id: "material-storage", x: 492, y: 104, w: 96, h: 72, label: "MATERIAL STORAGE" },
  { id: "ventilation", x: 330, y: 48, w: 120, h: 22, label: "VENTILATION" },
  { id: "smoke-detection", x: 400, y: 168, w: 28, h: 18, label: "SMOKE DETECTION" },
  { id: "fire-suppression", x: 430, y: 168, w: 28, h: 18, label: "FIRE SUPPRESSION" },
];

const LINKS: Array<[number, number]> = [
  [86, 108],
  [240, 268],
  [464, 492],
];

/** 2D plan of the habitat systems, used when WebGL is unavailable. */
export function Schematic({
  selected,
  onSelect,
}: {
  selected: EquipmentId | null;
  onSelect: (id: EquipmentId) => void;
}) {
  return (
    <div className="flex h-full min-h-60 flex-col justify-center gap-3 p-4 pt-24">
      <p className="text-[13px] text-status-caution">
        WebGL is unavailable. This 2D plan shows the same habitat systems as the 3D view.
      </p>
      <svg viewBox="0 0 620 250" className="h-auto w-full max-w-3xl" role="img" aria-label="Habitat plan">
        <rect x="0" y="0" width="620" height="250" className="fill-void" />
        {LINKS.map(([x1, x2]) => (
          <line key={x1} x1={x1} y1="140" x2={x2} y2="140" strokeWidth="6" className="stroke-text-tertiary" />
        ))}
        {PLAN.map((node) => {
          const on = selected === node.id;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: "pointer" }}>
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                strokeWidth={on ? 2 : 1}
                className={on ? "fill-elev-3 stroke-ember" : "fill-elev-2 stroke-border"}
              />
              <text x={node.x + 6} y={node.y + 14} fontSize="9" className="fill-foreground font-cond">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
