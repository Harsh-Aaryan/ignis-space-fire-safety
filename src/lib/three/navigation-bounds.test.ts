import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { navigationBounds } from "@/lib/three/navigation-bounds";

describe("camera framing with fire overlays", () => {
  it("keeps the same room bounds before, during and after a fire with off-screen particle buffers", () => {
    const room = new THREE.Group();
    room.position.set(3, -2, 4);
    room.rotation.set(0.2, 0.5, 0);
    const equipment = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 5));
    room.add(equipment);
    const before = navigationBounds(room);
    const effects = new THREE.Group();
    effects.userData.fireOverlay = true;
    const smoke = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-500, -500, -500)]));
    effects.add(smoke);
    room.add(effects);
    expect(new THREE.Box3().setFromObject(room).getSize(new THREE.Vector3()).length()).toBeGreaterThan(500);
    expect(navigationBounds(room).equals(before)).toBe(true);
    smoke.geometry.attributes.position.setXYZ(0, 500, 500, 500);
    expect(navigationBounds(room).equals(before)).toBe(true);
    room.remove(effects);
    expect(navigationBounds(room).equals(before)).toBe(true);
    equipment.geometry.dispose();
    smoke.geometry.dispose();
  });
});
