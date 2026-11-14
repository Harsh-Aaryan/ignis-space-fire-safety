"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { objectById, type HabitatRoomConfig, type Vec3 } from "@/data/habitat-interiors";
import { firePoint } from "@/lib/fire/scenario";
import { fireRuntime, useFireSimStore } from "@/stores/fire-sim-store";

/**
 * Fire scenario overlay for one room. It only adds objects on top of the
 * existing interior; nothing in the habitat geometry is changed. Every mesh
 * here ignores pointer rays so equipment stays selectable.
 */

const SMOKE_COUNT = 420;
const VENT_COUNT = 70;
const AGENT_COUNT = 140;
/** Flames are drawn a little larger than the model's lengths so they read from a room-scale camera. */
const DRAW_SCALE = 1.5;
const noRay = () => {};
const HIDDEN = -500;

function softDot(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function pointCloud(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3).fill(HIDDEN);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return { geometry, positions };
}

/** Direction the cabin air moves, in room coordinates: away from the supply duct along the long axis. */
function ventDirection(room: HabitatRoomConfig): THREE.Vector3 {
  const [w, , d] = room.size;
  const duct = room.equipment.find((item) => item.type === "duct");
  const alongZ = d >= w;
  const origin = duct ? (alongZ ? duct.position[2] : duct.position[0]) : -1;
  const sign = origin <= 0 ? 1 : -1;
  return alongZ ? new THREE.Vector3(0, 0, sign) : new THREE.Vector3(sign, 0, 0);
}

