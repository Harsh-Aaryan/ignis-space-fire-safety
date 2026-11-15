import { describe, expect, it } from "vitest";
import { investigationById } from "@/data/research/investigations";
import { BRIEF_FORMAT, briefFilename, briefToJson, briefToMarkdown, buildEvidenceBrief } from "./brief";
import { recordsForIds } from "./compare";
import { EMPTY_QUESTION, questionFromText } from "./rank";

const REVIEWER = "Which NASA investigations are most relevant to lunar-habitat fire detection?";
const lunarCabin = { name: "Lunar habitat", conditions: { oxygenPct: 32, pressureKpa: 70.33, flowCmS: 5, gravityG: 0.165 }, specimen: { materialId: "pmma", geometry: "thick" as const } };

function brief() {
  return buildEvidenceBrief({
    question: { ...EMPTY_QUESTION, text: REVIEWER },
    records: recordsForIds(["same-2", "iss-fire-detection-suppression", "partial-gravity-wires"]),
    cabin: lunarCabin,
    generatedAt: "2026-11-15T12:00:00.000Z",
  });
}

describe("buildEvidenceBrief", () => {
  it("records the question and the criteria read from it", () => {
    const b = brief();
    expect(b.format).toBe(BRIEF_FORMAT);
    expect(b.question.text).toBe(REVIEWER);
    expect(b.question.criteria.map((part) => part.value)).toEqual(["Lunar surface habitats", "Fire detection"]);
    expect(b.cabin?.material).toBe("PMMA (acrylic)");
  });

  it("lists the selected investigations with evidence quality and the cabin status", () => {
    const b = brief();
    expect(b.investigations.map((item) => item.id)).toEqual(["same-2", "iss-fire-detection-suppression", "partial-gravity-wires"]);
    expect(b.investigations[0].evidence.label).toBe("Original measurements held");
    expect(b.investigations[0].path).toBe("/research/same-2");
    for (const item of b.investigations) expect(["Matching experimental run", "Within reported ranges", "Insufficient information", "Outside tested conditions"]).toContain(item.cabinMatch?.label);
  });

  it("builds the side-by-side rows with one cell per investigation", () => {
    const b = brief();
    for (const row of b.comparison.rows) expect(row.cells).toHaveLength(3);
    expect(b.comparison.rows.find((row) => row.label === "Oxygen")?.cells[0]).toBe("Not reported");
    expect(b.comparison.rows.find((row) => row.label === "Specimen geometry")?.basis).toBe("derived");
    // Three pairs plus the all-three summary.
    expect(b.comparison.pairs).toHaveLength(4);
  });

  it("only states conclusions that are recorded findings of the selected records, each cited", () => {
    const b = brief();
    const recorded = ["same-2", "iss-fire-detection-suppression", "partial-gravity-wires"].flatMap((id) => investigationById(id)!.findings.map((finding) => finding.text));
    expect(b.conclusions.map((item) => item.text)).toEqual(recorded);
    expect(b.conclusions.every((item) => item.citations.length > 0)).toBe(true);
  });

  it("lists unresolved uncertainties: gaps, untested gravity, missing dimensions, holdings and the cabin", () => {
    const b = brief();
    const texts = b.uncertainties.map((item) => item.text);
    expect(texts).toContain("No indexed test addresses fire detection at lunar gravity (0.165 g).");
    expect(texts).toContain("Not tested at lunar gravity (0.165 g): SAME-2 and ISS fire detection and suppression system.");
    expect(texts).toContain("SAME-2 does not report oxygen or pressure.");
    expect(b.uncertainties.some((item) => item.kind === "holdings")).toBe(true);
    expect(b.uncertainties.some((item) => item.kind === "cabin" && item.recordIds[0] === "same-2")).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("collects NTRS, PSI, DOI and source links without duplicates", () => {
    const b = brief();
    const urls = b.citations.map((item) => item.url);
    expect(urls).toContain("https://ntrs.nasa.gov/citations/20130000422");
    expect(urls).toContain("https://psi.nasa.gov/physci/repo/data/investigations/PSI-101");
    expect(urls).toContain("https://doi.org/10.60555/2np7-jv14");
    expect(new Set(urls).size).toBe(urls.length);
    expect(b.method.some((note) => note.includes("±0.5 percentage points"))).toBe(true);
  });

  it("works with an empty selection", () => {
    const b = buildEvidenceBrief({ question: questionFromText("smoke"), records: [], generatedAt: "2026-11-15T00:00:00.000Z" });
    expect(b.investigations).toEqual([]);
    expect(b.conclusions).toEqual([]);
    expect(briefToMarkdown(b)).toContain("No investigation was selected.");
  });
});

describe("rendering", () => {
  it("writes Markdown with every section and a comparison table", () => {
    const md = briefToMarkdown(brief(), "https://example.org");
    for (const heading of ["# Evidence brief", "## Question", "## Selected investigations", "## Side-by-side comparison", "## Supported conclusions", "## Unresolved uncertainties", "## Citations", "## Method"]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain("| | SAME-2 | ISS fire detection and suppression system | Wire fires in partial gravity |");
    expect(md).toContain("https://example.org/research/same-2");
    expect(md).toMatch(/- SAME-2: .+ Source: \[.+\]\(https:\/\/.+\)\./);
    expect(md).toContain("(derived)");
  });
  it("writes JSON that parses back to the same brief, and dated file names", () => {
    const b = brief();
    expect(JSON.parse(briefToJson(b))).toEqual(b);
    expect(briefFilename(b, "md")).toBe("ignis-evidence-brief-2026-11-15.md");
    expect(briefFilename(b, "json")).toBe("ignis-evidence-brief-2026-11-15.json");
  });
});
