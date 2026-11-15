import { describe, expect, it } from "vitest";
import { INVESTIGATIONS } from "@/data/research/investigations";
import {
  EMPTY_QUESTION,
  RANK_POINTS,
  describeQuestion,
  evidenceQuality,
  freeTerms,
  isEmptyQuestion,
  questionFromText,
  questionGaps,
  rankInvestigations,
  resolveQuestion,
  type ResearchQuestion,
} from "./rank";

const REVIEWER = "Which NASA investigations are most relevant to lunar-habitat fire detection?";
const ids = (rows: ReturnType<typeof rankInvestigations>) => rows.map((row) => row.record.id);

describe("questionFromText", () => {
  it("reads the reviewer's question as lunar habitats and fire detection", () => {
    const q = questionFromText(REVIEWER);
    expect(q.environment).toBe("lunar-base");
    expect(q.topic).toBe("detection");
    expect(q.materials).toEqual([]);
    expect(q.cabin).toBeNull();
  });
  it("reads materials and specimen shape", () => {
    const q = questionFromText("Does a PMMA slab or Kapton wire burn at low flow?");
    expect(q.materials).toEqual(expect.arrayContaining(["pmma", "kapton", "wire"]));
    expect(q.geometry).toBe("thick");
  });
  it("reads growth and spread as flame spread only in a fire or material context", () => {
    expect(questionFromText("growing plants safely").topic).toBeNull();
    expect(questionFromText("How fast does a fire grow in a lunar habitat?").topic).toBe("flame-spread");
    expect(questionFromText("spread rate over PMMA").topic).toBe("flame-spread");
    expect(questionFromText("how does a rumour spread").topic).toBeNull();
  });
  it("reads every environment a question names, and gravity levels as environments", () => {
    const both = questionFromText("Moon and Mars habitats");
    expect(both.environment).toBe("lunar-base");
    expect(both.environments).toEqual(["lunar-base", "mars-base"]);
    expect(questionFromText("partial gravity flame spread").environments).toEqual(["lunar-base", "mars-base"]);
    expect(questionFromText("flames at 0.38 g").environment).toBe("mars-base");
    expect(questionFromText("smoke at 0.16 g").environment).toBe("lunar-base");
    expect(questionFromText("smoke at 0.165 g").environment).toBe("lunar-base");
    expect(questionFromText("Martian gravity detection").environment).toBe("mars-base");
    // A single environment keeps the original shape.
    expect(questionFromText("lunar detection").environments).toBeUndefined();
  });
  it("prefers a rover over the body it drives on", () => {
    expect(questionFromText("pressurized rover on the Moon").environment).toBe("rover");
    expect(questionFromText("Martian habitat smoke").environment).toBe("mars-base");
    expect(questionFromText("ISS suppression").environment).toBe("station");
  });
});

describe("resolveQuestion and describeQuestion", () => {
  it("keeps explicit choices and fills the rest from the text", () => {
    const q = resolveQuestion({ ...EMPTY_QUESTION, text: "lunar smoke detection with PMMA", environment: "mars-base", materials: ["sibal"] });
    expect(q.environment).toBe("mars-base");
    expect(q.topic).toBe("detection");
    expect(q.materials).toEqual(["sibal", "pmma"]);
  });
  it("says where each criterion came from", () => {
    const parts = describeQuestion({ ...EMPTY_QUESTION, text: "fire detection", environment: "lunar-base" });
    expect(parts).toContainEqual(expect.objectContaining({ factor: "environment", source: "selected", value: "Lunar surface habitats" }));
    expect(parts).toContainEqual(expect.objectContaining({ factor: "topic", source: "question", value: "Fire detection" }));
  });
  it("leaves only unused, meaningful words for text matching", () => {
    const q = questionFromText(REVIEWER);
    expect(freeTerms(q)).toEqual([]);
    expect(freeTerms(questionFromText("ventilation shutdown on the ISS"))).toEqual(["ventilation", "shutdown"]);
    expect(freeTerms(questionFromText("Compare and show what did ventilation do between tests versus others"))).toEqual(["ventilation", "others"]);
  });
  it("keeps proper nouns capitalized inside reasons", () => {
    const rows = rankInvestigations({ ...EMPTY_QUESTION, environment: "mars-base" });
    const details = rows.flatMap((row) => row.reasons.map((reason) => reason.detail));
    expect(details.some((detail) => detail.includes("Martian surface habitats"))).toBe(true);
    expect(details.some((detail) => detail.includes("martian"))).toBe(false);
    const lunar = rankInvestigations({ ...EMPTY_QUESTION, environment: "lunar-base" })[0].reasons[0].detail;
    expect(lunar.startsWith("Tested for lunar surface habitats:")).toBe(true);
  });
});

