"use client";

import { ContactShadows, OrbitControls, SoftShadows, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, SSAO, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useReducedMotion } from "motion/react";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { interiorObjects } from "@/components/three/habitat-interior";
import { roomsForHabitat, roomById } from "@/data/habitat-interiors";
import { GatewayHabitat } from "@/components/three/gateway-habitat";
import { HabitatDecor, HOTSPOT_LABEL, Hotspot, OutlinePass, hoverBus } from "@/components/three/hotspot";
import { MARS_EQUIPMENT_LABEL, MOON_EQUIPMENT_LABEL } from "@/lib/labels";
import { FOCUS_FOV, LIGHTING, LIGHT_UNIT_SCALE, MARS_DUSK, lightingForMission } from "@/components/three/lighting";
import { LunarSite } from "@/components/three/parts/lunar-site";
import { LocalHdrEnvironment, SceneEnvironment } from "@/components/three/parts/reality";
import { MarsHabitat } from "@/components/three/mars-habitat";
import { MoonHabitat } from "@/components/three/moon-habitat";
import { useMissionStore } from "@/stores/mission-store";
import { navigationBounds } from "@/lib/three/navigation-bounds";
import type { EquipmentId, MissionId } from "@/types/domain";

type Vec3 = [number, number, number];

const Y = 2.8;
const DEFAULT_POS: Vec3 = [17, 8.6, 24];
const DEFAULT_TARGET: Vec3 = [-0.4, 1.6, 0];
const MODULE_PLATES: EquipmentId[] = ["laboratory", "material-storage", "living-quarters", "airlock-oxygen"];
const LABEL_RANK: EquipmentId[] = [
  "laboratory",
  "material-storage",
  "living-quarters",
  "airlock-oxygen",
  "shell",
  "ventilation",
  "smoke-detection",
  "fire-suppression",
];
interface Anim {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  rate: number;
}

function useCoarse() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse), (max-width: 767px)");
    const apply = () => setCoarse(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return coarse;
}

function paint(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256) {
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

function useSurfaces() {
  return useMemo(() => {
    const regolith = paint((ctx, size) => {
      ctx.fillStyle = "#8A8478";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#6E675C";
      for (let i = 0; i < 10; i += 1) {
        const cx = (i * 47) % size;
        const cy = (i * 83) % size;
        const radius = 8 + (i % 5) * 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.72, i, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 1400; i += 1) {
        const x = (i * 97) % size;
        const y = (i * 57) % size;
        const shade = 110 + ((i * 13) % 40);
        ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
        ctx.fillRect(x, y, 1 + (i % 3), 1 + (i % 2));
      }
    });
    regolith?.repeat.set(56 / 3.1, 56 / 3.1);
    const pad = paint((ctx, size) => {
      ctx.fillStyle = "#3A342C";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#2A2622";
      ctx.lineWidth = 2;
      const cell = size / 8;
      for (let i = 0; i <= 8; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
      }
    });
    const mli = paint((ctx, size) => {
      ctx.fillStyle = "#C4BEB4";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(90,86,80,0.18)";
      for (let y = 0; y < size; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 8) {
          ctx.lineTo(x, y + Math.sin(x * 0.15 + y) * 1.4);
        }
        ctx.stroke();
      }
    });
    return { regolith, pad, mli };
  }, []);
}

