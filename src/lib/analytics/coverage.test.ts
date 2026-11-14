import { describe, expect, it } from "vitest";
import { investigations, runs } from "@/data/mock";
import { scenarioFromMission } from "@/data/missions";
import { buildHeatmap, computeCoverage, highlightCell } from "@/lib/analytics/coverage";
import { buildRecommendations, discoverGaps } from "@/lib/analytics/gaps";
import { gravityRegime } from "@/lib/ranking/score";
import { answerQuestion } from "@/services/assistant";

describe("coverage", () => {
  it("gives lunar gravity a zero contribution and changes when oxygen leaves the catalog", () => {
    const lunar = scenarioFromMission("lunar-habitat");
    const report = computeCoverage(lunar, runs);
    const gravity = report.contributions.find((item) => item.axis.startsWith("Gravity"));
    expect(gravity?.score).toBe(0);
    expect(report.notASafetyProbability).toBe(true);
    expect(report.formula).toMatch(/not a fire-safety probability/i);
    const far = computeCoverage({ ...lunar, oxygenPct: 45 }, runs);
    expect(report.percent).toBeGreaterThan(far.percent);
    const iss = computeCoverage(scenarioFromMission("iss-microgravity"), runs);
    expect(iss.percent).toBeGreaterThan(report.percent);
  });

  it("builds heatmap counts from runs and keeps unreported values out of the zero bin", () => {
    const heatmap = buildHeatmap(runs, "oxygen", "gravity");
    const counted = heatmap.cells.reduce((sum, cell) => sum + cell.count, 0);
    expect(counted + heatmap.unreported).toBe(runs.length);
    const lunar = heatmap.cells.filter((cell) => cell.y === "lunar");
    expect(lunar.every((cell) => cell.count === 0)).toBe(true);
    expect(heatmap.unreported).toBeGreaterThan(0);
    const lunarScenario = scenarioFromMission("lunar-habitat");
    const cell = highlightCell(lunarScenario, "oxygen", "gravity");
    expect(cell).toEqual({ x: "o2-32", y: "lunar" });
  });
});

describe("gaps and recommendations", () => {
  it("finds an empty lunar gravity cell and does not call it a negative result", () => {
    const lunar = scenarioFromMission("lunar-habitat");
    const gaps = discoverGaps(lunar, runs);
    const gravity = gaps.find((gap) => gap.dimension === "gravity");
    expect(gravity).toBeTruthy();
    expect(gravity?.evidenceCount).toBe(0);
    expect(gravity?.distinguishesMissingFromNegative.toLowerCase()).toMatch(/not mean|missing coverage|was not represented/);
    expect(runs.some((run) => gravityRegime(run.gravityG) === "lunar")).toBe(false);
    expect(runs.some((run) => gravityRegime(run.gravityG) === "martian")).toBe(false);
  });

  it("ranks a lunar solid-material study first and keeps the heuristic deterministic", () => {
    const lunar = scenarioFromMission("lunar-habitat");
    const first = buildRecommendations(lunar, runs, investigations);
    const second = buildRecommendations(lunar, runs, investigations);
    expect(first[0]?.title).toBe(
      "Oxygen-Enriched Solid-Material Flammability Under Lunar Gravity",
    );
    expect(first.map((item) => item.priorityScore)).toEqual(
      [...first.map((item) => item.priorityScore)].sort((a, b) => b - a),
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    for (const item of first) {
      const weight = item.factors.reduce((sum, factor) => sum + factor.weight, 0);
      expect(weight).toBeCloseTo(1, 5);
      expect(item.synthetic).toBe(true);
      expect(item.limitations).toMatch(/not a safety ranking/i);
    }
  });

  it("opens a Martian gravity gap for the Mars habitat scenario", () => {
    const mars = scenarioFromMission("mars-habitat");
    const gaps = discoverGaps(mars, runs);
    expect(gaps.some((gap) => gap.id === "gap-gravity-martian" && gap.evidenceCount === 0)).toBe(
      true,
    );
    const recommendations = buildRecommendations(mars, runs, investigations, gaps);
    expect(recommendations[0]?.title).toMatch(/Martian/);
  });
});

describe("mock assistant", () => {
  it("grounds lunar and Martian answers in the active scenario", () => {
    const lunar = answerQuestion(
      "Which investigations are most relevant to this lunar habitat?",
      scenarioFromMission("lunar-habitat"),
    );
    const mars = answerQuestion(
      "What evidence is missing for Martian gravity?",
      scenarioFromMission("mars-habitat"),
    );
    expect(lunar.text).toMatch(/32/);
    expect(lunar.text).toMatch(/BASS/);
    expect(lunar.uncertainty).toMatch(/synthetic/i);
    expect(mars.text).toMatch(/0\.38|Martian|partial-gravity|No /);
    expect(lunar.text).not.toBe(mars.text);
    expect(lunar.investigationIds.length).toBeGreaterThan(0);
  });

  it("does not repeat one canned reply for the prompt set", () => {
    const scenario = scenarioFromMission("iss-microgravity");
    const prompts = [
      "Which investigations are relevant to this habitat?",
      "What research relates to smoke detection?",
      "Which conditions best match our atmosphere?",
      "What should researchers investigate next?",
    ];
    const replies = prompts.map((prompt) => answerQuestion(prompt, scenario).text);
    expect(new Set(replies).size).toBe(prompts.length);
    expect(replies[1]).toMatch(/SAME|DAFT/);
  });
});
