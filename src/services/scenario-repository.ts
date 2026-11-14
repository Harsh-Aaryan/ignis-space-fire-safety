import type { SavedScenario } from "@/types/domain";
import type { ScenarioRepository } from "@/services/contracts";

const KEY = "ignis.saved-scenarios.v1";

function read(): SavedScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedScenario);
  } catch {
    return [];
  }
}

function write(items: SavedScenario[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

function isSavedScenario(value: unknown): value is SavedScenario {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedScenario>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.savedAt === "string" &&
    !!item.scenario &&
    typeof item.scenario === "object" &&
    !!item.weights
  );
}

export const scenarioRepository: ScenarioRepository = {
  list: read,
  save(input) {
    const next: SavedScenario = {
      id: `scenario-${Date.now().toString(36)}`,
      name: input.name.trim() || "Untitled scenario",
      savedAt: new Date().toISOString(),
      scenario: input.scenario,
      weights: input.weights,
      notes: input.notes ?? "",
    };
    const items = [next, ...read().filter((item) => item.name !== next.name)];
    write(items);
    return next;
  },
  remove(id) {
    write(read().filter((item) => item.id !== id));
  },
  replaceAll(items) {
    write(items.filter(isSavedScenario));
  },
};

export function exportScenarios(items: SavedScenario[]): string {
  return JSON.stringify(
    {
      format: "ignis-scenarios-v1",
      synthetic: true,
      note: "Synthetic demonstration scenarios. Not NASA data.",
      scenarios: items,
    },
    null,
    2,
  );
}

export function parseScenarios(raw: string): SavedScenario[] {
  const parsed = JSON.parse(raw) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "scenarios" in parsed
      ? (parsed as { scenarios: unknown }).scenarios
      : null;
  if (!Array.isArray(list)) {
    throw new Error("File does not contain IGNIS scenarios.");
  }
  const valid = list.filter(isSavedScenario);
  if (!valid.length) throw new Error("No valid scenarios found in that file.");
  return valid;
}
