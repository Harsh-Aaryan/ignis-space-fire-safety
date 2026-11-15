import { describe, expect, it } from "vitest";
import { Bm25Index, stem, tokenize } from "./bm25";

describe("tokenizer", () => {
  it("matches the Python corpus builder token for token", () => {
    // Reference output of tokenize() in scripts/NASAflamesRAG.py for the same sentence.
    expect(tokenize("Which studies measured smoke detectors, flames and gases in FLEX-2 and SAME-R? Burning wires, O₂ ignition, running processes."))
      .toEqual(["study", "measur", "smok", "detect", "flam", "gas", "flex2", "flex", "2", "samer", "same", "r", "burn", "wire", "o2", "ignit", "runn", "process"]);
    expect(["studies", "studied", "detection", "detectors", "flames", "gases", "boxes", "processes", "running", "stopped", "ignite", "ignition", "measure", "measured", "spill", "suppression", "cool", "droplets"].map(stem))
      .toEqual(["study", "study", "detect", "detect", "flam", "gas", "box", "process", "runn", "stop", "ignit", "ignit", "measur", "measur", "spill", "suppress", "cool", "droplet"]);
  });

  it("drops stopwords unless asked to keep them, and keeps SAME as a word", () => {
    expect(tokenize("What is the smoke in the cabin?")).toEqual(["smok", "cabin"]);
    expect(tokenize("the same", { keepStopwords: true })).toEqual(["the", "same"]);
    expect(tokenize("SAME")).toEqual(["same"]);
  });
});

describe("BM25 ranking", () => {
  const docs = [
    { item: "detection", fields: [{ text: "Smoke detectors respond to particle size; ionization detectors saw every sample.", weight: 1 }] },
    { item: "spread", fields: [{ text: "Flame spread over thin fabric in low-speed concurrent flow.", weight: 1 }] },
    { item: "both", fields: [{ text: "Flame spread produced smoke that reached a detector late.", weight: 1 }] },
    { item: "filler", fields: [{ text: "Cabin pressure and oxygen concentration were held constant.", weight: 1 }] },
  ];

  it("ranks the document that matches the rare query terms first", () => {
    const index = new Bm25Index(docs);
    expect(index.search("smoke detector particle size")[0].item).toBe("detection");
    expect(index.search("flame spread fabric")[0].item).toBe("spread");
    expect(index.search("flame spread fabric").map((hit) => hit.item)).not.toContain("filler");
  });

  it("returns nothing for unmatched or empty queries", () => {
    const index = new Bm25Index(docs);
    expect(index.search("stock market")).toEqual([]);
    expect(index.search("the and of")).toEqual([]);
  });

  it("weights boosted fields and applies document priors and filters", () => {
    const boosted = new Bm25Index([
      { item: "title", fields: [{ text: "SAME-R", weight: 2, keepStopwords: true }, { text: "Smoke aerosol reflight results.", weight: 1 }] },
      { item: "body", fields: [{ text: "Unrelated title", weight: 2 }, { text: "SAME-R smoke aerosol reflight results.", weight: 1 }] },
    ]);
    expect(boosted.search("SAME-R")[0].item).toBe("title");
    expect(boosted.search("SAME-R", 5, (item) => item === "body").map((hit) => hit.item)).toEqual(["body"]);

    const prior = new Bm25Index([
      { item: "list", fields: [{ text: "smoke detector", weight: 1 }], prior: 0.5 },
      { item: "prose", fields: [{ text: "smoke detector", weight: 1 }] },
    ]);
    expect(prior.search("smoke detector").map((hit) => hit.item)).toEqual(["prose", "list"]);
  });

  it("reports which query terms matched", () => {
    const hit = new Bm25Index(docs).search("smoke detector oxygen")[0];
    expect(hit.matched.length).toBeGreaterThan(0);
    expect(hit.matched.every((term) => ["smok", "detect", "oxygen"].includes(term))).toBe(true);
  });
});
