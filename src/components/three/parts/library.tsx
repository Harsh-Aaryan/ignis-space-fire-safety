"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { OutlinePass } from "@/components/three/hotspot";

export const MLI = "#C4BEB4";
export const ALUMINIUM = "#8A8E94";
export const RADIATOR = "#E8E4DC";
export const SOLAR = "#1A1E24";
export const REGOLITH = "#6F5A4A";
export const BERM = "#85715F";
export const APRON = "#5A5048";

export function paintTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 512,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function crinkleNormal(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(size, size);
  const valueNoise = (u: number, v: number) => {
    const x = Math.sin(u * 12.7 + v * 4.1) * 43758.5453;
    const y = Math.sin(u * 3.1 - v * 9.4) * 24634.6345;
    return (x - Math.floor(x) + (y - Math.floor(y))) * 0.5;
  };
  const height = (u: number, v: number) =>
    Math.sin(u * 40 + 2 * Math.sin(v * 8)) +
    Math.sin(v * 30 + 2 * Math.sin(u * 6)) +
    valueNoise(u, v) * 0.85 +
    valueNoise(u * 2.1, v * 2.3) * 0.4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const eps = 0.04;
      const dx = height(u + eps, v) - height(u - eps, v);
      const dy = height(u, v + eps) - height(u, v - eps);
      const nx = -dx * 0.85;
      const ny = -dy * 0.85;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz);
      const index = (y * size + x) * 4;
      image.data[index] = (nx / length) * 127 + 128;
      image.data[index + 1] = (ny / length) * 127 + 128;
      image.data[index + 2] = (nz / length) * 127 + 128;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function latheBarrel(length: number, radius: number, radial: number) {
  const fillet = 0.05;
  const half = length / 2;
  const steps = 20;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const y = -half + (i / steps) * length;
    const past = Math.abs(y) - (half - fillet);
    let r = radius;
    if (past > 0) {
      const t = Math.min(1, past / fillet);
      r = radius - fillet + Math.cos(t * Math.PI * 0.5) * fillet;
    }
    points.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  return new THREE.LatheGeometry(points, radial);
}

export function Barrel({
  length,
  radius,
  radial = 28,
  clip = [],
  dust = false,
}: {
  length: number;
  radius: number;
  radial?: number;
  clip?: THREE.Plane[];
  dust?: boolean;
}) {
  const geometry = useMemo(() => latheBarrel(length, radius, radial), [length, radius, radial]);
  const weave = useMemo(
    () =>
      paintTexture((ctx, size) => {
        ctx.fillStyle = dust ? "#C4B8A4" : MLI;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1800; i += 1) {
          const x = (i * 47) % size;
          const y = (i * 83) % size;
          const shade = 210 + ((i * 17) % 28);
          ctx.fillStyle = `rgba(${shade},${shade - 6},${shade - 12},0.05)`;
          ctx.fillRect(x, y, 3 + (i % 4), 2);
        }
        if (dust) {
          const fade = ctx.createLinearGradient(0, 0, 0, size);
          fade.addColorStop(0, "rgba(138,118,96,0)");
          fade.addColorStop(0.55, "rgba(138,118,96,0.15)");
          fade.addColorStop(1, "rgba(138,118,96,0.7)");
          ctx.fillStyle = fade;
          ctx.fillRect(0, 0, size, size);
        }
        ctx.strokeStyle = "rgba(90,86,80,0.08)";
        for (let y = 0; y < size; y += 10) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y + Math.sin(y) * 1.2);
          ctx.stroke();
        }
      }, 256),
    [dust],
  );
  const normal = useMemo(() => crinkleNormal(), []);
  const cut = clip.length > 0;
  const seams = Math.max(1, Math.floor(length / 1.2));
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={dust ? "#C4B8A4" : MLI}
          map={weave}
          normalMap={normal}
          normalScale={new THREE.Vector2(0.4, 0.4)}
          roughness={dust ? 0.9 : 0.9}
          metalness={0.02}
          sheen={0.04}
          sheenColor="#EDE8DC"
          sheenRoughness={0.55}
          clippingPlanes={clip}
          side={cut ? THREE.DoubleSide : THREE.FrontSide}
        />
        <OutlinePass />
      </mesh>
      {Array.from({ length: seams }, (_, index) => {
        const y = -length / 2 + ((index + 1) * length) / (seams + 1);
        return (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius + 0.01, 0.02, 6, 20]} />
            <meshPhysicalMaterial color={ALUMINIUM} roughness={0.38} metalness={0.82} clearcoat={0.55} clearcoatRoughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

export function RadiatorPanel({
  position,
  rotation,
  length = 4,
  width = 1.6,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  width?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[length, width, 0.06]} />
      <meshPhysicalMaterial color={RADIATOR} roughness={0.48} metalness={0.04} />
    </mesh>
  );
}

export function SolarWing({
  position,
  rotation,
  size,
  dust = false,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  dust?: boolean;
}) {
  const map = useMemo(() => {
    if (!dust) return null;
    return paintTexture((ctx, pixels) => {
      ctx.fillStyle = SOLAR;
      ctx.fillRect(0, 0, pixels, pixels);
      ctx.fillStyle = "rgba(138,118,96,0.15)";
      ctx.fillRect(0, 0, pixels, pixels);
    }, 128);
  }, [dust]);
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshPhysicalMaterial color="#0C1218" map={map} roughness={0.18} metalness={0.1} clearcoat={1} clearcoatRoughness={0.06} ior={1.45} />
    </mesh>
  );
}

export function Tank({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.6, 0.6, 2.4, 12]} />
      <meshPhysicalMaterial color={ALUMINIUM} roughness={0.38} metalness={0.82} clearcoat={0.55} clearcoatRoughness={0.4} />
    </mesh>
  );
}

export function VentDuct({ length = 3.2 }: { length?: number }) {
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.16, 0.16, length, 8]} />
      <meshPhysicalMaterial color={ALUMINIUM} roughness={0.38} metalness={0.82} clearcoat={0.55} clearcoatRoughness={0.4} />
      <OutlinePass />
    </mesh>
  );
}

export function Detector() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.14, 0.14, 0.06, 8]} />
      <meshPhysicalMaterial color="#6A6864" roughness={0.6} metalness={0.15} />
      <OutlinePass />
    </mesh>
  );
}

export function Suppression() {
  return (
    <mesh>
      <cylinderGeometry args={[0.1, 0.1, 0.64, 8]} />
      <meshPhysicalMaterial color="#6A6864" roughness={0.7} metalness={0.2} />
      <OutlinePass />
    </mesh>
  );
}

export function Rack({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={args} />
      <meshPhysicalMaterial color="#4A5560" roughness={0.45} metalness={0.6} />
    </mesh>
  );
}

export function DockingPort() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[1, 0.08, 6, 20]} />
        <meshPhysicalMaterial color={ALUMINIUM} roughness={0.38} metalness={0.82} clearcoat={0.55} clearcoatRoughness={0.4} />
        <OutlinePass />
      </mesh>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]} position={[Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0.1]}>
          <boxGeometry args={[0.28, 0.08, 0.2]} />
          <meshPhysicalMaterial color={ALUMINIUM} roughness={0.38} metalness={0.82} clearcoat={0.55} clearcoatRoughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
