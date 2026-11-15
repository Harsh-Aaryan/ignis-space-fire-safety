import { describe, expect, it } from "vitest";
import { INVESTIGATIONS, MATRIX_TOPICS, coverageCell } from "@/data/research/investigations";
import { controlRecords, coverageMatrix, emptyCells, partialGravityGaps } from "./coverage";

describe("coverageMatrix", () => {
  it("has one row per matrix topic and four gravity columns", () => {
    const matrix = coverageMatrix();
    expect(matrix).toHaveLength(MATRIX_TOPICS.length);
    expect(matrix.every((row) => row.cells.length === 4)).toBe(true);
  });
  it("agrees with coverageCell", () => {
    for (const row of coverageMatrix()) {
      for (const cell of row.cells) expect(cell.records).toEqual(coverageCell(row.topic, cell.gravity));
    }
  });
  it("lists detection and suppression at lunar gravity as empty", () => {
    const empty = emptyCells();
    expect(empty).toContainEqual({ topic: "detection", gravity: "lunar" });
    expect(empty).toContainEqual({ topic: "suppression", gravity: "lunar" });
    expect(empty).toContainEqual({ topic: "suppression", gravity: "mars" });
  });
});

describe("controlRecords", () => {
  it("only returns records with the controls pillar and a group topic", () => {
    for (const group of ["detection", "suppression", "materials"] as const) {
      const records = controlRecords(group);
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((record) => record.pillars.includes("controls"))).toBe(true);
    }
    expect(controlRecords("suppression").map((record) => record.id)).toContain("fine-water-mist");
    expect(controlRecords("materials").map((record) => record.id)).toContain("cabin-atmosphere-limits");
  });
  it("finds the partial-gravity gaps for detection and suppression", () => {
    expect(partialGravityGaps("detection").length).toBeGreaterThan(0);
    expect(partialGravityGaps("suppression")).toEqual(
      expect.arrayContaining([
        { topic: "suppression", gravity: "lunar" },
        { topic: "suppression", gravity: "mars" },
      ]),
    );
    expect(INVESTIGATIONS.length).toBe(19);
  });
});
