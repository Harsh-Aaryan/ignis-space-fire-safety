"use client";

import { Billboard, Outlines } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { createContext, useContext, useRef, useState } from "react";
import * as THREE from "three";
import { useMissionStore } from "@/stores/mission-store";
import type { EquipmentId } from "@/types/domain";

export const EMBER = "#E07A3D";
const BONE = "#EDEAE4";

export const HOTSPOT_LABEL: Record<EquipmentId, string> = {
  shell: "Pressure shell",
  "airlock-oxygen": "Airlock / O₂",
  "living-quarters": "Living quarters",
  laboratory: "Laboratory",
  "material-storage": "Material storage",
  ventilation: "Ventilation",
  "smoke-detection": "Smoke detection",
  "fire-suppression": "Fire suppression",
};

export const hoverBus: { id: EquipmentId | null } = { id: null };

export const HabitatDecor = createContext<{ hairline: boolean; ringMode: "ground" | "camera" }>({
  hairline: false,
  ringMode: "ground",
});

const OutlineState = createContext({ selected: false, hovered: false, hairline: false });

export function OutlinePass() {
  const { selected, hovered, hairline } = useContext(OutlineState);
  const show = selected || hovered;
  return (
    <>
      {hairline && selected ? (
        <Outlines
          screenspace={false}
          toneMapped={false}
          angle={Math.PI}
          thickness={4}
          color={BONE}
          transparent
          opacity={0.85}
        />
      ) : null}
      <Outlines
        screenspace={false}
        toneMapped={false}
        angle={Math.PI}
        thickness={show ? 3 : 0}
        color={selected ? EMBER : BONE}
        transparent
        opacity={selected ? 1 : 0.85}
      />
    </>
  );
}

type Vec3 = [number, number, number];

export function Hotspot({
  id,
  position = [0, 0, 0],
  registry,
  groundRadius,
  anchorY,
  outlineIds,
  ring = true,
  hairline = false,
  ringMode = "ground",
  children,
}: {
  id: EquipmentId;
  label?: string;
  position?: Vec3;
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse?: boolean;
  groundRadius: number;
  anchorY?: number;
  outlineIds?: EquipmentId[];
  ring?: boolean;
  hairline?: boolean;
  ringMode?: "ground" | "camera";
  children: React.ReactNode;
}) {
  const selected = useMissionStore((state) => state.selectedEquipment === id);
  const outlined = useMissionStore((state) =>
    (outlineIds ?? [id]).includes(state.selectedEquipment as EquipmentId),
  );
  const select = useMissionStore((state) => state.selectEquipment);
  const [hovered, setHovered] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);
  const { gl } = useThree();
  const decor = useContext(HabitatDecor);
  const useHairline = hairline || decor.hairline;
  const useRing = ringMode === "camera" || decor.ringMode === "camera" ? "camera" : "ground";
  const ringY = 0.03 - (anchorY ?? position[1]);
  return (
    <OutlineState.Provider value={{ selected: outlined, hovered, hairline: useHairline }}>
      <group
        position={position}
        ref={(node) => {
          if (node) registry.current.set(id, node);
          else registry.current.delete(id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          hoverBus.id = id;
          gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          if (hoverBus.id === id) hoverBus.id = null;
          gl.domElement.style.cursor = "auto";
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          down.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          if (!down.current) return;
          const dx = event.clientX - down.current.x;
          const dy = event.clientY - down.current.y;
          down.current = null;
          if (dx * dx + dy * dy > 16) return;
          event.stopPropagation();
          select(id);
        }}
      >
        {children}
      {ring && (selected || outlined) && useRing === "ground" ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ringY, 0]} renderOrder={1}>
          <ringGeometry args={[groundRadius + 0.15, groundRadius + 0.22, 48]} />
          <meshBasicMaterial color={EMBER} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {ring && (selected || outlined) && useRing === "camera" ? (
        <Billboard>
          <mesh>
            <ringGeometry args={[groundRadius * 1.05, groundRadius * 1.15, 48]} />
            <meshBasicMaterial color={selected ? EMBER : BONE} toneMapped={false} side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
        </Billboard>
      ) : null}
      </group>
    </OutlineState.Provider>
  );
}
