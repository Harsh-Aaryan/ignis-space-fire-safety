import { describe, expect, it } from "vitest";
import { INVESTIGATIONS, investigationById } from "@/data/research/investigations";
import {
  MAX_COMPARE,
  citeFinding,
  compareColumn,
  compareRecords,
  comparability,
  idsFromParam,
  idsToParam,
  matchingRunPairs,
  overlap,
  recordCitations,
  recordLimitations,
  recordsForIds,
} from "./compare";

const get = (id: string) => investigationById(id)!;

describe("ids in the URL", () => {
  it("keeps known, distinct ids, at most three, in order", () => {
    expect(idsFromParam("saffire-vi,bass-ii,nope,saffire-vi,flex,same-2")).toEqual(["saffire-vi", "bass-ii", "flex"]);
    expect(idsFromParam(null)).toEqual([]);
    expect(idsFromParam(" , ")).toEqual([]);
    expect(idsToParam(["a", "b"])).toBe("a,b");
    expect(recordsForIds(["flex", "nope"]).map((record) => record.id)).toEqual(["flex"]);
    expect(MAX_COMPARE).toBe(3);
  });
});

describe("overlap", () => {
  it("gives the shared interval when ranges overlap", () => {
    const result = overlap([get("saffire-vi"), get("bass-ii")], "oxygen");
    expect(result).toEqual({ status: "overlap", interval: [22, 22.2], text: "Both include 22–22.2% O₂." });
  });
  it("says no overlap when ranges are disjoint", () => {
    const result = overlap([get("saffire-vi"), get("same-2")], "airflow");
    expect(result.status).toBe("no-overlap");
    expect(result.text).toBe("No overlap: Saffire VI 20 cm/s; SAME-2 0–8.1 cm/s.");
  });
  it("names the records that do not report a condition", () => {
    const result = overlap([get("saffire-vi"), get("bass-ii")], "pressure");
    expect(result).toEqual({ status: "not-reported", missing: ["BASS-II"], text: "Not reported for BASS-II." });
  });
});

describe("comparability", () => {
  it("finds Saffire VI and Saffire I–III directly comparable, naming the condition only one reports", () => {
    const result = comparability([get("saffire-vi"), get("saffire-i-iii")]);
    expect(result.verdict).toBe("comparable");
    expect(result.gravity.shared).toEqual(["0g"]);
    expect(result.materials.shared).toEqual(["PMMA (acrylic)", "SIBAL (cotton–fiberglass fabric)"]);
    expect(result.geometry.shared).toEqual(["thin", "thick"]);
    expect(result.summary).toBe(
      "Directly comparable on microgravity, oxygen 22–22.1% O₂ and airflow 20 cm/s; both tested PMMA (acrylic) and SIBAL (cotton–fiberglass fabric), with thin and thick specimens. Pressure not reported for Saffire I–III.",
    );
    expect(result.runPairs.length).toBeGreaterThan(0);
    expect(result.runPairs[0].a.id).toBe("saffire-vi-paper:IV-1");
    expect(result.runPairs[0].sameMaterial).toBe(true);
    expect(result.runPairs[0].agree).toEqual(["oxygen", "airflow"]);
  });

  it("calls records at different gravity not comparable", () => {
    const result = comparability([get("saffire-vi"), get("wstf-flammability-limits")]);
    expect(result.verdict).toBe("not-comparable");
    expect(result.summary).toBe("Not comparable: different gravity.");
    expect(result.gravity.text).toBe("Different gravity: Saffire VI microgravity; White Sands flammability limits Earth gravity (1 g).");
  });

  it("calls records at the same gravity without overlapping conditions not directly comparable", () => {
    const result = comparability([get("saffire-vi"), get("same-2")]);
    expect(result.verdict).toBe("not-comparable");
    expect(result.summary).toBe("Not directly comparable: same gravity (microgravity), but no overlapping airflow range.");
  });

  it("never treats a standard as an experimental result", () => {
    const result = comparability([get("saffire-vi"), get("nasa-std-6001")]);
    expect(result.verdict).toBe("not-comparable");
    expect(result.summary).toContain("NASA-STD-6001B is a standard");
  });

  it("reports a direct comparison only when material, gravity and every condition line up", () => {
    const a = { ...get("saffire-vi"), id: "a", name: "A" };
    const b = { ...get("saffire-vi"), id: "b", name: "B", conditions: { ...get("saffire-vi").conditions, oxygenPct: [25, 35] as [number, number] } };
    const result = comparability([a, b]);
    expect(result.verdict).toBe("comparable");
    expect(result.summary).toBe(
      "Directly comparable on microgravity, oxygen 25–31% O₂, pressure 54.1–100 kPa and airflow 20 cm/s; both tested PMMA (acrylic) and SIBAL (cotton–fiberglass fabric), with thin and thick specimens.",
    );
  });

  it("reaches a direct comparison for some indexed pairs, and only with shared gravity, material, geometry and overlap", () => {
    const pairs: ReturnType<typeof comparability>[] = [];
    for (let i = 0; i < INVESTIGATIONS.length; i++) for (let j = i + 1; j < INVESTIGATIONS.length; j++) pairs.push(comparability([INVESTIGATIONS[i], INVESTIGATIONS[j]]));
    const direct = pairs.filter((pair) => pair.verdict === "comparable");
    expect(direct.length).toBeGreaterThan(0);
    for (const pair of direct) {
      expect(pair.gravity.shared.length).toBeGreaterThan(0);
      expect(pair.materials.shared.length).toBeGreaterThan(0);
      expect(pair.geometry.shared.length).toBeGreaterThan(0);
      expect([pair.oxygen, pair.pressure, pair.airflow].some((result) => result.status === "overlap")).toBe(true);
      expect([pair.oxygen, pair.pressure, pair.airflow].every((result) => result.status !== "no-overlap")).toBe(true);
    }
    expect(direct.map((pair) => pair.recordIds.join("+"))).toContain("saffire-vi+bass-ii");
  });

  it("names the specific gap when the pair is comparable only in part", () => {
    const smoke = comparability([get("same-2"), get("same")]);
    expect(smoke.verdict).toBe("partial");
    expect(smoke.summary).toBe(
      "Comparable in part on microgravity and airflow 5–8.1 cm/s; both tested Kapton (polyimide), Teflon (PTFE), Silicone and Cellulose (paper, wick); specimen geometry not stated for either; oxygen and pressure not reported for either.",
    );
    const fuels = comparability([get("flex"), get("bass-ii")]);
    expect(fuels.verdict).toBe("partial");
    expect(fuels.summary).toContain("no shared material");
    expect(fuels.summary).toContain("no shared specimen geometry");
  });

  it("groups conditions that the same records leave out", () => {
    const result = comparability([get("partial-gravity-wires"), get("lunar-martian-flammability")]);
    expect(result.verdict).toBe("partial");
    expect(result.summary).toContain("oxygen not reported for either");
    expect(result.summary).toContain("pressure and airflow not reported for Flammability at lunar and Martian gravity");
  });
});

