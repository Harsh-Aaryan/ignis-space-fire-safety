"use client";

import { Environment, useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal, useThree } from "@react-three/fiber";
import { HabitatRoom } from "@/components/three/habitat-interior";
import { roomById, roomsForHabitat, type HabitatRoomConfig } from "@/data/habitat-interiors";
import { useMissionStore } from "@/stores/mission-store";
import * as THREE from "three";
import { Hotspot } from "@/components/three/hotspot";
import {
  ALUMINIUM,
  Barrel,
  Detector,
  DockingPort,
  Rack,
  RadiatorPanel,
  SolarWing,
  Suppression,
  VentDuct,
} from "@/components/three/parts/library";
import type { EquipmentId } from "@/types/domain";

/** Compact HALO / PPE / I-Hab inspired T-stack. No logos, no ground. */
function LegacyGateway({
  registry,
  coarse,
  cutaway,
  exploded,
}: {
  registry: React.RefObject<Map<EquipmentId, THREE.Object3D>>;
  coarse: boolean;
  cutaway: boolean;
  exploded: boolean;
}) {
  const spread = exploded ? 1.4 : 0;
  const clip = useMemo(() => (cutaway ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.2)] : []), [cutaway]);
  const stars = useMemo(() => {
    const positions = new Float32Array(200 * 3);
    const look = new THREE.Vector3(-20, -6.2, -16.5).normalize();
    for (let i = 0; i < 200; i += 1) {
      const inFrame = i < 100;
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      if (inFrame) dir.lerp(look, 0.72).normalize();
      dir.multiplyScalar(600);
      positions[i * 3] = dir.x;
      positions[i * 3 + 1] = dir.y;
      positions[i * 3 + 2] = dir.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  if (!coarse && !cutaway) {
    return (
      <group>
        <Environment files="/textures/space/low_lunar_orbit_4k.jpg" background environmentIntensity={0.1} />
        <GatewayCoreModel />
        {(
          [
            ["shell", [6, 8, 8]],
            ["living-quarters", [2, 3, 10]],
            ["laboratory", [-4, -2, 10]],
            ["material-storage", [0, -8, 8]],
            ["ventilation", [8, 10, 4]],
            ["smoke-detection", [10, 5, 2]],
            ["fire-suppression", [8, 0, 6]],
            ["airlock-oxygen", [-8, 2, 10]],
          ] as const
        ).map(([id, position]) => (
          <Hotspot key={id} id={id} position={[position[0], position[1], position[2]]} registry={registry} groundRadius={3} anchorY={position[1]} ring={false}>
            <mesh>
              <sphereGeometry args={[0.35, 6, 6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </Hotspot>
        ))}
      </group>
    );
  }

  return (
    <group>
      {coarse ? (
      <points geometry={stars}>
        <pointsMaterial color="#F0F2F5" size={1.2} sizeAttenuation={false} transparent opacity={0.62} toneMapped={false} />
      </points>
      ) : null}
      {coarse ? (
        <>
          <mesh position={[-8, 3.2, -18]}>
            <sphereGeometry args={[0.31, 16, 12]} />
            <meshBasicMaterial color="#6FA0C8" />
          </mesh>
          <mesh position={[6, 4.4, -16]}>
            <sphereGeometry args={[0.42, 16, 12]} />
            <meshBasicMaterial color="#C8C4BC" />
          </mesh>
        </>
      ) : null}
      <group position={[-0.4, 0, 0]}>
        <Hotspot id="shell" registry={registry} groundRadius={2.3} anchorY={0} outlineIds={["shell", "living-quarters"]}>
          <Barrel length={6.5} radius={2} radial={18} clip={clip} />
        </Hotspot>
        <Hotspot id="living-quarters" position={[-1.2, 0.15, 1.7]} registry={registry} groundRadius={2.3} anchorY={0.15} ring={false}>
          <mesh>
            <boxGeometry args={[1.1, 0.36, 0.05]} />
            <meshPhysicalMaterial color="#E7E1D6" roughness={0.15} />
          </mesh>
        </Hotspot>
        <Hotspot id="ventilation" position={[0, 2.15, 0]} registry={registry} groundRadius={2.3} anchorY={2.15}>
          <VentDuct length={3.6} />
        </Hotspot>
        <Hotspot id="smoke-detection" position={[1.1, 1.45, 0.4]} registry={registry} groundRadius={2.3} anchorY={1.45}>
          <Detector />
        </Hotspot>
        <Hotspot id="fire-suppression" position={[2.1, -1.15, -0.5]} registry={registry} groundRadius={2.3} anchorY={-1.15}>
          <Suppression />
        </Hotspot>
        {cutaway ? (
          <>
            <Rack position={[0, -1.15, -0.4]} args={[2.4, 0.45, 0.7]} />
            <Rack position={[0.2, 1.15, -0.2]} args={[2.2, 0.4, 0.55]} />
          </>
        ) : null}
      </group>
      <group position={[0.2, 0, 4.8 + spread]}>
        <Hotspot id="laboratory" registry={registry} groundRadius={2} anchorY={0}>
          <Barrel length={6} radius={1.8} radial={16} />
        </Hotspot>
        <group rotation={[0, Math.atan2(20, 16.5), 0]}>
          <mesh position={[2.3, 0.35, 0]} castShadow>
            <boxGeometry args={[0.06, 1.4, 10]} />
            <meshPhysicalMaterial color="#E8E4DC" roughness={0.48} metalness={0.04} />
          </mesh>
          <mesh position={[-2.3, -0.15, 0]} castShadow>
            <boxGeometry args={[0.05, 1.28, 9.85]} />
            <meshPhysicalMaterial color="#E8E4DC" roughness={0.48} metalness={0.04} />
          </mesh>
        </group>
      </group>
      <group position={[6.2 + spread, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.2, 2.4, 4]} />
          <meshPhysicalMaterial color={ALUMINIUM} roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.7, 1.1, 0.8, 12]} />
          <meshPhysicalMaterial color={ALUMINIUM} roughness={0.4} metalness={0.7} />
        </mesh>
        <SolarWing position={[0.2, 0, 6.2]} rotation={[0.4, 0, 0]} size={[0.05, 3.2, 12]} />
        <SolarWing position={[0.2, 0, -6.2]} rotation={[-0.4, 0, 0]} size={[0.05, 3.2, 12]} />
        <mesh position={[0.4, 1.5, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.6, 6]} />
          <meshPhysicalMaterial color={ALUMINIUM} metalness={0.8} roughness={0.35}  clearcoat={0.55} clearcoatRoughness={0.18} />
        </mesh>
        <mesh position={[0.4, 2.3, 0]}>
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshPhysicalMaterial color={ALUMINIUM} metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      <group position={[-4.6 - spread, 0, 0]}>
        <Hotspot id="airlock-oxygen" registry={registry} groundRadius={1.3} anchorY={0}>
          <DockingPort />
        </Hotspot>
      </group>
      <group position={[-1.6, 0, -3.6 - spread]}>
        <Hotspot id="material-storage" registry={registry} groundRadius={1.3} anchorY={0}>
          <Barrel length={3.2} radius={1.35} radial={14} />
        </Hotspot>
      </group>
    </group>
  );
}

const GATEWAY_CORE_URL = "/models/gateway-core.glb";

function GatewayCoreModel() {
  const { scene } = useGLTF(GATEWAY_CORE_URL, "/draco/");
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const physical = material as THREE.MeshStandardMaterial;
          physical.color.multiplyScalar(0.5);
          physical.roughness = Math.max(physical.roughness ?? 0.5, 0.72);
          physical.metalness = Math.min(physical.metalness ?? 0, 0.2);
          physical.emissive?.multiplyScalar(0.05);
          physical.envMapIntensity = 0.08;
        }
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={model} />;
}



/** Preserve the NASA exterior and reveal only the selected pressurized module. */
export function GatewayHabitat(props: Parameters<typeof LegacyGateway>[0]) {
  if (props.coarse && !props.cutaway) return <LegacyGateway {...props} />;
  return <GatewayStation {...props} />;
}
function GatewayStation({registry,coarse,cutaway}: Parameters<typeof LegacyGateway>[0]) {
  const {scene} = useGLTF(GATEWAY_CORE_URL,"/draco/");
  const roomId = useMissionStore(s=>s.selectedRoomId);
  const selectRoom = useMissionStore(s=>s.selectRoom);
  const invalidate = useThree(s=>s.invalidate);
  const rooms = useMemo(() => roomsForHabitat("gateway-orbit"), []);
  const selectedRoom = roomById(roomId) ?? rooms[0];
  const {model,meshes} = useMemo(()=>{
    const model = scene.clone(true);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    model.position.sub(center);
    const meshes: THREE.Mesh[] = [];
    model.traverse(node=>{
      const mesh=node as THREE.Mesh;if(!mesh.isMesh)return;
      meshes.push(mesh);
      const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const copies=originals.map(original=>{
        const m=original.clone() as THREE.MeshStandardMaterial;
        m.color?.multiplyScalar(0.5);m.roughness=Math.max(m.roughness??0.5,0.72);
        m.metalness=Math.min(m.metalness??0,0.2);m.emissive?.multiplyScalar(0.05);m.envMapIntensity=0.08;
        return m;
      });
      mesh.material=Array.isArray(mesh.material)?copies:copies[0];mesh.castShadow=true;mesh.receiveShadow=true;
    });
    model.updateMatrixWorld(true);
    return {model,meshes};
  },[scene]);
  const modules = useMemo(()=>rooms.map(room=>({room,node:model.getObjectByName(room.moduleName!)})),[model,rooms]);
  const activeNode = modules.find(item=>item.room.id===selectedRoom.id)?.node;
  useLayoutEffect(()=>{
    for(const mesh of meshes) {
      let owner: THREE.Object3D|null=mesh;let active=false;
      while(owner) {if(owner===activeNode){active=true;break;}owner=owner.parent;}
      const reveal=cutaway&&active;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) {
        const m=material as THREE.MeshStandardMaterial;
        m.transparent=reveal;m.opacity=reveal?0.055:1;m.depthWrite=!reveal;m.needsUpdate=true;
      }
      mesh.castShadow=!reveal;
      mesh.raycast=reveal?()=>{}:THREE.Mesh.prototype.raycast;
    }
    invalidate();
  },[activeNode,cutaway,invalidate,meshes]);
  useEffect(()=>()=>{for(const mesh of meshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();},[meshes]);
  return <group>
    <Environment files={coarse?"/textures/space/low_lunar_orbit_2k.jpg":"/textures/space/low_lunar_orbit_4k.jpg"} background environmentIntensity={0.1} />
    <primitive object={model} onClick={(event: import("@react-three/fiber").ThreeEvent<MouseEvent>)=>{
      if(event.delta>4)return;
      let owner:THREE.Object3D|null=event.object;
      while(owner){const item=modules.find(item=>item.node===owner);if(item){event.stopPropagation();selectRoom(item.room.id);break;}owner=owner.parent;}
    }} />
    {cutaway&&activeNode ? createPortal(<group rotation={[0,selectedRoom.moduleName==="NG_HALO001"?0:Math.PI/2,0]} position={selectedRoom.moduleName==="NG_HALO001"?[0,0,3.7]:[3.4,0,0]}>
      <ambientLight intensity={1.4} color="#ECF0E6" />
      <HabitatRoom room={selectedRoom} origin={[0,-1.25,0]} />
    </group>, activeNode):null}
    {modules.map(({room,node})=>node ? <GatewayMarker key={room.id} room={room} node={node} registry={registry} />:null)}
  </group>;
}
function GatewayMarker({room,node,registry}: {room:HabitatRoomConfig;node:THREE.Object3D;registry:React.RefObject<Map<EquipmentId,THREE.Object3D>>}) {
  const position=useMemo(()=>{
    const local = room.moduleName==="NG_HALO001" ? new THREE.Vector3(0,0,3.7):new THREE.Vector3(3.4,0,0);
    return node.localToWorld(local).toArray() as [number,number,number];
  },[node,room.moduleName]);
  return <Hotspot id={room.system} position={position} registry={registry} groundRadius={1.5} anchorY={position[1]} ring={false}>
    <mesh><sphereGeometry args={[0.3,6,6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </Hotspot>;
}
