import type { FireInput, FireState } from "./model";
import { brownianDiffusivity } from "./transport";
/** Shared flow interpretation for tracer visuals and detector paths. */
export function tracerVelocity(p: readonly number[], s: FireState, input: FireInput): [number, number, number] {
  const flow = input.spatial?.flow ?? [0, 0, 1];
  const source = input.spatial?.origin ?? [0, input.fireHeightM, 0];
  const height = Math.max(0.04, p[1] - source[1]);
  const radius = Math.hypot(p[0] - source[0], p[2] - source[2]);
  const plume = input.gravityG > 0 && s.chemicalHrrW > 0 ? 0.96 * Math.cbrt(input.gravityG * s.chemicalHrrW / 1000 / Math.max(0.2, height)) * Math.exp(-(radius ** 2) / (0.05 + height * 0.2) ** 2) : 0;
  const ceiling = input.spatial?.size[1] ?? input.roomHeightM;
  if (p[1] >= ceiling - 0.15 && plume > 0) return [flow[0] * s.uForcedMs + (p[0] - source[0]) / Math.max(0.05, radius) * plume * 0.5, 0, flow[2] * s.uForcedMs + (p[2] - source[2]) / Math.max(0.05, radius) * plume * 0.5];
  return [flow[0] * s.uForcedMs, plume, flow[2] * s.uForcedMs];
}
export function tracerDiffusivity(s: FireState) { return brownianDiffusivity(s.smokeCountMeanUm * 1e-6, s.room.tempK, s.pressureKpa); }
export function isInsideObstacle(p: readonly number[], input: FireInput) {
  return input.spatial?.obstacles.some(o => p.every((v, i) => Math.abs(v - o.center[i]) < o.half[i])) ?? false;
}
