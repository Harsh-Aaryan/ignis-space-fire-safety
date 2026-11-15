import type { FireInput, FireState } from "@/lib/fire/model";
import { applicability, FIRE_MODEL_VERSION, MODEL_ASSUMPTIONS } from "@/lib/fire/evidence";
export type ScenarioInput = Pick<FireInput, "gravityG" | "oxygenPct" | "pressureKpa" | "ventilationMs" | "material" | "fuel">;
export type ScenarioSnapshot = Pick<FireState, "t" | "smokeMgM3" | "detectorSmokeMgM3" | "transportS" | "firstAlarmTime" | "chemicalHrrW" | "sourceHeatW" | "surfaceTempC" | "localO2Pct">
  & Partial<Pick<FireState, "phase" | "peakHrrW" | "ignitionTime" | "extinctionTime" | "uForcedMs" | "coPpm" | "co2TotalMmHg">>;
export const SCENARIO_PHASES = ["heating", "smoldering", "pyrolysis", "flaming", "extinguished", "burned-out", "no-ignition"] as const;
export interface ScenarioAnswer { text: string; sources: string[]; context: string; compareVentilation?: boolean; provider?: "local" | "groq"; notice?: string; }
export const SCOPE_REFUSAL = "I can help with your fire run and the research behind it. Try asking what happened, why the flame changed, or how smoke reaches a detector.";
const SUMMARY_WORDS = new Set("a about actually after again all an and are at break breakdown brief briefly burn burned burning by can change changed continue could current describe detail details did didnt do does doesnt down end ended entire exactly explain explained explanation fire flame give go going happen happened happening has hasnt have help here how i in is isnt it its just language last latest me mean means model more my no not of on out outcome overall overview plain please quickly result results run s scenario scenarios sceanrio scenerio setup short show simple simply simulation so stop stopped summarize summarise summary tell terms test that the these this through to understand us walk was wasnt what why with work worked working would you your".split(" "));

/** Short conversational requests refer to the run already open in IGNIS. */
export function isRunSummaryQuestion(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\bwhat['’]s\b/g, "what is").replace(/['’]/g, "");
  const words = normalized.match(/[a-z]+/g) ?? [];
  return words.length > 0 && words.every(word => SUMMARY_WORDS.has(word))
    && /\b(explain|explanation|summari[sz]e|summary|overview|describe|happen\w*|work\w*|mean\w*|walk|break|tell|show|continue|what|why|how)\b/i.test(normalized);
}

export function resolveScenarioQuestion(message: string, history: readonly string[] = []): string {
  const short = message.toLowerCase().replace(/[^a-z\s]/g, "").trim()
    .replace(/^(?:(?:can|could|would) you (?:please )?|please )/, "");
  if (/^(?:explain(?: (?:it|this|that)(?: to me)?| more| further)?|why|how so|how come|tell me more|go on|continue|what do you mean)$/.test(short)) {
    const previous = history.at(-1);
    if (previous && isScenarioQuestion(previous) && !isOverrideAttempt(previous)) return previous;
  }
  return message;
}
/** Conservative local scope check; the Groq path also uses a separate scope classifier. */
export function isScenarioQuestion(message: string): boolean {
  return isRunSummaryQuestion(message) || /\b(fire|fires|flame\w*|combust\w*|smoke|detect\w*|alarm\w*|sensor\w*|ventilat\w*|airflow|oxygen|gravity|microgravity|buoyan\w*|suppress\w*|extinguish\w*|saffire|bass|same|nasa|ignis|flammab\w*|pyrolys\w*|soot|hrr|material\w*)\b/i.test(message)
    || /^(explain this (run|scenario)|which parts are assumptions|which parts are uncertain|what changes if i stop ventilation)[?.!]*$/i.test(message.trim());
}
export function isOverrideAttempt(message: string): boolean {
  return /(?:ignore|disregard|override|forget)[\s\S]{0,70}(?:instructions?|rules?|prompts?|restrictions?|previous)|(?:reveal|print|show|repeat)[\s\S]{0,50}(?:system prompt|api key|secret)|(?:system|developer)\s*:|<\|(?:im_start|system|endoftext)\|>/i.test(message);
}
/** Deterministic explanations from the selected model state and real source registry.
 * Answers draw only on the scenario and the source registry; unsupported free text is not invented.
 */
