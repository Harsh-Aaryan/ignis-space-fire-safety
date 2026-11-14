import { FUELS, SENSORS } from "@/data/mock/catalog";
import { buildCatalog } from "@/data/mock/generate-runs";

const catalog = buildCatalog();

export const investigations = catalog.investigations;
export const runs = catalog.runs;
export const fuels = FUELS;
export const sensors = SENSORS;

export function getInvestigation(id: string) {
  return investigations.find((item) => item.id === id) ?? null;
}

export function runsFor(investigationId: string) {
  return runs.filter((run) => run.investigationId === investigationId);
}
