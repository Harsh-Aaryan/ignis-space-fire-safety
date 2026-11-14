import type {
  ChartSuggestion,
  ChatTurn,
  EvidenceGap,
  ExperimentalRun,
  ExplorerFilters,
  Investigation,
  MissionScenario,
  RankingWeights,
  ResearchRecommendation,
  SavedScenario,
} from "@/types/domain";
import type { MissionAnalysis } from "@/lib/evidence/selectors";

export type { ChartSuggestion, ChatTurn };

export interface AssistantReply {
  intent: string;
  text: string;
  investigationIds: string[];
  chartSuggestion?: ChartSuggestion;
  uncertainty: string;
  synthetic: true;
}

export interface EvidenceRepository {
  readonly source: "mock";
  readonly synthetic: true;
  listInvestigations(): Investigation[];
  listRuns(): ExperimentalRun[];
  getInvestigation(id: string): Investigation | null;
}

/** Phase 2 replacement. The UI should depend on EvidenceRepository, not on JSON imports. */
export interface EvidenceRepositoryAsync {
  listInvestigations(): Promise<Investigation[]>;
  listRuns(): Promise<ExperimentalRun[]>;
  getInvestigation(id: string): Promise<Investigation | null>;
}

export interface ResearchAssistant {
  reply(input: {
    message: string;
    scenario: MissionScenario;
    history: ChatTurn[];
  }): AssistantReply;
}

/** Phase 2: implement with a hosted model and retrieval. Do not call it from Phase 1. */
export interface LlmResearchAssistant extends ResearchAssistant {
  readonly provider: string;
}

export interface ScenarioRepository {
  list(): SavedScenario[];
  save(input: {
    name: string;
    scenario: MissionScenario;
    weights: RankingWeights;
    notes?: string;
  }): SavedScenario;
  remove(id: string): void;
  replaceAll(items: SavedScenario[]): void;
}

export interface AnalysisGateway {
  analyze(
    scenario: MissionScenario,
    weights?: RankingWeights,
    filters?: ExplorerFilters,
    includeMissing?: boolean,
  ): MissionAnalysis;
  recommendations(
    scenario: MissionScenario,
    runs?: ExperimentalRun[],
  ): ResearchRecommendation[];
  gaps(scenario: MissionScenario, runs?: ExperimentalRun[]): EvidenceGap[];
}
