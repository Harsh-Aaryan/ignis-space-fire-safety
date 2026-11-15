import { describe, expect, it } from "vitest";
import { Object3D, PerspectiveCamera, Vector3 } from "three";
import { LIGHTING } from "@/components/three/lighting";
import { LUNAR_EARTH_RADIUS, positionLunarEarth } from "./lunar-sky";

function setup() {
  const reference = LIGHTING.moon.defaultCamera;
  const camera = new PerspectiveCamera(LIGHTING.moon.fov, 1.6, 0.15, 4000);
  camera.position.set(...reference.pos);
  camera.lookAt(new Vector3(...reference.target));
  camera.updateMatrixWorld(true);
  const earth = new Object3D();
  positionLunarEarth(earth, camera);
  return { camera, earth };
}

describe("Earth in the lunar sky", () => {
  it("starts above the habitat in the original exterior view", () => {
    const { camera, earth } = setup();
    const screen = earth.position.clone().project(camera);
    expect(screen.x).toBeGreaterThan(0);
    expect(screen.x).toBeLessThan(1);
    expect(screen.y).toBeGreaterThan(0);
    expect(screen.y).toBeLessThan(1);
  });

  it("moves across the screen when the camera rotates, retaining its sky bearing and orientation", () => {
    const { camera, earth } = setup();
    const before = earth.position.clone().project(camera);
    const bearing = earth.position.clone().sub(camera.position).normalize();
    const orientation = earth.quaternion.clone();
    camera.rotateY(0.15);
    camera.updateMatrixWorld(true);
    positionLunarEarth(earth, camera);
    const after = earth.position.clone().project(camera);
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(0.2);
    expect(earth.position.clone().sub(camera.position).normalize().distanceTo(bearing)).toBeLessThan(1e-10);
    expect(earth.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
  });

  it("keeps its apparent size and bearing while the camera pans or dollies", () => {
    const { camera, earth } = setup();
    const before = earth.position.clone().project(camera);
    const distance = earth.position.distanceTo(camera.position);
    camera.position.add(new Vector3(20, 4, -12));
    camera.updateMatrixWorld(true);
    positionLunarEarth(earth, camera);
    const after = earth.position.clone().project(camera);
    expect(after.distanceTo(before)).toBeLessThan(1e-10);
    expect(earth.position.distanceTo(camera.position)).toBeCloseTo(distance, 10);
    expect(2 * Math.asin(LUNAR_EARTH_RADIUS / distance) * 180 / Math.PI).toBeCloseTo(2, 8);
  });
});
