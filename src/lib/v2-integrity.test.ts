import { describe, expect, it } from "vitest";
import { GATEWAY_SCENE_LABEL, scenarioAfterHabitatSwitch, scenarioFromMission } from "@/data/missions";
import { assessIndexedMetadata, classifySyntheticRuns } from "@/lib/analytics/gap-class";
import { LIGHTING } from "@/components/three/lighting";
import { gatewayTriangleUpperBound, marsTriangleUpperBound, SCENE_TRIANGLE_CAP } from "@/components/three/scene-budget";
import { VERIFIED_CITATIONS } from "@/data/verified";
import { formatGravity } from "@/lib/format";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import {
  assessVerifiedPrediction,
  fitLine,
  meanConfidenceInterval,
  observationPredictionInterval,
  type RegressionPoint,
} from "@/lib/predict/baseline";
import type { ExperimentalRun } from "@/types/domain";

describe("habitat switch and gravity", () => {
  it("keeps oxygen, pressure, and material when the habitat changes", () => {
    const lunar = scenarioFromMission("lunar-habitat");
    const edited = { ...lunar, oxygenPct: 32, pressurePsi: 10.2, fuelCategory: "solid-polymer" as const };
    const mars = scenarioAfterHabitatSwitch(edited, "mars-habitat");
    const gateway = scenarioAfterHabitatSwitch(edited, "gateway-orbit");
    expect(mars.oxygenPct).toBe(32);
    expect(mars.pressurePsi).toBe(10.2);
    expect(mars.fuelCategory).toBe("solid-polymer");
    expect(mars.gravityG).toBe(0.38);
    expect(gateway.gravityG).toBe(0);
    expect(gateway.oxygenPct).toBe(32);
    expect(gateway.name).toBe(GATEWAY_SCENE_LABEL);
    expect(scenarioFromMission("lunar-habitat").gravityG).toBe(0.165);
    expect(scenarioFromMission("iss-microgravity").gravityG).toBe(0);
  });

  it("computes partial pressure as fraction times cabin pressure", () => {
    expect(oxygenPartialPressurePsi(32, 10.2)).toBeCloseTo(3.264, 3);
    expect(formatGravity(0)).toBe("~0");
    expect(formatGravity(0.38)).toBe("0.38");
    expect(formatGravity(0.165)).toBe("0.165");
  });
});

describe("lighting presets", () => {
  it("locks the Mars afternoon sun and keeps ember off the ground color", () => {
    expect(LIGHTING.mars.sunIntensity).toBe(52_000);
    expect(LIGHTING.mars.sunColor).toBe("#FFD2A6");
    expect([...LIGHTING.mars.sunPosition]).toEqual([-42, 22, 18]);
    expect(LIGHTING.mars.hemisphere.intensity).toBe(4_250);
    expect(LIGHTING.mars.fog?.type).toBe("Fog");
    expect(LIGHTING.mars.fog && "near" in LIGHTING.mars.fog ? LIGHTING.mars.fog.near : 0).toBe(22);
    expect(LIGHTING.mars.fog && "far" in LIGHTING.mars.fog ? LIGHTING.mars.fog.far : 0).toBe(140);
    expect(LIGHTING.mars.exposure).toBe(0.55);
    expect(LIGHTING.mars.softShadows).toEqual({ samples: 12, size: 14, focus: 0.2 });
    expect(LIGHTING.gateway.earthshineDirectional?.intensity).toBe(8_400);
    expect(LIGHTING.gateway.hemisphere.intensity).toBe(6_000);
    expect(LIGHTING.gateway.exposure).toBe(0.12);
    expect(LIGHTING.gateway.softShadows).toBeNull();
    expect(LIGHTING.moon.sunIntensity).toBe(120_000);
    expect(LIGHTING.moon.exposure).toBe(0.38);
    expect(LIGHTING.moon.hemisphere.intensity).toBe(1_450);
    expect(LIGHTING.moon.earthshineDirectional?.intensity).toBe(19_000);
    expect(LIGHTING.moon.fov).toBe(37.85);
  });
});

describe("evidence classes and prediction", () => {
  it("uses the locked gap sentences and does not invent measurements", () => {
    const lunar = scenarioFromMission("lunar-habitat");
    const indexed = assessIndexedMetadata(lunar, VERIFIED_CITATIONS);
    expect(indexed.summary).toBe("An experiment exists but its required measurement is unavailable.");
    expect(VERIFIED_CITATIONS.every((item) => item.measurementsExtracted === false)).toBe(true);
    const empty = classifySyntheticRuns(lunar, []);
    expect(empty.summary).toBe("No matching experiment is represented in the indexed subset.");
    expect(assessVerifiedPrediction(VERIFIED_CITATIONS).message).toMatch(/Insufficient experimental evidence/);
  });

  it("makes the prediction interval wider than the confidence interval", () => {
    const points: RegressionPoint[] = [
      { x: 1, y: 2.2, group: "a" },
      { x: 2, y: 3.6, group: "a" },
      { x: 3, y: 6.1, group: "b" },
      { x: 4, y: 7.4, group: "b" },
      { x: 5, y: 9.2, group: "c" },
    ];
    const fit = fitLine(points);
    expect(fit).not.toBeNull();
    const confidence = meanConfidenceInterval(fit!, points, 3);
    const prediction = observationPredictionInterval(fit!, points, 3);
    expect(prediction.high - prediction.low).toBeGreaterThan(confidence.high - confidence.low);
  });

  it("does not treat a missing measurement as zero", () => {
    const run = {
      fuelCategory: "solid-polymer",
      gravityG: null,
      oxygenConcentrationPct: null,
      pressurePsi: null,
      measurements: [{ type: "flame-spread-rate", value: null, status: "missing" }],
    } as ExperimentalRun;
    const other = { ...run, gravityG: 1, oxygenConcentrationPct: 21, pressurePsi: 14.7 };
    const result = classifySyntheticRuns(scenarioFromMission("lunar-habitat"), [run, other]);
    expect(result.summary).not.toMatch(/NASA has never/);
    expect(result.summary === "An experiment exists but its required measurement is unavailable." || result.summary.includes("partial") || result.summary.includes("not comparable") || result.summary.includes("No matching")).toBe(true);
  });
});

describe("scene triangle budgets", () => {
  it("keeps the new scenes under 50,000 triangles", () => {
    expect(marsTriangleUpperBound()).toBeLessThan(SCENE_TRIANGLE_CAP);
    expect(gatewayTriangleUpperBound()).toBeLessThan(50_000);
  });
});
