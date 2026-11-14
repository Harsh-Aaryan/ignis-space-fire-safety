"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { LIGHTING, type LightingPreset } from "@/components/three/lighting";

const skyVert = `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skyFrag = `
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float dusk;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float up = dir.y;
    vec3 zenith = mix(vec3(0.07, 0.048, 0.030), vec3(0.11, 0.065, 0.035), dusk);
    vec3 mid = mix(vec3(0.13, 0.085, 0.048), vec3(0.20, 0.12, 0.055), dusk);
    vec3 horizon = vec3(0.22, 0.145, 0.075);
    float limb = smoothstep(0.18, -0.02, up);
    vec3 sky = mix(zenith, mid, smoothstep(0.55, 0.12, up));
    sky = mix(sky, horizon, limb);
    sky += vec3(0.015, 0.008, 0.003) * exp(-pow((up - 0.02) / 0.07, 2.0));
    float mu = dot(dir, normalize(sunDirection));
    float disc = smoothstep(cos(0.0032), cos(0.0014), mu);
    float aureole = pow(max(mu, 0.0), 48.0);
    vec3 blue = vec3(0.541, 0.608, 0.690);
    float blueLobe = dusk * pow(max(mu, 0.0), 180.0);
    sky += sunColor * (disc * 1.4 + aureole * 0.25);
    sky = mix(sky, blue, blueLobe * 0.55);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export function MarsSky({ dusk = false }: { dusk?: boolean }) {
  const material = useMemo(() => {
    const sun = dusk ? new THREE.Vector3(30.3, 5.6, 25.5) : new THREE.Vector3(-42, 22, 18);
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        sunDirection: { value: sun.normalize() },
        sunColor: { value: new THREE.Color(dusk ? "#FFC090" : "#FFD2A6") },
        dusk: { value: dusk ? 1 : 0 },
      },
      vertexShader: skyVert,
      fragmentShader: skyFrag,
    });
  }, [dusk]);
  return (
    <mesh frustumCulled={false} userData={{ noLabelOcclude: true }}>
      <sphereGeometry args={[400, 32, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export function heightAt(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  const apron = THREE.MathUtils.smoothstep(radius, 5.5, 9.5);
  const fbm =
    Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.42 +
    Math.sin(x * 0.9 + z * 0.4) * 0.12 +
    Math.sin(x * 2.6) * Math.cos(z * 2.1) * 0.045;
  const crater = Math.exp(-((x - 8) ** 2 + (z + 4) ** 2) / 18) * 0.22;
  return (fbm - crater) * apron;
}

export function DisplacedGround({
  segments,
  size = 90,
  repeat,
}: {
  segments: number;
  size?: number;
  repeat?: number;
}) {
  const [colorMap, normalMap, roughMap, aoMap] = useTexture([
    "/textures/mars/rocky_trail_02_color.webp",
    "/textures/mars/rocky_trail_02_normal.webp",
    "/textures/mars/rocky_trail_02_rough.webp",
    "/textures/mars/rocky_trail_02_ao.webp",
  ]);
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();
    geo.setAttribute("uv2", geo.getAttribute("uv").clone());
    return geo;
  }, [segments, size]);
  useLayoutEffect(() => {
    const tiles = repeat ?? size / 2;
    for (const texture of [colorMap, normalMap, roughMap, aoMap]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(tiles, tiles);
      texture.needsUpdate = true;
    }
    colorMap.colorSpace = THREE.SRGBColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    roughMap.colorSpace = THREE.NoColorSpace;
    aoMap.colorSpace = THREE.NoColorSpace;
  }, [aoMap, colorMap, normalMap, repeat, roughMap, size]);
  return (
    <mesh geometry={geometry} receiveShadow userData={{ noLabelOcclude: true }}>
      <meshPhysicalMaterial
        color="#6F5A4A"
        map={colorMap}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(1.5, 1.5)}
        roughnessMap={roughMap}
        aoMap={aoMap}
        aoMapIntensity={0.85}
        roughness={0.9}
        metalness={0}
        sheen={0.05}
        sheenColor="#C4B090"
        sheenRoughness={0.75}
      />
    </mesh>
  );
}

/** Local CC0 HDRI. Reflections only — never the visible background. */
export function LocalHdrEnvironment({ url, intensity }: { url: string; intensity: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let active = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    const loader = new RGBELoader();
    loader.load(url, (hdr) => {
      const target = pmrem.fromEquirectangular(hdr);
      if (!active) {
        target.dispose();
        hdr.dispose();
        return;
      }
      scene.environment = target.texture;
      scene.environmentIntensity = intensity;
      hdr.dispose();
      invalidate();
    });
    return () => {
      active = false;
      pmrem.dispose();
    };
  }, [gl, intensity, invalidate, scene, url]);
  return null;
}

export function SceneEnvironment({ preset, dusk = false }: { preset: LightingPreset; dusk?: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = new THREE.Scene();
    env.background = new THREE.Color(preset === "mars" ? "#2A241E" : "#000000");
    if (preset === "mars") {
      const sunDir = new THREE.Vector3(33.9, 21.2, 0.6).normalize();
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          sunDirection: { value: sunDir },
          sunColor: { value: new THREE.Color(dusk ? "#FFC090" : "#FFD2A6") },
          dusk: { value: dusk ? 1 : 0 },
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
      });
      env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16), mat));
    } else {
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#FFF3DC" }),
      );
      sun.position.set(8, 4, 6);
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#6FA0C8" }),
      );
      earth.position.set(-6, 1.2, -4);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#C8C4BC" }),
      );
      moon.position.set(5, 2.2, -7);
      env.add(sun, earth, moon);
    }
    const target = pmrem.fromScene(env, 0.04);
    const previous = scene.environment;
    scene.environment = target.texture;
    scene.environmentIntensity = LIGHTING[preset].environmentIntensity;
    invalidate();
    return () => {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
      pmrem.dispose();
      previous?.dispose?.();
    };
  }, [dusk, gl, invalidate, preset, scene]);
  return null;
}
