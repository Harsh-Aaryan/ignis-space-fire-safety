import { describe, expect, it } from "vitest";
import { FIRE_SOURCES } from "@/data/fire/sources";
import { INVESTIGATIONS, psiUrl } from "@/data/research/investigations";
import { PSI_CORPUS, psiInvestigation, psiLabel } from "./corpus";
import { passageCounts, retrievePassages } from "./retrieve";

describe("NASA PSI corpus", () => {
  it("holds the combustion-science investigations with public record links and pre-split passages", () => {
    expect(PSI_CORPUS.schemaVersion).toBe(1);
    expect(Number.isNaN(Date.parse(PSI_CORPUS.retrievedAt))).toBe(false);
    expect(PSI_CORPUS.source.search).toBe("https://psi.nasa.gov/geode-py/ws/repo/search");
    expect(PSI_CORPUS.investigations.length).toBeGreaterThanOrEqual(20);
    const ids = new Set<string>();
    for (const investigation of PSI_CORPUS.investigations) {
      expect(investigation.accession).toMatch(/^PSI-\d+$/);
      expect(investigation.url).toBe(psiUrl(investigation.accession));
      expect(investigation.title.length).toBeGreaterThan(0);
      expect(investigation.chunks.length).toBeGreaterThan(0);
      for (const chunk of investigation.chunks) {
        expect(chunk.id).toMatch(new RegExp(`^${investigation.accession}#${chunk.field}-\\d+$`));
        expect(ids.has(chunk.id)).toBe(false);
        ids.add(chunk.id);
        expect(chunk.text.split(/\s+/).length).toBeLessThanOrEqual(260);
      }
    }
  });

  it("carries no contact details", () => {
    const raw = JSON.stringify(PSI_CORPUS);
    expect(raw).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(raw).not.toMatch(/"(email|phone|fax|address)"/);
  });

  it("covers the PSI accessions the research index links to", () => {
    for (const accession of new Set(INVESTIGATIONS.flatMap((record) => record.links.psi))) {
      expect(psiInvestigation(accession), accession).not.toBeNull();
    }
    expect(psiLabel({ accession: "PSI-101", acronym: "SAME-R" })).toBe("PSI-101 SAME-R");
    expect(psiLabel({ accession: "PSI-62", acronym: "" })).toBe("PSI-62");
  });
});

describe("passage retrieval", () => {
  it("indexes records, source extracts (not the model assumption) and PSI passages", () => {
    const counts = passageCounts();
    expect(counts.record).toBe(INVESTIGATIONS.length);
    expect(counts.source).toBe(FIRE_SOURCES.length - 1);
    expect(counts.psi).toBe(PSI_CORPUS.investigations.reduce((sum, item) => sum + item.chunks.length, 0));
  });

  it("finds smoke particle-size evidence in SAME across all three kinds", () => {
    const passages = retrievePassages("smoke particle size in microgravity", { k: 8 });
    expect(passages.length).toBe(8);
    expect(passages.slice(0, 4).some((p) => p.citeId === "same-2")).toBe(true);
    expect(passages.some((p) => p.kind === "psi" && ["PSI-101", "PSI-102"].includes(p.citeId))).toBe(true);
    for (const p of passages) {
      expect(p.text.length).toBeGreaterThan(0);
      expect(p.citationLabel.length).toBeGreaterThan(0);
      expect(p.href).toMatch(p.kind === "record" ? /^\/research\// : /^(https:\/\/|\/research\/data)/);
    }
    expect(passages.map((p) => p.score)).toEqual([...passages.map((p) => p.score)].sort((a, b) => b - a));
  });

  it("finds cool-flame droplet investigations in the PSI corpus and limits passages per investigation", () => {
    const passages = retrievePassages("cool flames droplet extinction", { k: 6, kinds: ["psi"], perInvestigation: 1 });
    expect(passages.every((p) => p.kind === "psi")).toBe(true);
    expect(new Set(passages.map((p) => p.citeId)).size).toBe(passages.length);
    expect(passages.map((p) => p.citeId)).toContain("PSI-39");
    expect(passages[0].href).toBe(psiUrl(passages[0].citeId));
  });

  it("matches investigation acronyms, including hyphenated ones", () => {
    expect(retrievePassages("FLEX-2", { k: 1, kinds: ["psi"] })[0].citeId).toBe("PSI-68");
    expect(retrievePassages("SAME-R reflight", { k: 1, kinds: ["psi"] })[0].citeId).toBe("PSI-101");
  });

  it("returns nothing for unrelated questions", () => {
    expect(retrievePassages("quarterly stock dividends", { k: 5 })).toEqual([]);
  });
});
