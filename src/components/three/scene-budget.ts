/** Upper bounds for the meshes each new scene actually builds. Under 50,000 is the V2 cap. */

export function planeTriangles(widthSegments: number, heightSegments: number): number {
  return widthSegments * heightSegments * 2;
}

export function cylinderTriangles(radial: number, heightSegments: number, openEnded: boolean): number {
  const side = radial * heightSegments * 2;
  return openEnded ? side : side + radial * 2;
}

export function sphereTriangles(widthSegments: number, heightSegments: number): number {
  return widthSegments * heightSegments * 2;
}

export function circleTriangles(segments: number): number {
  return segments;
}

export function boxTriangles(): number {
  return 12;
}

export const MARS_MESH = {
  terrainSegments: 24,
  padSegments: 32,
  berms: 3,
  hullRadial: 18,
  hullCapsWidth: 12,
  hullCapsHeight: 8,
  greenhouseWidth: 16,
  greenhouseHeight: 10,
  airlockRadial: 12,
  quartersRadial: 14,
  smallRadial: 8,
  boxes: 14,
  tunnels: 2,
  tunnelRadial: 10,
} as const;

export function marsTriangleUpperBound(): number {
  return (
    sphereTriangles(24, 16) +
    planeTriangles(32, 32) +
    circleTriangles(28) +
    cylinderTriangles(20, 1, true) +
    8 * boxTriangles() +
    4 * (cylinderTriangles(16, 1, true) + 2 * sphereTriangles(12, 8) + 2 * 16 * 6 * 2) +
    6 * cylinderTriangles(12, 1, false) +
    10 * 36
  );
}

export const GATEWAY_MESH = {
  haloRadial: 20,
  logisticsRadial: 16,
  capWidth: 12,
  capHeight: 8,
  nodeWidth: 14,
  nodeHeight: 10,
  dockRadial: 12,
  smallRadial: 8,
  boxes: 10,
  tunnels: 2,
  tunnelRadial: 10,
} as const;

export function gatewayTriangleUpperBound(): number {
  return (
    4 * (cylinderTriangles(18, 1, true) + 2 * sphereTriangles(12, 8) + 2 * 16 * 6 * 2) +
    12 * boxTriangles() +
    8 * cylinderTriangles(12, 1, false) +
    sphereTriangles(16, 12) * 2 +
    20 * 12
  );
}

export const SCENE_TRIANGLE_CAP = 150_000;
export const SCENE_TRIANGLE_CAP_LOW = 50_000;
