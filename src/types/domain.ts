export type MissionId =
  | "lunar-habitat"
  | "mars-habitat"
  | "iss-microgravity"
  | "lunar-rover"
  | "gateway-orbit";

export type DataMode = "synthetic" | "verified" | "combined";

export type GravityRegime =
  | "microgravity"
  | "lunar"
  | "martian"
  | "earth"
  | "partial-other";

export type FuelCategory =
  | "solid-polymer"
  | "solid-fabric"
  | "solid-composite"
  | "liquid-droplet"
  | "aerosol-smoke"
  | "paper-cellulose";

export type ResearchObjective =
  | "solid-material-flammability"
  | "flame-spread"
  | "extinction-suppression"
  | "smoke-detection"
  | "oxygen-enriched-atmospheres"
  | "droplet-combustion"
  | "detector-aerosol"
  | "habitat-fire-safety";

export type MeasurementType =
  | "flame-spread-rate"
  | "burn-duration"
  | "mass-loss-rate"
  | "soot-volume-fraction"
  | "smoke-particle-diameter"
  | "smoke-number-density"
  | "detector-response"
  | "extinction-limit-oxygen"
  | "flame-standoff";

export type Completeness = "complete" | "partial" | "sparse";

export type EquipmentId =
  | "material-storage"
  | "ventilation"
  | "smoke-detection"
  | "airlock-oxygen"
  | "fire-suppression"
  | "laboratory"
  | "living-quarters"
  | "shell";

export type DataOrigin = "synthetic-demonstration";

export interface FuelMaterial {
  id: string;
  name: string;
  category: FuelCategory;
  notes: string;
}

export interface Sensor {
  id: string;
  name: string;
  measures: MeasurementType[];
  synthetic: true;
  note: string;
}

export interface Measurement {
  type: MeasurementType;
  value: number | null;
  unit: string;
  uncertainty: number | null;
  synthetic: true;
  status: "present" | "missing" | "incomplete";
}

export interface EvidenceSource {
  id: string;
  kind: "synthetic-dossier";
  familyLabel: string;
  citation: null;
  doi: null;
  note: string;
}

export interface ResearchFinding {
  id: string;
  investigationId: string;
  statement: string;
  synthetic: true;
  limitations: string;
}

export interface Investigation {
  id: string;
  family: string;
  title: string;
  description: string;
  researchObjectives: ResearchObjective[];
  fuelCategories: FuelCategory[];
  fuelMaterials: string[];
  hardware: string[];
  gravityConditions: Array<"microgravity" | "earth">;
  measurementTypes: MeasurementType[];
  relatedSafetyApplications: string[];
  sourceStatus: "synthetic-dossier";
  dataOrigin: DataOrigin;
  officialNameNote: string;
  equipmentLinks: EquipmentId[];
  findings: ResearchFinding[];
  evidenceSource: EvidenceSource;
}

export interface ExperimentalConditions {
  oxygenConcentrationPct: number | null;
  pressurePsi: number | null;
  gravityG: number | null;
  airflowVelocityMs: number | null;
}

export interface ExperimentalRun {
  id: string;
  investigationId: string;
  oxygenConcentrationPct: number | null;
  pressurePsi: number | null;
  gravityG: number | null;
  airflowVelocityMs: number | null;
  fuelCategory: FuelCategory;
  fuelMaterial: string;
  sampleGeometry: string;
  measurements: Measurement[];
  uncertaintyNote: string;
  provenance: DataOrigin;
  evidenceCompleteness: Completeness;
  metadataGaps: string[];
}

export interface MissionScenario {
  missionId: MissionId;
  name: string;
  oxygenPct: number;
  pressurePsi: number;
  gravityG: number;
  airflowMs: number;
  fuelCategory: FuelCategory;
  objective: ResearchObjective;
}

export interface RankingWeights {
  objectiveFuel: number;
  oxygenPressure: number;
  gravityAirflow: number;
  measurementAvailability: number;
  evidenceCompleteness: number;
}

export type GapDimension =
  | "gravity"
  | "oxygen"
  | "pressure"
  | "fuel"
  | "airflow"
  | "measurement"
  | "metadata";

export interface EvidenceGap {
  id: string;
  title: string;
  dimension: GapDimension;
  severity: number;
  evidenceCount: number;
  explanation: string;
  rule: string;
  distinguishesMissingFromNegative: string;
}

export interface RecommendationFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
  note: string;
}

export interface ResearchRecommendation {
  id: string;
  title: string;
  researchQuestion: string;
  suggestedConditions: string;
  gapExplanation: string;
  relatedInvestigationIds: string[];
  expectedValue: string;
  feasibilityNote: string;
  priorityScore: number;
  factors: RecommendationFactor[];
  limitations: string;
  synthetic: true;
  gapId: string;
}

export interface ExplorerFilters {
  query: string;
  fuelCategories: FuelCategory[];
  gravityRegimes: GravityRegime[];
  oxygenMin: number | null;
  oxygenMax: number | null;
  pressureMin: number | null;
  pressureMax: number | null;
  airflowMin: number | null;
  airflowMax: number | null;
  hardware: string[];
  objectives: ResearchObjective[];
  measurementTypes: MeasurementType[];
  completeness: Completeness[];
  families: string[];
}

export type SortKey = "relevance" | "family" | "runCount" | "completeness";

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  scenario: MissionScenario;
  weights: RankingWeights;
  notes: string;
}

export interface ActivityEvent {
  id: string;
  at: number;
  label: string;
  module:
    | "overview"
    | "firetwin"
    | "research"
    | "gravity-bridge"
    | "firelab"
    | "reports";
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  investigationIds?: string[];
  chartSuggestion?: ChartSuggestion;
  uncertainty?: string;
}

export interface ChartSuggestion {
  kind: "relevance" | "oxygen-airflow" | "coverage";
  title: string;
  note: string;
}
