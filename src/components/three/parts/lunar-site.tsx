"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

const WINDOW_METERS = 480;
const HEIGHT_SPAN = 160;
/** Column of the cratered ground inside the 2048 NAC crop. */
const ORIGIN_U = 0.844;
const ROCK_URL = "/models/moon-rocks.glb";
const LM_URL = "/models/Apollo_Lunar_Module_30k.glb";
const ROCK_SPOTS = [
  { x: 7.6, z: 6.4, size: 1.85, yaw: 0.7 },
  { x: 4.2, z: 11.8, size: 1.15, yaw: -0.4 },
  { x: 11.2, z: 4.8, size: 1.55, yaw: 0.3 },
  { x: -5.4, z: 10.2, size: 0.85, yaw: 1.2 },
];

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Browser image decoders drop 16-bit samples. Read the PNG IDAT directly. */
export async function decodePng16(url: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset + 8 < bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = view.getUint32(0);
      height = view.getUint32(4);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const packed = new Uint8Array(idat.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0;
  for (const chunk of idat) {
    packed.set(chunk, cursor);
    cursor += chunk.length;
  }
  const inflated = new Uint8Array(
    await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer(),
  );
  const bpp = 2;
  const stride = width * bpp;
  const raw = new Uint8Array(height * stride);
  let index = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[index];
    index += 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? raw[row + x - bpp] : 0;
      const up = y > 0 ? raw[prev + x] : 0;
      const upLeft = y > 0 && x >= bpp ? raw[prev + x - bpp] : 0;
      const value = inflated[index];
      index += 1;
      let next = value;
      if (filter === 1) next = (value + left) & 255;
      else if (filter === 2) next = (value + up) & 255;
      else if (filter === 3) next = (value + ((left + up) >> 1)) & 255;
      else if (filter === 4) next = (value + paeth(left, up, upLeft)) & 255;
      raw[row + x] = next;
    }
  }
  const samples = new Uint16Array(width * height);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  for (let i = 0; i < samples.length; i += 1) samples[i] = view.getUint16(i * 2);
  return { width, height, samples };
}

function reliefAt(samples: Uint16Array, n: number, x: number, z: number) {
  const span = WINDOW_METERS / (n * (n > 1500 ? 2 : 4));
  const u = THREE.MathUtils.clamp(ORIGIN_U + (x / WINDOW_METERS) * span, 0, 1);
  const v = THREE.MathUtils.clamp(0.5 + (z / WINDOW_METERS) * span, 0, 1);
  const px = Math.round(u * (n - 1));
  const py = Math.round((1 - v) * (n - 1));
  return (samples[py * n + px] / 65535) * HEIGHT_SPAN - HEIGHT_SPAN / 2;
}

/** Three shallow bowls taken from DTM lows, blended into a quieter pad. */
const SHALLOW_CRATERS = [
  { x: -14, z: 11, radius: 8.5 },
  { x: 10.5, z: 15, radius: 6.5 },
  { x: -7, z: -7.5, radius: 7.5 },
];

function metersAt(samples: Uint16Array, n: number, x: number, z: number) {
  const raw = reliefAt(samples, n, x, z);
  const broad =
    (raw +
      reliefAt(samples, n, x + 8, z) +
      reliefAt(samples, n, x - 8, z) +
      reliefAt(samples, n, x, z + 8) +
      reliefAt(samples, n, x, z - 8)) /
    5;
  const detail = raw - broad;
  const dist = Math.hypot(x, z);
  const pad = THREE.MathUtils.smoothstep(dist, 13, 21);
  const far = 1 - THREE.MathUtils.smoothstep(dist, 46, 200);
  let height = broad * 0.07 * pad * far;
  if (detail < 0) height += detail * 0.2 * far;
  for (const crater of SHALLOW_CRATERS) {
    const d = Math.hypot(x - crater.x, z - crater.z);
    if (d >= crater.radius) continue;
    const t = 1 - THREE.MathUtils.smoothstep(d, crater.radius * 0.22, crater.radius);
    const localDip = Math.min(0, reliefAt(samples, n, x, z) - reliefAt(samples, n, crater.x, crater.z));
    height += localDip * 0.18 * t - 0.62 * t * t;
  }
  if (z > -1.8 && z < 5.4 && x > 7.7 && x < 10.6) {
    const along = THREE.MathUtils.clamp((x - 7.8) / 2, 0, 1);
    const across = 1 - THREE.MathUtils.smoothstep(Math.abs(z - 1.6), 3.2, 5.5);
    const lip = 0.45 * (1 - along) ** 2.2;
    height += lip * across;
  }
  return height;
}