export function HabitatCanvas() {
  const coarse = useCoarse();
  const missionId = useMissionStore((state) => state.scenario.missionId);
  const [shown, setShown] = useState(missionId);
  const [labelsFor, setLabelsFor] = useState(missionId);
  const veil = missionId !== shown;
  const showLabels = !veil && labelsFor === missionId;
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const out = reduce ? 80 : 160;
    const labelsAt = reduce ? 0 : 120;
    const swap = window.setTimeout(() => setShown(missionId), out);
    const labels = window.setTimeout(() => setLabelsFor(missionId), out + labelsAt);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(labels);
    };
  }, [missionId]);
  return (
    <>
      <Canvas
        camera={{ position: DEFAULT_POS, fov: 37.85, near: 0.15, far: 4000 }}
        dpr={coarse ? 1 : [1, 1.5]}
        shadows
        frameloop="demand"
        gl={{ antialias: coarse, alpha: false, powerPreference: "high-performance" }}
        className="absolute inset-0 h-full w-full"
        onCreated={({ gl }) => {
          RectAreaLightUniformsLib.init();
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 0.18;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.localClippingEnabled = true;
          gl.setClearColor("#000000", 1);
        }}
      >
        <Scene coarse={coarse} missionId={shown} showLabels={showLabels} transitioning={veil} />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0 z-30"
        style={{
          background: "#07080B",
          opacity: veil ? 1 : 0,
          transition: veil ? "opacity 160ms linear" : "opacity 320ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      />
    </>
  );
}

function Scene({
  coarse,
  missionId,
  showLabels,
  transitioning,
}: {
  coarse: boolean;
  missionId: MissionId;
  showLabels: boolean;
  transitioning: boolean;
}) {
  const cutaway = useMissionStore((state) => state.cutaway);
  const exploded = useMissionStore((state) => state.exploded);
  const registry = useRef(new Map<EquipmentId, THREE.Object3D>());
  const anim = useRef<Anim | null>(null);
  const iss = missionId === "iss-microgravity";
  const mars = missionId === "mars-habitat";
  const gateway = missionId === "gateway-orbit";
  const rover = missionId === "lunar-rover";
  const marsDusk = useMissionStore((state) => state.marsDusk);
  const presetKey = lightingForMission(missionId);
  const preset = LIGHTING[presetKey];
  const tier = coarse ? "low" : "high";
  const canUseN8AO = useThree(state => state.gl.capabilities.isWebGL2);
  const surfaces = useSurfaces();
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.15), []);
  const invalidate = useThree((state) => state.invalidate);

  return (
    <>
      <color attach="background" args={[preset.background]} />
      <Exposure preset={presetKey} dusk={mars && marsDusk} />
      {mars ? <SceneEnvironment preset={presetKey} dusk={marsDusk} /> : null}
      {!mars && !gateway && !coarse ? (
        <LocalHdrEnvironment url="/textures/cc0/moon_lab_1k.hdr" intensity={0.05} />
      ) : null}
      {preset.softShadows ? (
        <SoftShadows samples={preset.softShadows.samples} size={preset.softShadows.size} focus={preset.softShadows.focus} />
      ) : null}
      <Sun coarse={coarse} preset={presetKey} dusk={mars && marsDusk} />
      <hemisphereLight args={[preset.hemisphere.sky, preset.hemisphere.ground, preset.hemisphere.intensity * LIGHT_UNIT_SCALE]} />
      {mars ? <directionalLight color="#C4A888" intensity={0.9} position={[18, 8, -10]} /> : null}
      {preset.earthshineDirectional ? (
        <directionalLight
          color={preset.earthshineDirectional.color}
          intensity={preset.earthshineDirectional.intensity * LIGHT_UNIT_SCALE}
          position={preset.earthshineDirectional.position}
        />
      ) : null}
      {!mars && !iss && !gateway ? (
        <Suspense fallback={null}>
          <EarthDisc />
        </Suspense>
      ) : null}
      {iss ? <EarthLimb /> : null}
      <HabitatDecor.Provider value={{ hairline: true, ringMode: gateway ? "camera" : "ground" }}>
        {rover ? (
          <RoverMission registry={registry} coarse={coarse} cutaway={cutaway} />
        ) : mars ? (
          <Suspense fallback={null}>
            <MarsHabitat registry={registry} coarse={coarse} cutaway={cutaway} exploded={exploded} />
          </Suspense>
        ) : gateway ? (
          <Suspense fallback={null}>
            <GatewayHabitat registry={registry} coarse={coarse} cutaway={cutaway} exploded={exploded} />
          </Suspense>
        ) : iss ? (
          <Base
            registry={registry}
            coarse={coarse}
            iss={iss}
            mars={false}
            cutaway={cutaway}
            exploded={exploded}
            surfaces={surfaces}
            clip={clip}
          />
        ) : (
          <Suspense fallback={null}>
            <MoonHabitat registry={registry} coarse={coarse} cutaway={cutaway} exploded={exploded} />
          </Suspense>
        )}
      </HabitatDecor.Provider>
      <CameraRig anim={anim} registry={registry} missionId={missionId} coarse={coarse} />
      {showLabels && !cutaway ? <LabelLayer registry={registry} coarse={coarse} /> : null}
      <OrbitControls
        makeDefault
        enabled={!transitioning}
        enableDamping
        dampingFactor={0.12}
        minDistance={cutaway ? 1.1 : preset.defaultCamera.minD}
        maxDistance={preset.defaultCamera.maxD}
        minPolarAngle={(preset.defaultCamera.polar[0] * Math.PI) / 180}
        maxPolarAngle={cutaway ? Math.PI * 0.51 : (preset.defaultCamera.polar[1] * Math.PI) / 180}
        onStart={() => {
          anim.current = null;
        }}
        onChange={() => invalidate()}
      />
      {!mars && !gateway && missionId !== "lunar-habitat" ? (
        <ContactShadows position={[0, 0.02, 0]} opacity={0.45} scale={40} blur={2.2} far={8} resolution={coarse ? 256 : 512} color="#000000" />
      ) : null}
      {mars ? (
        <ContactShadows position={[0, 0.02, 0]} opacity={0.4} scale={48} blur={2.4} far={10} resolution={coarse ? 256 : 512} color="#1A120C" />
      ) : null}
      <EffectComposer multisampling={0} enableNormalPass={!coarse}>
        {coarse ? null : (
          <AoBoundary
            fallback={
              <SSAO samples={16} rings={4} radius={0.18} intensity={8} luminanceInfluence={0.5} bias={0.025} />
            }
          >
            {canUseN8AO ? (
              <N8AO aoRadius={0.6} intensity={1.15} aoSamples={16} halfRes={false} distanceFalloff={1} />
            ) : (
              <SSAO samples={16} rings={4} radius={0.18} intensity={8} luminanceInfluence={0.5} bias={0.025} />
            )}
          </AoBoundary>
        )}
        {coarse ? null : (
          <Bloom
            intensity={missionId === "lunar-habitat" ? 0.12 : 0.35}
            luminanceThreshold={missionId === "lunar-habitat" ? 4 : 1.35}
            luminanceSmoothing={0.15}
            mipmapBlur
            kernelSize={KernelSize.SMALL}
          />
        )}
        <Vignette eskil={false} offset={0.22} darkness={coarse ? 0.2 : 0.42} blendFunction={BlendFunction.NORMAL} />
        <SMAA />
      </EffectComposer>
      <TriangleProbe missionId={missionId} tier={tier} />
    </>
  );
}

class AoBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Exposure({ preset, dusk }: { preset: keyof typeof LIGHTING; dusk: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const light = LIGHTING[preset];
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = dusk ? MARS_DUSK.exposure : light.exposure;
    gl.shadowMap.type = THREE.PCFShadowMap;
    scene.fog = light.fog ? new THREE.Fog(light.fog.color, light.fog.near, light.fog.far) : null;
    invalidate();
  }, [dusk, gl, invalidate, preset, scene]);
  return null;
}

function Sun({ coarse, preset, dusk }: { coarse: boolean; preset: keyof typeof LIGHTING; dusk: boolean }) {
  const light = LIGHTING[preset];
  const size = coarse ? 1024 : 2048;
  const frustum = light.shadowFrustum;
  const position = dusk ? MARS_DUSK.sunPosition : light.sunPosition;
  const intensity = (dusk ? MARS_DUSK.sunIntensity : light.sunIntensity) * LIGHT_UNIT_SCALE;
  const color = dusk ? MARS_DUSK.sunColor : light.sunColor;
  return (
    <directionalLight
      position={position}
      intensity={intensity}
      color={color}
      castShadow
      shadow-mapSize-width={size}
      shadow-mapSize-height={size}
      shadow-bias={preset === "moon" ? -0.0002 : -0.0004}
      shadow-normalBias={0.03}
      shadow-camera-left={-frustum}
      shadow-camera-right={frustum}
      shadow-camera-top={frustum}
      shadow-camera-bottom={-frustum}
      shadow-camera-near={light.shadowNear}
      shadow-camera-far={light.shadowFar}
    />
  );
}

