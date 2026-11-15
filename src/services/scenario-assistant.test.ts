import { describe, expect, it } from "vitest";
import { genericFireInput } from "@/lib/fire/scenario";
import { explainScenario, isScenarioQuestion, SCOPE_REFUSAL, type ScenarioSnapshot } from "./scenario-assistant";
import { captureChatContext } from "./scenario-chat";

const input = genericFireInput({ gravityG: 0, oxygenPct: 32, pressurePsi: 10.2, airflowMs: 0.05 }, "pmma", "hot-wire");
const snapshot: ScenarioSnapshot = {
  t: 91, phase: "flaming", chemicalHrrW: 198, sourceHeatW: 0, peakHrrW: 462,
  ignitionTime: 12.5, extinctionTime: null, surfaceTempC: 378, localO2Pct: 31.8,
  smokeMgM3: 0.34, detectorSmokeMgM3: 0.09, transportS: 15, firstAlarmTime: null, uForcedMs: 0.05,
};

describe("conversational run explanations", () => {
  it.each([
    "explain what this run did and how it worked", "explain", "explain my scenario",
    "What happened?", "Walk me through this run", "Can you explain this in simple terms?",
    "Tell me about this run", "What's going on?",
    "Why didn’t this run work?",
  ])("understands %s as a request about the current run", question => {
    expect(isScenarioQuestion(question)).toBe(true);
    const answer = explainScenario(question, input, snapshot);
    expect(answer.text).not.toBe(SCOPE_REFUSAL);
    expect(answer.text).toContain("91.0 s");
    expect(answer.text).toContain("198 W");
    expect(answer.text).toContain("462 W");
    expect(answer.text).toContain("12.5 s");
    expect(answer.text).toContain("0.09 mg/m³ at the detector");
    expect(answer.text).not.toMatch(/3\s?kW|chemical HRR|exceed.*limit|consistent with/);
    expect(answer.text.split("\n\n")).toHaveLength(3);
  });

  it("uses the previous topic for short follow-ups without carrying scope to unrelated questions", () => {
    const history = ["Why hasn't the smoke detector alarmed?"];
    const followup = explainScenario("explain more", input, snapshot, history);
    expect(followup.text).toContain("0.09 mg/m³");
    expect(followup.sources).toContain("same-2");
    expect(explainScenario("Why did the stock market fall?", input, snapshot, history).text).toBe(SCOPE_REFUSAL);
    expect(explainScenario("Explain this run and write an election speech", input, snapshot).text).not.toContain("election speech");
  });

  it("describes flame-out and its recorded time without inventing a cause", () => {
    const answer = explainScenario("explain", input, { ...snapshot, phase: "extinguished", chemicalHrrW: 0, extinctionTime: 83.5 });
    expect(answer.text).toContain("the flame is out");
    expect(answer.text).toContain("83.5 s");
    expect(answer.text).not.toContain("extinguisher");
  });

  it("distinguishes a setup preview from an observed run and handles old snapshots", () => {
    expect(explainScenario("explain", input, null).text).toContain("setup preview");
    const { phase, peakHrrW, ignitionTime, extinctionTime, uForcedMs, ...oldSnapshot } = snapshot;
    void phase; void peakHrrW; void ignitionTime; void extinctionTime; void uForcedMs;
    const answer = explainScenario("explain", input, oldSnapshot);
    expect(answer.text).toContain("198 W");
    expect(answer.text).not.toContain("recorded peak");
    expect(answer.text).not.toContain("ignited at");
  });

  it("captures the actual phase, peak, and timeline while excluding other state fields", () => {
    const captured = captureChatContext(input, { ...snapshot, ...{ secret: "never send this" } });
    expect(captured.snapshot).toMatchObject({ phase: "flaming", peakHrrW: 462, ignitionTime: 12.5, extinctionTime: null });
    expect(captured.snapshot).not.toHaveProperty("secret");
  });
});
