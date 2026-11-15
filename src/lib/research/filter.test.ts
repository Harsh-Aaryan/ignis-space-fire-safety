import { describe, expect, it } from "vitest";
import { INVESTIGATIONS, investigationsForEnvironment } from "@/data/research/investigations";
import { NO_FILTERS, filterInvestigations, filtersFromQuery, filtersToQuery } from "./filter";

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
