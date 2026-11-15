import { describe, expect, it } from "vitest";
import { genericFireInput } from "@/lib/fire/scenario";
import { FIRE_SOURCES } from "@/data/fire/sources";
import { INVESTIGATIONS } from "@/data/research/investigations";
import { PSI_CORPUS } from "@/lib/rag/corpus";
import { explainScenario, isRunReference, isScenarioQuestion, SCOPE_REFUSAL, type ScenarioSnapshot } from "./scenario-assistant";
import { captureChatContext } from "./scenario-chat";
import { isResearchQuestion, namedInQuestion, normalizeQuestion, researchBrief } from "./research-assistant";

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

const LUNAR_DETECTION = "Which NASA investigations are most relevant to lunar-habitat fire detection?";

describe("research questions", () => {
  it("answers the lunar-detection question without a scenario, with records, citations and gaps", () => {
    const answer = explainScenario(LUNAR_DETECTION, null, null);
    expect(answer.mode).toBe("research");
    expect(answer.text).not.toBe(SCOPE_REFUSAL);
    expect(answer.text).not.toMatch(/Choose a habitat/);
    // Records come from the research index, each linking to its page with an evidence label and a reason.
    expect(answer.records?.length).toBe(3);
    for (const record of answer.records!) {
      const indexed = INVESTIGATIONS.find((r) => r.id === record.id)!;
      expect(indexed).toBeDefined();
      expect(indexed.topics.some((topic) => topic === "detection" || topic === "smoke")).toBe(true);
      expect(indexed.environments.some((link) => link.id === "lunar-base")).toBe(true);
      expect(record.href).toBe(`/research/${record.id}`);
      expect(record.evidence.length).toBeGreaterThan(0);
      expect(record.why).toMatch(/fire detection/i);
      expect(answer.text).toContain(record.name);
    }
    // Quoted findings and caveats appear verbatim in the cited records.
    const quotes = [...answer.text.matchAll(/“([^”]+)”/g)].map((m) => m[1]);
    expect(quotes.length).toBeGreaterThan(0);
    const recordText = INVESTIGATIONS.flatMap((r) => [...r.findings.map((f) => f.text), ...r.environments.map((l) => l.note)]);
    for (const quote of quotes) expect(recordText).toContain(quote);
    // The untested lunar conditions are stated explicitly.
    expect(answer.gaps?.[0]).toMatch(/^No fire detection test.*at lunar gravity \(0\.165 g\) is indexed\.$/);
    expect(answer.gaps?.some((gap) => /microgravity/i.test(gap))).toBe(true);
    expect(answer.text).toContain("Not yet tested");
    expect(answer.text).toMatch(/None of them was tested at lunar gravity/);
    // Citations: fire-source chips and NASA PSI passages, all from real ids.
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.sources.every((id) => FIRE_SOURCES.some((s) => s.id === id))).toBe(true);
    expect(answer.passages?.length).toBeGreaterThan(0);
    for (const passage of answer.passages!) {
      const accession = passage.id.split("#")[0];
      expect(PSI_CORPUS.investigations.some((inv) => inv.accession === accession && inv.url === passage.href)).toBe(true);
      expect(passage.citationLabel).toMatch(/^PSI-\d+/);
    }
  });

  it("answers research questions the same way while a scenario is open", () => {
    const withRun = explainScenario(LUNAR_DETECTION, input, snapshot);
    expect(withRun.mode).toBe("research");
    expect(withRun.records).toEqual(explainScenario(LUNAR_DETECTION, null, null).records);
    expect(withRun.context).toContain("Model");
  });

  it("states partial-gravity gaps for gap questions and for microgravity topics", () => {
    const mars = explainScenario("Which fire conditions have not been tested at Martian gravity?", null, null);
    expect(mars.gaps?.[0]).toMatch(/^No cabin-scale fire test.*at Martian gravity \(0\.38 g\) is indexed\.$/);
    expect(mars.records?.[0].why).toMatch(/Martian/);
    const smoke = explainScenario("What is known about smoke particle size in microgravity?", null, null);
    expect(smoke.records?.map((r) => r.id)).toEqual(expect.arrayContaining(["same-2", "same"]));
    expect(smoke.gaps).toContain("No smoke-particle measurement at lunar or Martian gravity is indexed.");
    expect(smoke.text).toMatch(/particle sizes/);
  });

  it("recognizes named investigations and quotes PSI objectives for comparisons", () => {
    expect(namedInQuestion("Compare FLEX and FLEX-2").mentions).toEqual(["FLEX", "FLEX-2"]);
    expect(namedInQuestion("Is it the same flame?").records).toEqual([]);
    const compare = explainScenario("Compare FLEX and FLEX-2", null, null);
    expect(compare.records?.[0].id).toBe("flex");
    expect(compare.text).toContain("PSI-68 FLEX-2 states its objective as");
    expect(compare.passages?.map((p) => p.citationLabel)).toEqual(expect.arrayContaining(["PSI-68 FLEX-2", "PSI-69 FLEX"]));
    const sameR = explainScenario("What did SAME-R measure?", null, null);
    expect(sameR.records?.[0].id).toBe("same-2");
    expect(sameR.text).toMatch(/^For SAME-R,/);
  });

  it("points a question about a missing run to setup and offers research help", () => {
    for (const question of ["explain", "Which NASA data supports this?", "What changes if I stop ventilation?", "Why hasn't the smoke detector alarmed?"]) {
      const answer = explainScenario(question, null, null);
      expect(answer.mode, question).toBe("no-run");
      expect(answer.text).toContain("No run is set up yet");
      expect(answer.text).toContain("Choose a habitat");
      expect(answer.text).toMatch(/Research questions work without a run/);
    }
  });

  it("adds scenario-matched records to the run's evidence answer without changing its run text", () => {
    const answer = explainScenario("Which NASA experiment supports this?", input, snapshot);
    expect(answer.mode).toBeUndefined();
    expect(answer.text).toContain(input.material.nasaFinding);
    expect(answer.records?.length).toBeGreaterThan(0);
    expect(answer.sources.every((id) => FIRE_SOURCES.some((s) => s.id === id))).toBe(true);
    // The run is at 0 g, so the run-informed ranking looks at spacecraft records.
    expect(researchBrief("Which NASA experiment supports this?", input, { useScenario: true }).question.environment).toBe("spacecraft");
  });

  it("widens scope for research wording without admitting unrelated questions", () => {
    for (const question of [LUNAR_DETECTION, "Which studies matter for lunar habitats?", "What did SAME-R measure?", "Compare FLEX and FLEX-2", "What data exists for Martian habitat cabins?", "Which experiments tested ignition at reduced pressure?"]) {
      expect(isScenarioQuestion(question), question).toBe(true);
      expect(isResearchQuestion(question), question).toBe(true);
    }
    for (const question of ["Which studies show the stock market falls?", "What research exists on coffee?", "Is this the same as yesterday?", "Recommend a flex workout"]) {
      expect(isScenarioQuestion(question), question).toBe(false);
      expect(explainScenario(question, null, null).text).toBe(SCOPE_REFUSAL);
    }
    expect(isResearchQuestion("Why hasn't the smoke detector alarmed?")).toBe(false);
    expect(isResearchQuestion("Which parts are assumptions?")).toBe(false);
    expect(isRunReference("Which investigations matter most for lunar habitat fire detection?")).toBe(false);
    expect(isRunReference("Which NASA experiment supports this?")).toBe(true);
  });

  it.each([
    ["Is it safe to use PMMA in a lunar habitat?", /^No PMMA \(acrylic\) test at lunar gravity \(0\.165 g\) is indexed\.$/],
    ["Can Kapton burn on Mars?", /^No Kapton test at Martian gravity \(0\.38 g\) is indexed\.$/],
    ["Will a candle burn in a Mars habitat?", /^No candle test at Martian gravity \(0\.38 g\) is indexed\.$/],
    ["How does fire behave on the Moon?", /^No cabin-scale fire test.*at lunar gravity \(0\.165 g\) is indexed\.$/],
    ["How do you put out a fire in a spacecraft?", /^No suppression test at lunar or Martian gravity is indexed\.$/],
    ["Which materials are riskiest in a lunar rover?", /^NASA-STD-6001B: No partial-gravity acceptance test exists in the standard\.$/],
  ])("answers the natural question %s with records and an untested condition", (question, gap) => {
    expect(isScenarioQuestion(question)).toBe(true);
    const answer = explainScenario(question, null, null);
    expect(answer.mode).toBe("research");
    expect(answer.text).not.toBe(SCOPE_REFUSAL);
    expect(answer.text).not.toMatch(/^Nothing in the IGNIS research index/);
    expect(answer.records?.length).toBe(3);
    expect(answer.records!.every((record) => INVESTIGATIONS.some((r) => r.id === record.id))).toBe(true);
    expect(answer.gaps?.[0]).toMatch(gap);
    // Quotes are verbatim record text.
    const recordText = INVESTIGATIONS.flatMap((r) => [...r.findings.map((f) => f.text), ...r.environments.map((l) => l.note)]);
    for (const [, quote] of answer.text.matchAll(/“([^”]+)”/g)) expect(recordText).toContain(quote);
  });

  it("maps plain wording to the ranking's topics and never rates a material as safe", () => {
    expect(normalizeQuestion("How do you put out a fire?")).toContain("extinguish");
    expect(normalizeQuestion("How do you put a cabin fire out?")).toContain("extinguish");
    expect(normalizeQuestion("How do astronauts fight fires?")).toContain("suppress");
    expect(normalizeQuestion("Can Kapton burn on Mars?")).toContain("flammability");
    expect(researchBrief("How do you put out a fire in a spacecraft?").question.topic).toBe("suppression");
    expect(researchBrief("Which materials are riskiest in a lunar rover?").question.topic).toBe("flammability-limits");
    const safety = explainScenario("Is it safe to use PMMA in a lunar habitat?", null, null);
    expect(safety.text).toContain("IGNIS does not rate materials as safe or risky");
    expect(safety.text).not.toMatch(/\b(?:is|are) safe\b/);
    expect(safety.sources).toContain("nasa-std-6001b");
  });

  it("says which records tested the habitat's gravity, judged by the gravity tested", () => {
    const rover = explainScenario("Which materials are riskiest in a lunar rover?", null, null);
    expect(rover.text).not.toMatch(/None of them was tested at lunar gravity/);
    expect(rover.text).toMatch(/Wire fires in partial gravity.*include tests at lunar gravity/);
  });

  it("keeps material and safety words out of scope without a fire or habitat context", () => {
    for (const question of ["Is cotton safe for babies?", "Is it safe to invest in index funds?", "What is the risk of rain tomorrow?", "Which wires should I buy for my speakers?", "Will this workout burn calories?"]) {
      expect(isScenarioQuestion(question), question).toBe(false);
    }
    expect(isScenarioQuestion("Can cotton burn?")).toBe(true);
  });

  it("routes questions about another habitat or material to research while a run is open", () => {
    // The run is PMMA at 0 g.
    expect(explainScenario("How does fire behave on the Moon?", input, snapshot).mode).toBe("research");
    expect(explainScenario("Can Kapton burn on Mars?", input, snapshot).mode).toBe("research");
    expect(explainScenario("How do you put out a fire?", input, snapshot).sources).toContain("fwm-pfe");
    expect(explainScenario("explain", input, snapshot).text).toContain("91.0 s");
  });

  it("says so when nothing in the index matches instead of listing records for the habitat word", () => {
    const bare = researchBrief("Which experiments studied plasma thrusters?");
    expect(bare.records).toEqual([]);
    expect(bare.passages).toEqual([]);
    expect(bare.text).toMatch(/^Nothing in the IGNIS research index or the NASA PSI combustion records mentions “[^”]*thrusters”/);
    // With a habitat parsed, the habitat's records are given, after saying the subject itself is not covered.
    const habitat = researchBrief("Which experiments studied plasma thrusters for spacecraft?");
    expect(habitat.text).toMatch(/^Nothing in the IGNIS research index or the NASA PSI combustion records mentions “[^”]*thrusters”\. What the index holds for the habitat in general:/);
    expect(habitat.records.length).toBeGreaterThan(0);
    // A known subject still gets records.
    expect(researchBrief("Why does airflow affect a flame?").records.length).toBeGreaterThan(0);
  });
});