function TriangleProbe({ missionId, tier }: { missionId: string; tier: "high" | "low" }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const seen = useRef(0);
  const benchStart = useRef(0);
  const benchFrames = useRef(0);
  useEffect(() => {
    seen.current = performance.now();
    invalidate();
  }, [invalidate, missionId, tier]);
  useFrame(() => {
    const win = window as Window & { __IGNIS_TRIS?: number; __IGNIS_TIER?: string; __IGNIS_BENCH?: boolean; __IGNIS_FPS?: number };
    win.__IGNIS_TIER = tier;
    let count = 0;
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const position = mesh.geometry.getAttribute("position");
      if (!position) return;
      const base = mesh.geometry.index ? mesh.geometry.index.count / 3 : position.count / 3;
      const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
      count += base * instances;
    });
    win.__IGNIS_TRIS = Math.round(count);
    if (performance.now() - seen.current < 6000) invalidate();
    if (win.__IGNIS_BENCH) {
      const now = performance.now();
      if (!benchStart.current) benchStart.current = now;
      benchFrames.current += 1;
      if (now - benchStart.current > 1000) {
        win.__IGNIS_FPS = benchFrames.current;
        win.__IGNIS_BENCH = false;
        benchStart.current = 0;
        benchFrames.current = 0;
      } else {
        invalidate();
      }
    }
  });
  return null;
}

function CameraRig({
  anim,
  registry,
  missionId,
  coarse,
}: {
  anim: React.RefObject<Anim | null>;
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  missionId: MissionId;
  coarse: boolean;
}) {
  const { camera, controls, invalidate } = useThree();
  const cutaway = useMissionStore(s => s.cutaway);
  const navigation = useMissionStore(s => s.navigationMode);
  const roomId = useMissionStore(s => s.selectedRoomId);
  const objectId = useMissionStore(s => s.selectedObjectId);
  const exploded = useMissionStore(s => s.exploded);
  const reduce = useReducedMotion();
  const equipment = useMissionStore((state) => state.selectedEquipment);
  const focusNonce = useMissionStore((state) => state.focusNonce);
  const resetNonce = useMissionStore((state) => state.cameraResetNonce);
  const pendingInterior = useRef<string | null>(null);

  useEffect(() => {
    const orbit = controls as { target: THREE.Vector3 } | null;
    let next = poseFor(missionId, equipment === "shell" ? null : equipment, registry.current, coarse);
    if (cutaway && roomsForHabitat(missionId).length) {
      const room = roomById(roomId) ?? roomsForHabitat(missionId)[0];
      const object = interiorObjects.get(objectId ?? room.id);
      if (object && (roomId || missionId === "gateway-orbit")) {
        object.updateWorldMatrix(true, true);
        const box = navigationBounds(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z, 0.8);
        const dist = objectId ? Math.max(2.4, extent * 2.2) : Math.max(5.4, extent * 1.65);
        const direction = new THREE.Vector3(0.65, 0.65, 1).normalize().applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
        next = { pos: center.clone().addScaledVector(direction, dist).toArray() as Vec3, target: center.toArray() as Vec3 };
        if (missionId === "gateway-orbit") next = gatewayInteriorPose(room.id, center, Boolean(objectId));
      } else if (missionId === "mars-habitat") {
        next = { pos: exploded ? [21, 18, 27] : [16, 12, 22], target: [0, exploded ? 9 : 6.4, 0] };
      } else if (missionId === "lunar-habitat") {
        next = { pos: [11, 9, 14], target: [0, 2, 0] };
      }
    }
    pendingInterior.current = cutaway ? (objectId ?? roomId ?? (missionId === "gateway-orbit" ? roomsForHabitat(missionId)[0]?.id ?? null : null)) : null;
    const focus = Boolean(equipment);
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = cutaway ? 45 : focus ? FOCUS_FOV : LIGHTING[lightingForMission(missionId)].fov;
    perspective.updateProjectionMatrix();
    if (reduce && orbit) {
      camera.position.set(...next.pos);
      orbit.target.set(...next.target);
      anim.current = null;
      invalidate();
      return;
    }
    anim.current = {
      pos: new THREE.Vector3(...next.pos),
      target: new THREE.Vector3(...next.target),
      rate: equipment ? 5.5 : 8,
    };
    invalidate();
  }, [anim, camera, coarse, controls, equipment, focusNonce, invalidate, missionId, reduce, registry, resetNonce, cutaway, navigation, roomId, objectId, exploded]);

  useFrame((_, delta) => {
    if (pendingInterior.current) {
      const object = interiorObjects.get(pendingInterior.current);
      if (object) {
        object.updateWorldMatrix(true, true);
        const box = navigationBounds(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const extent = Math.max(size.x, size.y, size.z, 0.8);
        const dist = objectId ? Math.max(2.4, extent * 2.2) : Math.max(5.4, extent * 1.65);
        const direction = new THREE.Vector3(0.65, 0.65, 1).normalize().applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
        const next = missionId === "gateway-orbit" ? gatewayInteriorPose(roomId, center, Boolean(objectId)) : null;
        anim.current = {
          pos: next ? new THREE.Vector3(...next.pos) : center.clone().addScaledVector(direction, dist),
          target: next ? new THREE.Vector3(...next.target) : center,
          rate: 6,
        };
        pendingInterior.current = null;
      }
      invalidate();
    }
    const projected: Record<string, { x: number; y: number }> = {};
    registry.current.forEach((object, id) => {
      const point = new THREE.Vector3();
      object.getWorldPosition(point);
      point.project(camera);
      projected[id] = { x: point.x, y: point.y };
    });
    interiorObjects.forEach((object, id) => {
      const point = navigationBounds(object).getCenter(new THREE.Vector3());
      point.project(camera); projected[id] = {x: point.x, y: point.y};
    });
    (window as Window & { __IGNIS_SCREEN?: typeof projected }).__IGNIS_SCREEN = projected;
    const orbit = controls as { target: THREE.Vector3; update: () => void } | null;
    if (!anim.current || !orbit) return;
    const k = 1 - Math.exp(-anim.current.rate * delta);
    camera.position.lerp(anim.current.pos, k);
    orbit.target.lerp(anim.current.target, k);
    orbit.update();
    if (
      camera.position.distanceTo(anim.current.pos) < 0.04 &&
      orbit.target.distanceTo(anim.current.target) < 0.04
    ) {
      anim.current = null;
    } else {
      invalidate();
    }
  });
  return null;
}

/** Place the camera within the revealed orbital module, clear of neighboring opaque shells. */
function gatewayInteriorPose(roomId: string | null, center: THREE.Vector3, focusObject: boolean): { pos: Vec3; target: Vec3 } {
  const room = roomById(roomId) ?? roomsForHabitat("gateway-orbit")[0];
  const group = room ? interiorObjects.get(room.id) : null;
  if (!room || !group) return { pos: center.clone().add(new THREE.Vector3(0, 1, 3)).toArray() as Vec3, target: center.toArray() as Vec3 };
  const [w, h, d] = room.size;
  const pos = group.localToWorld(new THREE.Vector3(-w * 0.04, h * 0.9, d * 0.46));
  const target = focusObject ? center : group.localToWorld(new THREE.Vector3(0, h * 0.32, -d * 0.05));
  return { pos: pos.toArray() as Vec3, target: target.toArray() as Vec3 };
}

function poseFor(
  mission: MissionId,
  equipment: EquipmentId | null,
  registry: Map<EquipmentId, THREE.Object3D>,
  coarse = false,
) {
  if (mission === "lunar-rover" && !equipment) {
    return { pos: [6.2, 3.2, 7.4] as Vec3, target: [0.2, 1.1, 0.4] as Vec3 };
  }
  if (mission === "gateway-orbit" && !equipment && coarse) {
    return { pos: [20, 6.2, 16.5] as Vec3, target: [0, 0.2, 0] as Vec3 };
  }
  if (!equipment) {
    const camera = LIGHTING[lightingForMission(mission)].defaultCamera;
    return { pos: [...camera.pos] as Vec3, target: [...camera.target] as Vec3 };
  }
  const object = registry.get(equipment);
  if (!object) return { pos: DEFAULT_POS, target: DEFAULT_TARGET };
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return { pos: DEFAULT_POS, target: DEFAULT_TARGET };
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z, 1.2);
  const dist = Math.max(6, (1.4 * extent) / Math.tan((FOCUS_FOV * Math.PI) / 180 / 2));
  const dir = new THREE.Vector3(0.42, 0.34, 0.84).normalize();
  const pos = center.clone().add(dir.multiplyScalar(dist));
  const floor = mission === "mars-habitat" ? 2.2 : mission === "gateway-orbit" ? -4 : 2.5;
  if (pos.y < floor) pos.y = floor;
  return { pos: pos.toArray() as Vec3, target: center.toArray() as Vec3 };
}