function groundGeometry(samples: Uint16Array, n: number, size: number, segments: number) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const span = WINDOW_METERS / (n * (n > 1500 ? 2 : 4));
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, metersAt(samples, n, x, z));
    uv.setXY(i, x / 9, z / 9);
    const shade = 1 - 0.45 * THREE.MathUtils.smoothstep(Math.hypot(x, z), 22, 140);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const uv2 = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv2[i * 2] = ORIGIN_U + (x / WINDOW_METERS) * span;
    uv2[i * 2 + 1] = 0.5 + (z / WINDOW_METERS) * span;
  }
  geo.setAttribute("uv2", new THREE.BufferAttribute(uv2, 2));
  return geo;
}

export function LunarSite({ coarse }: { coarse: boolean }) {
  const heightUrl = coarse ? "/textures/moon/apollo11_nac_dtm_1024.png" : "/textures/moon/apollo11_nac_dtm_2048.png";
  const [field, setField] = useState<{ samples: Uint16Array; n: number } | null>(null);
  const [albedo, normal, rough, ao] = useTexture([
    "/textures/moon/moon_01_color.webp",
    "/textures/moon/moon_01_normal.webp",
    "/textures/moon/moon_01_rough.webp",
    coarse ? "/textures/moon/apollo11_nac_ao_1024.webp" : "/textures/moon/apollo11_nac_ao_2048.webp",
  ]);
  useEffect(() => {
    let cancel = false;
    setField(null);
    decodePng16(heightUrl).then((image) => {
      if (!cancel) setField({ samples: image.samples, n: image.width });
    });
    return () => {
      cancel = true;
    };
  }, [heightUrl]);
  useEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    rough.colorSpace = THREE.NoColorSpace;
    ao.colorSpace = THREE.NoColorSpace;
    for (const texture of [albedo, normal, rough, ao]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = coarse ? 2 : 8;
    }
  }, [albedo, ao, coarse, normal, rough]);
  const outerSegments = 64;
  const outer = useMemo(
    () => (field ? groundGeometry(field.samples, field.n, WINDOW_METERS, outerSegments) : null),
    [field],
  );
  const inner = useMemo(
    () => (field && !coarse ? groundGeometry(field.samples, field.n, 80, 128) : null),
    [coarse, field],
  );
  if (!outer || !field) return null;
  const groundMaterial = (
    <meshPhysicalMaterial
      color="#6E6A62"
      vertexColors
      map={albedo}
      normalMap={normal}
      normalScale={new THREE.Vector2(0.65, 0.65)}
      roughnessMap={rough}
      aoMap={ao}
      aoMapIntensity={0.9}
      roughness={0.96}
      metalness={0}
      sheen={0}
    />
  );
  return (
    <group>
      <mesh geometry={outer} receiveShadow userData={{ noLabelOcclude: true }}>
        {groundMaterial}
      </mesh>
      {inner ? (
        <mesh geometry={inner} receiveShadow userData={{ noLabelOcclude: true }}>
          <meshPhysicalMaterial
            color="#6E6A62"
            vertexColors
            map={albedo}
            normalMap={normal}
            normalScale={new THREE.Vector2(0.65, 0.65)}
            roughnessMap={rough}
            aoMap={ao}
            aoMapIntensity={0.9}
            roughness={0.96}
            metalness={0}
            sheen={0}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ) : null}
      {coarse ? <Pebbles samples={field.samples} n={field.n} /> : <MoonBoulders samples={field.samples} n={field.n} />}
      {coarse ? null : <ApolloModule samples={field.samples} n={field.n} />}
    </group>
  );
}