export function FireEffects({ room }: { room: HabitatRoomConfig }) {
  const status = useFireSimStore((store) => store.status);
  const objectId = useFireSimStore((store) => store.activeObjectId);
  const invalidate = useThree((three) => three.invalidate);
  const reduce = useReducedMotion();
  const object = objectById(objectId);

  const [w, h, d] = room.size;
  const origin = useMemo<Vec3>(() => (object ? firePoint(object, room) : [0, 1, 0]), [object, room]);
  const flow = useMemo(() => ventDirection(room), [room]);
  const yaw = Math.atan2(flow.x, flow.z);
  const detectors = useMemo(() => room.equipment.filter((item) => item.type === "detector"), [room]);
  const nozzle = useMemo<Vec3>(() => {
    const bottle = room.equipment.find((item) => item.type === "extinguisher");
    return bottle ? [bottle.position[0], bottle.position[1] + 0.6, bottle.position[2]] : [w * 0.3, 1.2, d * 0.3];
  }, [room, w, d]);

  const dot = useMemo(softDot, []);
  const smoke = useMemo(() => pointCloud(SMOKE_COUNT), []);
  const vent = useMemo(() => pointCloud(VENT_COUNT), []);
  const agent = useMemo(() => pointCloud(AGENT_COUNT), []);
  const smokeVelocity = useMemo(() => new Float32Array(SMOKE_COUNT * 3), []);
  const smokeAge = useMemo(() => new Float32Array(SMOKE_COUNT).fill(-1), []);
  const agentPhase = useMemo(() => Float32Array.from({ length: AGENT_COUNT }, () => Math.random()), []);
  const ventSeed = useMemo(
    () => Float32Array.from({ length: VENT_COUNT * 3 }, () => Math.random()),
    [],
  );
  useEffect(
    () => () => {
      dot.dispose();
      smoke.geometry.dispose();
      vent.geometry.dispose();
      agent.geometry.dispose();
    },
    [dot, smoke, vent, agent],
  );

  const flameGroup = useRef<THREE.Group>(null);
  const tiltGroup = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Mesh>(null);
  const middle = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const layer = useRef<THREE.Mesh>(null);
  const haze = useRef<THREE.Mesh>(null);
  const smokePoints = useRef<THREE.Points>(null);
  const ventPoints = useRef<THREE.Points>(null);
  const agentPoints = useRef<THREE.Points>(null);
  const halos = useRef<Array<THREE.Mesh | null>>([]);
  const spawn = useRef(0);
  const clock = useRef(0);

  useEffect(() => {
    invalidate();
  }, [status, objectId, invalidate]);

  useFrame((_, rawDelta) => {
    const state = fireRuntime.state;
    const input = fireRuntime.input;
    if (!state || !input) return;
    const running = status === "running";
    const delta = running ? Math.min(rawDelta, 0.05) : 0;
    clock.current += delta;
    const time = clock.current;
    const flame = state.flame;
    const gravity = input.gravityG;
    const flicker =
      reduce || flame.flickerHz === 0
        ? 1
        : 1 + 0.1 * Math.sin(time * flame.flickerHz * Math.PI * 2) + 0.05 * Math.sin(time * 17.3);

    // Flame.
    const burning = flame.kind === "dome" || flame.kind === "plume";
    if (flameGroup.current && tiltGroup.current && outer.current && middle.current && core.current) {
      flameGroup.current.visible = burning;
      if (burning) {
        const length = Math.max(0.05, flame.lengthM * DRAW_SCALE);
        const width = Math.max(0.05, flame.widthM * DRAW_SCALE);
        const blue = flame.kind === "dome" ? flame.blueFraction : flame.blueFraction * 0.15;
        if (flame.kind === "plume") {
          // Buoyant teardrop, leaning with the ventilation.
          tiltGroup.current.rotation.x = Math.min(flame.tiltRad, 1.2);
          const tall = length * flicker;
          const girth = Math.min(width, tall * 0.7) / (reduce ? 1 : flicker);
          outer.current.scale.set(girth * 0.55, tall * 0.55, girth * 0.55);
          outer.current.position.set(0, tall * 0.5, 0);
          middle.current.scale.set(girth * 0.4, tall * 0.4, girth * 0.4);
          middle.current.position.set(0, tall * 0.38, 0);
          core.current.scale.set(girth * 0.24, tall * 0.22, girth * 0.24);
          core.current.position.set(0, tall * 0.22, 0);
        } else {
          // No buoyancy: a thin dome that hugs the fuel and trails downstream. Spherical when the fuel is a spot.
          tiltGroup.current.rotation.x = 0;
          const thick = Math.max(0.035, flame.standoffM * 4 * DRAW_SCALE);
          const span = Math.max(width, thick * 2);
          const reach = Math.max(length, thick * 2);
          outer.current.scale.set(span * 0.55, thick, reach * 0.55);
          outer.current.position.set(0, thick * 0.3, reach * 0.25);
          middle.current.scale.set(span * 0.42, thick * 0.7, reach * 0.42);
          middle.current.position.set(0, thick * 0.25, reach * 0.2);
          core.current.scale.set(span * 0.25, thick * 0.4, reach * 0.25);
          core.current.position.set(0, thick * 0.2, reach * 0.12);
        }
        // Sooty yellow-orange with buoyancy; blue and nearly soot-free at low flow without it.
        (outer.current.material as THREE.MeshBasicMaterial).color.setRGB(
          1 - 0.86 * blue,
          0.22 + 0.25 * blue,
          0.01 + 0.99 * blue,
        );
        (middle.current.material as THREE.MeshBasicMaterial).color.setRGB(
          1 - 0.65 * blue,
          0.46 + 0.2 * blue,
          0.03 + 0.97 * blue,
        );
        (core.current.material as THREE.MeshBasicMaterial).color.setRGB(1 - 0.75 * blue, 0.78 - 0.2 * blue, 0.18 + 0.82 * blue);
        (core.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - 0.55 * blue);
      }
    }

    // Heated spot before ignition, and the arc.
    if (glow.current) {
      const heating = flame.kind === "glow";
      glow.current.visible = heating;
      if (heating) {
        const fraction = THREE.MathUtils.clamp(
          (state.surfaceTempC - input.ambientC) / (input.material.ignitionTempC.value - input.ambientC),
          0,
          1,
        );
        const arc = input.ignition.id === "short-circuit" && state.sourceActive;
        const pulse = arc && !reduce ? (Math.sin(time * 90) > 0.2 ? 1.6 : 0.4) : 1;
        glow.current.scale.setScalar((0.03 + 0.05 * fraction) * pulse);
        (glow.current.material as THREE.MeshBasicMaterial).color.setRGB(
          1,
          arc ? 0.9 : 0.25 + 0.5 * fraction,
          arc ? 1 : 0.05 + 0.2 * fraction,
        );
      }
    }

    if (light.current) {
      const kilowatts = state.hrrW / 1000;
      const target = burning ? Math.min(1.6, 0.2 + 0.5 * Math.sqrt(kilowatts)) * flicker : flame.kind === "glow" ? 0.15 : 0;
      light.current.intensity = target;
      light.current.color.setRGB(1 - 0.5 * flame.blueFraction, 0.62, 0.3 + 0.7 * flame.blueFraction);
    }

    // Smoke layer under the ceiling (needs gravity) and the well-mixed haze.
    if (layer.current) {
      const depth = h - state.layerHeightM;
      const show = gravity > 0.01 && depth > 0.03;
      layer.current.visible = show;
      if (show) {
        layer.current.scale.set(w * 0.98, depth, d * 0.98);
        layer.current.position.set(0, h - depth / 2, 0);
        const concentration = (state.room.smokeKg * 1e6) / (input.roomFloorAreaM2 * Math.max(depth, 0.15));
        (layer.current.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(
          0.06 + concentration / 900,
          0.06,
          0.55,
        );
      }
    }
    if (haze.current) {
      const opacity = THREE.MathUtils.clamp((state.smokeMgM3 / 700) * (1 - 0.7 * state.stratification), 0, 0.4);
      haze.current.visible = opacity > 0.01;
      (haze.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }

    // Smoke particles. Motion is drawn in real time at any simulation speed.
    const emitting = burning || state.phase === "smoldering" || (state.phase === "extinguished" && state.t < state.hotUntil);
    if (delta > 0) {
      const positions = smoke.positions;
      const rate = emitting ? Math.min(70, 8 + state.hrrW / 60) : 0;
      spawn.current += rate * delta;
      const rise = gravity > 0 ? 0.35 + 0.9 * Math.cbrt(gravity) * Math.cbrt(Math.max(state.hrrW, 30) / 1000) : 0;
      const drift = Math.min(1.2, state.uForcedMs * 3);
      for (let i = 0; i < SMOKE_COUNT; i += 1) {
        const k = i * 3;
        if (smokeAge[i] < 0) {
          if (spawn.current < 1) continue;
          spawn.current -= 1;
          smokeAge[i] = 0;
          const spread = Math.max(0.04, flame.widthM * 0.4);
          positions[k] = origin[0] + (Math.random() - 0.5) * spread;
          positions[k + 1] = origin[1] + 0.05 + Math.random() * 0.05;
          positions[k + 2] = origin[2] + (Math.random() - 0.5) * spread;
          // With no flow and no gravity the smoke only diffuses, so it stays as a slowly growing ball.
          const jitter = gravity > 0 ? 0.12 : 0.05 + 0.03 * Math.random();
          smokeVelocity[k] = (Math.random() - 0.5) * jitter;
          smokeVelocity[k + 1] = (Math.random() - 0.5) * jitter;
          smokeVelocity[k + 2] = (Math.random() - 0.5) * jitter;
          continue;
        }
        smokeAge[i] += delta;
        const underCeiling = positions[k + 1] >= h - 0.12;
        const inLayer = gravity > 0.01 && positions[k + 1] >= state.layerHeightM;
        let vx = smokeVelocity[k] + flow.x * drift;
        let vy = smokeVelocity[k + 1];
        let vz = smokeVelocity[k + 2] + flow.z * drift;
        if (gravity > 0.01) {
          if (underCeiling) {
            // Ceiling jet: spread outward from above the fire.
            const dx = positions[k] - origin[0];
            const dz = positions[k + 2] - origin[2];
            const radius = Math.hypot(dx, dz) + 0.05;
            vx += (dx / radius) * rise * 0.5;
            vz += (dz / radius) * rise * 0.5;
            vy = 0;
          } else if (inLayer && smokeAge[i] > 2) {
            vy = (Math.random() - 0.5) * 0.1;
          } else {
            vy += rise;
          }
        }
        positions[k] = THREE.MathUtils.clamp(positions[k] + vx * delta, -w / 2 + 0.08, w / 2 - 0.08);
        positions[k + 1] = THREE.MathUtils.clamp(positions[k + 1] + vy * delta, 0.05, h - 0.06);
        positions[k + 2] = THREE.MathUtils.clamp(positions[k + 2] + vz * delta, -d / 2 + 0.08, d / 2 - 0.08);
        const life = gravity > 0.01 ? 11 : drift > 0.05 ? 9 : 16;
        if (smokeAge[i] > life) {
          smokeAge[i] = -1;
          positions[k + 1] = HIDDEN;
        }
      }
      smoke.geometry.attributes.position.needsUpdate = true;
    }

    // Ventilation tracers.
    if (ventPoints.current) {
      const speed = state.uForcedMs;
      ventPoints.current.visible = speed > 0.004;
      (ventPoints.current.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp(speed / 0.12, 0.15, 0.75);
      const along = flow.z !== 0 ? d : w;
      const across = flow.z !== 0 ? w : d;
      for (let i = 0; i < VENT_COUNT; i += 1) {
        const k = i * 3;
        const travel = ((ventSeed[k] + time * Math.min(0.6, speed * 3) / along) % 1) * along - along / 2;
        const side = (ventSeed[k + 1] - 0.5) * across * 0.8;
        const height = 0.35 + ventSeed[k + 2] * (h - 0.7);
        vent.positions[k] = flow.z !== 0 ? side : travel * flow.x;
        vent.positions[k + 1] = height;
        vent.positions[k + 2] = flow.z !== 0 ? travel * flow.z : side;
      }
      vent.geometry.attributes.position.needsUpdate = true;
    }

    // Extinguisher discharge.
    if (agentPoints.current) {
      const a = state.agent;
      const co2 = a.co2Start !== null && state.t - a.co2Start < 45;
      const mist = a.mistStart !== null && state.t - a.mistStart < 30;
      const halon = a.halonStart !== null && state.t - a.halonStart < 10;
      const active = co2 || mist || halon;
      agentPoints.current.visible = active;
      if (active) {
        (agentPoints.current.material as THREE.PointsMaterial).color.set(mist ? "#BFE3F5" : halon ? "#D9CFF2" : "#F2F2F2");
        for (let i = 0; i < AGENT_COUNT; i += 1) {
          const k = i * 3;
          const along = (agentPhase[i] + time * 1.4) % 1;
          const cone = along * 0.35;
          agent.positions[k] = nozzle[0] + (origin[0] - nozzle[0]) * along + Math.sin(i * 12.9898) * cone;
          agent.positions[k + 1] = nozzle[1] + (origin[1] - nozzle[1]) * along + Math.sin(i * 78.233) * cone;
          agent.positions[k + 2] = nozzle[2] + (origin[2] - nozzle[2]) * along + Math.sin(i * 37.719) * cone;
        }
        agent.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Detector status rings.
    const alarmed = state.firstAlarmTime !== null;
    halos.current.forEach((mesh) => {
      if (!mesh) return;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.set(alarmed ? "#F67A6C" : "#6BA3C7");
      material.opacity = alarmed ? (reduce ? 0.9 : 0.55 + 0.4 * Math.sin(time * 8)) : 0.5;
      mesh.scale.setScalar(alarmed ? 1.25 : 1);
    });

    if (running) invalidate();
  });

  if (!object) return null;

  return (
    <group userData={{ fireOverlay: true }}>
      <group ref={flameGroup} position={origin} rotation={[0, yaw, 0]} visible={false}>
        <group ref={tiltGroup}>
          <mesh ref={outer} raycast={noRay} renderOrder={12}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial transparent opacity={0.58} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={middle} raycast={noRay} renderOrder={13}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshBasicMaterial transparent opacity={0.82} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={core} raycast={noRay} renderOrder={14}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshBasicMaterial color="#FFF0C2" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <mesh ref={glow} position={origin} raycast={noRay} visible={false} renderOrder={12}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[origin[0], origin[1] + 0.12, origin[2]]} intensity={0} distance={7} decay={2} />

      <mesh ref={layer} raycast={noRay} visible={false} renderOrder={9}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#2B2A28" transparent opacity={0.1} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={haze} raycast={noRay} visible={false} position={[0, h / 2, 0]} scale={[w * 0.97, h * 0.97, d * 0.97]} renderOrder={8}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#3A3835" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      <points ref={smokePoints} geometry={smoke.geometry} raycast={noRay} renderOrder={10} frustumCulled={false}>
        <pointsMaterial map={dot} alphaMap={dot} color="#4A4844" size={0.36} sizeAttenuation transparent opacity={0.42} depthWrite={false} toneMapped={false} />
      </points>
      <points ref={ventPoints} geometry={vent.geometry} raycast={noRay} renderOrder={7} frustumCulled={false} visible={false}>
        <pointsMaterial map={dot} alphaMap={dot} color="#1FA58C" size={0.08} sizeAttenuation transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </points>
      <points ref={agentPoints} geometry={agent.geometry} raycast={noRay} renderOrder={11} frustumCulled={false} visible={false}>
        <pointsMaterial map={dot} alphaMap={dot} color="#F2F2F2" size={0.12} sizeAttenuation transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </points>

      {detectors.map((item, index) => (
        <mesh
          key={item.id}
          ref={(node) => {
            halos.current[index] = node;
          }}
          position={[item.position[0], item.position[1] - 0.14, item.position[2]]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noRay}
          renderOrder={15}
        >
          <torusGeometry args={[0.24, 0.018, 8, 28]} />
          <meshBasicMaterial color="#6BA3C7" transparent opacity={0.5} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