describe("matchingRunPairs", () => {
  it("returns nothing when one record holds no runs or runs share fewer than two conditions", () => {
    expect(matchingRunPairs(get("saffire-vi"), get("same-2"))).toEqual([]);
    // BASS-II runs report oxygen only.
    expect(matchingRunPairs(get("saffire-vi"), get("bass-ii"))).toEqual([]);
  });
  it("skips FLEX runs diluted with CO₂ or helium", () => {
    for (const pair of matchingRunPairs(get("flex"), get("saffire-vi"), 50)) {
      expect(pair.a.diluents?.co2 ?? 0).toBe(0);
      expect(pair.a.diluents?.he ?? 0).toBe(0);
    }
  });
});

describe("columns", () => {
  it("lays out one record with labelled limitations and cited findings", () => {
    const column = compareColumn(get("bass-ii"));
    expect(column.oxygen).toBe("13.6–22.2% O₂");
    expect(column.pressure).toBe("Not reported");
    expect(column.runs).toBe("129 tabulated runs: oxygen in all, pressure in none, airflow in none.");
    expect(column.evidence.grade).toBe("measured-table");
    expect(column.findings).toHaveLength(get("bass-ii").findings.length);
    expect(column.findings.every((finding) => finding.citations.length > 0)).toBe(true);
    expect(column.limitations).toContainEqual({ basis: "derived", text: "Not tested at lunar or Martian gravity." });
    expect(column.limitations).toContainEqual({ basis: "derived", text: "Pressure not reported in the index." });
    expect(column.limitations.some((item) => item.basis === "index" && item.text.startsWith("Lunar surface habitats, Martian surface habitats and Pressurized rovers:"))).toBe(true);
  });
  it("labels summary-only and citation-only holdings", () => {
    expect(recordLimitations(get("saffire-vi")).map((item) => item.text)).toContain("IGNIS holds published summary values only, not the original data files.");
    expect(recordLimitations(get("saffire-models")).map((item) => item.text)).toContain("IGNIS holds a citation record only; no values.");
    expect(recordLimitations(get("partial-gravity-wires")).map((item) => item.text)).not.toContain("Not tested at lunar or Martian gravity.");
  });
  it("cites each finding: the document it was read from, or the record's own sources", () => {
    const saffire = get("saffire-vi");
    const direct = citeFinding(saffire, saffire.findings[0]);
    expect(direct.direct).toBe(true);
    expect(direct.citations[0].url).toBe("https://ntrs.nasa.gov/citations/20240002981");
    const program = get("saffire-i-iii");
    const indirect = citeFinding(program, program.findings[0]);
    expect(indirect.direct).toBe(false);
    expect(indirect.citations.map((item) => item.url)).toContain("https://ntrs.nasa.gov/citations/20170000230");
    expect(recordCitations(get("bass-ii")).map((item) => item.kind)).toEqual(expect.arrayContaining(["ntrs", "psi", "doi", "source"]));
  });
});

describe("compareRecords", () => {
  it("builds one column per record, one entry per pair and an all-three summary", () => {
    const result = compareRecords(recordsForIds(["saffire-vi", "saffire-i-iii", "bass-ii"]));
    expect(result.columns).toHaveLength(3);
    expect(result.pairs).toHaveLength(3);
    expect(result.all?.verdict).toBe("comparable");
    expect(result.all?.summary).toContain("all tested PMMA (acrylic) and SIBAL (cotton–fiberglass fabric)");
    expect(compareRecords(recordsForIds(["saffire-vi", "bass-ii"])).all).toBeNull();
    expect(compareRecords(INVESTIGATIONS).columns).toHaveLength(3);
  });
});
