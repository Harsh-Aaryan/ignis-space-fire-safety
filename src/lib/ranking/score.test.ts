import { describe, expect, it } from "vitest";
import { investigations, runs } from "@/data/mock";
import { LUNAR_DEFAULT, scenarioFromMission } from "@/data/missions";
import { EMPTY_FILTERS, filterRuns } from "@/lib/evidence/filters";
import {
  DEFAULT_WEIGHTS,
  scoreRun,
  type FactorScore,
} from "@/lib/ranking/score";
import type {
  ExperimentalRun,
  Investigation,
  RankingWeights,
} from "@/types/domain";

function factor(result: { factors: FactorScore[] }, key: FactorScore["key"]) {
  const found = result.factors.find((item) => item.key === key);
  if (!found) throw new Error(`missing factor ${key}`);
  return found;
}

function zeroFilled(factors: FactorScore[], weights: RankingWeights): number {
  const total = (Object.values(weights) as number[]).reduce((sum, value) => sum + value, 0);
  return (
    factors.reduce((sum, item) => sum + (item.score ?? 0) * weights[item.key], 0) / total
  );
}

const investigation = investigations[0];

function baseRun(overrides: Partial<ExperimentalRun> = {}): ExperimentalRun {
  return {
    id: "SYN-RUN-TEST-001",
    investigationId: investigation.id,
    oxygenConcentrationPct: 32,
    pressurePsi: 10.2,
    gravityG: 0.165,
    airflowVelocityMs: 0.05,
    fuelCategory: "solid-polymer",
    fuelMaterial: "PMMA",
    sampleGeometry: "flat coupon 50 mm",
    measurements: [
      {
        type: "flame-spread-rate",
        value: 2.2,
        unit: "mm/s",
        uncertainty: 0.1,
        synthetic: true,
        status: "present",
      },
      {
        type: "mass-loss-rate",
        value: 2.4,
        unit: "mg/s",
        uncertainty: 0.1,
        synthetic: true,
        status: "present",
      },
      {
        type: "burn-duration",
        value: 15,
        unit: "s",
        uncertainty: 0.4,
        synthetic: true,
        status: "present",
      },
    ],
    uncertaintyNote: "synthetic",
    provenance: "synthetic-demonstration",
    evidenceCompleteness: "complete",
    metadataGaps: [],
    ...overrides,
  };
}

describe("relevance scoring", () => {
  it("scores a matching lunar run highly without calling it a safety probability", () => {
    const result = scoreRun(baseRun(), investigation, LUNAR_DEFAULT);
    expect(result.relevance).not.toBeNull();
    expect(result.relevance!).toBeGreaterThan(0.85);
    expect(result.limitations.join(" ")).toMatch(/not a fire, ignition, or safety probability/i);
  });

  it("excludes unreported oxygen instead of treating it as 0%", () => {
    const result = scoreRun(
      baseRun({ oxygenConcentrationPct: null, metadataGaps: ["oxygen unreported"] }),
      investigation,
      LUNAR_DEFAULT,
    );
    const oxygen = factor(result, "oxygenPressure");
    expect(oxygen.excluded).toBe(false);
    expect(oxygen.score).toBeGreaterThan(0.9);
    expect(oxygen.notes.join(" ")).toMatch(/not scored as 0%/);
  });

  it("drops the oxygen/pressure factor when both values are unreported", () => {
    const result = scoreRun(
      baseRun({
        oxygenConcentrationPct: null,
        pressurePsi: null,
        evidenceCompleteness: "sparse",
        metadataGaps: ["oxygen unreported", "pressure unreported"],
      }),
      investigation,
      LUNAR_DEFAULT,
    );
    const oxygen = factor(result, "oxygenPressure");
    expect(oxygen.excluded).toBe(true);
    expect(oxygen.score).toBeNull();
    expect(result.relevance).not.toBeNull();
    expect(result.relevance!).toBeGreaterThan(zeroFilled(result.factors, DEFAULT_WEIGHTS));
  });

  it("lets a single weight dominate after renormalization", () => {
    const weights: RankingWeights = {
      objectiveFuel: 0,
      oxygenPressure: 0,
      gravityAirflow: 1,
      measurementAvailability: 0,
      evidenceCompleteness: 0,
    };
    const result = scoreRun(
      baseRun({ gravityG: 0, airflowVelocityMs: null }),
      investigation,
      LUNAR_DEFAULT,
      weights,
    );
    const gravity = factor(result, "gravityAirflow");
    expect(result.relevance).toBeCloseTo(gravity.score ?? -1, 5);
    expect(gravity.score).toBeLessThan(0.6);
  });

  it("does not treat an explicitly missing measurement as a zero result", () => {
    const result = scoreRun(
      baseRun({
        measurements: [
          {
            type: "flame-spread-rate",
            value: null,
            unit: "mm/s",
            uncertainty: null,
            synthetic: true,
            status: "missing",
          },
          {
            type: "mass-loss-rate",
            value: 2,
            unit: "mg/s",
            uncertainty: 0.1,
            synthetic: true,
            status: "present",
          },
          {
            type: "burn-duration",
            value: 12,
            unit: "s",
            uncertainty: 0.2,
            synthetic: true,
            status: "present",
          },
        ],
      }),
      investigation,
      LUNAR_DEFAULT,
    );
    const notes = factor(result, "measurementAvailability").notes.join(" ");
    expect(notes).toMatch(/explicitly missing/);
    expect(notes).toMatch(/not a negative experimental result/);
  });
});

describe("catalog integrity", () => {
  it("ships 20 dossiers and 80 to 120 fictional runs with no DOIs", () => {
    expect(investigations).toHaveLength(20);
    expect(runs.length).toBeGreaterThanOrEqual(80);
    expect(runs.length).toBeLessThanOrEqual(120);
    for (const item of investigations) {
      expect(item.evidenceSource.doi).toBeNull();
      expect(item.evidenceSource.citation).toBeNull();
      expect(item.dataOrigin).toBe("synthetic-demonstration");
    }
    for (const run of runs) {
      expect(run.id.startsWith("SYN-RUN-")).toBe(true);
      expect(run.provenance).toBe("synthetic-demonstration");
      expect(run.gravityG === 0 || run.gravityG === 1 || run.gravityG == null).toBe(true);
    }
  });

  it("withholds unreported oxygen from a range filter instead of treating it as zero", () => {
    const result = filterRuns(
      runs,
      investigations,
      { ...EMPTY_FILTERS, oxygenMin: 20, oxygenMax: 40 },
      false,
    );
    expect(result.withheldForMissing).toBeGreaterThan(0);
    expect(result.runs.every((run) => run.oxygenConcentrationPct != null)).toBe(true);
  });
});

void (0 as unknown as Investigation);
