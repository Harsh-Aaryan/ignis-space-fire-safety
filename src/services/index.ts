import { investigations, runs } from "@/data/mock";
import { EMPTY_FILTERS } from "@/lib/evidence/filters";
import { analyzeMission } from "@/lib/evidence/selectors";
import { discoverGaps, buildRecommendations } from "@/lib/analytics/gaps";
import { DEFAULT_WEIGHTS } from "@/lib/ranking/score";
import { answerQuestion } from "@/services/assistant";
import type {
  AnalysisGateway,
  EvidenceRepository,
  ResearchAssistant,
} from "@/services/contracts";
import type { ExplorerFilters, MissionScenario, RankingWeights } from "@/types/domain";

const evidence: EvidenceRepository = {
  source: "mock",
  synthetic: true,
  listInvestigations: () => investigations,
  listRuns: () => runs,
  getInvestigation: (id) => investigations.find((item) => item.id === id) ?? null,
};

const analysis: AnalysisGateway = {
  analyze(scenario, weights = DEFAULT_WEIGHTS, filters = EMPTY_FILTERS, includeMissing = false) {
    return analyzeMission({
      runs: evidence.listRuns(),
      investigations: evidence.listInvestigations(),
      scenario,
      weights,
      filters,
      includeMissing,
    });
  },
  gaps(scenario, sourceRuns = evidence.listRuns()) {
    return discoverGaps(scenario, sourceRuns);
  },
  recommendations(scenario, sourceRuns = evidence.listRuns()) {
    return buildRecommendations(scenario, sourceRuns, evidence.listInvestigations());
  },
};

const assistant: ResearchAssistant = {
  reply(input) {
    return answerQuestion(input.message, input.scenario, input.history);
  },
};

export interface IgnisServices {
  evidence: EvidenceRepository;
  analysis: AnalysisGateway;
  assistant: ResearchAssistant;
}

let current: IgnisServices = { evidence, analysis, assistant };

export function getServices(): IgnisServices {
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
  const provider = process.env.NEXT_PUBLIC_ASSISTANT_PROVIDER ?? "mock";
  if (source !== "mock") {
    throw new Error(
      `Data source "${source}" is not available in Phase 1. Set NEXT_PUBLIC_DATA_SOURCE=mock.`,
    );
  }
  if (provider !== "mock") {
    throw new Error(
      `Assistant provider "${provider}" is not available in Phase 1. Set NEXT_PUBLIC_ASSISTANT_PROVIDER=mock.`,
    );
  }
  return current;
}

export function analyzeScenario(
  scenario: MissionScenario,
  weights?: RankingWeights,
  filters?: ExplorerFilters,
  includeMissing?: boolean,
) {
  return getServices().analysis.analyze(scenario, weights, filters, includeMissing);
}