function MoonBoulders({ samples, n }: { samples: Uint16Array; n: number }) {
  const gltf = useGLTF(ROCK_URL, "/draco/");
  const rocks = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    for (const scene of gltf.scenes) {
      const inScene: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) inScene.push(mesh);
      });
      const lod1 = inScene.find((mesh) => `${mesh.name} ${mesh.parent?.name ?? ""}`.includes("LOD1"));
      const pick = lod1 ?? inScene[0];
      if (pick) meshes.push(pick);
    }
    return meshes.map((mesh, index) => {
      const spot = ROCK_SPOTS[index] ?? ROCK_SPOTS[0];
      const clone = mesh.clone();
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.scale.set(1, 1, 1);
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const plan = Math.max(size.x, size.z, 0.02);
      const scale = spot.size / plan;
      const material = (clone.material as THREE.MeshStandardMaterial).clone();
      material.color.setRGB(0.35, 0.35, 0.35);
      clone.material = material;
      clone.castShadow = true;
      clone.receiveShadow = true;
      clone.userData.noLabelOcclude = true;
      const y = metersAt(samples, n, spot.x, spot.z) - box.min.y * scale - size.y * scale * 0.3;
      return { clone, spot, scale, y };
    });
  }, [gltf.scenes, n, samples]);
  return (
    <>
      {rocks.map(({ clone, spot, scale, y }) => (
        <primitive key={`${spot.x}-${spot.z}`} object={clone} position={[spot.x, y, spot.z]} rotation={[0, spot.yaw, 0]} scale={scale} />
      ))}
    </>
  );
}

function ApolloModule({ samples, n }: { samples: Uint16Array; n: number }) {
  const gltf = useGLTF(LM_URL, "/draco/");
  const placed = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const height = Math.max(0.01, box.max.y - box.min.y);
    const scale = 7.04 / height;
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const source = mesh.material;
      const name = `${mesh.name} ${mesh.parent?.name ?? ""}`.toLowerCase();
      const namedCabin = /ascent|cabin|csm/.test(name);
      const tune = (material: THREE.Material) => {
        const next = material.clone() as THREE.MeshStandardMaterial;
        const c = next.color;
        const isFoil = c && c.r > 0.45 && c.g > 0.3 && c.b < c.r * 0.75 && c.r - c.b > 0.15;
        const isWhite =
          namedCabin ||
          (c && c.r > 0.45 && c.g > 0.45 && c.b > 0.4 && c.r - c.b < 0.28);
        if (isFoil && !namedCabin) {
          next.color.set("#5C431C");
          next.roughness = Math.max(next.roughness ?? 0, 0.62);
          next.metalness = 0.28;
        } else if (isWhite) {
          next.color.set("#484644");
          if (next.map) next.map = null;
          next.roughness = 0.85;
          next.metalness = 0;
          next.emissive?.set(0, 0, 0);
          if ("emissiveIntensity" in next) next.emissiveIntensity = 0;
          if ("emissiveMap" in next) (next as { emissiveMap: null }).emissiveMap = null;
          if ("envMapIntensity" in next) (next as { envMapIntensity: number }).envMapIntensity = 0;
          if ("clearcoat" in next) (next as { clearcoat: number }).clearcoat = 0;
          if ("sheen" in next) (next as { sheen: number }).sheen = 0;
        } else if (c) {
          next.color.multiplyScalar(0.85);
        }
        const specular = next as THREE.MeshStandardMaterial & { specularIntensity?: number; specularColor?: THREE.Color };
        if ("specularIntensity" in specular) specular.specularIntensity = isFoil && !namedCabin ? 0.12 : isWhite ? 0.04 : 0.04;
        if (isWhite && specular.specularColor) specular.specularColor.set("#000000");
        return next;
      };
      mesh.material = Array.isArray(source) ? source.map(tune) : tune(source);
    });
    const y = metersAt(samples, n, -20, 2) - box.min.y * scale - 0.28;
    return { clone, scale, y };
  }, [gltf.scene, n, samples]);
  return (
    <primitive object={placed.clone} position={[-20, placed.y, 2]} rotation={[0, 1.75, 0]} scale={placed.scale} />
  );
}

function Pebbles({ samples, n }: { samples: Uint16Array; n: number }) {
  const spots = [
    [4.2, 8.5],
    [-3.1, 7.4],
    [8.6, 6.2],
    [1.4, 10.2],
    [-6.2, 9.1],
    [10.4, 11.2],
  ];
  return (
    <>
      {spots.map(([x, z], index) => (
        <mesh key={index} position={[x, metersAt(samples, n, x, z) - 0.04, z]} castShadow>
          <dodecahedronGeometry args={[0.18 + (index % 3) * 0.08, 0]} />
          <meshPhysicalMaterial color="#6E6A62" roughness={0.96} />
        </mesh>
      ))}
    </>
  );
}
