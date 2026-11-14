"use client";

import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  levelOffset,
  roomsForHabitat,
  type HabitatRoomConfig,
  type InteriorEquipment,
  type Vec3,
} from "@/data/habitat-interiors";
import { FireEffects } from "@/components/three/fire-effects";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import type { MissionId } from "@/types/domain";

export const interiorObjects = new Map<string, THREE.Object3D>();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 12);
const MATERIALS = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string) {
  if (!MATERIALS.has(color))
    MATERIALS.set(
      color,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.48),
        roughness: 0.72,
        metalness: 0.15,
      }),
    );
  return MATERIALS.get(color)!;
}
function Box({
  p = [0, 0, 0],
  s,
  c = "#B9BEBB",
}: {
  p?: Vec3;
  s: Vec3;
  c?: string;
}) {
  return (
    <mesh
      position={p}
      scale={s}
      dispose={null}
      geometry={UNIT_BOX}
      material={material(c)}
      castShadow
      receiveShadow
    />
  );
}
function Cylinder({
  p,
  s,
  c = "#899298",
  rotation,
}: {
  p: Vec3;
  s: Vec3;
  c?: string;
  rotation?: Vec3;
}) {
  return (
    <mesh
      position={p}
      scale={s}
      rotation={rotation}
      dispose={null}
      geometry={CYLINDER}
      material={material(c)}
    />
  );
}
function FaceLabel({
  text,
  p,
  width = 0.7,
  color = "#C8D9D7",
}: {
  text: string;
  p: Vec3;
  width?: number;
  color?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#202A30";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = color;
    ctx.font = "bold 25px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 42);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={p}>
      <planeGeometry args={[width, width / 4]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
function Monitor({ p = [0, 1.2, -0.08] }: { p?: Vec3 }) {
  return (
    <group position={p}>
      <Box s={[0.62, 0.4, 0.06]} c="#303B43" />
      <Box p={[0, -0.26, 0]} s={[0.06, 0.18, 0.1]} c="#899298" />
      <Box p={[0, -0.35, 0.04]} s={[0.32, 0.025, 0.22]} />
      <FaceLabel text="SYS  NOMINAL" p={[0, 0.08, 0.032]} width={0.54} />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[-0.12 + i * 0.13, -0.09, 0.035]}
          s={[0.09, 0.02, 0.005]}
          c="#7CA9AA"
        />
      ))}
    </group>
  );
}
export function EquipmentRack() {
  return (
    <group>
      <Box p={[0, 0.88, 0]} s={[0.76, 1.76, 0.65]} c="#596972" />
      <Monitor p={[0, 1.43, 0.34]} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <Box p={[0, 0.22 + i * 0.25, 0.34]} s={[0.63, 0.2, 0.055]} />
          <Box
            p={[0.2, 0.22 + i * 0.25, 0.38]}
            s={[0.12, 0.025, 0.025]}
            c="#35424B"
          />
          {[0, 1, 2].map((j) => (
            <Box
              key={j}
              p={[-0.21 + j * 0.045, 0.22 + i * 0.25, 0.373]}
              s={[0.016, 0.09, 0.01]}
              c="#35424B"
            />
          ))}
        </group>
      ))}
    </group>
  );
}
export function StorageCabinet() {
  return (
    <group>
      <Box p={[0, 0.8, 0]} s={[0.9, 1.6, 0.58]} c="#657177" />
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Box
            p={[0, 0.28 + i * 0.5, 0.04]}
            s={[0.8, 0.44, 0.55]}
            c={i === 1 ? "#9D967E" : "#B1B2A6"}
          />
          <Box
            p={[0, 0.28 + i * 0.5, 0.33]}
            s={[0.22, 0.04, 0.045]}
            c="#45545E"
          />
          <FaceLabel
            text={["POLYMER", "FABRIC", "COMPOSITE"][i]}
            p={[0, 0.4 + i * 0.5, 0.321]}
            width={0.64}
          />
        </group>
      ))}
    </group>
  );
}
export function VentilationDuct() {
  return (
    <group>
      <Box s={[1.65, 0.25, 0.3]} c="#879597" />
      {[-0.65, 0, 0.65].map((x) => (
        <Box key={x} p={[x, 0, 0]} s={[0.035, 0.29, 0.34]} c="#4E5B61" />
      ))}
      <Box p={[0, -0.15, 0.18]} s={[0.65, 0.06, 0.28]} c="#36464E" />
      {[-2, -1, 0, 1, 2].map((i) => (
        <Box key={i} p={[i * 0.1, -0.185, 0.2]} s={[0.025, 0.02, 0.24]} />
      ))}
      <FaceLabel
        text="AIR  >>>"
        p={[0, 0.01, 0.153]}
        width={0.58}
        color="#91C0B4"
      />
    </group>
  );
}
export function AirFilter() {
  return (
    <group>
      <Box p={[0, 0.8, 0]} s={[0.95, 1.6, 0.65]} c="#67797B" />
      {[0, 1].map((i) => (
        <group key={i}>
          <Cylinder
            p={[-0.23 + i * 0.46, 0.85, 0.32]}
            s={[0.18, 1.1, 0.18]}
            c="#CFCCC1"
          />
          <Box
            p={[-0.23 + i * 0.46, 0.42, 0.49]}
            s={[0.26, 0.035, 0.03]}
            c="#566A70"
          />
        </group>
      ))}
      <FaceLabel text="ECLSS / FILTER" p={[0, 1.45, 0.331]} width={0.8} />
      <Cylinder
        p={[0, 0.21, 0.35]}
        s={[0.17, 0.08, 0.17]}
        rotation={[Math.PI / 2, 0, 0]}
        c="#334851"
      />
    </group>
  );
}
export function SmokeDetector() {
  return (
    <group>
      <Cylinder p={[0, 0, 0]} s={[0.17, 0.09, 0.17]} c="#D4D5C9" />
      <Cylinder p={[0, -0.06, 0]} s={[0.12, 0.06, 0.12]} c="#4F6166" />
      <Box p={[0, -0.1, 0.07]} s={[0.035, 0.015, 0.025]} c="#B7B08A" />
    </group>
  );
}
export function OxygenControlPanel() {
  const oxygen = useMissionStore((s) => s.scenario.oxygenPct);
  const pressure = useMissionStore((s) => s.scenario.pressurePsi);
  return (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.65, 0.65, 0.12]} c="#53656B" />
      <FaceLabel
        text={`O2 ${oxygen.toFixed(1)}%`}
        p={[0, 0.32, 0.062]}
        width={0.56}
      />
      <FaceLabel
        text={`${pressure.toFixed(1)} PSI`}
        p={[0, 0.14, 0.062]}
        width={0.56}
      />
      {[-0.2, 0, 0.2].map((x) => (
        <Cylinder
          key={x}
          p={[x, -0.02, 0.08]}
          s={[0.035, 0.035, 0.035]}
          rotation={[Math.PI / 2, 0, 0]}
          c="#D0B17A"
        />
      ))}
    </group>
  );
}
export function FireExtinguisher() {
  return (
    <group>
      <Box p={[0, 0.3, -0.12]} s={[0.24, 0.6, 0.07]} c="#45535C" />
      <Cylinder p={[0, 0.33, 0]} s={[0.12, 0.57, 0.12]} c="#A84F3E" />
      <Cylinder p={[0, 0.65, 0]} s={[0.035, 0.1, 0.035]} />
      <Box p={[0.04, 0.72, 0]} s={[0.22, 0.035, 0.07]} c="#35454C" />
      <Box p={[0.15, 0.43, 0]} s={[0.03, 0.4, 0.035]} c="#293740" />
      <FaceLabel text="FIRE" p={[0, 0.36, 0.123]} width={0.21} />
    </group>
  );
}
export function ResearchWorkbench() {
  return (
    <group>
      <Box p={[0, 0.87, 0]} s={[1.3, 0.09, 0.67]} c="#D0CEC1" />
      {[-0.5, 0.5].map((x) => (
        <Box key={x} p={[x, 0.4, 0]} s={[0.08, 0.8, 0.52]} c="#62737A" />
      ))}
      <Box p={[-0.35, 0.45, -0.02]} s={[0.38, 0.65, 0.5]} />
      <Monitor p={[0.25, 1.28, -0.16]} />
      <Box p={[-0.35, 1.02, 0.05]} s={[0.35, 0.2, 0.32]} c="#4B6770" />
      <Cylinder p={[-0.35, 1.17, 0.05]} s={[0.08, 0.12, 0.08]} c="#B5AF8E" />
      <Box p={[0.23, 0.95, 0.2]} s={[0.43, 0.025, 0.18]} c="#45565F" />
    </group>
  );
}
export function MaterialSampleRack() {
  return (
    <group>
      {[-0.43, 0.43].map((x) => (
        <Box key={x} p={[x, 0.8, 0]} s={[0.055, 1.6, 0.45]} c="#62737A" />
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Box p={[0, 0.18 + i * 0.49, 0]} s={[0.9, 0.055, 0.5]} c="#839091" />
          {[-0.27, 0, 0.27].map((x) => (
            <Box
              key={x}
              p={[x, 0.36 + i * 0.49, 0]}
              s={[0.16, 0.29, 0.07]}
              c={["#A0C1C1", "#C7B58E", "#878A89"][i]}
            />
          ))}
          <FaceLabel
            text={["POLYMER", "FABRIC", "COMPOSITE"][i]}
            p={[0, 0.15 + i * 0.49, 0.26]}
            width={0.8}
          />
        </group>
      ))}
    </group>
  );
}
export function CrewBed() {
  return (
    <group>
      <Box p={[0, 0.24, 0]} s={[0.95, 0.25, 1.95]} c="#5D6D76" />
      <Box p={[0, 0.43, 0]} s={[0.88, 0.17, 1.87]} c="#B7B2A2" />
      <Box p={[0, 0.54, -0.62]} s={[0.67, 0.13, 0.4]} c="#D0CFC3" />
      <Box p={[0, 0.54, 0.3]} s={[0.88, 0.06, 1.1]} c="#7B8D96" />
      {[-0.2, 0.65].map((z) => (
        <Box key={z} p={[0, 0.58, z]} s={[0.94, 0.035, 0.08]} c="#495E66" />
      ))}
      <Box p={[-0.48, 0.7, -0.78]} s={[0.04, 0.65, 0.04]} />
      <Box p={[-0.38, 1, -0.78]} s={[0.25, 0.04, 0.12]} c="#E2DDC4" />
    </group>
  );
}
export function EmergencyPanel() {
  return (
    <group>
      <Box p={[0, 0.25, 0]} s={[0.65, 0.55, 0.1]} c="#916B48" />
      <FaceLabel text="EMERGENCY" p={[0, 0.41, 0.052]} width={0.56} />
      {[-0.19, 0, 0.19].map((x) => (
        <Cylinder
          key={x}
          p={[x, 0.2, 0.07]}
          s={[0.045, 0.03, 0.045]}
          rotation={[Math.PI / 2, 0, 0]}
          c={x === 0 ? "#A84F3E" : "#BEB699"}
        />
      ))}
    </group>
  );
}
export function AirlockDoor() {
  return (
    <group>
      <Box p={[0, 1.05, 0]} s={[1.15, 2.1, 0.15]} c="#5D6C71" />
      <Box p={[0, 1.05, 0.1]} s={[0.99, 1.9, 0.07]} c="#AFB3A9" />
      <Cylinder
        p={[0, 1.5, 0.16]}
        s={[0.2, 0.04, 0.2]}
        rotation={[Math.PI / 2, 0, 0]}
        c="#334A57"
      />
      <mesh position={[0, 0.91, 0.2]}>
        <torusGeometry args={[0.23, 0.025, 6, 16]} />
        <meshStandardMaterial color="#566C74" />
      </mesh>
      <Box p={[0, 0.91, 0.2]} s={[0.44, 0.025, 0.04]} c="#566C74" />
      <FaceLabel text="PRESSURE HATCH" p={[0, 1.85, 0.141]} width={0.86} />
    </group>
  );
}
export function LightingFixture() {
  return (
    <group>
      <Box s={[1, 0.06, 0.18]} c="#55666C" />
      <mesh position={[0, -0.035, 0]}>
        <boxGeometry args={[0.92, 0.02, 0.13]} />
        <meshBasicMaterial color="#E8DEC4" toneMapped={false} />
      </mesh>
    </group>
  );
}
const EQUIPMENT_COMPONENTS = {
  rack: EquipmentRack,
  cabinet: StorageCabinet,
  duct: VentilationDuct,
  filter: AirFilter,
  detector: SmokeDetector,
  oxygen: OxygenControlPanel,
  extinguisher: FireExtinguisher,
  bench: ResearchWorkbench,
  samples: MaterialSampleRack,
  bed: CrewBed,
  emergency: EmergencyPanel,
  door: AirlockDoor,
  light: LightingFixture,
};
const HEIGHTS = {
  rack: 1.9,
  cabinet: 1.6,
  duct: 0.4,
  filter: 1.6,
  detector: 0.25,
  oxygen: 0.8,
  extinguisher: 0.8,
  bench: 1.6,
  samples: 1.65,
  bed: 1.1,
  emergency: 0.65,
  door: 2.1,
  light: 0.15,
};
function Equipment({ object }: { object: InteriorEquipment }) {
  const selected = useMissionStore((s) => s.selectedObjectId === object.id);
  const select = useMissionStore((s) => s.selectObject);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const Component = EQUIPMENT_COMPONENTS[object.type];
  const h = HEIGHTS[object.type];
  return (
    <group
      position={object.position}
      rotation={[0, object.rotation, 0]}
      scale={object.scale}
      ref={(node) => {
        if (node) interiorObjects.set(object.id, node);
        else interiorObjects.delete(object.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (e.delta > 4) return;
        e.stopPropagation();
        select(object.id);
      }}
    >
      <Component />
      {selected || hovered ? (
        <mesh raycast={() => {}} position={[0, h / 2, 0]}>
          <boxGeometry
            args={[
              object.type === "bed" ? 1.06 : 1.05,
              h + 0.08,
              object.type === "bed" ? 2.05 : 0.8,
            ]}
          />
          <meshBasicMaterial
            color={selected ? "#E8A36D" : "#EDEAE4"}
            wireframe
            transparent
            opacity={0.65}
            toneMapped={false}
            depthTest={false}
          />
        </mesh>
      ) : null}
      {hovered ? (
        <Html
          center
          position={[0, h + 0.2, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            role="tooltip"
            className="block whitespace-nowrap border border-[#68747A] bg-[#171C20] px-2 py-1 text-[11px] text-[#EDEAE4]"
          >
            {object.label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}
export function InteriorWall({
  position,
  size,
  color = "#9EA9A6",
}: {
  position: Vec3;
  size: Vec3;
  color?: string;
}) {
  return <Box p={position} s={size} c={color} />;
}
export function HabitatRoom({
  room,
  origin = room.position,
}: {
  room: HabitatRoomConfig;
  origin?: Vec3;
}) {
  const group = useRef<THREE.Group>(null);
  const selected = useMissionStore((s) => s.selectedRoomId === room.id);
  const exploded = useMissionStore((s) => s.exploded);
  const hideFront = useMissionStore((s) => s.hideFrontWalls);
  const hideRoof = useMissionStore((s) => s.hideRoof);
  const select = useMissionStore((s) => s.selectRoom);
  const fireHere = useFireSimStore((s) => s.activeRoomId === room.id);
  const invalidate = useThree((s) => s.invalidate);
  const reduce = useReducedMotion();
  const [w, h, d] = room.size;
  const targetY = origin[1] + levelOffset(room.level, exploded);
  useEffect(() => {
    invalidate();
  }, [targetY, invalidate]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const y = group.current.position.y;
    group.current.position.y = reduce
      ? targetY
      : THREE.MathUtils.damp(y, targetY, 7, delta);
    if (Math.abs(y - targetY) > 0.001) invalidate();
  });
  return (
    <group
      position={origin}
      ref={(node) => {
        group.current = node;
        if (node) interiorObjects.set(room.id, node);
        else interiorObjects.delete(room.id);
      }}
    >
      <group
        onClick={(e) => {
          if (e.delta > 4) return;
          e.stopPropagation();
          select(room.id);
        }}
      >
        {room.round ? (
          <mesh position={[0, -0.07, 0]} receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2, 0.14, 32]} />
            <meshStandardMaterial
              color={selected ? "#7D9192" : "#788285"}
              roughness={0.88}
            />
          </mesh>
        ) : (
          <Box
            p={[0, -0.07, 0]}
            s={[w, 0.14, d]}
            c={selected ? "#7D9192" : "#788285"}
          />
        )}
        <Box
          p={[0, 0.015, d * 0.34]}
          s={[w * 0.65, 0.015, 0.035]}
          c={room.color}
        />
        <InteriorWall
          position={[0, h / 2, -d / 2]}
          size={[room.round ? w * 0.7 : w, h, 0.12]}
          color="#9DA6A2"
        />
        <InteriorWall
          position={[-w / 2 + 0.06, h * 0.27, 0]}
          size={[0.12, h * 0.54, d * 0.75]}
        />
        <RemovablePanel
          position={[0, h / 2, d / 2]}
          size={[w * 0.34, h, 0.12]}
          open={hideFront}
        />
        <RemovablePanel
          position={[w * 0.4, h / 2, d / 2]}
          size={[w * 0.2, h, 0.12]}
          open={hideFront}
        />
        <RemovablePanel
          position={[0, h + 0.04, 0]}
          size={[w, 0.08, d]}
          open={hideRoof}
          roof
        />
        {selected ? (
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[Math.min(w, d) * 0.44, Math.min(w, d) * 0.46, 32]}
            />
            <meshBasicMaterial
              color={room.color}
              transparent
              opacity={0.7}
              toneMapped={false}
            />
          </mesh>
        ) : null}
      </group>
      <FaceLabel
        text={`${room.habitatId === "gateway-orbit" ? "MODULE" : `L${room.level}`} / ${room.name.split(" · ")[0].toUpperCase()}`}
        p={[0, 0.13, d / 2 + 0.065]}
        width={Math.min(w * 0.85, 2.1)}
        color={room.color}
      />
      <rectAreaLight
        position={[0, h - 0.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={w * 0.7}
        height={d * 0.6}
        color="#FFF1D7"
        intensity={room.habitatId === "gateway-orbit" ? 15 : 5}
      />
      {room.equipment.map((object) => (
        <Equipment key={object.id} object={object} />
      ))}
      {fireHere ? <FireEffects room={room} /> : null}
      {room.round ? (
        <group position={[-w * 0.35, 0, d * 0.17]}>
          {[-0.18, 0.18].map((x) => (
            <Cylinder key={x} p={[x, h / 2, 0]} s={[0.025, h, 0.025]} />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Cylinder
              key={i}
              p={[0, 0.2 + i * 0.34, 0]}
              s={[0.022, 0.4, 0.022]}
              rotation={[0, 0, Math.PI / 2]}
            />
          ))}
        </group>
      ) : null}
    </group>
  );
}
export function HabitatInterior({ habitatId }: { habitatId: MissionId }) {
  const level = useMissionStore((s) => s.selectedLevel);
  const mode = useMissionStore((s) => s.navigationMode);
  const rooms = roomsForHabitat(habitatId);
  const isolated =
    mode === "floor" || mode === "interior" || mode === "equipment";
  return (
    <group>
      <ambientLight intensity={0.65} color="#E6ECE6" />
      {rooms
        .filter((room) => !isolated || level === null || room.level === level)
        .map((room) => (
          <HabitatRoom key={room.id} room={room} />
        ))}
    </group>
  );
}

function RemovablePanel({
  position,
  size,
  open,
  roof = false,
}: {
  position: Vec3;
  size: Vec3;
  open: boolean;
  roof?: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const opacity = useRef(open ? 0 : 1);
  const reduce = useReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const panelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#697572",
        roughness: 0.85,
        transparent: true,
      }),
    [],
  );
  useEffect(() => {
    invalidate();
  }, [open, invalidate]);
  useEffect(() => () => panelMaterial.dispose(), [panelMaterial]);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    opacity.current = reduce
      ? open
        ? 0
        : 1
      : THREE.MathUtils.damp(opacity.current, open ? 0 : 1, 8, delta);
    panelMaterial.opacity = opacity.current;
    panelMaterial.depthWrite = opacity.current > 0.95;
    mesh.current.visible = opacity.current > 0.01;
    mesh.current.position.set(
      position[0],
      position[1] + (roof ? (1 - opacity.current) * 0.6 : 0),
      position[2] + (roof ? 0 : (1 - opacity.current) * 0.4),
    );
    mesh.current.raycast =
      opacity.current > 0.5 ? THREE.Mesh.prototype.raycast : () => {};
    if (Math.abs(opacity.current - (open ? 0 : 1)) > 0.001) invalidate();
  });
  return (
    <mesh
      ref={mesh}
      position={position}
      scale={size}
      geometry={UNIT_BOX}
      material={panelMaterial}
      dispose={null}
      receiveShadow
    />
  );
}
