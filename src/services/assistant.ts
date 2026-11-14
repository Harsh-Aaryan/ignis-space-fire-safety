import { investigations, runs } from "@/data/mock";
import type { VerifiedCitation } from "@/data/verified";
import { scenarioFromMission } from "@/data/missions";
import { EMPTY_FILTERS } from "@/lib/evidence/filters";
import { analyzeMission } from "@/lib/evidence/selectors";
import { FUEL_LABEL, OBJECTIVE_LABEL, REGIME_LABEL } from "@/lib/labels";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
import { DEFAULT_WEIGHTS, gravityRegime } from "@/lib/ranking/score";
import type { AssistantReply } from "@/services/contracts";
import type {
  ChartSuggestion,
  ChatTurn,
  ExplorerFilters,
  MissionScenario,
  RankingWeights,
} from "@/types/domain";

function percent(value: number | null): string {
  if (value == null) return "unscored";
  return `${Math.round(value * 100)}`;
}

export function answerQuestion(
  message: string,
  scenario: MissionScenario,
  history: ChatTurn[] = [],
  options?: {
    weights?: RankingWeights;
    filters?: ExplorerFilters;
    includeMissing?: boolean;
    citations?: VerifiedCitation[];
  },
): AssistantReply {
  const analysis = analyzeMission({
    runs,
    investigations,
    scenario,
    weights: options?.weights ?? DEFAULT_WEIGHTS,
    filters: options?.filters ?? EMPTY_FILTERS,
    includeMissing: options?.includeMissing ?? false,
  });
  const text = message.trim().toLowerCase();
  const followUp = /^(tell me more|why|explain|go on|expand)\b/.test(text);
  const prior = followUp
    ? [...history].reverse().find((turn) => turn.role === "user" && turn.id !== "pending")
    : undefined;
  const basis = prior ? `${prior.text} ${message}` : message;
  const intent = detectIntent(basis.toLowerCase());
  const regime = gravityRegime(scenario.gravityG);
  const top = analysis.ranked.slice(0, 3);
  const names = top
    .map(
      (row) =>
        `${row.investigation.family} “${row.investigation.title}” (${row.investigation.id}, relevance ${percent(row.relevance)})`,
    )
    .join("; ");
  const uncertainty = uncertaintyLine(analysis.gaps.length, analysis.coverage.percent, regime);
  let body = "";
  let chart: ChartSuggestion | undefined;
  const ids = top.map((row) => row.investigation.id);

  if (intent === "next") {
    const first = analysis.recommendations[0];
    body = first
      ? `For ${scenario.name} at ${scenario.oxygenPct}% O₂, ${scenario.pressurePsi} psi, ${scenario.gravityG} g, the highest-priority synthetic proposal is “${first.title}” (priority ${Math.round(first.priorityScore * 100)}). ${first.gapExplanation} Related dossiers: ${first.relatedInvestigationIds.join(", ") || "none in range"}.`
      : `No coverage gap cleared the ranking threshold for this scenario, so there is no new proposal to rank.`;
    chart = {
      kind: "coverage",
      title: "Scenario envelope coverage",
      note: "Coverage is a cell-fill fraction, not a safety probability.",
    };
  } else if (intent === "missing") {
    const focus = /mars|martian/.test(basis.toLowerCase())
      ? analysis.gaps.find((gap) => gap.id.includes("martian") || gap.dimension === "gravity")
      : analysis.gaps[0];
    body = focus
      ? `${focus.explanation} Rule: ${focus.rule} ${focus.distinguishesMissingFromNegative} Catalog coverage for this scenario is ${analysis.coverage.percent.toFixed(0)}%.`
      : "No gap met the severity threshold.";
    chart = {
      kind: "coverage",
      title: "Where the catalog is empty",
      note: "Empty cells are missing representation, not negative results.",
    };
  } else if (intent === "smoke") {
    const smoke = analysis.ranked.filter((row) =>
      row.investigation.researchObjectives.some((objective) =>
        objective === "smoke-detection" || objective === "detector-aerosol",
      ),
    );
    const listed = (smoke.length ? smoke : analysis.ranked).slice(0, 3);
    body = `Smoke and aerosol dossiers for ${scenario.name} (${scenario.oxygenPct}% O₂, ${scenario.airflowMs} m/s): ${listed
      .map((row) => `${row.investigation.family} ${row.investigation.id} at relevance ${percent(row.relevance)}`)
      .join("; ")}. SAME, SAME-R, DAFT, and DAFT-2 are family labels only. Particle diameters and detector responses in those rows are synthetic.`;
    chart = {
      kind: "oxygen-airflow",
      title: "Synthetic aerosol runs by oxygen and airflow",
      note: "Points are demonstration records.",
    };
    ids.splice(0, ids.length, ...listed.map((row) => row.investigation.id));
  } else if (intent === "suppression") {
    const flex = analysis.ranked.filter((row) => row.investigation.family.startsWith("FLEX"));
    body = `Suppression and extinction questions currently surface ${flex.length} FLEX-family dossiers in the filtered ranking. ${flex
      .slice(0, 2)
      .map((row) => `${row.investigation.title} (${percent(row.relevance)})`)
      .join("; ") || "None passed the active filters."} Extinction-limit markers are synthetic indexes, not certified suppressant performance.`;
    ids.splice(0, ids.length, ...flex.slice(0, 3).map((row) => row.investigation.id));
  } else if (intent === "airflow") {
    body = `Airflow for this scenario is ${scenario.airflowMs.toFixed(2)} m/s. Ventilation-linked dossiers in the current ranking: ${names || "none"}. Unreported airflow was not treated as 0 m/s. ${analysis.applicability.gravityMismatch}`;
    chart = {
      kind: "oxygen-airflow",
      title: "Oxygen and airflow of ranked runs",
      note: "Runs with unreported airflow are omitted from the plot.",
    };
  } else if (intent === "match") {
    const nearest = analysis.applicability.nearest[0];
    body = nearest
      ? `The closest synthetic row to ${scenario.oxygenPct}% O₂ / ${scenario.pressurePsi} psi / ${scenario.gravityG} g is ${nearest.run.id} in ${nearest.investigation.family} (distance ${nearest.distance.toFixed(2)}, relevance ${percent(nearest.relevance)}). ${analysis.applicability.gravityMismatch} ${analysis.applicability.outside.join(" ")}`
      : "No row could be distance-ranked. Filters may be hiding the catalog.";
    chart = {
      kind: "relevance",
      title: "Relevance of the current ranking",
      note: "Relevance is not an ignition probability.",
    };
    if (nearest) ids.splice(0, ids.length, nearest.investigation.id, ...ids.filter((id) => id !== nearest.investigation.id));
  } else if (intent === "help") {
    body = `Ask about the active scenario (${scenario.name}, ${OBJECTIVE_LABEL[scenario.objective]}, ${FUEL_LABEL[scenario.fuelCategory]}, ${regime ? REGIME_LABEL[regime] : "custom gravity"}). I can rank dossiers, describe smoke or suppression families, find the closest atmospheres, list gaps, or draft the next study. I only read the synthetic catalog.`;
  } else if (intent === "search") {
    body = names
      ? `I matched “${message.trim()}” against the synthetic dossiers for ${scenario.name}. Top rows: ${names}.`
      : `Nothing in the synthetic catalog matched “${message.trim()}” under the active filters.`;
    chart = {
      kind: "relevance",
      title: "Search ranking",
      note: "Scores use the live scenario and weights.",
    };
  } else {
    const partial = oxygenPartialPressurePsi(scenario.oxygenPct, scenario.pressurePsi);
    body = `Most relevant dossiers for ${scenario.name} at ${scenario.oxygenPct}% oxygen, ${scenario.pressurePsi} psi total cabin pressure, pO₂ ${partial.toFixed(2)} psi, ${scenario.gravityG} g, ${FUEL_LABEL[scenario.fuelCategory]}, objective “${OBJECTIVE_LABEL[scenario.objective]}”: ${names || "none under the current filters"}. ${analysis.coverage.percent.toFixed(0)}% of the scenario envelope has usable synthetic runs.`;
    chart = {
      kind: "relevance",
      title: "Top dossier relevance",
      note: "A relevance score is not a fire-safety probability.",
    };
  }

  if (followUp) {
    body = `${body} Expanding on the previous turn: the ranking uses objective/fuel 30%, oxygen/pressure 25%, gravity/airflow 20%, measurements 15%, and completeness 10%, renormalized when a value is unreported.`;
  }
  if (options?.citations?.length) {
    const cited = options.citations.slice(0, 5);
    body = `${body}

Verified NASA metadata (not measurements): ${cited.map((item) => `${item.indexHint} “${item.title}”`).join("; ")}.
Supporting data: none. No oxygen, pressure, gravity, airflow, or outcome numbers were extracted from these NTRS records.
Comparison: withheld. An abstract is not a dataset, so these records are not plotted against the synthetic runs.
Interpretation: a shared investigation name is topic overlap, not a condition match and not a safety result.
Uncertainty: Insufficient experimental evidence for reliable prediction.
Citations: ${cited.map((item) => item.sourceUrl).join(" ")}
Follow-up: which measurement would need to be extracted before this cabin could be compared with a published run?`;
  }

  return {
    intent,
    text: body,
    investigationIds: [...new Set(ids)].slice(0, 4),
    chartSuggestion: chart,
    uncertainty,
    synthetic: true,
  };
}