describe("rankInvestigations", () => {
  it("keeps index order, with no reasons, when nothing is asked", () => {
    expect(isEmptyQuestion(EMPTY_QUESTION)).toBe(true);
    const rows = rankInvestigations(EMPTY_QUESTION);
    expect(ids(rows)).toEqual(INVESTIGATIONS.map((record) => record.id));
    expect(rows.every((row) => row.relevance === 0 && row.reasons.length === 0)).toBe(true);
    expect(rows.map((row) => row.position)).toEqual(INVESTIGATIONS.map((_, i) => i + 1));
  });

  it("sums itemized reasons into relevance, penalties included", () => {
    const rows = rankInvestigations(questionFromText(REVIEWER));
    for (const row of rows) expect(row.relevance).toBe(row.reasons.reduce((sum, reason) => sum + reason.points, 0));
    const negative = rows.flatMap((row) => row.reasons).filter((reason) => reason.points < 0);
    expect(negative.some((reason) => reason.factor === "topic" && reason.detail === "Does not address fire detection.")).toBe(true);
    expect(negative.some((reason) => reason.factor === "gravity" && reason.detail.startsWith("No test at lunar gravity"))).toBe(true);
  });

  it("ranks detection and lunar-gravity records first for the reviewer's question, with reasons", () => {
    const rows = rankInvestigations(questionFromText(REVIEWER));
    const related = rows.filter((row) => row.related);
    // Every related record addresses detection or was tested at lunar gravity / applies there.
    for (const row of related) {
      const detection = row.record.topics.includes("detection");
      const lunar = row.record.gravity.includes("lunar");
      expect(detection || lunar, row.record.id).toBe(true);
    }
    // The first records address detection and say how they bear on lunar habitats.
    const top = rows.slice(0, 5);
    for (const row of top) {
      expect(row.record.topics, row.record.id).toContain("detection");
      expect(row.reasons.some((reason) => reason.factor === "topic" && reason.points === RANK_POINTS.topic.match)).toBe(true);
      expect(row.reasons.some((reason) => reason.factor === "environment")).toBe(true);
    }
    expect(ids(top)).toEqual(expect.arrayContaining(["same-2", "iss-fire-detection-suppression", "saffire-vi"]));
    // The partial-gravity records come next, above everything that addresses neither.
    const wires = ids(rows).indexOf("partial-gravity-wires");
    const lunarFlammability = ids(rows).indexOf("lunar-martian-flammability");
    const neither = rows.findIndex((row) => !row.record.topics.includes("detection") && !row.record.gravity.includes("lunar"));
    expect(wires).toBeLessThan(neither);
    expect(lunarFlammability).toBeLessThan(neither);
    expect(rows[wires].reasons.map((reason) => reason.factor)).toEqual(expect.arrayContaining(["environment", "gravity", "topic"]));
    // The gap is stated, not hidden.
    expect(questionGaps(questionFromText(REVIEWER))).toEqual(["No indexed test addresses fire detection at lunar gravity (0.165 g)."]);
  });

  it("separates the detection records by relevance, not by evidence, for the reviewer's question", () => {
    const rows = rankInvestigations(questionFromText(REVIEWER));
    const top = rows.slice(0, 3);
    expect(top[0].relevance).toBeGreaterThan(top[1].relevance);
    expect(top[1].relevance).toBeGreaterThan(top[2].relevance);
    expect(top[2].relevance).toBeGreaterThan(rows[3].relevance);
    expect(ids(top)).toContain("iss-fire-detection-suppression");
    const iss = rows.find((row) => row.record.id === "iss-fire-detection-suppression")!;
    expect(iss.reasons).toContainEqual(expect.objectContaining({ factor: "environment", points: RANK_POINTS.environment.noteOnTopic }));
    expect(iss.reasons).toContainEqual(expect.objectContaining({ factor: "topic", points: RANK_POINTS.topic.primary }));
    // Evidence quality is still not a reason; it only orders equal relevance.
    expect(iss.reasons.some((reason) => /evidence/i.test(reason.detail))).toBe(false);
  });

  it("ranks for several environments at once, averaging the environment points", () => {
    const rows = rankInvestigations(questionFromText("Moon and Mars habitats"));
    expect(ids(rows).slice(0, 2)).toEqual(["partial-gravity-wires", "lunar-martian-flammability"]);
    const first = rows[0].reasons.find((reason) => reason.factor === "environment")!;
    expect(first.points).toBe(RANK_POINTS.environment.tested);
    expect(first.detail).toBe("Tested for lunar surface habitats; tested for Martian surface habitats. Points are the average over the 2 environments asked about.");
    expect(describeQuestion(questionFromText("Moon and Mars habitats")).map((part) => part.value)).toEqual(["Lunar surface habitats", "Martian surface habitats"]);
    expect(questionGaps(questionFromText("partial gravity fire detection"))).toEqual([
      "No indexed test addresses fire detection at lunar gravity (0.165 g) or Martian gravity (0.38 g).",
    ]);
  });

  it("gives no cabin points when a cabin value is not a number", () => {
    const rows = rankInvestigations({ ...EMPTY_QUESTION, cabin: { oxygenPct: Number.NaN, pressureKpa: 55, flowCmS: 20, gravityG: 0 } });
    const saffire = rows.find((row) => row.record.id === "saffire-vi")!;
    expect(saffire.relevance).toBe(0);
    expect(saffire.reasons[0].detail).toMatch(/^Insufficient information for your cabin\. Cabin oxygen not set to a number/);
  });

  it("reorders for the lunar environment alone: tested there, then applies, then transferable", () => {
    const rows = rankInvestigations({ ...EMPTY_QUESTION, environment: "lunar-base" });
    expect(ids(rows).slice(0, 2)).toEqual(["partial-gravity-wires", "lunar-martian-flammability"]);
    expect(rows[2].record.id).toBe("cabin-atmosphere-limits");
    const basis = rows.map((row) => row.record.environments.find((link) => link.id === "lunar-base")?.basis);
    const firstTransferable = basis.indexOf("transferable");
    expect(basis.slice(0, firstTransferable).every((item) => item === "tested" || item === "applies")).toBe(true);
    expect(basis.slice(firstTransferable).every((item) => item === "transferable" || item === undefined)).toBe(true);
    expect(rows[0].record.id).not.toBe("saffire-vi");
    expect(ids(rows)).not.toEqual(INVESTIGATIONS.map((record) => record.id));
  });

  it("orders ties by evidence quality, then by index order", () => {
    const rows = rankInvestigations({ ...EMPTY_QUESTION, environment: "lunar-base" });
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = [rows[i - 1], rows[i]];
      if (a.relevance !== b.relevance) continue;
      expect(a.evidence.strength).toBeGreaterThanOrEqual(b.evidence.strength);
      if (a.evidence.strength === b.evidence.strength) {
        expect(INVESTIGATIONS.indexOf(a.record)).toBeLessThan(INVESTIGATIONS.indexOf(b.record));
      }
    }
    // Same input, same output.
    expect(ids(rankInvestigations({ ...EMPTY_QUESTION, environment: "lunar-base" }))).toEqual(ids(rows));
  });

  it("credits tested materials and penalizes records that tested something else", () => {
    const rows = rankInvestigations({ ...EMPTY_QUESTION, materials: ["pmma"] });
    const saffire = rows.find((row) => row.record.id === "saffire-vi")!;
    expect(saffire.reasons).toContainEqual(expect.objectContaining({ factor: "material", points: RANK_POINTS.material.tested }));
    expect(saffire.reasons[0].detail).toContain("Cast acrylic (PMMA) slabs");
    const same = rows.find((row) => row.record.id === "same")!;
    expect(same.reasons).toContainEqual(expect.objectContaining({ factor: "material", points: RANK_POINTS.material.notTested }));
    // A record with no itemized materials gets neither.
    const generic = rows.find((row) => row.record.id === "nasa-std-6001")!;
    expect(generic.reasons.filter((reason) => reason.factor === "material")).toEqual([]);
  });

  it("credits matching specimen geometry", () => {
    const rows = rankInvestigations({ ...EMPTY_QUESTION, geometry: "wire" });
    expect(rows[0].record.id).toBe("partial-gravity-wires");
    expect(rows[0].reasons[0]).toEqual({ factor: "geometry", points: RANK_POINTS.geometry.match, detail: "Includes wire specimens." });
  });

  it("ranks a record with a matching run first when the cabin is part of the question", () => {
    const q: ResearchQuestion = { ...EMPTY_QUESTION, cabin: { oxygenPct: 30.2, pressureKpa: 55, flowCmS: 20, gravityG: 0 } };
    const rows = rankInvestigations(q);
    expect(rows[0].record.id).toBe("saffire-vi");
    expect(rows[0].reasons[0].factor).toBe("conditions");
    expect(rows[0].reasons[0].detail).toMatch(/^Matching experimental run for your cabin\. Test VI-3/);
    // Standards are requirements, not tests: no cabin reason.
    expect(rows.find((row) => row.record.id === "nasa-std-6001")!.reasons).toEqual([]);
  });

  it("groups records at or below zero as less related without dropping any", () => {
    const rows = rankInvestigations(questionFromText(REVIEWER));
    expect(rows).toHaveLength(INVESTIGATIONS.length);
    const firstLess = rows.findIndex((row) => !row.related);
    expect(firstLess).toBeGreaterThan(0);
    expect(rows.slice(firstLess).every((row) => row.relevance <= 0)).toBe(true);
  });

  it("ranks a subset when given one", () => {
    const subset = INVESTIGATIONS.filter((record) => record.kind === "standard");
    expect(rankInvestigations({ ...EMPTY_QUESTION, topic: "atmosphere-limits" }, subset)[0].record.id).toBe("cabin-atmosphere-limits");
  });
});

