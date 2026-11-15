import { describe, expect, it } from "vitest";
import { INVESTIGATIONS, investigationsForEnvironment } from "@/data/research/investigations";
import {
  NO_EXPLORER_STATE,
  NO_FILTERS,
  explorerQuestion,
  explorerStateFromQuery,
  explorerStateFromQuestion,
  explorerStateToQuery,
  filterInvestigations,
  filtersFromQuery,
  filtersToQuery,
  hasExplorerQuery,
} from "./filter";

describe("filterInvestigations", () => {
  it("returns everything with no filters", () => {
    expect(filterInvestigations(INVESTIGATIONS, NO_FILTERS)).toHaveLength(INVESTIGATIONS.length);
  });
  it("filters by crew environment like investigationsForEnvironment", () => {
    const rows = filterInvestigations(INVESTIGATIONS, { ...NO_FILTERS, environment: "lunar-base" });
    expect(rows).toEqual(investigationsForEnvironment("lunar-base"));
  });
  it("combines topic, type and gravity", () => {
    const rows = filterInvestigations(INVESTIGATIONS, { ...NO_FILTERS, topic: "flammability-limits", gravity: "lunar", kind: "flight-experiment" });
    expect(rows.map((row) => row.id)).toEqual(["partial-gravity-wires"]);
  });
  it("matches every search word, case-insensitively", () => {
    expect(filterInvestigations(INVESTIGATIONS, { ...NO_FILTERS, query: "water MIST" }).map((row) => row.id)).toContain("fine-water-mist");
    expect(filterInvestigations(INVESTIGATIONS, { ...NO_FILTERS, query: "PSI-25" }).map((row) => row.id)).toEqual(["bass-ii"]);
    expect(filterInvestigations(INVESTIGATIONS, { ...NO_FILTERS, query: "zzzz" })).toEqual([]);
  });
});

describe("query round trip", () => {
  it("writes and reads the same filters, ignoring unknown values", () => {
    const filters = { environment: "rover", topic: "smoke", kind: "standard", gravity: "mars", query: "acrylic" } as const;
    const query = filtersToQuery(filters);
    expect(filtersFromQuery(new URLSearchParams(query))).toEqual(filters);
    expect(filtersFromQuery(new URLSearchParams("topic=nope&environment=moon"))).toEqual(NO_FILTERS);
    expect(filtersToQuery(NO_FILTERS)).toBe("");
  });
});

describe("explorer state", () => {
  it("round-trips ranking criteria and filters through the URL", () => {
    const state = {
      filters: { environment: "lunar-base", topic: "detection", kind: "flight-experiment", gravity: null, query: "smoke plume" },
      material: "pmma",
      geometry: "thick",
      matchCabin: true,
    } as const;
    const query = explorerStateToQuery(state);
    expect(query).toContain("material=pmma");
    expect(query).toContain("cabin=1");
    expect(explorerStateFromQuery(new URLSearchParams(query))).toEqual(state);
    expect(explorerStateToQuery(NO_EXPLORER_STATE)).toBe("");
  });
  it("ignores unknown materials and geometries", () => {
    expect(explorerStateFromQuery(new URLSearchParams("material=unobtainium&geometry=cube&cabin=yes"))).toEqual(NO_EXPLORER_STATE);
  });
  it("detects whether a URL carries explorer parameters", () => {
    expect(hasExplorerQuery(new URLSearchParams(""))).toBe(false);
    expect(hasExplorerQuery(new URLSearchParams("q=lunar"))).toBe(true);
    expect(hasExplorerQuery(new URLSearchParams("view=tables"))).toBe(false);
  });
  it("builds the question and back, using the cabin only when asked", () => {
    const cabin = { oxygenPct: 32, pressureKpa: 70.3, flowCmS: 5, gravityG: 0.165 };
    const state = { ...NO_EXPLORER_STATE, filters: { ...NO_FILTERS, environment: "rover" as const, query: "battery" }, material: "battery" };
    const question = explorerQuestion(state, cabin);
    expect(question).toEqual({ text: "battery", environment: "rover", topic: null, materials: ["battery"], geometry: null, cabin: null });
    expect(explorerQuestion({ ...state, matchCabin: true }, cabin).cabin).toEqual(cabin);
    expect(explorerStateFromQuestion(question)).toEqual(state);
  });
});
