import * as THREE from "three";

/** Particle buffers and visual effects must never change equipment or room camera framing. */
export function navigationBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  const local = new THREE.Box3();
  function visit(node: THREE.Object3D) {
    if (node.userData.fireOverlay) return;
    const geometry = (node as THREE.Mesh).geometry;
    if (geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (geometry.boundingBox) bounds.union(local.copy(geometry.boundingBox).applyMatrix4(node.matrixWorld));
    }
    for (const child of node.children) visit(child);
  }
  visit(root);
  return bounds;
}
