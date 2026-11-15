import { Camera, Matrix4, Object3D, Quaternion, Vector3, Euler } from "three";
import { LIGHTING } from "@/components/three/lighting";

const DISTANCE = 380;
const reference = LIGHTING.moon.defaultCamera;
const referenceRotation = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(
  new Vector3(...reference.pos),
  new Vector3(...reference.target),
  new Vector3(0, 1, 0),
));

// Preserve the original exterior composition, but keep the bearing in world
// coordinates. Applying the current camera rotation would pin Earth to the screen.
const direction = new Vector3(62, 92, -DISTANCE).applyQuaternion(referenceRotation).normalize();
const orientation = referenceRotation.clone().multiply(new Quaternion().setFromEuler(new Euler(0, 1.05, 0.15, "YXZ")));

/** Two-degree disc at a constant sky distance, with negligible translation parallax. */
export const LUNAR_EARTH_RADIUS = DISTANCE * Math.sin(Math.PI / 180);

export function positionLunarEarth(earth: Object3D, camera: Camera): void {
  // A distant sky follows camera translation, not rotation. Keep its angular
  // size stable when dollying or panning around the much smaller habitat.
  camera.getWorldPosition(earth.position);
  earth.position.addScaledVector(direction, DISTANCE);
  earth.quaternion.copy(orientation);
}
