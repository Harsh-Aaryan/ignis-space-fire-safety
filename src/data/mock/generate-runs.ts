import { INVESTIGATION_DRAFTS, investigationFromDraft } from "@/data/mock/catalog";
import { MEASUREMENT_META } from "@/lib/labels";
import type {
  Completeness,
  ExperimentalRun,
  Investigation,
  Measurement,
  MeasurementType,
} from "@/types/domain";
import type { FuelCategory } from "@/types/domain";

interface RunSpec {
  o2: number | null;
  psi: number | null;
  g: number | null;
  air: number | null;
  fuel: FuelCategory;
  material: string;
  geometry: string;
  missing?: MeasurementType[];
  incomplete?: MeasurementType[];
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function syntheticValue(
  type: MeasurementType,
  oxygen: number,
  index: number,
): number {
  const wobble = (index * 17) % 7 - 3;
  switch (type) {
    case "flame-spread-rate":
      return round(0.45 + (oxygen - 21) * 0.16 + wobble * 0.04, 2);
    case "burn-duration":
      return round(11 + (oxygen - 21) * 0.35 + wobble * 0.2, 1);
    case "mass-loss-rate":
      return round(1.1 + (oxygen - 21) * 0.12 + Math.abs(wobble) * 0.03, 2);
    case "soot-volume-fraction":
      return round(0.35 + Math.max(0, 30 - oxygen) * 0.02 + wobble * 0.01, 3);
    case "smoke-particle-diameter":
      return round(0.32 + wobble * 0.015 + (oxygen > 30 ? 0.04 : 0), 3);
    case "smoke-number-density":
      return round(1.1e5 + index * 900 + oxygen * 80, 0);
    case "detector-response":
      return round(0.18 + (oxygen - 21) * 0.015 + (index % 5) * 0.02, 3);
    case "extinction-limit-oxygen":
      return round(13.5 + (index % 5) * 0.35, 2);
    case "flame-standoff":
      return round(1.8 + wobble * 0.08, 2);
    default:
      return 0;
  }
}

function measurementsFor(
  types: MeasurementType[],
  oxygen: number | null,
  index: number,
  spec: RunSpec,
): Measurement[] {
  const basis = oxygen ?? 21;
  return types.map((type) => {
    const unit = MEASUREMENT_META[type].unit;
    if (spec.missing?.includes(type)) {
      return {
        type,
        value: null,
        unit,
        uncertainty: null,
        synthetic: true as const,
        status: "missing" as const,
      };
    }
    const value = syntheticValue(type, basis, index);
    if (spec.incomplete?.includes(type)) {
      return {
        type,
        value,
        unit,
        uncertainty: null,
        synthetic: true as const,
        status: "incomplete" as const,
      };
    }
    return {
      type,
      value,
      unit,
      uncertainty: round(Math.abs(value) * 0.08 || 0.01, 3),
      synthetic: true as const,
      status: "present" as const,
    };
  });
}

export function classifyCompleteness(run: {
  oxygenConcentrationPct: number | null;
  pressurePsi: number | null;
  gravityG: number | null;
  airflowVelocityMs: number | null;
  sampleGeometry: string;
  measurements: Measurement[];
}): { level: Completeness; gaps: string[] } {
  const gaps: string[] = [];
  if (run.oxygenConcentrationPct == null) gaps.push("oxygen unreported");
  if (run.pressurePsi == null) gaps.push("pressure unreported");
  if (run.gravityG == null) gaps.push("gravity unreported");
  if (run.airflowVelocityMs == null) gaps.push("airflow unreported");
  if (!run.sampleGeometry) gaps.push("geometry unreported");
  for (const measurement of run.measurements) {
    if (measurement.status === "missing") {
      gaps.push(`${measurement.type} explicitly missing`);
    } else if (
      measurement.status === "incomplete" ||
      measurement.uncertainty == null
    ) {
      gaps.push(`${measurement.type} uncertainty incomplete`);
    }
  }
  const level: Completeness =
    gaps.length === 0 ? "complete" : gaps.length === 1 ? "partial" : "sparse";
  return { level, gaps };
}

const PLANS: Record<string, RunSpec[]> = {
  "syn-inv-bass-01": [
    { o2: 30, psi: 10.2, g: 0, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 34, psi: 10.2, g: 0, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 21, psi: 14.7, g: 0, air: 0, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 24, psi: 14.7, g: 1, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 27, psi: 8.3, g: 0, air: 0.15, fuel: "solid-fabric", material: "cotton fabric", geometry: "strip 100×20 mm" },
    { o2: 34, psi: 14.7, g: 1, air: 0.3, fuel: "solid-polymer", material: "PMMA", geometry: "rod 3 mm" },
    { o2: 38, psi: 10.2, g: 1, air: 0.5, fuel: "solid-fabric", material: "meta-aramid fabric", geometry: "strip 100×20 mm" },
    { o2: 30, psi: 10.2, g: 0, air: null, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
  ],
  "syn-inv-bass-02": [
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 24, psi: 10.2, g: 0, air: 0.05, fuel: "solid-polymer", material: "UHMWPE", geometry: "flat coupon 50 mm" },
    { o2: 30, psi: 10.2, g: 1, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 34, psi: 10.2, g: 0, air: null, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 38, psi: 14.7, g: 1, air: 0.3, fuel: "solid-polymer", material: "UHMWPE", geometry: "rod 3 mm" },
    { o2: null, psi: 8.3, g: 0, air: 0, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
  ],
  "syn-inv-bass2-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 30, psi: 10.2, g: 0, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "edge-lit coupon" },
    { o2: 34, psi: 14.7, g: 1, air: 0.3, fuel: "solid-polymer", material: "PMMA", geometry: "rod 6 mm" },
    { o2: 24, psi: 10.2, g: 1, air: 0, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 27, psi: 14.7, g: 0, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "rod 3 mm", incomplete: ["flame-standoff"] },
    { o2: 34, psi: 8.3, g: 1, air: 0.5, fuel: "solid-polymer", material: "PMMA", geometry: "edge-lit coupon" },
  ],
  "syn-inv-bass2-02": [
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "solid-fabric", material: "cotton fabric", geometry: "strip 100×20 mm" },
    { o2: 24, psi: 10.2, g: 1, air: 0.05, fuel: "solid-fabric", material: "meta-aramid fabric", geometry: "strip 100×20 mm" },
    { o2: 30, psi: 10.2, g: 0, air: 0.15, fuel: "solid-fabric", material: "cotton fabric", geometry: "strip 100×20 mm" },
    { o2: 34, psi: 8.3, g: 1, air: 0.08, fuel: "solid-fabric", material: "meta-aramid fabric", geometry: "folded strip" },
    { o2: 27, psi: 14.7, g: 0, air: 0, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 38, psi: 14.7, g: 1, air: 0.3, fuel: "solid-fabric", material: "cotton fabric", geometry: "strip 100×20 mm", missing: ["mass-loss-rate"] },
  ],
  "syn-inv-flex-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 24, psi: 14.7, g: 0, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 30, psi: 10.2, g: 1, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 21, psi: 10.2, g: 0, air: 0.15, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 27, psi: 8.3, g: 1, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 34, psi: 14.7, g: 0, air: null, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
  ],
  "syn-inv-flex-02": [
    { o2: 21, psi: 14.7, g: 0, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 21, psi: 10.2, g: 1, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 24, psi: null, g: 0, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 30, psi: 8.3, g: 1, air: 0.15, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
  ],
  "syn-inv-flex2-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 27, psi: 14.7, g: 0, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 30, psi: 10.2, g: 1, air: 0.15, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm", incomplete: ["soot-volume-fraction"] },
    { o2: 34, psi: 14.7, g: 1, air: 0.3, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
  ],
  "syn-inv-flex2-02": [
    { o2: 18, psi: 14.7, g: 0, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 24, psi: 10.2, g: 1, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 30, psi: 14.7, g: 1, air: 0.15, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm", missing: ["extinction-limit-oxygen"] },
  ],
  "syn-inv-acme-bre": [
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 30, psi: 10.2, g: 0, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 34, psi: 14.7, g: 1, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "rod 3 mm" },
    { o2: 24, psi: 8.3, g: 0, air: 0, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 38, psi: 10.2, g: 1, air: 0.3, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
  ],
  "syn-inv-acme-fd": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 30, psi: 14.7, g: 0, air: 0.3, fuel: "solid-polymer", material: "PMMA", geometry: "edge-lit coupon" },
    { o2: 34, psi: 10.2, g: 1, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "rod 3 mm" },
    { o2: 27, psi: 10.2, g: 1, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
  ],
  "syn-inv-acme-cl": [
    { o2: 21, psi: 14.7, g: 0, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 24, psi: 10.2, g: 0, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 30, psi: 14.7, g: 1, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm" },
    { o2: 21, psi: 8.3, g: 1, air: null, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
  ],
  "syn-inv-same-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol" },
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol" },
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "quiescent bolus" },
    { o2: 24, psi: 14.7, g: 1, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol" },
    { o2: 30, psi: 10.2, g: 0, air: 0.3, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 21, psi: 10.2, g: 1, air: 0, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "quiescent bolus" },
  ],
  "syn-inv-same-02": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 21, psi: 14.7, g: 0, air: 0.3, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 24, psi: 14.7, g: 1, air: 0.05, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol" },
    { o2: 30, psi: 10.2, g: 0, air: 0.5, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 21, psi: 8.3, g: 1, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol", missing: ["detector-response"] },
  ],
  "syn-inv-samer-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol" },
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "quiescent bolus" },
    { o2: null, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "well-mixed aerosol" },
    { o2: 24, psi: 10.2, g: 1, air: 0.3, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 27, psi: 14.7, g: 1, air: 0, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "quiescent bolus" },
  ],
  "syn-inv-daft-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "challenge bolus" },
    { o2: 21, psi: 14.7, g: 0, air: 0.05, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "challenge bolus" },
    { o2: 24, psi: 14.7, g: 1, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "challenge bolus" },
    { o2: 30, psi: 10.2, g: 0, air: 0.3, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 21, psi: 10.2, g: 1, air: null, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "challenge bolus" },
  ],
  "syn-inv-daft2-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 21, psi: 14.7, g: 0, air: 0.3, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 21, psi: 14.7, g: 1, air: 0.5, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 30, psi: 10.2, g: 0, air: 0.08, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol" },
    { o2: 34, psi: 8.3, g: 1, air: 0.15, fuel: "aerosol-smoke", material: "synthetic smoke aerosol", geometry: "ducted aerosol", incomplete: ["smoke-particle-diameter"] },
  ],
  "syn-inv-spice-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 30, psi: 14.7, g: 0, air: 0.3, fuel: "solid-polymer", material: "PMMA", geometry: "rod 3 mm" },
    { o2: 34, psi: 10.2, g: 1, air: 0.15, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 24, psi: 10.2, g: 1, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
  ],
  "syn-inv-slice-01": [
    { o2: 21, psi: 14.7, g: 0, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 27, psi: 14.7, g: 0, air: 0.3, fuel: "solid-polymer", material: "PMMA", geometry: "edge-lit coupon" },
    { o2: 34, psi: 10.2, g: 1, air: 0.5, fuel: "solid-polymer", material: "PMMA", geometry: "rod 3 mm" },
    { o2: 30, psi: 8.3, g: 1, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
  ],
  "syn-inv-acme-efield": [
    { o2: 21, psi: 14.7, g: 0, air: 0, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm", incomplete: ["flame-standoff"] },
    { o2: 24, psi: 14.7, g: 0, air: 0.05, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
    { o2: 30, psi: 10.2, g: 1, air: null, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 1.5 mm", missing: ["burn-duration"] },
    { o2: 21, psi: 8.3, g: 1, air: 0.15, fuel: "liquid-droplet", material: "n-heptane droplet", geometry: "droplet 2 mm" },
  ],
  "syn-inv-ground-01": [
    { o2: 21, psi: 14.7, g: 1, air: 0.05, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 30, psi: 14.7, g: 1, air: 0.15, fuel: "solid-polymer", material: "PMMA", geometry: "flat coupon 50 mm" },
    { o2: 34, psi: 10.2, g: 1, air: 0.05, fuel: "solid-composite", material: "fiberglass-epoxy coupon", geometry: "coupon 80 mm" },
    { o2: 24, psi: 14.7, g: 1, air: 0, fuel: "paper-cellulose", material: "cellulose sheet", geometry: "sheet 100 mm" },
    { o2: 38, psi: 14.7, g: 1, air: 0.3, fuel: "solid-composite", material: "fiberglass-epoxy coupon", geometry: "coupon 80 mm", missing: ["burn-duration"] },
  ],
};

function slug(id: string): string {
  return id.replace("syn-inv-", "").replace(/-/g, "").slice(0, 10).toUpperCase();
}

export function buildCatalog(): {
  investigations: Investigation[];
  runs: ExperimentalRun[];
} {
  const runs: ExperimentalRun[] = [];
  const investigations: Investigation[] = INVESTIGATION_DRAFTS.map((draft) => {
    const specs = PLANS[draft.id];
    if (!specs) throw new Error(`Missing run plan for ${draft.id}`);
    specs.forEach((spec, index) => {
      const measurements = measurementsFor(
        draft.measurementTypes,
        spec.o2,
        runs.length + 1,
        spec,
      );
      const partial = {
        oxygenConcentrationPct: spec.o2,
        pressurePsi: spec.psi,
        gravityG: spec.g,
        airflowVelocityMs: spec.air,
        sampleGeometry: spec.geometry,
        measurements,
      };
      const classified = classifyCompleteness(partial);
      const sequence = String(index + 1).padStart(3, "0");
      runs.push({
        id: `SYN-RUN-${slug(draft.id)}-${sequence}`,
        investigationId: draft.id,
        oxygenConcentrationPct: spec.o2,
        pressurePsi: spec.psi,
        gravityG: spec.g,
        airflowVelocityMs: spec.air,
        fuelCategory: spec.fuel,
        fuelMaterial: spec.material,
        sampleGeometry: spec.geometry,
        measurements,
        uncertaintyNote:
          "Uncertainties are generated illustration bands, not instrument calibrations. Every value is synthetic demonstration data.",
        provenance: "synthetic-demonstration",
        evidenceCompleteness: classified.level,
        metadataGaps: classified.gaps,
      });
    });
    const own = runs.filter((run) => run.investigationId === draft.id);
    const gravities = new Set<"microgravity" | "earth">();
    for (const run of own) {
      if (run.gravityG == null) continue;
      gravities.add(run.gravityG < 0.05 ? "microgravity" : "earth");
    }
    return {
      ...investigationFromDraft(draft),
      gravityConditions: [...gravities],
    };
  });
  return { investigations, runs };
}
