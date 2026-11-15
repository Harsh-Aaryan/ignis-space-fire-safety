"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { objectById, type HabitatRoomConfig } from "@/data/habitat-interiors";
import { firePoint, roomFlowDirection } from "@/lib/fire/scenario";
import { opticalOpacity } from "@/lib/fire/transport";
import { isInsideObstacle, tracerDiffusivity, tracerVelocity } from "@/lib/fire/visual-transport";
import { fireRuntime, useFireSimStore } from "@/stores/fire-sim-store";
import { flameVolumeMaterial } from "./flame-volume";

const COUNT = 320, HIDDEN = -500;
const noRay = () => {};
function cloud(count: number) {
  const positions = new Float32Array(count * 3).fill(HIDDEN);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return { positions, geometry };
}
function softDot() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,"rgba(255,255,255,.85)"); g.addColorStop(.5,"rgba(255,255,255,.35)"); g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0,0,64,64); return new THREE.CanvasTexture(canvas);
}
/** Additive effect layer: no equipment rays, no scene geometry mutations. */
export function FireEffects({ room }: { room: HabitatRoomConfig }) {
  const status = useFireSimStore(s => s.status), objectId = useFireSimStore(s => s.activeObjectId);
  const enhanced = useFireSimStore(s => s.enhanceVisibility), showFlow = useFireSimStore(s => s.showAirflow);
  const { invalidate, camera } = useThree(), reduced = useReducedMotion();
  const object = objectById(objectId);
  const origin = useMemo(() => object ? firePoint(object, room) : [0,1,0] as [number,number,number], [object,room]);
  const flow = useMemo(() => roomFlowDirection(room), [room]);
  const resources = useMemo(() => ({ smoke: cloud(COUNT), agent: cloud(100), flow: cloud(48), texture: softDot(), flame: flameVolumeMaterial() }), []);
  const flame = useRef<THREE.Mesh>(null), glow = useRef<THREE.Mesh>(null), light = useRef<THREE.PointLight>(null);
  const smokePoints = useRef<THREE.Points>(null), agentPoints = useRef<THREE.Points>(null), flowPoints = useRef<THREE.Points>(null);
  const halos = useRef<(THREE.Mesh | null)[]>([]);
  const simClock = useRef(0), spawn = useRef(0), seed = useRef(73129), ages = useRef(new Float32Array(COUNT).fill(-1));
  const detectors = room.equipment.filter(e => e.type === "detector");
  const random = () => { seed.current = (Math.imul(seed.current,1664525) + 1013904223) >>> 0; return (seed.current + .5) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  useEffect(() => { invalidate(); }, [status, enhanced, showFlow, invalidate]);
  useEffect(() => () => { resources.smoke.geometry.dispose(); resources.agent.geometry.dispose(); resources.flow.geometry.dispose(); resources.texture.dispose(); resources.flame.dispose(); }, [resources]);
  useFrame(() => {
    const s = fireRuntime.state, input = fireRuntime.input;
    if (!s || !input || !object) return;
    const delta = Math.max(0, s.t - simClock.current);
    const time = reduced ? 0 : s.t;
    const f = s.flame, scale = enhanced ? 1.5 : 1;
    if (flame.current) {
      flame.current.visible = s.phase === "flaming" && s.chemicalHrrW > 0.1;
      const dome = f.kind === "dome";
      const width = Math.max(.03, f.widthM) * scale;
      const height = (dome ? Math.max(f.standoffM * 4, width * .6) : Math.max(.05, f.lengthM)) * scale;
      const reach = dome ? Math.max(width, f.lengthM * scale) : width;
      flame.current.scale.set(width * 1.4, height * 1.25, reach * 1.4);
      // A dome's long axis is local z: yaw it onto the room flow and shift it downstream of the fuel.
      const downstream = dome ? Math.max(0, reach - width) * .7 : 0;
      flame.current.position.set(origin[0] + flow[0] * downstream, origin[1] + height * .5, origin[2] + flow[2] * downstream);
      const direction = new THREE.Vector3(flow[0] * Math.sin(f.tiltRad), Math.cos(f.tiltRad), flow[2] * Math.sin(f.tiltRad));
      if (dome) flame.current.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.atan2(flow[0], flow[2]));
      else flame.current.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction);
      flame.current.updateWorldMatrix(true,false);
      resources.flame.uniforms.uEye.value.copy(flame.current.worldToLocal(camera.getWorldPosition(new THREE.Vector3())));
      resources.flame.uniforms.uTime.value = time;
      resources.flame.uniforms.uDome.value = dome ? 1 : 0;
      resources.flame.uniforms.uBlue.value = f.blueFraction;
      resources.flame.uniforms.uPower.value = Math.max(.35, Math.min(1.2, Math.sqrt(s.chemicalHrrW / 1000)));
    }
    if (glow.current) { glow.current.visible = s.surfaceTempC > 250; glow.current.scale.setScalar(.02 + .025 * Math.min(1, s.surfaceTempC / 600)); }
    if (light.current) { light.current.intensity = s.phase === "flaming" ? Math.min(1.25, s.chemicalHrrW * input.material.radiativeFraction.value / 1000) : s.surfaceTempC > 400 ? .08 : 0; light.current.color.setRGB(1 - f.blueFraction * .6,.4 + f.blueFraction * .2,.08 + f.blueFraction * .7); }
    if (delta > 0 && smokePoints.current) {
      const frames = s.transportFrames.filter(frame => frame.t > simClock.current + 1e-8);
      for (const frame of frames) {
        const dt = Math.min(.125, frame.t - simClock.current);
        const transportState = { ...s, uForcedMs: frame.forcedMs, chemicalHrrW: frame.chemicalW, smokeCountMeanUm: frame.countUm, room: { ...s.room, tempK: frame.tempK }, pressureKpa: frame.pressureKpa };
        simClock.current = frame.t;
        spawn.current += Math.min(60, frame.smokeKgS * 2e6) * dt;
        for (let i=0;i<COUNT;i++) {
          const k=i*3, p=resources.smoke.positions;
          if (ages.current[i] < 0) {
            if (spawn.current < 1) continue; spawn.current--; ages.current[i] = 0;
            p[k]=origin[0]+(random()-.5)*Math.max(.02,f.widthM); p[k+1]=origin[1]+.025; p[k+2]=origin[2]+(random()-.5)*.03; continue;
          }
          ages.current[i] += dt;
          const pos=[p[k],p[k+1],p[k+2]], v=tracerVelocity(pos,transportState,input), sigma=Math.sqrt(2*tracerDiffusivity(transportState)*dt);
          const next=pos.map((x,j)=>x+v[j]*dt+sigma*normal());
          const outside = Math.abs(next[0]) > room.size[0]/2-.05 || next[1]<.02 || next[1]>room.size[1]-.02 || Math.abs(next[2])>room.size[2]/2-.05 || (room.round && Math.hypot(next[0],next[2])>room.size[0]/2-.05);
          if (outside || isInsideObstacle(next,input)) { ages.current[i]=-1; p[k+1]=HIDDEN; }
          else { p[k]=next[0]; p[k+1]=next[1]; p[k+2]=next[2]; }
        }
      }
      resources.smoke.geometry.attributes.position.needsUpdate=true;
      (smokePoints.current.material as THREE.PointsMaterial).opacity=Math.min(.65,opticalOpacity(s.smokeMgM3*1e-6,.3));
    }
    if (flowPoints.current) {
      flowPoints.current.visible=showFlow && s.uForcedMs>.001;
      const along=flow[0] ? room.size[0] : room.size[2];
      for(let i=0;i<48;i++){ const k=i*3, travel=((i*.6180339+s.t*s.uForcedMs/along)%1-.5)*along;
        resources.flow.positions[k]=flow[0]?travel*flow[0]:Math.sin(i*7)*room.size[0]*.35;
        resources.flow.positions[k+1]=.3+(i%7)/7*(room.size[1]-.6);
        resources.flow.positions[k+2]=flow[2]?travel*flow[2]:Math.sin(i*7)*room.size[2]*.35;
      } resources.flow.geometry.attributes.position.needsUpdate=true;
    }
    if(agentPoints.current){
      const a=s.agent, active=(a.co2Start!==null && s.t-a.co2Start<45)||(a.mistStart!==null&&s.t-a.mistStart<30)||(a.halonStart!==null&&s.t-a.halonStart<10);
      agentPoints.current.visible=active;
      const nozzle=[origin[0]+.7,Math.min(room.size[1]-.1,origin[1]+.4),origin[2]+.5];
      for(let i=0;i<100&&active;i++){const k=i*3,t=(i*.6180339+s.t*2)%1;for(let j=0;j<3;j++)resources.agent.positions[k+j]=nozzle[j]+(origin[j]-nozzle[j])*t+Math.sin(i*(j+1)*9)*t*.12;}
      resources.agent.geometry.attributes.position.needsUpdate=true;
    }
    detectors.forEach((d,i)=>{const mesh=halos.current[i];if(!mesh)return;const location=s.detectorLocations.find(l=>l.id===d.id);const alarm=location&&Object.values(location.sensors).some(cell=>cell.alarmed);(mesh.material as THREE.MeshBasicMaterial).color.set(alarm?"#F67A6C":"#6BA3C7");});
    if(status==="running")invalidate();
  });
  if(!object)return null;
  return <group userData={{fireOverlay:true}}>
    <mesh ref={flame} material={resources.flame} visible={false} raycast={noRay} renderOrder={12}><boxGeometry args={[1,1,1]}/></mesh>
    <mesh ref={glow} position={origin} visible={false} raycast={noRay}><sphereGeometry args={[1,10,8]}/><meshBasicMaterial color="#E94D12" transparent opacity={.35} depthWrite={false}/></mesh>
    <pointLight ref={light} position={[origin[0],origin[1]+.1,origin[2]]} intensity={0} distance={4} decay={2}/>
    <points ref={smokePoints} geometry={resources.smoke.geometry} raycast={noRay} frustumCulled={false}><pointsMaterial map={resources.texture} color="#605C56" size={.22} transparent opacity={0} depthWrite={false}/></points>
    <points ref={flowPoints} geometry={resources.flow.geometry} raycast={noRay} frustumCulled={false} visible={false}><pointsMaterial map={resources.texture} color="#66C6BD" size={.035} transparent opacity={.65} depthWrite={false}/></points>
    <points ref={agentPoints} geometry={resources.agent.geometry} raycast={noRay} frustumCulled={false} visible={false}><pointsMaterial map={resources.texture} color="#CAEAF1" size={.07} transparent opacity={.45} depthWrite={false}/></points>
    {detectors.map((d,i)=><mesh key={d.id} ref={node=>{halos.current[i]=node;}} position={[d.position[0],d.position[1]-.14,d.position[2]]} rotation={[Math.PI/2,0,0]} raycast={noRay}><torusGeometry args={[.14,.009,8,24]}/><meshBasicMaterial color="#6BA3C7" transparent opacity={.75} depthWrite={false}/></mesh>)}
  </group>;
}