function Base({
  registry,
  coarse,
  iss,
  cutaway,
  exploded,
  surfaces,
  clip,
}: {
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
  iss: boolean;
  mars: boolean;
  cutaway: boolean;
  exploded: boolean;
  surfaces: ReturnType<typeof useSurfaces>;
  clip: THREE.Plane;
}) {
  const shellClip = cutaway ? [clip] : [];
  const spread = exploded ? 1.15 : 0;
  return (
    <group>
      {iss ? null : (
        <>
          <Suspense fallback={null}>
            <LunarSite coarse={coarse} />
          </Suspense>
          <Pad map={surfaces.pad} />
          <Berm color="#6E6A64" />
          <RoverProp />
          <Tanks />
          <Solar />
          <Radiators />
          <Cables />
        </>
      )}
      <Tunnel from={[-8.7, Y, 0]} to={[-7.2, Y, 0]} clip={shellClip} />
      <Tunnel from={[-1.6, Y, 0]} to={[0.2, Y, 0]} clip={shellClip} />
      <Tunnel from={[6.5, Y, 0]} to={[7.7, Y, 0]} clip={shellClip} />
      <Docking clip={shellClip} />
      <Module
        id="airlock-oxygen"
        label={HOTSPOT_LABEL["airlock-oxygen"]}
        position={[-10.2 - spread * 1.4, Y, 0]}
        length={2.4}
        radius={1}
        segs={24}
        map={surfaces.mli}
        clip={shellClip}
        registry={registry}
        coarse={coarse}
        groundRadius={1.15}
      />
      <Module
        id="living-quarters"
        label={HOTSPOT_LABEL["living-quarters"]}
        position={[-5 - spread * 0.45, Y, 0]}
        length={6}
        radius={2}
        segs={32}
        map={surfaces.mli}
        clip={shellClip}
        registry={registry}
        coarse={coarse}
        groundRadius={2.2}
        blister
      />
      <Lab
        position={[2.4 + spread * 0.2, Y, 0]}
        map={surfaces.mli}
        clip={shellClip}
        cutaway={cutaway}
        registry={registry}
        coarse={coarse}
      />
      <Module
        id="material-storage"
        label={HOTSPOT_LABEL["material-storage"]}
        position={[9.6 + spread * 1.1, Y, 0]}
        length={3.6}
        radius={1.6}
        segs={32}
        map={surfaces.mli}
        clip={shellClip}
        registry={registry}
        coarse={coarse}
        groundRadius={1.8}
        doors
      />
      <Antenna />
    </group>
  );
}

function Pad({ map }: { map: THREE.Texture | null }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <circleGeometry args={[9, 48]} />
      <meshPhysicalMaterial color="#3A342C" map={map} roughness={0.9} metalness={0.02} />
    </mesh>
  );
}