function detectIntent(text: string): string {
  if (/next|recommend|investigate next|what should/.test(text)) return "next";
  if (/missing|gap|unknown|martian|mars|don't have|do not have|absent/.test(text)) return "missing";
  if (/smoke|detector|aerosol|same|daft/.test(text)) return "smoke";
  if (/suppress|extinguish|flex|extinction/.test(text)) return "suppression";
  if (/airflow|ventilation|convection|flow/.test(text)) return "airflow";
  if (/match|closest|atmosphere|oxygen|which condition/.test(text)) return "match";
  if (/help|what can you|how do i/.test(text)) return "help";
  if (/relevant|which (experiment|investigation|dossier)|lunar habitat|habitat/.test(text)) {
    return "relevant";
  }
  return text.length > 2 ? "search" : "help";
}

function uncertaintyLine(
  gapCount: number,
  coverage: number,
  regime: ReturnType<typeof gravityRegime>,
): string {
  const gravity =
    regime === "lunar" || regime === "martian"
      ? ` ${regime === "lunar" ? "Lunar" : "Martian"} gravity has no direct rows, so ISS and Earth evidence cannot set that behavior.`
      : "";
  return `Demo AI — this answer uses synthetic records only. ${gapCount} gaps are open and envelope coverage is ${coverage.toFixed(0)}%.${gravity} Relevance is not a safety probability.`;
}

export function scenarioAnswerPreview(mission: Parameters<typeof scenarioFromMission>[0]) {
  return answerQuestion("Which investigations are most relevant?", scenarioFromMission(mission));
}
