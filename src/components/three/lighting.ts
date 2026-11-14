/**
 * Physical lighting. Stored intensities are lux.
 * three r187 applies DirectionalLight.intensity as a unitless scale, so 52_000
 * clips mid-grey to white under AgX. One uniform scale keeps the locked ratios
 * (Mars sun = 0.43 × Moon, earthshine = 0.07 × its sun, Mars fill = 0.22 × its sun).
 */
export const LIGHT_UNIT_SCALE = 1 / 5000;

export const LIGHTING = {
  moon: {
    sunColor: "#FFF6E4",
    sunIntensity: 120_000,
    sunPosition: [74.7, 15.3, 24.3] as const,
    hemisphere: { sky: "#B7C8E0", ground: "#2A2A28", intensity: 1_450 },
    earthshineDirectional: { color: "#A8C4E0", intensity: 19_000, position: [-22, 14, -16] as const },
    fog: null,
    background: "#000000",
    exposure: 0.38,
    environmentIntensity: 0.05,
    softShadows: null,
    shadowFrustum: 36,
    shadowNear: 6,
    shadowFar: 240,
    fov: 37.85,
    defaultCamera: {
      pos: [20.4, 2.18, 15.8] as const,
      target: [-1.6, 2.15, 1.2] as const,
      polar: [8, 100] as const,
      minD: 6,
      maxD: 60,
    },
  },
  mars: {
    sunColor: "#FFD2A6",
    sunIntensity: 52_000,
    sunPosition: [-42, 22, 18] as const,
    hemisphere: { sky: "#C8B090", ground: "#5A4A3C", intensity: 4_250 },
    earthshineDirectional: null,
    fog: { type: "Fog" as const, color: "#C4B090", near: 22, far: 140 },
    background: "#2A241E",
    exposure: 0.55,
    environmentIntensity: 0.55,
    softShadows: { samples: 12, size: 14, focus: 0.2 } as const,
    shadowFrustum: 48,
    shadowNear: 8,
    shadowFar: 160,
    fov: 37.85,
    defaultCamera: {
      pos: [28.5, 3.05, 32] as const,
      target: [-0.5, 5.4, -8] as const,
      polar: [8, 110] as const,
      minD: 10,
      maxD: 90,
    },
  },
  gateway: {
    sunColor: "#FFF3DC",
    sunIntensity: 120_000,
    sunPosition: [28.8, 13.68, 24.2] as const,
    earthshineDirectional: { color: "#B7C8E0", intensity: 8_400, position: [-20, 8, -16] as const },
    hemisphere: { sky: "#B7C8E0", ground: "#C8C0B0", intensity: 6_000 },
    fog: null,
    background: "#000000",
    exposure: 0.12,
    environmentIntensity: 0.05,
    softShadows: null,
    shadowFrustum: 24,
    shadowNear: 8,
    shadowFar: 100,
    fov: 37.85,
    defaultCamera: {
      pos: [35.7, 17.65, 33.74] as const,
      target: [0, 1.2, 0] as const,
      polar: [5, 175] as const,
      minD: 12,
      maxD: 90,
    },
  },
} as const;

export const MARS_DUSK = {
  sunColor: "#FFC090",
  sunIntensity: 18_000,
  sunPosition: [30.3, 5.6, 25.5] as const,
  exposure: 0.55,
} as const;

export const FOCUS_FOV = 27;

export type LightingPreset = keyof typeof LIGHTING;

export function lightingForMission(missionId: string): LightingPreset {
  if (missionId === "mars-habitat") return "mars";
  if (missionId === "gateway-orbit") return "gateway";
  return "moon";
}
