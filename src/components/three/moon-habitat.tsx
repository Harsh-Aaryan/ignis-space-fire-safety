"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { lazy, Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useMissionStore } from "@/stores/mission-store";
import * as THREE from "three";
import { Hotspot } from "@/components/three/hotspot";
import { LunarSite } from "@/components/three/parts/lunar-site";
import type { EquipmentId } from "@/types/domain";

const DetailedInterior = lazy(() => import("@/components/three/habitat-interior").then(m => ({ default: m.HabitatInterior })));

const MOUND_URL = "/models/foster_esa_mound.glb";
const NO_CLIP: THREE.Plane[] = [];
const TUBE_R = 1.68;
const TUBE_Y = 1.62;
const Z_OPEN = 4.35;

const CLOTH = {
  color: "#8E8B84",
  roughness: 0.88,
  metalness: 0.12,
  sheen: 0.18,
  sheenColor: "#D4D0C8",
  sheenRoughness: 0.72,
  clearcoat: 0.04,
  clearcoatRoughness: 0.7,
} as const;

const RIM = {
  // #8E8B84 still clips under sun 24 × exposure 0.38. This is the same matte family, dark enough to stay under the mound.
  color: "#3A3836",
  roughness: 0.98,
  metalness: 0,
  sheen: 0,
  clearcoat: 0,
} as const;

const RAIL = {
  color: "#2C2A28",
  roughness: 1,
  metalness: 0,
  clearcoat: 0,
  sheen: 0,
} as const;

function useMoundMaps() {
  const [color, normal, rough] = useTexture([
    "/textures/moon/moon_01_color.webp",
    "/textures/moon/moon_01_normal.webp",
    "/textures/moon/moon_01_rough.webp",
  ]);
  useLayoutEffect(() => {
    color.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    rough.colorSpace = THREE.NoColorSpace;
    for (const texture of [color, normal, rough]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    }
  }, [color, normal, rough]);
  return { color, normal, rough };
}

function FosterMound({ clip }: { clip: THREE.Plane[] }) {
  const { scene } = useGLTF(MOUND_URL, "/draco/");
  const maps = useMoundMaps();
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const material = clip.length
      ? new THREE.MeshStandardMaterial({
          color: "#6E6A62",
          map: maps.color,
          roughnessMap: maps.rough,
          vertexColors: true,
          roughness: 0.96,
          metalness: 0,
          side: THREE.DoubleSide,
          clippingPlanes: clip,
        })
      : new THREE.MeshPhysicalMaterial({
          color: "#C4C0B8",
          map: maps.color,
          normalMap: maps.normal,
          normalScale: new THREE.Vector2(1.85, 1.85),
          roughnessMap: maps.rough,
          vertexColors: true,
          roughness: 0.97,
          metalness: 0,
          sheen: 0.14,
          sheenRoughness: 0.86,
          sheenColor: new THREE.Color("#C8C4BA"),
          side: THREE.DoubleSide,
        });
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry.clone();
      const position = geo.getAttribute("position");
      const normal = geo.getAttribute("normal");
      const uv = new Float32Array(position.count * 2);
      for (let i = 0; i < position.count; i += 1) {
        const crown = !normal || Math.abs(normal.getY(i)) > 0.55;
        uv[i * 2] = position.getX(i) / 4;
        uv[i * 2 + 1] = crown ? position.getZ(i) / 4 : position.getY(i) / 4;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      geo.setAttribute("uv2", new THREE.BufferAttribute(uv, 2));
      if (!normal) geo.computeVertexNormals();
      try {
        geo.computeTangents();
      } catch {
        /* indexed uv is enough for the normal map if tangents fail */
      }
      mesh.geometry = geo;
      mesh.material = material;
      mesh.castShadow = clip.length === 0;
      mesh.receiveShadow = true;
    });
    return clone;
  }, [clip, maps, scene]);
  return <primitive object={model} position={[0, 0.01, 0]} />;
}