describe("evidenceQuality", () => {
  it("is separate from relevance and grades what IGNIS holds", () => {
    const grade = (id: string) => evidenceQuality(INVESTIGATIONS.find((record) => record.id === id)!);
    expect(grade("same-2")).toMatchObject({ grade: "measured-table", label: "Original measurements held", strength: 4 });
    expect(grade("saffire-vi")).toMatchObject({ grade: "flight-summary", strength: 3 });
    expect(grade("saffire-vi").basis.join(" ")).toContain("4 tabulated runs");
    expect(grade("lunar-martian-flammability")).toMatchObject({ grade: "ground-summary", label: "Published summary" });
    expect(grade("saffire-models")).toMatchObject({ grade: "citation-only", label: "Citation only", strength: 1 });
    expect(grade("nasa-std-6001")).toMatchObject({ grade: "standard" });
    // Evidence never enters relevance.
    for (const row of rankInvestigations(questionFromText(REVIEWER))) {
      expect(row.reasons.every((reason) => ["environment", "gravity", "topic", "material", "geometry", "conditions", "text"].includes(reason.factor))).toBe(true);
    }
  });
});

describe("questionGaps", () => {
  it("lists the empty partial-gravity cells for an environment", () => {
    const [gap] = questionGaps({ ...EMPTY_QUESTION, environment: "lunar-base" });
    expect(gap).toMatch(/^At lunar gravity \(0\.165 g\), no indexed test addresses: /);
    expect(gap).toContain("fire detection");
  });
  it("checks both partial-gravity regimes for a topic with no environment", () => {
    expect(questionGaps({ ...EMPTY_QUESTION, topic: "suppression" })).toEqual([
      "No indexed test addresses suppression and response at lunar gravity (0.165 g) or Martian gravity (0.38 g).",
    ]);
    expect(questionGaps({ ...EMPTY_QUESTION, topic: "flammability-limits", environment: "lunar-base" })).toEqual([]);
  });
});