function Berm({ color }: { color: string }) {
  return (
    <mesh position={[0, 0.55, -2]} rotation={[-Math.PI / 2, 0, Math.PI * 0.85]} receiveShadow castShadow>
      <torusGeometry args={[12, 1.15, 5, 36, Math.PI * 1.2]} />
      <meshPhysicalMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  );
}

function Module({
  id,
  label,
  position,
  length,
  radius,
  segs,
  map,
  clip,
  registry,
  coarse,
  groundRadius,
  blister = false,
  doors = false,
}: {
  id: EquipmentId;
  label: string;
  position: Vec3;
  length: number;
  radius: number;
  segs: number;
  map: THREE.Texture | null;
  clip: THREE.Plane[];
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
  groundRadius: number;
  blister?: boolean;
  doors?: boolean;
}) {
  return (
    <Hotspot id={id} label={label} position={position} registry={registry} coarse={coarse} groundRadius={groundRadius} anchorY={position[1]}>
      <Barrel length={length} radius={radius} segs={segs} map={map} clip={clip} />
      {blister ? (
        <mesh position={[0, radius + 0.15, 0]} castShadow>
          <sphereGeometry args={[0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#C4BEB4" map={map} roughness={0.88} metalness={0.08}  sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
        </mesh>
      ) : null}
      {doors ? (
        <mesh position={[0, 0, radius - 0.02]} castShadow>
          <boxGeometry args={[1.4, 1.3, 0.06]} />
          <meshPhysicalMaterial color="#8A8E94" roughness={0.38} metalness={0.82}  clearcoat={0.55} clearcoatRoughness={0.18} />
        </mesh>
      ) : null}
      <Viewport position={[length * 0.18, 0.15, radius - 0.04]} />
      <Legs length={length} />
    </Hotspot>
  );
}

function Lab({
  position,
  map,
  clip,
  cutaway,
  registry,
  coarse,
}: {
  position: Vec3;
  map: THREE.Texture | null;
  clip: THREE.Plane[];
  cutaway: boolean;
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
}) {
  return (
    <group position={position}>
      <Hotspot
        id="shell"
        label={HOTSPOT_LABEL.shell}
        registry={registry}
        coarse={coarse}
        groundRadius={2.6}
        anchorY={position[1]}
        outlineIds={["shell", "laboratory"]}
      >
        <Barrel length={8} radius={2.2} segs={32} map={map} clip={clip} />
        {[-2, 0, 2].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[2.28, 0.035, 6, 24]} />
            <meshPhysicalMaterial color="#8A8E94" metalness={0.82} roughness={0.38}  clearcoat={0.55} clearcoatRoughness={0.18} />
          </mesh>
        ))}
        <Viewport position={[-1.6, 0.2, 2.05]} />
        <Viewport position={[1.7, 0.2, 2.05]} />
        <Legs length={8} />
      </Hotspot>
      <Hotspot
        id="laboratory"
        label={HOTSPOT_LABEL.laboratory}
        position={[0.2, 0.35, 2.16]}
        registry={registry}
        coarse={coarse}
        groundRadius={2.6}
        anchorY={position[1] + 0.35}
        ring={false}
      >
        <mesh>
          <boxGeometry args={[0.7, 0.36, 0.05]} />
          <meshPhysicalMaterial
            color="#E7E1D6"
            roughness={0.05}
            metalness={0}
            transmission={0.9}
            thickness={0.02}
            ior={1.5}
            transparent
          />
        </mesh>
      </Hotspot>
      <Hotspot
        id="ventilation"
        label={HOTSPOT_LABEL.ventilation}
        position={[0, 2.35, 0]}
        registry={registry}
        coarse={coarse}
        groundRadius={2.6}
        anchorY={position[1] + 2.35}
      >
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 4, 12]} />
          <meshPhysicalMaterial color="#8A8E94" roughness={0.38} metalness={0.82}  clearcoat={0.55} clearcoatRoughness={0.18} />
          <OutlinePass />
        </mesh>
      </Hotspot>
      <Hotspot
        id="smoke-detection"
        label={HOTSPOT_LABEL["smoke-detection"]}
        position={[1.4, 1.85, 0.4]}
        registry={registry}
        coarse={coarse}
        groundRadius={2.6}
        anchorY={position[1] + 1.85}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.05, 12]} />
          <meshPhysicalMaterial color="#C8C4BC" roughness={0.6} metalness={0.15} />
          <OutlinePass />
        </mesh>
        <mesh position={[0.7, -0.15, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 10]} />
          <meshPhysicalMaterial color="#B7B3AB" roughness={0.6} metalness={0.15} />
        </mesh>
      </Hotspot>
      <Hotspot
        id="fire-suppression"
        label={HOTSPOT_LABEL["fire-suppression"]}
        position={[3.3, -0.7, -1.5]}
        registry={registry}
        coarse={coarse}
        groundRadius={2.6}
        anchorY={position[1] - 0.7}
      >
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 10]} />
          <meshPhysicalMaterial color="#4A5560" roughness={0.7} metalness={0.2} />
          <OutlinePass />
        </mesh>
        <mesh position={[0.32, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.64, 10]} />
          <meshPhysicalMaterial color="#4A5560" roughness={0.7} metalness={0.2} />
        </mesh>
        <mesh position={[0.08, 0.55, 0.12]}>
          <boxGeometry args={[0.16, 0.08, 0.02]} />
          <meshPhysicalMaterial color="#C4A06A" roughness={0.5} metalness={0.1} />
        </mesh>
      </Hotspot>
      {cutaway ? <Interior /> : null}
    </group>
  );
}