function ProceduralMound({ clip }: { clip: THREE.Plane[] }) {
  const maps = useMoundMaps();
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.min(1, Math.hypot(x, z));
      const h = 4.6 * (1 - r ** 1.35) ** 0.9;
      const lump = Math.sin(x * 6.2) * Math.cos(z * 5.4) * 0.16 * r;
      const px = x * 10.2;
      const pz = z * 9.0 - 1.1;
      pos.setXYZ(i, px, Math.max(0.04, h + lump), pz);
      uv.setXY(i, px / 9, pz / 9);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        clippingPlanes={clip}
        side={THREE.DoubleSide}
        color="#6E6A62"
        map={maps.color}
        normalMap={maps.normal}
        normalScale={new THREE.Vector2(0.4, 0.4)}
        roughness={0.97}
        metalness={0}
      />
    </mesh>
  );
}

function Rail({ position, args, rotation }: { position: [number, number, number]; args: [number, number, number, number]; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={args} />
      <meshPhysicalMaterial {...RAIL} />
    </mesh>
  );
}

function ClusterLamp({ x }: { x: number }) {
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);
  return (
    <group position={[x, TUBE_Y + 0.98 + 0.36, Z_OPEN + 0.22]}>
      <mesh>
        <boxGeometry args={[0.16, 0.08, 0.12]} />
        <meshPhysicalMaterial {...RIM} />
      </mesh>
      <mesh position={[0, -0.04, 0.03]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshPhysicalMaterial color="#8E8B84" roughness={0.9} emissive="#8E8B84" emissiveIntensity={0.04} />
      </mesh>
      <spotLight ref={light} color="#FFF4E0" intensity={0.35} distance={9} angle={0.55} penumbra={0.45} decay={1.4} position={[0, -0.05, 0.05]} />
      <object3D ref={target} position={[0, -1.4, 1.8]} />
    </group>
  );
}

function Airlock({ clip }: { clip: THREE.Plane[] }) {
  const cloth = useMemo(() => new THREE.MeshPhysicalMaterial({ ...CLOTH, clippingPlanes: clip }), [clip]);
  const doorCloth = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#8E8B84",
        roughness: 0.88,
        metalness: 0,
        sheen: 0,
        clearcoat: 0,
        clippingPlanes: clip,
      }),
    [clip],
  );
  const lipZ = Z_OPEN + 0.18;
  const doorZ = lipZ - 0.4;
  const z0 = Z_OPEN - 0.28;
  const len = lipZ - z0;
  const mid = (z0 + lipZ) / 2;
  const r = TUBE_R - 0.015;
  const doorR = 0.98;
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, TUBE_Y, mid]} castShadow receiveShadow material={cloth}>
        <cylinderGeometry args={[r, r, len, 48, 1, true]} />
      </mesh>
      {[0.14, 0.3].map((offset) => (
        <mesh key={offset} position={[0, TUBE_Y, doorZ + offset]}>
          <torusGeometry args={[r + 0.012, 0.028, 8, 40]} />
          <meshPhysicalMaterial {...RIM} />
        </mesh>
      ))}
      <mesh position={[0, TUBE_Y, lipZ]}>
        <torusGeometry args={[r - 0.02, 0.045, 8, 40]} />
        <meshPhysicalMaterial {...RIM} />
      </mesh>
      <mesh position={[0, TUBE_Y, doorZ + 0.03]} castShadow>
        <torusGeometry args={[doorR, 0.05, 10, 40]} />
        <meshPhysicalMaterial {...RIM} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, TUBE_Y, doorZ + 0.01]}>
        <cylinderGeometry args={[doorR + 0.06, doorR + 0.06, 0.06, 40]} />
        <meshPhysicalMaterial {...RIM} />
      </mesh>
      <mesh position={[0, TUBE_Y, doorZ - 0.02]} castShadow material={doorCloth}>
        <circleGeometry args={[doorR - 0.02, 40]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, TUBE_Y, doorZ - 0.7]}>
        <cylinderGeometry args={[doorR - 0.04, doorR - 0.04, 1.3, 28, 1, true]} />
        <meshPhysicalMaterial color="#1A1C1E" roughness={0.86} metalness={0.05} side={THREE.BackSide} />
      </mesh>
      <pointLight color="#F0E0C0" intensity={0.15} distance={3.2} decay={2} position={[0, TUBE_Y, doorZ - 0.9]} />
      <mesh position={[0, TUBE_Y + 0.42, doorZ + 0.01]}>
        <circleGeometry args={[0.16, 20]} />
        <meshPhysicalMaterial color="#8E8B84" roughness={0.88} metalness={0} />
      </mesh>
      <mesh position={[0, TUBE_Y + 0.42, doorZ + 0.02]}>
        <torusGeometry args={[0.17, 0.016, 8, 18]} />
        <meshPhysicalMaterial {...RIM} />
      </mesh>
      <Rail position={[0, TUBE_Y + doorR + 0.16, lipZ + 0.04]} rotation={[0, 0, Math.PI / 2]} args={[0.028, 0.028, 1.15, 10]} />
      <Rail position={[0, TUBE_Y - doorR - 0.16, lipZ + 0.04]} rotation={[0, 0, Math.PI / 2]} args={[0.028, 0.028, 1.15, 10]} />
      <Rail position={[doorR + 0.16, TUBE_Y, lipZ + 0.04]} args={[0.028, 0.028, 1.15, 10]} />
      <Rail position={[-doorR - 0.16, TUBE_Y, lipZ + 0.04]} args={[0.028, 0.028, 1.15, 10]} />
      <ClusterLamp x={-0.28} />
      <ClusterLamp x={0.28} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, TUBE_Y, Z_OPEN - 2.4]}>
        <cylinderGeometry args={[TUBE_R - 0.04, TUBE_R - 0.04, 5.2, 24]} />
        <meshPhysicalMaterial color="#1A1C1E" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  );
}