export function explainScenario(message: string, input: ScenarioInput | null, state: ScenarioSnapshot | null, history: readonly string[] = []): ScenarioAnswer {
  const question = resolveScenarioQuestion(message, history);
  const q = question.toLowerCase();
  const context = `Model ${FIRE_MODEL_VERSION} · ${input ? `${input.gravityG} g · ${input.material.name} · ${input.oxygenPct}% O₂ · ${input.pressureKpa.toFixed(1)} kPa` : "No equipment selected"}${state ? ` · captured at T+${state.t.toFixed(1)} s` : " · setup preview"}`;
  if (isOverrideAttempt(message) || !isScenarioQuestion(question)) return { context, text: SCOPE_REFUSAL, sources: [] };
  if (!input) return { context, text: "Choose a habitat and a piece of equipment, then select a material and ignition source. I can explain fire shape, smoke transport, sensor delays, ventilation changes and the evidence behind that scenario.", sources: ["saffire-vi", "bass-ii"] };
  if (isRunSummaryQuestion(question)) return { context, text: summarizeRun(input, state), sources: ["model", "nist-cfast", ...input.material.nasaSources] };
  const evidence = applicability(input);
  if (/assum|uncertain|accur|valid|limit/.test(q)) return { context, text: `${evidence.status}. ${evidence.reason} ${MODEL_ASSUMPTIONS.slice(0, 4).join(" ")} For ${input.material.name}, published findings describe particular specimens; they do not establish a universal ignition temperature or oxygen limit.`, sources: [...input.material.nasaSources, "model"] };
  if (/detect|alarm|smoke|sensor/.test(q)) return { context, text: state ? `Smoke is ${state.smokeMgM3.toFixed(2)} mg/m³ averaged over the room and ${state.detectorSmokeMgM3.toFixed(2)} mg/m³ at the modeled detector. The current travel estimate is ${state.transportS > 86400 ? "more than a day without effective transport" : `${state.transportS.toFixed(1)} seconds`}. Transport, particle-size sensitivity and instrument lag all contribute. ${state.firstAlarmTime === null ? "No enabled sensor has crossed its assumed alarm threshold." : `The first alarm was at ${state.firstAlarmTime.toFixed(1)} s.`} SAME measured sub-ignition aerosols; the detector calibration here is assumed.` : "A smoke alarm needs smoke to reach the sensor and generate a strong enough signal. In orbit, ventilation paths matter because buoyant rise vanishes. Small particles may scatter little light. The simulation uses per-location transport and assumed instrument response constants.", sources: ["same-2", "nist-smoke", "saffire-vi"] };
  if (/stop|fan|vent|airflow|what changes|compare/.test(q)) return { context, text: `At ${input.gravityG} g, ${input.gravityG === 0 ? "fan shutdown removes forced transport; molecular diffusion and stored fuel heat remain" : "buoyancy remains after the fan stops"}. Saffire observed persistent flamelets and regrowth after airflow returned. The result depends on thermal history, local oxygen and geometry. Compare a copy of this setup with ventilation stopped at 30 s; the active run stays in place.`, sources: ["saffire-iv-v", "iss-fds-2001"], compareVentilation: true };
  if (/exting|suppress|water|co₂|co2|agent|power/.test(q)) return { context, text: "Removing power stops an electrical heat source; a self-sustaining fire can continue. CO₂ adds a finite gas dose and dilutes local oxygen. Captured water absorbs sensible and latent heat; the modeled capture fraction is assumed. Chemical-agent inhibition is exploratory. Flame-out leaves hot material and combustion products, so read the remaining heat and gases separately.", sources: ["iss-fds-2001", "fwm-pfe", "model"] };
  if (/nasa|source|research|evidence|support|experiment/.test(q)) return { context, text: `${input.material.nasaFinding} The links below identify the relevant publications. Saffire supplies cabin-scale HRR and product summaries; BASS explores geometry/flow-dependent spread and extinction; SAME supplies smoke-size observations. ${evidence.reason} Open NASA research for the original tables and unmodified telemetry.`, sources: [...input.material.nasaSources, "saffire-vi", "same-2"] };
  if (/flame|shape|blue|lean|gravity|why|explain/.test(q)) return { context, text: `${input.gravityG === 0 ? "The buoyant velocity is zero. A compact source can form a rounded envelope while forced airflow stretches it downstream." : "Hot gases experience buoyancy. The balance of buoyancy and cabin airflow determines plume direction and elongation."} ${state ? `The modeled chemical HRR is ${state.chemicalHrrW.toFixed(0)} W; source heating adds ${state.sourceHeatW.toFixed(0)} W. Surface temperature is ${state.surfaceTempC.toFixed(0)} °C and local oxygen is ${state.localO2Pct.toFixed(1)}%. ` : ""}The rendering uses the burning footprint and flow. Soot and fuel affect color; a blue flame is not a rule for zero gravity. ${evidence.reason}`, sources: ["bass-ii", "saffire-iv-v", "nist-cfast"] };
  return { context, text: summarizeRun(input, state), sources: ["model", "nist-cfast", ...input.material.nasaSources] };
}

