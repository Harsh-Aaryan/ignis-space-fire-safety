import { describe, expect, it } from "vitest";
import { INVESTIGATIONS } from "@/data/research/investigations";
import { retrieveEvidence } from "@/lib/server/ignis-chat";
import { retrievePassages } from "./retrieve";

/** The Saffire IV–VI emission paper (ICES-2026-577) must be reachable for detection-timing questions. */
describe("Saffire IV–VI emission paper retrieval", () => {
  const question = "How long until a smoke detector alarms in Saffire?";

  it("is among the source extracts supplied to Ask IGNIS", () => {
    const sources = retrieveEvidence({ message: question, input: null, snapshot: null, history: [] });
    expect(sources.some((source) => source.id === "saffire-iv-vi-emission")).toBe(true);
  });

  it("ranks in the research passages for a detection-timing question", () => {
    const passages = retrievePassages(question, { k: 8 });
    expect(passages.some((passage) => passage.citeId === "saffire-iv-vi-emission")).toBe(true);
  });

  it("is cited by findings of the records that link it", () => {
    const records = INVESTIGATIONS.filter((record) => record.findings.some((finding) => finding.sourceId === "saffire-iv-vi-emission"));
    expect(records.map((record) => record.id).sort()).toEqual(["saffire-iv-v", "saffire-vi"]);
    for (const record of records) {
      expect(record.links.sources).toContain("saffire-iv-vi-emission");
      expect(record.links.ntrs).toContain("20260001992");
    }
  });
});
