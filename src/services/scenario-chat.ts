import type { ScenarioInput, ScenarioSnapshot } from "./scenario-assistant";

export const MAX_QUESTION_LENGTH = 1000;
export const MAX_HISTORY = 4;
export const SNAPSHOT_FIELDS = ["t", "smokeMgM3", "detectorSmokeMgM3", "transportS", "firstAlarmTime", "chemicalHrrW", "sourceHeatW", "surfaceTempC", "localO2Pct"] as const;
export const OPTIONAL_SNAPSHOT_FIELDS = ["peakHrrW", "ignitionTime", "extinctionTime", "uForcedMs", "coPpm", "co2TotalMmHg"] as const;

/** Only small, numeric scenario data crosses the API boundary. No client-supplied sources or prompts. */
export function captureChatContext(input: ScenarioInput | null, state: ScenarioSnapshot | null) {
  return {
    scenario: input ? {
      materialId: input.material.id,
      gravityG: input.gravityG,
      oxygenPct: input.oxygenPct,
      pressureKpa: input.pressureKpa,
      ventilationMs: input.ventilationMs,
      fuel: { ...input.fuel },
    } : null,
    snapshot: input && state ? {
      ...Object.fromEntries([...SNAPSHOT_FIELDS, ...OPTIONAL_SNAPSHOT_FIELDS]
        .filter(key => state[key] !== undefined).map(key => [key, state[key]])),
      ...(state.phase !== undefined ? { phase: state.phase } : {}),
    } : null,
  };
}