function Barrel({
  length,
  radius,
  segs,
  map,
  clip,
}: {
  length: number;
  radius: number;
  segs: number;
  map: THREE.Texture | null;
  clip: THREE.Plane[];
}) {
  const cut = clip.length > 0;
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, length, segs, 1, true]} />
        <meshPhysicalMaterial
          color="#C4BEB4"
          map={map}
          roughness={0.88}
          metalness={0.08}
          clippingPlanes={clip}
          clipShadows={cut}
          side={cut ? THREE.DoubleSide : THREE.FrontSide}
         sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
        <OutlinePass />
      </mesh>
      {[1, -1].map((sign) => (
        <group key={sign} position={[(sign * length) / 2, 0, 0]} rotation={[0, 0, sign > 0 ? -Math.PI / 2 : Math.PI / 2]}>
          <mesh castShadow>
            <sphereGeometry args={[radius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial
              color="#C4BEB4"
              map={map}
              roughness={0.88}
              metalness={0.08}
              clippingPlanes={clip}
              clipShadows={cut}
              side={cut ? THREE.DoubleSide : THREE.FrontSide}
             sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
            <OutlinePass />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <torusGeometry args={[radius, 0.045, 6, 20]} />
            <meshPhysicalMaterial color="#8A8E94" metalness={0.82} roughness={0.38}  clearcoat={0.55} clearcoatRoughness={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Viewport({ position }: { position: Vec3 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.85, 0.38, 0.06]} />
      <meshPhysicalMaterial
        color="#E7E1D6"
        roughness={0.05}
        metalness={0}
        transmission={0.9}
        thickness={0.02}
        ior={1.5}
        transparent
      />
    </mesh>
  );
}

function Legs({ length }: { length: number }) {
  const xs = length > 5 ? [-length * 0.28, 0, length * 0.28] : [-length * 0.22, length * 0.22];
  return (
    <group>
      {xs.map((x) => (
        <group key={x}>
          {[-1, 1].map((z) => (
            <group key={z} position={[x, -Y + 0.08, z * 1.15]}>
              <mesh position={[0, (Y - 0.08) / 2, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.07, Y - 0.08, 6]} />
                <meshPhysicalMaterial color="#8A8E94" metalness={0.82} roughness={0.38}  clearcoat={0.55} clearcoatRoughness={0.18} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <cylinderGeometry args={[0.28, 0.28, 0.08, 10]} />
                <meshPhysicalMaterial color="#6A6864" roughness={0.8} metalness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function Tunnel({ from, to, clip }: { from: Vec3; to: Vec3; clip: THREE.Plane[] }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: q, length: len };
  }, [from, to]);
  const cut = clip.length > 0;
  return (
    <group position={position} quaternion={quaternion}>
      <mesh castShadow>
        <cylinderGeometry args={[0.85, 0.85, Math.max(length, 0.3), 16, 1, true]} />
        <meshPhysicalMaterial
          color="#C9C3B8"
          roughness={0.7}
          metalness={0.12}
          clippingPlanes={clip}
          clipShadows={cut}
          side={cut ? THREE.DoubleSide : THREE.FrontSide}
         sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
      </mesh>
      {[1, -1].map((sign) => (
        <mesh key={sign} position={[0, sign * (length / 2 - 0.05), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.95, 0.06, 6, 16]} />
          <meshPhysicalMaterial color="#8A8E94" metalness={0.82} roughness={0.38}  clearcoat={0.55} clearcoatRoughness={0.18} />
        </mesh>
      ))}
    </group>
  );
}

function Docking({ clip }: { clip: THREE.Plane[] }) {
  const cut = clip.length > 0;
  return (
    <group position={[2.4, Y, 2.7]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.8, 0.8, 1.2, 16, 1, true]} />
        <meshPhysicalMaterial
          color="#C4BEB4"
          roughness={0.88}
          metalness={0.08}
          clippingPlanes={clip}
          clipShadows={cut}
          side={cut ? THREE.DoubleSide : THREE.FrontSide}
         sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <torusGeometry args={[0.88, 0.07, 6, 16]} />
        <meshPhysicalMaterial color="#8A8E94" metalness={0.8} roughness={0.4}  clearcoat={0.55} clearcoatRoughness={0.18} />
      </mesh>
    </group>
  );
}

function Interior() {
  return (
    <group>
      {[-2.2, -0.6, 1.0, 2.4].map((x) => (
        <mesh key={x} position={[x, Y - 2.8, -1.35]} castShadow>
          <boxGeometry args={[1.15, 1.7, 0.55]} />
          <meshPhysicalMaterial color="#4A5560" roughness={0.55} metalness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, Y - 3.55, 0]}>
        <boxGeometry args={[3.2, 0.12, 0.7]} />
        <meshPhysicalMaterial color="#6A6864" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[-1.2, Y - 2.2, -1.05]}>
        <boxGeometry args={[0.7, 0.08, 0.28]} />
        <meshPhysicalMaterial color="#F0EBE0" emissive="#F0EBE0" emissiveIntensity={0.4} />
      </mesh>
      <rectAreaLight position={[0, Y - 1.6, -0.4]} width={3.2} height={0.4} intensity={2.5} color="#F0EBE0" />
    </group>
  );
}

function Solar() {
  return (
    <group position={[9.6, 5.4, -3.4]} rotation={[0, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.08, 2.6, 6]} />
        <meshPhysicalMaterial color="#8A8E94" metalness={0.8} roughness={0.4}  clearcoat={0.55} clearcoatRoughness={0.18} />
      </mesh>
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[8, 0.06, 2.4]} />
          <meshPhysicalMaterial color="#1A1E24" roughness={0.35} metalness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function Radiators() {
  return (
    <group position={[-6.4, 3.2, -4.8]} rotation={[0, 0.7, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 1.2, 6]} />
        <meshPhysicalMaterial color="#8A8E94" metalness={0.8} roughness={0.4}  clearcoat={0.55} clearcoatRoughness={0.18} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 1.0, 0]} castShadow>
          <boxGeometry args={[0.06, 1.6, 4]} />
          <meshPhysicalMaterial color="#E8E4DC" roughness={0.55} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function Tanks() {
  return (
    <group>
      {[
        [7.5, 0.7, 5],
        [8.9, 0.7, 5.2],
      ].map((position) => (
        <mesh key={position.join()} position={position as Vec3} castShadow>
          <sphereGeometry args={[0.6, 16, 12]} />
          <meshPhysicalMaterial color="#E8E4DC" roughness={0.45} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function Antenna() {
  return (
    <group position={[-5, 5.6, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.6, 6]} />
        <meshPhysicalMaterial color="#8A8E94" metalness={0.82} roughness={0.35}  clearcoat={0.55} clearcoatRoughness={0.18} />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[0.4, 0, 0]}>
        <sphereGeometry args={[0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#C8C4BC" metalness={0.7} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cables() {
  const pts = [
    [9.6, 3.2, -2.2, 4.2, 0.08, 1.2],
    [4.2, 0.08, 1.2, 2.4, 0.9, 2.2],
    [-5, 0.08, 2.4, -5, 2.2, 1.6],
  ];
  return (
    <group>
      {pts.map((p) => {
        const a = new THREE.Vector3(p[0], p[1], p[2]);
        const b = new THREE.Vector3(p[3], p[4], p[5]);
        const len = a.distanceTo(b);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        return (
          <mesh key={p.join()} position={mid} quaternion={q} castShadow>
            <cylinderGeometry args={[0.035, 0.035, len, 6]} />
            <meshPhysicalMaterial color="#2A2C2E" roughness={0.6} metalness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoverProp() {
  return (
    <group position={[3.5, 0.35, 6.4]} rotation={[0, -0.44, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.5, 0.7, 1.8]} />
        <meshPhysicalMaterial color="#C4BEB4" roughness={0.88} metalness={0.08}  sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
      </mesh>
      <mesh position={[0.15, 0.55, 0]} castShadow>
        <boxGeometry args={[1.5, 0.55, 1.5]} />
        <meshPhysicalMaterial color="#C9C3B8" roughness={0.7} metalness={0.1}  sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
      </mesh>
      {[-0.8, 0.8].map((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -0.15, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.22, 12]} />
            <meshPhysicalMaterial color="#2A2724" roughness={0.8} />
          </mesh>
        )),
      )}
    </group>
  );
}

function RoverMission({
  registry,
  coarse,
  cutaway,
}: {
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
  cutaway: boolean;
}) {
  const clip = useMemo(() => (cutaway ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.4)] : []), [cutaway]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 40]} />
        <meshPhysicalMaterial color="#6B5344" roughness={0.95} />
      </mesh>
      <group position={[0, 0.7, 0]}>
        <Hotspot id="shell" label="Pressure shell" registry={registry} coarse={coarse} groundRadius={1.6}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.85, 0.85, 3.2, 20, 1, true]} />
            <meshPhysicalMaterial color="#C4BEB4" roughness={0.88} metalness={0.08} clippingPlanes={clip} side={clip.length ? THREE.DoubleSide : THREE.FrontSide}  sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
            <OutlinePass />
          </mesh>
        </Hotspot>
        <Hotspot id="airlock-oxygen" label={HOTSPOT_LABEL["airlock-oxygen"]} position={[-1.9, 0.2, 0]} registry={registry} coarse={coarse} groundRadius={0.8}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.55, 0.55, 0.9, 16]} />
            <meshPhysicalMaterial color="#C9C3B8" roughness={0.7} metalness={0.1}  sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
          </mesh>
        </Hotspot>
        <Hotspot id="living-quarters" label={HOTSPOT_LABEL["living-quarters"]} position={[-0.4, 0.7, 0.7]} registry={registry} coarse={coarse} groundRadius={1.2}>
          <mesh>
            <boxGeometry args={[0.5, 0.28, 0.04]} />
            <meshPhysicalMaterial color="#E7E1D6" transmission={0.85} thickness={0.02} roughness={0.05} transparent />
          </mesh>
        </Hotspot>
        <Hotspot id="laboratory" label={HOTSPOT_LABEL.laboratory} position={[0.55, 0.7, 0.7]} registry={registry} coarse={coarse} groundRadius={1.2}>
          <mesh>
            <boxGeometry args={[0.45, 0.24, 0.04]} />
            <meshPhysicalMaterial color="#8A8E94" metalness={0.6} roughness={0.4} />
          </mesh>
        </Hotspot>
        <Hotspot id="material-storage" label={HOTSPOT_LABEL["material-storage"]} position={[1.7, -0.1, 0.55]} registry={registry} coarse={coarse} groundRadius={0.7}>
          <mesh castShadow>
            <boxGeometry args={[0.55, 0.4, 0.45]} />
            <meshPhysicalMaterial color="#B7B2AA" roughness={0.7} metalness={0.2} />
            <OutlinePass />
          </mesh>
        </Hotspot>
        <Hotspot id="ventilation" label={HOTSPOT_LABEL.ventilation} position={[0.1, 1.05, 0]} registry={registry} coarse={coarse} groundRadius={1.2}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 1.4, 8]} />
            <meshPhysicalMaterial color="#8A8E94" metalness={0.82} roughness={0.38}  clearcoat={0.55} clearcoatRoughness={0.18} />
            <OutlinePass />
          </mesh>
        </Hotspot>
        <Hotspot id="smoke-detection" label={HOTSPOT_LABEL["smoke-detection"]} position={[0.8, 0.85, 0.15]} registry={registry} coarse={coarse} groundRadius={1}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 10]} />
            <meshPhysicalMaterial color="#C8C4BC" roughness={0.55} />
          </mesh>
        </Hotspot>
        <Hotspot id="fire-suppression" label={HOTSPOT_LABEL["fire-suppression"]} position={[1.15, -0.15, -0.55]} registry={registry} coarse={coarse} groundRadius={0.8}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.36, 8]} />
            <meshPhysicalMaterial color="#4A5560" roughness={0.7} />
          </mesh>
        </Hotspot>
        {[-1.1, 1.1].map((x) =>
          [-0.7, 0.7].map((z) => (
            <mesh key={`${x}${z}`} position={[x, -0.35, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.32, 0.32, 0.18, 10]} />
              <meshPhysicalMaterial color="#2A2724" />
            </mesh>
          )),
        )}
      </group>
      <group position={[0, 1.2, -16]} scale={0.45}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[2.2, 2.2, 8, 12]} />
          <meshPhysicalMaterial color="#C4BEB4" roughness={0.88} metalness={0.08}  sheen={0.04} sheenColor="#EDE8DC" sheenRoughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

type Plate = {
  id: EquipmentId;
  label: string;
  x: number;
  y: number;
  ax: number;
  ay: number;
};

function LabelLayer({
  registry,
  coarse,
}: {
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
}) {
  const { camera, scene, size, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const rootRef = useRef<Root | null>(null);
  const last = useRef("");
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "5";
    parent.appendChild(overlay);
    const root = createRoot(overlay);
    rootRef.current = root;
    return () => {
      rootRef.current = null;
      root.unmount();
      overlay.remove();
    };
  }, [gl]);

  useFrame(() => {
    const selected = useMissionStore.getState().selectedEquipment;
    const hovered = hoverBus.id;
    const candidates: Array<Plate & { rank: number }> = [];
    registry.current.forEach((object, id) => {
      const active = id === selected || id === hovered;
      const show = coarse ? active : active || MODULE_PLATES.includes(id);
      if (!show) return;
      const origin = new THREE.Vector3();
      object.getWorldPosition(origin);
      const anchor = origin.clone().add(new THREE.Vector3(0, 0.9, 0.2));
      const ndc = anchor.clone().project(camera);
      if (ndc.z < -1 || ndc.z > 1) return;
      const direction = anchor.clone().sub(camera.position);
      const distance = direction.length();
      if (distance < 0.01) return;
      raycaster.set(camera.position, direction.normalize());
      const hits = raycaster.intersectObjects(scene.children, true);
      const blocked = hits.some((hit) => {
        if (id === selected || id === hovered || MODULE_PLATES.includes(id)) return false;
        if (hit.distance >= distance - 0.8) return false;
        if (hit.point.distanceTo(anchor) < 3.4) return false;
        let node: THREE.Object3D | null = hit.object;
        let skip = false;
        let scan: THREE.Object3D | null = hit.object;
        while (scan) {
          if (scan.userData.noLabelOcclude) skip = true;
          scan = scan.parent;
        }
        if (skip) return false;
        node = hit.object;
        while (node) {
          if (node === object) return false;
          node = node.parent;
        }
        return true;
      });
      if (blocked) return;
      const ax = (ndc.x * 0.5 + 0.5) * size.width;
      const ay = (-ndc.y * 0.5 + 0.5) * size.height;
      const mission = useMissionStore.getState().scenario.missionId;
      const label =
        mission === "mars-habitat"
          ? MARS_EQUIPMENT_LABEL[id]
          : mission === "lunar-habitat"
            ? MOON_EQUIPMENT_LABEL[id]
            : HOTSPOT_LABEL[id];
      const plateWidth = Math.ceil(label.length * 6.6 + 16);
      const x = Math.min(size.width - 8 - plateWidth / 2, Math.max(8 + plateWidth / 2, ax));
      const y = Math.min(size.height - 64, Math.max(16, ay - 22));
      const rank =
        (id === selected ? 1000 : 0) +
        (id === hovered ? 800 : 0) +
        (LABEL_RANK.length - Math.max(0, LABEL_RANK.indexOf(id))) * 10 +
        Math.max(0, 8 - distance / 8);
      candidates.push({ id, label, x, y, ax, ay, rank });
    });
    candidates.sort((a, b) => b.rank - a.rank);
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const visible: Plate[] = [];
    for (const candidate of candidates) {
      const width = Math.ceil(candidate.label.length * 6.6 + 16);
      const height = 18;
      const shifts = [0, -(height + 6), height + 6];
      let kept = false;
      for (const shift of shifts) {
        const box = {
          x: candidate.x,
          y: Math.min(size.height - 64, Math.max(16, candidate.y + shift)),
          w: width,
          h: height,
        };
        const hit = placed.some(
          (other) =>
            Math.abs(box.x - other.x) < (box.w + other.w) / 2 + 8 &&
            Math.abs(box.y - other.y) < (box.h + other.h) / 2 + 8,
        );
        if (!hit) {
          placed.push(box);
          visible.push({ ...candidate, y: box.y });
          kept = true;
          break;
        }
      }
      if (!kept) continue;
    }
    const key = visible.map((plate) => `${plate.id}:${Math.round(plate.x)}:${Math.round(plate.y)}`).join("|");
    if (key === last.current) return;
    last.current = key;
    rootRef.current?.render(
      <>
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {visible.map((plate) => (
            <line key={`lead-${plate.id}`} x1={plate.ax} y1={plate.ay} x2={plate.x} y2={plate.y} stroke="#454B56" strokeWidth="1" />
          ))}
        </svg>
        {visible.map((plate) => (
          <span
            key={plate.id}
            className="hotspot-label"
            style={{
              position: "absolute",
              left: plate.x,
              top: plate.y,
              transform: "translate(-50%, -50%)",
              fontSize: 10,
              lineHeight: "12px",
              pointerEvents: "none",
            }}
          >
            {plate.label}
          </span>
        ))}
      </>,
    );
  });
  return null;
}

function EarthDisc() {
  const map = useTexture("/textures/moon/blue_marble_1k.jpg");
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const mesh = useRef<THREE.Mesh>(null);
  const distance = 380;
  const radius = distance * Math.tan((2 * Math.PI) / 180 / 2);
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    invalidate();
  }, [invalidate, map]);
  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    const offset = new THREE.Vector3(62, 92, -distance);
    offset.applyQuaternion(camera.quaternion);
    node.position.copy(camera.position).add(offset);
    node.quaternion.copy(camera.quaternion);
    node.rotateY(1.05);
    node.rotateZ(0.15);
  });
  return (
    <mesh ref={mesh} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 24]} />
      <meshBasicMaterial map={map} />
      <mesh frustumCulled={false}>
        <sphereGeometry args={[radius * 1.045, 24, 16]} />
        <meshBasicMaterial color="#7EA4D4" transparent opacity={0.28} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </mesh>
  );
}

function EarthLimb() {
  return (
    <mesh position={[-6, -2, -40]}>
      <sphereGeometry args={[18, 24, 16]} />
      <meshPhysicalMaterial color="#6FA0C8" emissive="#6FA0C8" emissiveIntensity={0.2} roughness={1} />
    </mesh>
  );
}