/** A run summary uses captured model values, never numbers borrowed from a paper. */
function summarizeRun(input: ScenarioInput, state: ScenarioSnapshot | null): string {
  const setup = `${input.material.name} at ${input.gravityG} g, ${input.oxygenPct}% oxygen and ${input.pressureKpa.toFixed(1)} kPa`;
  const flow = state?.uForcedMs ?? input.ventilationMs;
  const mechanism = input.gravityG === 0
    ? flow > 0
      ? "In zero gravity, there is no buoyant rise. Airflow carries oxygen toward the fuel and moves heat and smoke through the cabin."
      : "In zero gravity with the fans stopped, there is no buoyant rise or forced airflow. The model still accounts for diffusion and heat stored in the fuel."
    : "Gravity makes hot gases rise, while cabin airflow also carries oxygen, heat and smoke. The model balances those effects as the fuel heats and burns.";
  if (!state) return `You’ve set up ${setup}. This is a setup preview; start the scenario to see what happens.\n\nThe model heats the material, tracks burning and smoke, and checks whether smoke reaches an enabled detector. ${mechanism}`;

  const phase: Record<NonNullable<ScenarioSnapshot["phase"]>, string> = {
    heating: "the material is still heating up",
    smoldering: "the material is smoldering",
    pyrolysis: "the heated material is releasing fuel vapor",
    flaming: "the material is burning with a flame",
    extinguished: "the flame is out",
    "burned-out": "the modeled fuel has burned out",
    "no-ignition": "the material has not ignited",
  };
  const outcome = state.phase ? phase[state.phase] : state.chemicalHrrW > 0 ? "the fuel is releasing heat from burning" : "there is no heat from burning at this snapshot";
  const timeline = [
    state.ignitionTime != null ? `It ignited at ${state.ignitionTime.toFixed(1)} s.` : "",
    state.extinctionTime != null ? `The flame went out at ${state.extinctionTime.toFixed(1)} s.` : "",
  ].filter(Boolean).join(" ");
  const peak = state.peakHrrW !== undefined ? ` The recorded peak heat release for this run is ${state.peakHrrW.toFixed(0)} W.` : "";
  const alarm = state.firstAlarmTime === null ? "No detector alarm has been recorded yet." : `The first detector alarm was at ${state.firstAlarmTime.toFixed(1)} s.`;
  return `At ${state.t.toFixed(1)} s, ${outcome}. Your setup is ${setup}. ${timeline}\n\nThe fire itself is releasing ${state.chemicalHrrW.toFixed(0)} W of heat, and the heat source adds ${state.sourceHeatW.toFixed(0)} W.${peak} The fuel surface is ${state.surfaceTempC.toFixed(0)} °C, with ${state.localO2Pct.toFixed(1)}% oxygen near it. ${mechanism}\n\nSmoke is ${state.smokeMgM3.toFixed(2)} mg/m³ in the room and ${state.detectorSmokeMgM3.toFixed(2)} mg/m³ at the detector. ${alarm} Smoke travel and sensor response both affect when an alarm appears. These are exploratory model estimates.`.replace(/ +\n/g, "\n");
}
