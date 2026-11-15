import type { MissionScenario, SavedScenario } from "@/types/domain";

/** Cabin scenarios the user saved, kept in this browser's local storage. */

const KEY = "ignis.saved-scenarios.v1";

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

export const scenarioRepository = {
  list: read,
  save(input: { name: string; scenario: MissionScenario; notes?: string }): SavedScenario {
    const next: SavedScenario = {
      id: `scenario-${Date.now().toString(36)}`,
      name: input.name.trim() || "Untitled scenario",
      savedAt: new Date().toISOString(),
      scenario: input.scenario,
      notes: input.notes ?? "",
    };
    write([next, ...read().filter((item) => item.name !== next.name)]);
    return next;
  },
  remove(id: string) {
    write(read().filter((item) => item.id !== id));
  },
  replaceAll(items: SavedScenario[]) {
    write(items.filter(isSavedScenario));
  },
};
