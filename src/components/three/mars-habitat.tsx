"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { lazy, Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Hotspot } from "@/components/three/hotspot";
import { useMissionStore } from "@/stores/mission-store";
import { DisplacedGround, MarsSky, heightAt } from "@/components/three/parts/reality";
import type { EquipmentId } from "@/types/domain";

const DetailedInterior = lazy(() => import("@/components/three/habitat-interior").then(m => ({ default: m.HabitatInterior })));

const H = 13.72;
const CURIOSITY = {
  high: "/models/curiosity.glb",
  medium: "/models/curiosity-25k.glb",
} as const;
const ROCK_URL = "/models/namaqualand-rocks.glb";

type Tier = "high" | "medium" | "low";

function marshaRadius(height: number) {
  const t = Math.max(0, Math.min(1, height / H));
  const tMax = 0.38;
  if (t < tMax) {
    const u = t / tMax;
    return 3.18 + (3.66 - 3.18) * (1 - (1 - u) ** 1.55);
  }
  const u = (t - tMax) / (1 - tMax);
  return 3.66 + (1.92 - 3.66) * u ** 1.72;
}

function paintRibs(kind: "normal" | "rough") {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  texture.colorSpace = THREE.NoColorSpace;
  if (!ctx) return texture;
  const image = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y += 1) {
    const phase = ((y / 256) * (H / 0.152)) % 1;
    const bead = phase < 0.72 ? Math.sin((phase / 0.72) * Math.PI) : 0;
    const value = kind === "normal" ? Math.round(40 + bead * 180) : phase < 0.2 || phase > 0.85 ? 230 : 90;
    for (let x = 0; x < 64; x += 1) {
      const i = (y * 64 + x) * 4;
      image.data[i] = kind === "normal" ? 128 : value;
      image.data[i + 1] = value;
      image.data[i + 2] = kind === "normal" ? 255 : value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.needsUpdate = true;
  return texture;
}

function ribTexture() {
  return { normal: paintRibs("normal"), rough: paintRibs("rough") };
}

function shellGeometry(radial: number, stacks: number, ribs: boolean) {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= stacks; i += 1) {
    const h = (i / stacks) * H;
    let radius = marshaRadius(h);
    if (ribs) {
      const phase = (h / 0.152) % 1;
      const bead = phase < 0.72 ? Math.sin((phase / 0.72) * Math.PI) : 0;
      radius += 0.01 * bead;
    }
    points.push(new THREE.Vector2(Math.max(0.08, radius), h));
  }
  const geo = new THREE.LatheGeometry(points, radial);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const dust = THREE.MathUtils.smoothstep(2, 0.05, pos.getY(i)) * 0.18;
    cols[i * 3] = 0.012 + dust * 0.08;
    cols[i * 3 + 1] = 0.011 + dust * 0.055;
    cols[i * 3 + 2] = 0.01 + dust * 0.035;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

function ShellMaterial({
  clip,
  ribs,
}: {
  clip: THREE.Plane[];
  ribs: { normal: THREE.Texture; rough: THREE.Texture };
}) {
  return (
    <meshPhysicalMaterial
      color="#FFFFFF"
      vertexColors
      roughness={0.74}
      metalness={0.06}
      sheen={0.1}
      sheenRoughness={0.75}
      sheenColor="#6A6864"
      clearcoat={0.04}
      clearcoatRoughness={0.8}
      normalMap={ribs.normal}
      normalScale={new THREE.Vector2(1.35, 2.1)}
      roughnessMap={ribs.rough}
      clippingPlanes={clip}
      side={clip.length ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

function WindowUnit({ width, height }: { width: number; height: number }) {
  return (
    <group>
      <mesh position={[0, 0, 0.02]} castShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.16]} />
        <meshPhysicalMaterial color="#C8C4BE" roughness={0.35} metalness={0.7} clearcoat={0.4} clearcoatRoughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[width, height, 0.04]} />
        <meshPhysicalMaterial
          color="#E8F0F4"
          roughness={0.06}
          metalness={0}
          transmission={0.55}
          thickness={0.04}
          ior={1.5}
          emissive="#E8F0F4"
          emissiveIntensity={0.3}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>
      {height > 0.9 ? (
        <mesh position={[0, 0.08, 0.12]}>
          <boxGeometry args={[width + 0.02, 0.05, 0.06]} />
          <meshPhysicalMaterial color="#C8C4BE" roughness={0.35} metalness={0.7} />
        </mesh>
      ) : null}
    </group>
  );
}

function place(height: number, angleDeg: number, inset = 0.02): [number, number, number, number] {
  const radius = marshaRadius(height) - inset;
  const angle = (angleDeg * Math.PI) / 180;
  return [Math.sin(angle) * radius, height, Math.cos(angle) * radius, angle];
}

function Marsha({
  tier,
  clip,
  ribs,
  windows,
  open = false,
}: {
  tier: Tier;
  clip: THREE.Plane[];
  ribs: { normal: THREE.Texture; rough: THREE.Texture };
  windows: boolean;
  open?: boolean;
}) {
  const radial = tier === "high" ? 80 : tier === "medium" ? 48 : 32;
  const stacks = tier === "high" ? 140 : tier === "medium" ? 80 : 48;
  const geometry = useMemo(
    () => shellGeometry(radial, stacks, tier === "high"),
    [radial, stacks, tier],
  );
  const units = [
    { h: 5.15, a: 8, w: 0.55, hh: 1.15 },
    { h: 8.35, a: 8, w: 0.55, hh: 1.15 },
    { h: 5.15, a: -42, w: 0.5, hh: 1.05 },
    { h: 8.35, a: 52, w: 0.5, hh: 1.05 },
    { h: 5.15, a: 118, w: 0.48, hh: 1.0 },
  ];
  const capTheta = Math.PI * 0.22;
  const capR = 1.95;
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow userData={{ noLabelOcclude: true }}>
        <ShellMaterial clip={clip} ribs={ribs} />
      </mesh>
      <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[4.05, 4.15, 0.38, 8]} />
        <meshPhysicalMaterial color="#2A2826" roughness={0.7} metalness={0.15} />
      </mesh>
      {!open ? <>
      <mesh position={[0, H - capR * Math.cos(capTheta) + 0.02, 0]} castShadow>
        <sphereGeometry args={[capR, tier === "low" ? 16 : 32, tier === "low" ? 8 : 16, 0, Math.PI * 2, 0, capTheta]} />
        <meshPhysicalMaterial
          color="#F4F6F8"
          roughness={0.08}
          metalness={0}
          transmission={0.42}
          thickness={0.05}
          ior={1.5}
          emissive="#F4F6F8"
          emissiveIntensity={0.3}
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>
      <mesh position={[0, 13.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[capR * Math.sin(capTheta), 0.045, 8, tier === "low" ? 16 : 32]} />
        <meshPhysicalMaterial color="#C8C4BE" roughness={0.35} metalness={0.65} clearcoat={0.4} />
      </mesh>
      </> : null}
      {windows
        ? units.map((unit) => {
            const [x, y, z, angle] = place(unit.h, unit.a);
            return (
              <group key={`${unit.h}-${unit.a}`} position={[x, y, z]} rotation={[0, angle, 0]}>
                <WindowUnit width={unit.w} height={unit.hh} />
              </group>
            );
          })
        : null}
      {windows ? (
        <group position={[0, 1.15, marshaRadius(1.15) + 0.02]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.92, 0.92, 0.14, 28]} />
            <meshPhysicalMaterial color="#C8C4BE" roughness={0.32} metalness={0.75} clearcoat={0.45} />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <circleGeometry args={[0.68, 28]} />
            <meshPhysicalMaterial color="#1A1C1E" roughness={0.5} metalness={0.4} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function Rover({ url }: { url: string }) {
  const { scene } = useGLTF(url, "/draco/");
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  useEffect(() => {
    let triangles = 0;
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const position = mesh.geometry.getAttribute("position");
      if (!position) return;
      triangles += mesh.geometry.index ? mesh.geometry.index.count / 3 : position.count / 3;
    });
    (window as Window & { __IGNIS_ROVER?: number }).__IGNIS_ROVER = Math.round(triangles);

  }, [model, url]);
  return <primitive object={model} position={[7.4, heightAt(7.4, 8.6), 8.6]} rotation={[0, -0.85, 0]} scale={0.735} />;
}

const BOULDER_SPOTS = [
  { x: -2.4, z: 8.6, size: 2.2, yaw: 0.5 },
  { x: 11.2, z: 6.4, size: 1.8, yaw: 1.1 },
];

function Boulders({ count }: { count: number }) {
  const { scene } = useGLTF(ROCK_URL, "/draco/");
  const [albedo, normal, rough, ao] = useTexture([
    "/textures/mars/namaqualand_color.webp",
    "/textures/mars/namaqualand_normal.webp",
    "/textures/mars/namaqualand_rough.webp",
    "/textures/mars/namaqualand_ao.webp",
  ]);
  const rocks = useMemo(() => {
    albedo.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    rough.colorSpace = THREE.NoColorSpace;
    ao.colorSpace = THREE.NoColorSpace;
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });
    return meshes.slice(0, count).map((mesh, index) => {
      const spot = BOULDER_SPOTS[index] ?? BOULDER_SPOTS[0];
      const clone = mesh.clone();
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.scale.set(1, 1, 1);
      clone.updateMatrixWorld(true);
      if (!clone.geometry.getAttribute("uv2") && clone.geometry.getAttribute("uv")) {
        clone.geometry.setAttribute("uv2", clone.geometry.getAttribute("uv").clone());
      }
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const scale = spot.size / Math.max(size.x, size.z, 0.05);
      const material = new THREE.MeshPhysicalMaterial({
        color: index === 1 ? "#BEB4A8" : "#C8B8A8",
        map: albedo,
        normalMap: normal,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: rough,
        roughness: 0.92,
        metalness: 0.02,
        aoMap: ao,
        aoMapIntensity: 1,
      });
      clone.material = material;
      clone.castShadow = true;
      clone.receiveShadow = true;
      clone.userData.noLabelOcclude = true;
      const y = heightAt(spot.x, spot.z) - box.min.y * scale - size.y * scale * 0.18;
      return { clone, spot, scale, y };
    });
  }, [albedo, ao, count, normal, rough, scene]);
  return (
    <>
      {rocks.map(({ clone, spot, scale, y }) => (
        <primitive key={`${spot.x}-${spot.z}`} object={clone} position={[spot.x, y, spot.z]} rotation={[0, spot.yaw, 0]} scale={scale} />
      ))}
    </>
  );
}

