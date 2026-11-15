import { describe, expect, it } from "vitest";
import { INVESTIGATIONS } from "@/data/research/investigations";
import { RESEARCH_INDEX_COLUMNS, parseScenarioFile, researchIndexCsv, scenariosToJson } from "./export";

describe("researchIndexCsv", () => {
  it("writes a header and one row per record", () => {
    const csv = researchIndexCsv(INVESTIGATIONS);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(RESEARCH_INDEX_COLUMNS.join(","));
    // Summaries contain no line breaks, so each record is one line.
    expect(lines).toHaveLength(INVESTIGATIONS.length + 1);
  });
  it("writes absent ranges as not tabulated and quotes cells with commas", () => {
    const bass = INVESTIGATIONS.find((item) => item.id === "bass")!;
    const csv = researchIndexCsv([bass]);
    expect(csv).toContain("not tabulated");
    expect(csv).toContain('"');
  });
});

describe("scenario files", () => {
  const item = {
    id: "scenario-1",
    name: "Lunar cabin",
    savedAt: "2026-11-14T00:00:00.000Z",
    scenario: { missionId: "lunar-habitat", name: "Lunar", oxygenPct: 32, pressurePsi: 10.2, gravityG: 0.165, airflowMs: 0.05 },
    weights: { objectiveFuel: 1, oxygenPressure: 1, gravityAirflow: 1, measurementAvailability: 1, evidenceCompleteness: 1 },
    notes: "",
  };
  it("round-trips", () => {
    const json = scenariosToJson([item as never]);
    expect(parseScenarioFile(json)).toHaveLength(1);
  });
  it("rejects a file without scenarios", () => {
    expect(() => parseScenarioFile("{}")).toThrow();
    expect(() => parseScenarioFile("[]")).toThrow();
  });
});