function Panel({ sign, open }: { sign: number; open: number }) {
  const ang = open;
  const y = 0.1 + 0.77 * Math.cos(ang) - 0.77;
  const z = 0.04 * sign + 0.77 * Math.sin(ang * sign);
  return (
    <group position={[0, y, z]} rotation={[ang * sign, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.88, 1.72, 0.032]} />
        <meshPhysicalMaterial color="#8A8680" roughness={0.7} metalness={0.08} clearcoat={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.022 * sign]}>
        <boxGeometry args={[0.84, 1.66, 0.008]} />
        <meshPhysicalMaterial color="#7A6A3C" roughness={0.55} metalness={0.35} clearcoat={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CrownRadiators() {
  const { scene } = useGLTF(MOUND_URL, "/draco/");
  const units = useMemo(() => {
    const ray = new THREE.Raycaster();
    const spots = [
      { x: -1.55, z: -1.15, yaw: 0.78, open: 0.28 },
      { x: 0.35, z: -1.85, yaw: 1.05, open: 0.22 },
    ];
    return spots.map((spot) => {
      ray.set(new THREE.Vector3(spot.x, 9, spot.z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObject(scene, true);
      const y = (hits.length ? hits[0].point.y : 5.4) - 0.85;
      return { ...spot, y };
    });
  }, [scene]);
  return (
    <group>
      {units.map((unit) => (
        <group key={`${unit.x}-${unit.z}`} position={[unit.x, unit.y, unit.z]} rotation={[0, unit.yaw, 0]}>
          <mesh position={[0, 0.04, 0]} castShadow>
            <boxGeometry args={[0.42, 0.1, 0.28]} />
            <meshPhysicalMaterial color="#8A8680" roughness={0.7} metalness={0.08} clearcoat={0} />
          </mesh>
          <Panel sign={1} open={unit.open} />
          <Panel sign={-1} open={unit.open} />
        </group>
      ))}
    </group>
  );
}

function LowRadiator() {
  return (
    <group position={[0, 4.15, -0.6]} rotation={[0.2, 0.9, 0]}>
      <mesh>
        <boxGeometry args={[0.88, 0.28, 0.032]} />
        <meshPhysicalMaterial color="#8A8680" roughness={0.7} metalness={0.08} clearcoat={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Stars() {
  const geometry = useMemo(() => {
    const data = new Float32Array(170 * 3);
    for (let i = 0; i < 170; i += 1) {
      const theta = Math.PI * 2 * Math.random();
      const phi = Math.acos(0.08 + 0.92 * Math.random());
      const radius = 800;
      data[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      data[i * 3 + 1] = radius * Math.cos(phi);
      data[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(data, 3));
    return geo;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#E6E4DE" size={1.15} sizeAttenuation={false} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function CellularWall({ clip }: { clip: THREE.Plane[] }) {
  const cells = useMemo(() => {
    const list: Array<[number, number, number]> = [];
    for (let layer = 0; layer < 3; layer += 1) {
      const radius = TUBE_R + 0.42 + layer * 0.42;
      const count = Math.round((Math.PI * radius) / 0.42);
      for (let i = 0; i < count; i += 1) {
        const a = Math.PI * 0.15 + (i / count) * Math.PI * 0.7;
        list.push([0.62, TUBE_Y + Math.sin(a) * radius * 0.55, Z_OPEN - 1.1 - layer * 0.55 + Math.cos(a) * 0.8]);
      }
    }
    return list;
  }, []);
  return (
    <group>
      {cells.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.175, 8, 6]} />
          <meshStandardMaterial color="#3A3834" roughness={0.95} clippingPlanes={clip} />
        </mesh>
      ))}
    </group>
  );
}

function Marker({ id, position, registry }: { id: EquipmentId; position: [number, number, number]; registry: React.RefObject<Map<EquipmentId, THREE.Object3D>> }) {
  return (
    <Hotspot id={id} position={position} registry={registry} groundRadius={1.1} anchorY={position[1]}>
      <mesh>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </Hotspot>
  );
}

export function MoonHabitat({
  registry,
  coarse,
  cutaway,
}: {
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
  cutaway: boolean;
  exploded: boolean;
}) {
  const navigation = useMissionStore(s => s.navigationMode);
  const hideFront = useMissionStore(s => s.hideFrontWalls);
  const hideRoof = useMissionStore(s => s.hideRoof);
  const explodedView = useMissionStore(s => s.exploded);
  const isolate = cutaway && (navigation === "floor" || navigation === "interior" || navigation === "equipment" || explodedView);
  const clip = useMemo(() => cutaway ? [...(hideFront ? [new THREE.Plane(new THREE.Vector3(-0.45, -0.65, -1).normalize(), 0.4)] : []), ...(hideRoof ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 3.3)] : [])] : [], [cutaway, hideFront, hideRoof]);
  return (
    <group>
      <Stars />
      <LunarSite coarse={coarse} />
      {!isolate ? (coarse ? <ProceduralMound clip={clip} /> : <FosterMound clip={clip} />) : null}
      {!cutaway ? <Airlock clip={NO_CLIP} /> : null}
      {!cutaway ? (coarse ? <LowRadiator /> : <CrownRadiators />) : null}
      {cutaway ? <Suspense fallback={null}><DetailedInterior habitatId="lunar-habitat" /></Suspense> : null}
      <Marker id="shell" position={[0, 4.4, 0.4]} registry={registry} />
      <Marker id="airlock-oxygen" position={[0, TUBE_Y, Z_OPEN + 0.4]} registry={registry} />
      <Marker id="laboratory" position={[1.5, 1.25, -0.4]} registry={registry} />
      <Marker id="material-storage" position={[-1.6, 1.2, -0.8]} registry={registry} />
      <Marker id="ventilation" position={[0.35, 1.55, -1.5]} registry={registry} />
      <Marker id="living-quarters" position={[0.2, 3.35, -0.7]} registry={registry} />
      <Marker id="smoke-detection" position={[0.9, 3.7, 0.1]} registry={registry} />
      <Marker id="fire-suppression" position={[-0.8, 1.85, 0.2]} registry={registry} />
    </group>
  );
}