function SolarFarm() {
  const panels = [];
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      panels.push([i, j] as const);
    }
  }
  return (
    <group position={[14.2, heightAt(14.2, -13.2), -13.2]} rotation={[0, -0.4, 0]}>
      {panels.map(([i, j]) => (
        <group key={`${i}-${j}`}>
          <mesh position={[(i - 1) * 2.4, 0.72, (j - 0.5) * 1.7]} rotation={[-0.35, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.1, 0.04, 1.15]} />
            <meshPhysicalMaterial color="#3E3832" roughness={0.84} metalness={0.06} clearcoat={0.04} clearcoatRoughness={0.7} />
          </mesh>
          <mesh position={[(i - 1) * 2.4, 0.32, (j - 0.5) * 1.7 + 0.28]}>
            <boxGeometry args={[0.06, 0.64, 0.06]} />
            <meshPhysicalMaterial color="#6A645C" roughness={0.72} metalness={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}



export function MarsHabitat({
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
  const dusk = useMissionStore((state) => state.marsDusk);
  const viewport = typeof window === "undefined" ? 1440 : window.innerWidth;
  const tier: Tier = coarse || viewport < 768 ? "low" : viewport < 1100 ? "medium" : "high";
  const ribs = useMemo(() => ribTexture(), []);
  const clip = useMemo(() => cutaway && hideFront ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), -0.2)] : [], [cutaway, hideFront]);
  const segments = tier === "high" ? 112 : tier === "medium" ? 96 : 64;
  return (
    <group>
      <MarsSky dusk={dusk} />
      <DisplacedGround segments={segments} size={420} repeat={72} />
      <group position={[0, 0.05, 0]} rotation={[0, 0.35, 0]}>
        {!isolate ? <Marsha tier={tier} clip={clip} ribs={ribs} windows={!cutaway && tier !== "low"} open={cutaway && hideRoof} /> : null}
        {cutaway ? <Suspense fallback={null}><DetailedInterior habitatId="mars-habitat" /></Suspense> : null}
        <Hotspot id="shell" position={[0, 6.2, marshaRadius(6.2) + 0.3]} registry={registry} groundRadius={4.2} anchorY={6.2}>
          <mesh>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="airlock-oxygen" position={[0, 1.15, marshaRadius(1.15) + 0.4]} registry={registry} groundRadius={1.2} anchorY={1.15}>
          <mesh>
            <sphereGeometry args={[0.28, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="material-storage" position={[-1.6, 1.3, 1.2]} registry={registry} groundRadius={1.1} anchorY={1.3}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="laboratory" position={[1.4, 4.9, 1.5]} registry={registry} groundRadius={1.3} anchorY={4.9}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="ventilation" position={[-1.2, 4.7, -1.1]} registry={registry} groundRadius={1.1} anchorY={4.7}>
          <mesh>
            <boxGeometry args={[0.4, 0.8, 0.4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="living-quarters" position={[0.2, 8.2, -1.4]} registry={registry} groundRadius={1.6} anchorY={8.2}>
          <mesh>
            <boxGeometry args={[0.5, 0.6, 0.5]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="smoke-detection" position={[0.8, 8.6, 0.6]} registry={registry} groundRadius={0.8} anchorY={8.6}>
          <mesh>
            <boxGeometry args={[0.3, 0.2, 0.3]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
        <Hotspot id="fire-suppression" position={[-0.8, 4.4, 0.8]} registry={registry} groundRadius={0.8} anchorY={4.4}>
          <mesh>
            <boxGeometry args={[0.3, 0.5, 0.3]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
      </group>
      <group position={[8, heightAt(8, -20) + 0.05, -20]} rotation={[0, -0.6, 0]}>
        <Marsha tier="low" clip={[]} ribs={ribs} windows={false} />
      </group>
      {tier === "low" ? null : <Rover url={tier === "medium" ? CURIOSITY.medium : CURIOSITY.high} />}
      {tier === "low" ? null : <Boulders count={tier === "medium" ? 1 : 2} />}
      {tier === "low" ? null : <SolarFarm />}
    </group>
  );
}
