import {
  CREW_ENVIRONMENTS,
  GRAVITY_REGIMES,
  HOLDING_LABEL,
  KIND_LABEL,
  PILLARS,
  TOPICS,
  type CrewEnvironment,
  type InvestigationRecord,
} from "@/data/research/investigations";
import type { SavedScenario } from "@/types/domain";

/** CSV and JSON helpers for the research index and saved cabin scenarios. */

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function range(value: [number, number] | undefined): string {
  if (!value) return "not tabulated";
  return value[0] === value[1] ? String(value[0]) : `${value[0]}–${value[1]}`;
}

const ENVIRONMENT_ORDER = Object.keys(CREW_ENVIRONMENTS) as CrewEnvironment[];

export const RESEARCH_INDEX_COLUMNS = [
  "id",
  "name",
  "title",
  "record_type",
  "organization",
  "platform",
  "period",
  "challenge_questions",
  "topics",
  "gravity_tested",
  "oxygen_pct",
  "pressure_kpa",
  "flow_cm_s",
  "fuels",
  ...ENVIRONMENT_ORDER.map((id) => `environment_${id.replace("-", "_")}`),
  "holdings",
  "psi",
  "ntrs",
  "doi",
  "summary",
] as const;

export function researchIndexCsv(records: InvestigationRecord[]): string {
  const rows = records.map((record) => {
    const environments = ENVIRONMENT_ORDER.map((id) => record.environments.find((link) => link.id === id)?.basis ?? "not addressed");
    return [
      record.id,
      record.name,
      record.title,
      KIND_LABEL[record.kind],
      record.organization,
      record.platform,
      record.period,
      record.pillars.map((pillar) => PILLARS[pillar].label).join("; "),
      record.topics.map((topic) => TOPICS[topic].label).join("; "),
      record.gravity.map((gravity) => GRAVITY_REGIMES[gravity].label).join("; "),
      range(record.conditions.oxygenPct),
      range(record.conditions.pressureKpa),
      range(record.conditions.flowCmS),
      record.conditions.fuels.join("; "),
      ...environments,
      record.holdings.map((holding) => `${HOLDING_LABEL[holding.kind]}: ${holding.label}`).join("; "),
      record.links.psi.join("; "),
      record.links.ntrs.join("; "),
      record.links.doi ?? "",
      record.summary,
    ];
  });
  return [RESEARCH_INDEX_COLUMNS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export const SCENARIO_FILE_FORMAT = "ignis-scenarios-v1";

export function scenariosToJson(items: SavedScenario[]): string {
  return JSON.stringify({ format: SCENARIO_FILE_FORMAT, scenarios: items }, null, 2);
}

function isSavedScenario(value: unknown): value is SavedScenario {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedScenario>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.savedAt === "string" &&
    !!item.scenario &&
    typeof item.scenario === "object"
  );
}

/** Reads a scenario file written by IGNIS, either the wrapped format or a bare array. */
export function parseScenarioFile(raw: string): SavedScenario[] {
  const parsed = JSON.parse(raw) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "scenarios" in parsed
      ? (parsed as { scenarios: unknown }).scenarios
      : null;
  if (!Array.isArray(list)) throw new Error("This file does not contain IGNIS scenarios.");
  const valid = list.filter(isSavedScenario);
  if (!valid.length) throw new Error("No valid scenarios were found in this file.");
  return valid;
}

/** Starts a browser download of text content. */
export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
