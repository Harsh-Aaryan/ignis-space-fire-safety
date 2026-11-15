/**
 * Research index: real fire-safety investigations, standards and flight systems.
 *
 * Every statement here is taken from a record already held in this repository:
 *  - NASA PSI metadata and experiment tables in public/data/nasa-psi (ids "PSI-n"),
 *  - NTRS citation records in src/data/verified/ntrs-index.json (numeric ids),
 *  - the fire-model source registry in src/data/fire/sources.ts (slug ids).
 * Condition ranges marked "from the PSI table" were computed from the bundled CSV.
 * Nothing in this file is generated or illustrative.
 */

/** The three questions the challenge asks of the research. */
export type Pillar = "crew-environments" | "predictive-modeling" | "controls";

export type CrewEnvironment = "spacecraft" | "station" | "lunar-base" | "mars-base" | "rover";

export type GravityRegime = "0g" | "lunar" | "mars" | "1g";

export type Topic =
  | "flammability-limits"
  | "flame-spread"
  | "cabin-scale-fire"
  | "smoke"
  | "detection"
  | "suppression"
  | "atmosphere-limits";

export type RecordKind = "flight-experiment" | "ground-test" | "research-program" | "model-study" | "flight-system" | "standard";

/** What IGNIS actually holds for a record. */
export type HoldingKind = "table" | "telemetry" | "summary" | "citation";

export interface Finding {
  text: string;
  /** Fire-model source registry id, when the finding was read out of that document. */
  sourceId?: string;
}

export interface EnvironmentLink {
  id: CrewEnvironment;
  /** "tested": conditions of that environment were part of the test. "applies": a standard or system in force there. "transferable": informs it, with the stated caveat. */
  basis: "tested" | "applies" | "transferable";
  note: string;
}

export interface Holding {
  kind: HoldingKind;
  label: string;
  /** PSI accession when the holding is a bundled NASA table. */
  psiId?: string;
}

export interface TestedConditions {
  oxygenPct?: [number, number];
  pressureKpa?: [number, number];
  flowCmS?: [number, number];
  fuels: string[];
  note?: string;
}

export interface InvestigationRecord {
  id: string;
  name: string;
  title: string;
  kind: RecordKind;
  organization: string;
  platform: string;
  period: string;
  summary: string;
  findings: Finding[];
  pillars: Pillar[];
  topics: Topic[];
  gravity: GravityRegime[];
  conditions: TestedConditions;
  environments: EnvironmentLink[];
  /** How the IGNIS fire model uses this record. Empty when it does not. */
  modelUse: string[];
  /** What the record tells designers of detection, suppression and material controls. */
  controlsUse: string[];
  holdings: Holding[];
  links: { psi: string[]; ntrs: string[]; sources: string[]; doi?: string };
}

export const PILLARS: Record<Pillar, { label: string; short: string; question: string }> = {
  "crew-environments": {
    label: "Crew environments",
    short: "Environments",
    question:
      "Which investigations bear on fire safety where crews live: spacecraft, space stations, lunar and Martian surface bases, and pressurized rovers?",
  },
  "predictive-modeling": {
    label: "Predictive modeling data",
    short: "Modeling data",
    question: "Which measurements can a model of flammability and fire growth be built on, and checked against?",
  },
  controls: {
    label: "Detection, suppression and controls",
    short: "Controls",
    question: "Which results inform the next generation of fire detection, suppression equipment and material controls?",
  },
};

export const CREW_ENVIRONMENTS: Record<CrewEnvironment, { label: string; gravity: GravityRegime; gravityLabel: string; note: string }> = {
  spacecraft: {
    label: "Crewed spacecraft",
    gravity: "0g",
    gravityLabel: "Microgravity",
    note: "Transit and orbital vehicles. No buoyant flow; ventilation sets how a flame is fed.",
  },
  station: {
    label: "Space stations",
    gravity: "0g",
    gravityLabel: "Microgravity",
    note: "Long-duration orbital habitats such as the ISS and Gateway.",
  },
  "lunar-base": {
    label: "Lunar surface habitats",
    gravity: "lunar",
    gravityLabel: "0.165 g",
    note: "Partial gravity restores a weak buoyant flow. Cabin atmospheres may be oxygen-enriched at reduced pressure.",
  },
  "mars-base": {
    label: "Martian surface habitats",
    gravity: "mars",
    gravityLabel: "0.38 g",
    note: "Stronger buoyant flow than the Moon, still well below Earth's.",
  },
  rover: {
    label: "Pressurized rovers",
    gravity: "lunar",
    gravityLabel: "0.165–0.38 g",
    note: "Small free volume, frequent EVA and therefore the reduced-pressure, oxygen-enriched atmospheres studied for exploration.",
  },
};

export const GRAVITY_REGIMES: Record<GravityRegime, { label: string; g: number }> = {
  "0g": { label: "Microgravity", g: 0 },
  lunar: { label: "Lunar, 0.165 g", g: 0.165 },
  mars: { label: "Martian, 0.38 g", g: 0.38 },
  "1g": { label: "Earth, 1 g", g: 1 },
};

export const TOPICS: Record<Topic, { label: string; description: string }> = {
  "flammability-limits": { label: "Flammability limits", description: "The oxygen, pressure and flow at which a material stops burning." },
  "flame-spread": { label: "Flame spread and growth", description: "How fast a flame travels over a material and how large it gets." },
  "cabin-scale-fire": { label: "Cabin-scale fire", description: "Heat release, combustion gases and temperature in a vehicle-sized volume." },
  smoke: { label: "Smoke and aerosols", description: "Particle sizes and transport of smoke from heated and burning materials." },
  detection: { label: "Fire detection", description: "Sensor response, placement and alarm criteria." },
  suppression: { label: "Suppression and response", description: "Extinguishing agents, ventilation and power isolation." },
  "atmosphere-limits": { label: "Atmosphere limits", description: "Exposure limits for combustion products in the cabin." },
};

/** Topics shown as rows of the gravity coverage matrix. */
export const MATRIX_TOPICS: Topic[] = ["flammability-limits", "flame-spread", "cabin-scale-fire", "smoke", "detection", "suppression"];

export const KIND_LABEL: Record<RecordKind, string> = {
  "flight-experiment": "Flight experiment",
  "ground-test": "Ground test",
  "research-program": "Research program",
  "model-study": "Model study",
  "flight-system": "Flight system",
  standard: "Standard",
};

export const HOLDING_LABEL: Record<HoldingKind, string> = {
  table: "NASA experiment table",
  telemetry: "Sensor time history",
  summary: "Published summary values",
  citation: "Citation record",
};

const PARTIAL_G_CAVEAT = "Measured in microgravity. Partial gravity adds a buoyant flow that was not part of the test.";

function microgravityEnvironments(surfaceNote = PARTIAL_G_CAVEAT): EnvironmentLink[] {
  return [
    { id: "spacecraft", basis: "tested", note: "Measured in microgravity with forced flow, as in a ventilated cabin." },
    { id: "station", basis: "tested", note: "Flown on or from the ISS." },
    { id: "lunar-base", basis: "transferable", note: surfaceNote },
    { id: "mars-base", basis: "transferable", note: surfaceNote },
    { id: "rover", basis: "transferable", note: surfaceNote },
  ];
}

export const INVESTIGATIONS: InvestigationRecord[] = [
  {
    id: "saffire-vi",
    name: "Saffire VI",
    title: "Spacecraft Fire Safety Experiment VI",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center",
    platform: "Cygnus cargo vehicle, after departure from the ISS",
    period: "Results reported 2024",
    summary:
      "Large fabric and acrylic samples burned inside an uncrewed Cygnus at reduced pressure and elevated oxygen, with heat release, cabin gases and temperatures recorded through the vehicle.",
    findings: [
      { text: "Fires released 1.5–3.2 kW in 17–19 m³ of free volume. Temperature rose significantly only near the fire.", sourceId: "saffire-vi" },
      { text: "A far-field smoke alarm threshold of 1 mg/m³ was reached at 981 s, after most of the hazardous gas had been released.", sourceId: "saffire-vi" },
      { text: "Two acrylic slabs raised cabin CO₂ by more than 8,000 ppm and CO by more than 300 ppm.", sourceId: "saffire-vi" },
      { text: "Heat release from oxygen consumption used 13.1 kJ per gram of O₂.", sourceId: "saffire-vi" },
      { text: "With a 2 mg/m³ far-field alarm threshold, both acrylic tests already had a CO rise above the 100 ppm 24-hour limit at alarm (105 and 283 ppm); the one-sided slab approached the 425 ppm one-hour limit. The paper concludes that a lower threshold or additional detectors would be needed.", sourceId: "saffire-iv-vi-emission" },
    ],
    pillars: ["crew-environments", "predictive-modeling", "controls"],
    topics: ["cabin-scale-fire", "flame-spread", "detection"],
    gravity: ["0g"],
    conditions: {
      oxygenPct: [22.0, 31.0],
      pressureKpa: [54.1, 100],
      flowCmS: [20, 20],
      fuels: ["Cotton–fiberglass fabric (SIBAL)", "Cast acrylic (PMMA) slabs"],
      note: "Conditions of tests IV-1, V-2, VI-2, VI-3 and VI-4 as tabulated in the Saffire VI paper.",
    },
    environments: microgravityEnvironments(
      "Atmosphere matches the reduced-pressure, oxygen-enriched cabins studied for exploration; gravity does not. Partial gravity was not part of the test.",
    ),
    modelUse: [
      "Four test rows (IV-1, VI-2, VI-3, VI-4) are the cabin-scale reference the model is compared with.",
      "Fabric heat of combustion, fuel loading and spread rate; acrylic burning rate.",
      "Far-field smoke alarm threshold.",
    ],
    controlsUse: [
      "Smoke reached a far-field detector late, after most toxic gas was already released: detector placement and sensitivity matter more than in a buoyant fire.",
      "CO and CO₂ rises set the scale of post-fire atmosphere cleanup.",
    ],
    holdings: [{ kind: "summary", label: "Test conditions and results, Tables 1–2" }],
    links: { psi: [], ntrs: ["20240002981", "20260001992"], sources: ["saffire-vi", "saffire-iv-vi-emission"] },
  },
  {
    id: "saffire-iv-v",
    name: "Saffire IV–V",
    title: "Spacecraft Fire Safety Experiments IV and V",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center",
    platform: "Cygnus cargo vehicle, after departure from the ISS",
    period: "Results reported 2021 and 2026",
    summary:
      "Large-scale burns of thin and thick fuels in concurrent flow, including what happens when the airflow is reduced or stopped, and the smoke and gas the fires released at a far-field detector.",
    findings: [
      { text: "Concurrent flames reached a limiting, steady size on thin and thick fuels, unlike upward spread in Earth gravity.", sourceId: "saffire-iv-v" },
      { text: "Thick samples kept burning after the flow was reduced. Extinguishment of thick or charring fuels cannot be assumed to be rapid.", sourceId: "saffire-iv-v" },
      { text: "One acrylic test extinguished quickly once flow was stopped after 300 s at 5 cm/s.", sourceId: "saffire-iv-v" },
      { text: "Fuel vapor accumulates in low gravity: two samples ignited as small deflagrations.", sourceId: "saffire-iv-v" },
      { text: "Flames on flat acrylic stayed anchored at the leading edge and grew only as the material regressed, linearly at 0.22–0.38 mm/s for several minutes. That is faster than the less than 0.1 mm/s of the 5 cm wide Saffire II strip in air, and not accelerating as upward spread is in Earth gravity.", sourceId: "saffire-iv-vi-emission" },
      { text: "One-sided acrylic flames began to plateau near 380 s (Saffire V) and 420 s (Saffire VI); two-sided flames were still growing at about 500 s. Whether they would plateau is unknown.", sourceId: "saffire-iv-vi-emission" },
      { text: "Two-sided growth rate rose 73% for 0.08 more oxygen mole fraction despite a 45% lower pressure; one-sided growth was unchanged for 0.03 more oxygen mole fraction at a 27% lower pressure.", sourceId: "saffire-iv-vi-emission" },
      { text: "Time for far-field smoke to reach 2 mg/m³ was 92–201 s for the three thin-fabric tests and 1037–1603 s for the four acrylic tests, timed from about 10 minutes before ignition. Smoke reached the detector with little delay because of the direct path from the flow unit.", sourceId: "saffire-iv-vi-emission" },
      { text: "Heat release reached about 3 kW, yet the far-field temperature rose by at most 0.5 °C. The flow unit outlet reached 77 °C, which fell quickly through mixing and heat loss. Smoke products were the larger hazard.", sourceId: "saffire-iv-vi-emission" },
    ],
    pillars: ["crew-environments", "predictive-modeling", "controls"],
    topics: ["cabin-scale-fire", "flame-spread", "suppression", "detection", "smoke"],
    gravity: ["0g"],
    conditions: {
      flowCmS: [5, 20],
      fuels: ["Cotton–fiberglass fabric (SIBAL)", "Cast acrylic (PMMA)"],
      note: "Flame lengths of 9.5 cm after 400 s in air and 11 cm after 450 s at 25.4% O₂ are reported for thick acrylic.",
    },
    environments: microgravityEnvironments(),
    modelUse: [
      "Limiting flame size of thick acrylic in concurrent flow.",
      "Behavior after fan shutdown, used to check the ventilation-isolation response.",
    ],
    controlsUse: [
      "Stopping ventilation is not a guaranteed extinguishing action for thick fuels.",
      "Re-ignition by residual flamelets argues for monitoring after flame-out.",
      "A 2 mg/m³ smoke threshold at the far-field detector did not detect every fire before the CO rise passed the 24-hour limit. The authors point to a lower threshold or additional detectors to cut transport time.",
    ],
    holdings: [
      { kind: "summary", label: "Published observations" },
      { kind: "summary", label: "Test conditions, smoke alarm times and gas rises for IV-2, V-2 and V-3, Table 1 of ICES-2026-577" },
    ],
    links: { psi: [], ntrs: ["20260001992"], sources: ["saffire-iv-v", "saffire-iv-vi-emission"] },
  },
  {
    id: "saffire-i-iii",
    name: "Saffire I–III",
    title: "Spacecraft Fire Safety Experiments I, II and III",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center",
    platform: "Cygnus cargo vehicle, after departure from the ISS",
    period: "2016–2017",
    summary:
      "The first fires of practical size lit in a spacecraft: a 0.4 m by 0.94 m fabric panel in Saffire I and III, and nine smaller material samples in Saffire II.",
    findings: [
      { text: "Objectives: how rapidly a large fire grows in low gravity, and how low-gravity flammability limits compare with NASA's normal-gravity screening test." },
      { text: "Saffire II silicone samples of 0.27–1.03 mm did not burn significantly in microgravity; the thinnest burned completely in Earth gravity." },
      { text: "Saffire II thick acrylic flames stayed anchored at the base of the sample, with a regression rate of 0.01–0.04 mm/s." },
    ],
    pillars: ["crew-environments", "predictive-modeling"],
    topics: ["cabin-scale-fire", "flame-spread", "flammability-limits", "smoke"],
    gravity: ["0g"],
    conditions: {
      oxygenPct: [21.5, 22.1],
      flowCmS: [20, 30],
      fuels: ["Cotton–fiberglass fabric (SIBAL)", "Silicone", "Acrylic (PMMA)", "Nomex"],
      note: "From the PSI experiment tables. Saffire I and II ran at 20 cm/s, Saffire III at 30 cm/s.",
    },
    environments: microgravityEnvironments(),
    modelUse: ["Sample geometry of the reference fabric fuel.", "Saffire I cabin temperature, pressure and smoke-detector voltages are shown as recorded; they are not used to fit the model."],
    controlsUse: ["Observed smoke-detector voltage histories from a real spacecraft fire."],
    holdings: [
      { kind: "table", label: "Saffire I experiment table", psiId: "PSI-98" },
      { kind: "telemetry", label: "Saffire I sensor history, 1,215 readings", psiId: "PSI-98" },
      { kind: "table", label: "Saffire II experiment table", psiId: "PSI-99" },
      { kind: "table", label: "Saffire III experiment table", psiId: "PSI-100" },
    ],
    links: { psi: ["PSI-98", "PSI-99", "PSI-100"], ntrs: ["20170000230"], sources: ["saffire-poster"] },
  },
  {
    id: "saffire-models",
    name: "Saffire fire models",
    title: "Vehicle-scale fire models verified against Saffire",
    kind: "model-study",
    organization: "NASA Glenn Research Center",
    platform: "Computational models of the Cygnus vehicle",
    period: "2022–2026",
    summary:
      "Computational fire models of the Cygnus cabin, built to predict how heat and combustion products from a Saffire burn move through a vehicle.",
    findings: [
      { text: "A model of the Cygnus vehicle during Saffire IV was developed to aid the prediction of spacecraft fires." },
      { text: "A Fire Dynamics Simulator model used Saffire inlet and outlet temperatures and CO₂ concentrations, and was checked against six remote sensors and a far-field device in the vehicle." },
    ],
    pillars: ["predictive-modeling", "crew-environments"],
    topics: ["cabin-scale-fire", "smoke"],
    gravity: ["0g"],
    conditions: { fuels: ["Saffire IV–VI samples"], note: "Model studies. Conditions follow the Saffire flights they reproduce." },
    environments: microgravityEnvironments(),
    modelUse: ["Not used as input. These are the full-fidelity counterparts of the reduced-order model in IGNIS."],
    controlsUse: ["Predicting where combustion products travel is the basis for placing detectors in a new vehicle."],
    holdings: [{ kind: "citation", label: "Two NTRS conference papers" }],
    links: { psi: [], ntrs: ["20220002714", "20260001600"], sources: [] },
  },
  {
    id: "bass-ii",
    name: "BASS-II",
    title: "Burning and Suppression of Solids – II",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center with university investigators",
    platform: "ISS Microgravity Science Glovebox",
    period: "2014–2018",
    summary:
      "129 crew-operated burns of acrylic rods, films and slabs and cotton–fiberglass fabric in a small flow duct, mapping ignition, spread and extinction in slow airflow.",
    findings: [
      { text: "An acrylic rod spread flame steadily at 13.6% O₂ in microgravity, although it blows off at 16% in Earth gravity: a negative oxygen margin of 2.4% O₂ for the ground test.", sourceId: "bass-ii" },
      { text: "The minimum of the flammability boundary sits at very low flow, of the order of diffusive speeds.", sourceId: "bass-ii" },
      { text: "A 0.1 mm acrylic film quenched below 2 cm/s and blew off as flow crossed 40 cm/s.", sourceId: "bass-ii" },
      { text: "Acrylic rods gave 54 opposed-flow spread rates of roughly 0.005–0.025 cm/s at 16–21% O₂ and 0.4–4 cm/s.", sourceId: "bass-ii" },
      { text: "In an ISS flow-duct test at 18.7% O₂, a thin fabric sample ignited at 5 cm/s and quenched when flow fell to 2.2 cm/s.", sourceId: "saffire-poster" },
    ],
    pillars: ["crew-environments", "predictive-modeling", "controls"],
    topics: ["flammability-limits", "flame-spread", "suppression"],
    gravity: ["0g"],
    conditions: {
      oxygenPct: [13.6, 22.2],
      flowCmS: [0, 55],
      fuels: ["Acrylic (PMMA) rods, films and slabs", "Cotton–fiberglass fabric (SIBAL)"],
      note: "Initial oxygen range from the PSI table (129 runs). Tunnel flow range from the BASS-II results summary.",
    },
    environments: microgravityEnvironments(),
    modelUse: ["Acrylic flammability limit and its low-flow margin.", "Low-flow quenching and high-flow blowoff bounds of the flammability envelope.", "Low-flow quenching point of the reference fabric fuel."],
    controlsUse: [
      "NASA's ground screening test is not conservative for microgravity: materials that pass can still burn in a ventilated cabin.",
      "Reducing airflow below a few cm/s quenched thin-fuel flames, which supports ventilation shutdown as a first response.",
    ],
    holdings: [
      { kind: "table", label: "BASS-II experiment table, 129 runs", psiId: "PSI-25" },
      { kind: "summary", label: "Flammability limits and spread rates" },
    ],
    links: { psi: ["PSI-25"], ntrs: ["20210011385", "20160000593"], sources: ["bass-ii", "saffire-poster"], doi: "10.60555/4qc4-de67" },
  },
  {
    id: "bass",
    name: "BASS",
    title: "Burning and Suppression of Solids",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center with Case Western Reserve University",
    platform: "ISS Microgravity Science Glovebox",
    period: "2012–2013",
    summary:
      "The first BASS series: acrylic spheres, slabs and rods, cotton–fiberglass and Nomex fabrics and wax candles burned in a small flow duct to relate ground flammability tests to behavior in microgravity.",
    findings: [
      { text: "Objective: bridge the gap between the normal-gravity NASA-STD-6001 Test 1 method, ground-based microgravity tests and actual material flammability in microgravity." },
      { text: "NASA material selection rests on a test that sorts materials by Earth-gravity behavior, without considering low-gravity effects." },
    ],
    pillars: ["crew-environments", "predictive-modeling"],
    topics: ["flammability-limits", "flame-spread"],
    gravity: ["0g"],
    conditions: {
      fuels: ["Acrylic (PMMA) spheres, slabs and rods", "Cotton–fiberglass fabric (SIBAL)", "Nomex blend", "Wax candles"],
      note: "The PSI table lists 122 runs by sample; oxygen and flow are not tabulated per run.",
    },
    environments: microgravityEnvironments(),
    modelUse: [],
    controlsUse: ["Material selection based on Earth-gravity screening does not account for low-gravity effects."],
    holdings: [{ kind: "table", label: "BASS experiment table, 122 runs", psiId: "PSI-26" }],
    links: { psi: ["PSI-26"], ntrs: [], sources: [], doi: "10.60555/58h4-dy80" },
  },
  {
    id: "same-2",
    name: "SAME-2",
    title: "Smoke Aerosol Measurement Experiment – Reflight",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center with NIST",
    platform: "ISS Microgravity Science Glovebox",
    period: "July–September 2010",
    summary:
      "Five spacecraft materials were heated below ignition and the size of the resulting smoke particles measured, fresh and after aging, to learn what a spacecraft smoke detector actually has to sense.",
    findings: [
      { text: "Most average particle sizes were 200–400 nm. Zero-flow cases produced particles two to three times larger than at 8 cm/s.", sourceId: "same-2" },
      { text: "Kapton and Teflon smoke is very small and hard for light-scattering detectors. All samples were readily detected by an ionization detector.", sourceId: "same-2" },
      { text: "With no flow in microgravity, smoke diffuses about 4 cm in 60 s.", sourceId: "same-2" },
      { text: "Detectors that measure more than one moment of the size distribution are recommended.", sourceId: "same-2" },
    ],
    pillars: ["controls", "predictive-modeling", "crew-environments"],
    topics: ["smoke", "detection"],
    gravity: ["0g"],
    conditions: {
      flowCmS: [0, 8.1],
      fuels: ["Kapton", "Lamp wick (cellulose)", "Silicone rubber", "Teflon", "Pyrell foam"],
      note: "Inlet velocity range from the PSI table (109 runs). Samples were heated, not burned.",
    },
    environments: microgravityEnvironments(
      "Measured in microgravity, where smoke stays near its source. In partial gravity a weak plume carries it upward; particle sizes there were not measured.",
    ),
    modelUse: ["Smoke particle count-mean and mass-mean diameters, fresh and aged 720 s, for the five tested materials.", "Relative response of light-scattering and ionization detectors."],
    controlsUse: [
      "Detector technology must be matched to the smoke: light scattering alone can miss the smallest particles.",
      "Without buoyancy, smoke does not travel to a ceiling detector on its own. Detectors belong in the ventilation path.",
    ],
    holdings: [
      { kind: "table", label: "SAME-R experiment table, 109 runs", psiId: "PSI-101" },
      { kind: "summary", label: "Particle size table for five materials" },
    ],
    links: { psi: ["PSI-101"], ntrs: ["20130000422"], sources: ["same-2"], doi: "10.60555/2np7-jv14" },
  },
  {
    id: "same",
    name: "SAME",
    title: "Smoke and Aerosol Measurement Experiment",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center with NIST and the University of Maryland",
    platform: "ISS Microgravity Science Glovebox",
    period: "Manifested for 2007",
    summary:
      "The first measurement of smoke particle sizes from overheated spacecraft materials in low gravity, made alongside two spacecraft smoke detectors.",
    findings: [
      { text: "Goal: quantify the particle sizes smoke reaches in low gravity and relate them to how the smoke was generated and transported." },
      { text: "Owing to the absence of microgravity smoke data, existing spacecraft smoke detectors were designed from normal-gravity conditions." },
    ],
    pillars: ["controls", "crew-environments"],
    topics: ["smoke", "detection"],
    gravity: ["0g"],
    conditions: {
      flowCmS: [5, 10],
      fuels: ["Teflon", "Kapton", "Silicone rubber", "Lamp wick (cellulose)", "Dibutyl phthalate"],
      note: "From the PSI table: airflow of 5 and 10 cm/s, aging of 1 and 20 minutes.",
    },
    environments: microgravityEnvironments(),
    modelUse: [],
    controlsUse: ["Measured how existing spacecraft smoke detectors respond to low-gravity smoke, the evidence base for an advanced detector."],
    holdings: [{ kind: "table", label: "SAME experiment table", psiId: "PSI-102" }],
    links: { psi: ["PSI-102"], ntrs: ["20070031686"], sources: [], doi: "10.60555/gd4k-8h62" },
  },
  {
    id: "fire-detection-research",
    name: "Fire signatures and detection",
    title: "Fire signatures, sensors and next-generation smoke detectors",
    kind: "research-program",
    organization: "NASA Glenn Research Center",
    platform: "Research program supporting ISS detector experiments",
    period: "2004–2016",
    summary:
      "The NASA program that defines what a spacecraft fire detector must distinguish: fire and pre-fire signatures, background aerosols and nuisance sources.",
    findings: [
      { text: "Rapid fire detection requires telling fire signatures apart from background conditions and nuisance sources." },
      { text: "In low gravity, buoyant flow is negligible, so particles concentrate at the smoke source and stay longer in hot zones." },
      { text: "There is no data set for spacecraft fires comparable to terrestrial ones; detectors in current spacecraft were developed from terrestrial designs." },
    ],
    pillars: ["controls"],
    topics: ["detection", "smoke"],
    gravity: ["0g"],
    conditions: { fuels: ["Spacecraft materials and background cabin aerosols"], note: "Program-level records. No per-test conditions are indexed." },
    environments: microgravityEnvironments(),
    modelUse: [],
    controlsUse: ["Frames the requirement for discriminating detectors: characterize the background as carefully as the smoke."],
    holdings: [{ kind: "citation", label: "Three NTRS records" }],
    links: { psi: [], ntrs: ["20040142387", "20070031686", "20170007283"], sources: [] },
  },
  {
    id: "flex",
    name: "FLEX",
    title: "Flame Extinguishment Experiment",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center with university investigators",
    platform: "ISS Combustion Integrated Rack",
    period: "2009–2011",
    summary:
      "274 tabulated tests of single burning fuel droplets in controlled atmospheres to map where liquid fuels stop burning in microgravity and how well gaseous suppressants work.",
    findings: [
      { text: "Aim: map the flammability limits of liquid fuels in microgravity and measure the effectiveness of gaseous suppressants such as CO₂, helium and SF₆." },
      { text: "A primary objective was the limiting oxygen index as a function of ambient pressure, and how a suppressant changes it." },
    ],
    pillars: ["controls", "predictive-modeling"],
    topics: ["flammability-limits", "suppression"],
    gravity: ["0g"],
    conditions: {
      oxygenPct: [12, 34],
      fuels: ["Methanol droplets", "Heptane droplets"],
      note: "Oxygen mole fraction 0.12–0.34 with CO₂ up to 0.70 and helium up to 0.45, from the PSI table. Liquid-droplet evidence; it does not describe solid materials.",
    },
    environments: [
      { id: "spacecraft", basis: "tested", note: "Suppressant atmospheres measured in microgravity." },
      { id: "station", basis: "tested", note: "Flown on the ISS." },
      { id: "lunar-base", basis: "transferable", note: PARTIAL_G_CAVEAT },
      { id: "mars-base", basis: "transferable", note: PARTIAL_G_CAVEAT },
      { id: "rover", basis: "transferable", note: PARTIAL_G_CAVEAT },
    ],
    modelUse: ["Not used. The fire model burns solid fuels; droplet results are not transferred to them."],
    controlsUse: ["Direct measurements of how CO₂ and helium dilution change the oxygen needed to keep a flame alive in microgravity."],
    holdings: [{ kind: "table", label: "FLEX experiment table, 274 tests", psiId: "PSI-69" }],
    links: { psi: ["PSI-69"], ntrs: ["20150023456", "20120015928"], sources: [], doi: "10.60555/mbq8-0451" },
  },
  {
    id: "acme-bre",
    name: "ACME and the Burning Rate Emulator",
    title: "Advanced Combustion via Microgravity Experiments",
    kind: "flight-experiment",
    organization: "NASA Glenn Research Center with university investigators",
    platform: "ISS Combustion Integrated Rack",
    period: "Records dated 2016–2023",
    summary:
      "Gas-flame experiments on the ISS. The Burning Rate Emulator uses a gas burner to reproduce the flame of a burning solid or liquid from four fuel properties.",
    findings: [
      { text: "The Burning Rate Emulator assumes four properties define steady burning: heat of combustion, heat of gasification, surface temperature and laminar smoke point." },
      { text: "ACME's primary focus is terrestrial combustion; spacecraft fire safety is a secondary objective." },
      { text: "Spherical gas flames isolate the roles of radiation and extinction in microgravity.", sourceId: "s-flame" },
    ],
    pillars: ["predictive-modeling"],
    topics: ["flammability-limits"],
    gravity: ["0g"],
    conditions: { fuels: ["Gaseous fuels emulating condensed fuels"], note: "Burner results are not solid-material flammability measurements." },
    environments: microgravityEnvironments(),
    modelUse: ["Qualitative context for flame shape only. No coefficient in the model comes from these burner tests."],
    controlsUse: [],
    holdings: [{ kind: "citation", label: "Four NTRS records" }],
    links: { psi: [], ntrs: ["20210015913", "20220015583", "20160010073", "20170009141"], sources: ["s-flame"] },
  },
  {
    id: "exploration-atmospheres",
    name: "Flame spread in exploration atmospheres",
    title: "Microgravity flame spread in exploration atmospheres: pressure, oxygen and velocity effects",
    kind: "ground-test",
    organization: "NASA Glenn Research Center",
    platform: "Ground-based microgravity tests in a low-speed flow tunnel",
    period: "2008",
    summary:
      "Flammability of three spacecraft materials compared between microgravity and Earth gravity at the pressures and oxygen levels considered for exploration vehicles.",
    findings: [
      { text: "For Ultem 1000, Nomex HT90-40 and Mylar G, the Earth-gravity upward limiting oxygen index and maximum oxygen concentration were higher than the microgravity values by up to 4% O₂.", sourceId: "olson-2008" },
      { text: "Materials burned in microgravity at lower oxygen than NASA-STD-6001 Test 1 indicates.", sourceId: "olson-2008" },
    ],
    pillars: ["crew-environments", "predictive-modeling", "controls"],
    topics: ["flammability-limits", "flame-spread"],
    gravity: ["0g", "1g"],
    conditions: { fuels: ["Ultem 1000", "Nomex HT90-40", "Mylar G", "Kimwipes (flame spread)"], note: "Opposed and concurrent spread across pressure, oxygen and flow velocity. Test points are not tabulated here." },
    environments: [
      { id: "spacecraft", basis: "tested", note: "Microgravity limits at exploration cabin atmospheres." },
      { id: "station", basis: "tested", note: "Microgravity limits; station atmospheres are within the tested range." },
      { id: "lunar-base", basis: "transferable", note: "Atmosphere matches candidate surface-habitat cabins; gravity does not." },
      { id: "mars-base", basis: "transferable", note: "Atmosphere matches candidate surface-habitat cabins; gravity does not." },
      { id: "rover", basis: "transferable", note: "Rovers favor these reduced-pressure, oxygen-enriched atmospheres; gravity differs." },
    ],
    modelUse: ["Oxygen margin between Earth-gravity and microgravity limits for the three tested materials."],
    controlsUse: ["Ground screening overstates the oxygen a material can tolerate in flight, by up to 4% O₂ for these materials."],
    holdings: [{ kind: "summary", label: "Published limit comparison" }],
    links: { psi: [], ntrs: ["20080034883"], sources: ["olson-2008"] },
  },
  {
    id: "wstf-flammability-limits",
    name: "White Sands flammability limits",
    title: "Selected parametric effects on materials flammability limits",
    kind: "ground-test",
    organization: "NASA White Sands Test Facility",
    platform: "Ground test, Earth gravity",
    period: "2011",
    summary:
      "Upward limiting oxygen index and maximum oxygen concentration for eleven spacecraft polymers, and how those limits move with pressure, thickness and preheating.",
    findings: [
      { text: "Maximum oxygen concentration falls roughly linearly with total pressure: −0.251 to −0.975% O₂ per psia, −0.607 on average.", sourceId: "hirsch-2011" },
      { text: "Thinner silicone is more flammable: a limiting oxygen index of 17.5 at 4 mil against 23.4 at 40 mil.", sourceId: "hirsch-2011" },
      { text: "PTFE's limiting oxygen index drops from 49 to 40.8 when preheated to 200 °F.", sourceId: "hirsch-2011" },
    ],
    pillars: ["predictive-modeling", "controls"],
    topics: ["flammability-limits"],
    gravity: ["1g"],
    conditions: {
      pressureKpa: [70.3, 101.3],
      fuels: ["PMMA", "PEI (Ultem)", "PET", "Polyimide (Kapton)", "PEEK", "Silicone", "Nylon", "POM", "Polypropylene", "PVC", "Epoxy/glass"],
      note: "Limits at 14.7 psia unless noted; two materials at 10.2 psia.",
    },
    environments: [
      { id: "spacecraft", basis: "transferable", note: "Earth-gravity limits. Microgravity limits are lower for the materials tested in both." },
      { id: "station", basis: "transferable", note: "Earth-gravity limits. Microgravity limits are lower for the materials tested in both." },
      { id: "lunar-base", basis: "transferable", note: "Earth-gravity limits. No partial-gravity counterpart is indexed." },
      { id: "mars-base", basis: "transferable", note: "Earth-gravity limits. No partial-gravity counterpart is indexed." },
      { id: "rover", basis: "transferable", note: "The pressure trend bears on reduced-pressure rover cabins; gravity differs." },
    ],
    modelUse: ["Earth-gravity oxygen limits for eleven materials.", "Pressure dependence of the limit for PEI (Ultem)."],
    controlsUse: ["Material acceptance must state pressure, thickness and temperature: each one moves the oxygen limit."],
    holdings: [{ kind: "summary", label: "Limit table, 13 entries for eleven materials" }],
    links: { psi: [], ntrs: ["20110008636"], sources: ["hirsch-2011"] },
  },
  {
    id: "partial-gravity-wires",
    name: "Wire fires in partial gravity",
    title: "Flame spread and extinction over electric wires in partial gravity",
    kind: "flight-experiment",
    organization: "Hokkaido University with European university partners",
    platform: "Parabolic flight",
    period: "Published 2023",
    summary:
      "Polyethylene-insulated wires burned at 0 g, lunar, Martian and Earth gravity during parabolic flight: the only indexed solid-fuel measurements taken at lunar and Martian gravity.",
    findings: [
      { text: "The flammability limit against gravity is U-shaped: radiative extinction at low gravity, blowoff at high gravity.", sourceId: "konno-2023" },
      { text: "The limiting oxygen concentration of a nickel-chrome-core wire falls as gravity falls; a copper-core wire is nearly insensitive.", sourceId: "konno-2023" },
      { text: "Electrical faults are the most likely cause of a spacecraft fire.", sourceId: "konno-2023" },
    ],
    pillars: ["crew-environments", "predictive-modeling"],
    topics: ["flammability-limits", "flame-spread"],
    gravity: ["0g", "lunar", "mars", "1g"],
    conditions: {
      pressureKpa: [101.3, 101.3],
      flowCmS: [6, 15],
      fuels: ["LDPE-insulated wire, copper and nickel-chrome cores"],
      note: "Oxygen at or below 21%, opposed flow of 60 and 150 mm/s. Partial gravity lasted 24 s (lunar) and 33 s (Martian) per parabola.",
    },
    environments: [
      { id: "lunar-base", basis: "tested", note: "Measured at 0.16 g for 24 s per parabola, at 1 atm and no more than 21% O₂." },
      { id: "mars-base", basis: "tested", note: "Measured at 0.38 g for 33 s per parabola, at 1 atm and no more than 21% O₂." },
      { id: "rover", basis: "transferable", note: "Gravity matches; rover atmospheres are richer in oxygen than the 21% tested." },
      { id: "spacecraft", basis: "tested", note: "Includes a 0 g case." },
      { id: "station", basis: "tested", note: "Includes a 0 g case." },
    ],
    modelUse: ["Hot-wire igniter power and the wire fuel configuration.", "Shape of the flammability limit against gravity for wire insulation."],
    controlsUse: ["Wire construction changes partial-gravity flammability: the conductor core matters, not only the insulation."],
    holdings: [{ kind: "summary", label: "Published limits and spread behavior" }],
    links: { psi: [], ntrs: [], sources: ["konno-2023"] },
  },
  {
    id: "lunar-martian-flammability",
    name: "Flammability at lunar and Martian gravity",
    title: "Material flammability at lunar and Martian gravity",
    kind: "ground-test",
    organization: "NASA Glenn Research Center",
    platform: "Drop towers and aircraft; lunar-surface experiment planned",
    period: "Presented 2026",
    summary:
      "A NASA assessment that partial gravity may be the most dangerous regime for fire, and the case for testing materials on the lunar surface.",
    findings: [
      { text: "Flame spread rate as a function of gravity peaks near lunar gravity.", sourceId: "ferkul-2026" },
      { text: "The oxygen concentration needed for flammability reaches a minimum in the vicinity of lunar gravity.", sourceId: "ferkul-2026" },
      { text: "A partial-gravity fire in a habitat is expected to be substantially worse than in 0 g and potentially worse than in 1 g.", sourceId: "ferkul-2026" },
      { text: "Drop towers give 5 s and aircraft about 25 s of partial gravity. The Flammability of Materials on the Moon experiment is planned to extend this.", sourceId: "ferkul-2026" },
    ],
    pillars: ["crew-environments", "predictive-modeling"],
    topics: ["flammability-limits", "flame-spread"],
    gravity: ["lunar", "mars"],
    conditions: { fuels: ["Solid spacecraft materials"], note: "Short-duration partial gravity only. Sustained partial-gravity burns have not been measured." },
    environments: [
      { id: "lunar-base", basis: "tested", note: "Short-duration lunar-gravity tests; long burns await a surface experiment." },
      { id: "mars-base", basis: "tested", note: "Short-duration Martian-gravity tests." },
      { id: "rover", basis: "transferable", note: "Same gravity; cabin geometry and atmosphere differ from the tests." },
    ],
    modelUse: ["Direction of the partial-gravity trend. The model's partial-gravity results remain extrapolations."],
    controlsUse: ["Material limits qualified in 1 g or 0 g may not bound behavior on the Moon or Mars."],
    holdings: [{ kind: "summary", label: "Published assessment" }],
    links: { psi: [], ntrs: ["20260001966"], sources: ["ferkul-2026"] },
  },
  {
    id: "nasa-std-6001",
    name: "NASA-STD-6001B",
    title: "Flammability, offgassing and compatibility requirements and test procedures",
    kind: "standard",
    organization: "NASA Office of the Chief Engineer",
    platform: "Ground test standard, Earth gravity",
    period: "Change 3, 2025",
    summary:
      "The standard that decides which materials may fly. Its Test 1 burns a vertical specimen upward in the worst-case cabin atmosphere.",
    findings: [
      { text: "Test 1: five specimens 30 cm by 6.5 cm, mounted vertically, in the worst-case atmosphere.", sourceId: "nasa-std-6001b" },
      { text: "Pass: no specimen burns more than 15 cm and none propagates flame by burning debris.", sourceId: "nasa-std-6001b" },
      { text: "Maximum oxygen concentration is the highest oxygen level at which at least five specimens pass.", sourceId: "nasa-std-6001b" },
    ],
    pillars: ["controls"],
    topics: ["flammability-limits"],
    gravity: ["1g"],
    conditions: { fuels: ["Any candidate spacecraft material"], note: "An acceptance test, not a fire-spread prediction." },
    environments: [
      { id: "spacecraft", basis: "transferable", note: "Applied to all crewed vehicles. Flight experiments show it is not conservative in microgravity." },
      { id: "station", basis: "transferable", note: "Applied to all crewed vehicles. Flight experiments show it is not conservative in microgravity." },
      { id: "lunar-base", basis: "transferable", note: "No partial-gravity acceptance test exists in the standard." },
      { id: "mars-base", basis: "transferable", note: "No partial-gravity acceptance test exists in the standard." },
      { id: "rover", basis: "transferable", note: "No partial-gravity acceptance test exists in the standard." },
    ],
    modelUse: ["Defines the Earth-gravity limits the model starts from before applying microgravity margins."],
    controlsUse: ["The primary fire-prevention control: material selection by test."],
    holdings: [{ kind: "summary", label: "Test definitions and pass criteria" }],
    links: { psi: [], ntrs: [], sources: ["nasa-std-6001b"] },
  },
  {
    id: "iss-fire-detection-suppression",
    name: "ISS fire detection and suppression system",
    title: "ISS U.S. fire detection and suppression system",
    kind: "flight-system",
    organization: "NASA",
    platform: "International Space Station, U.S. segment",
    period: "Described 2001",
    summary:
      "How the ISS detects and responds to a fire: smoke detectors in the ventilation ducts, power and ventilation isolation, and a portable CO₂ extinguisher.",
    findings: [
      { text: "Photoelectric smoke detectors sit on the ventilation filter intake ducts; alarms use the scattering photodiode.", sourceId: "iss-fds-2001" },
      { text: "Alarm response: remove power to racks, then isolate the module by shutting intermodule ventilation valves and cabin fans.", sourceId: "iss-fds-2001" },
      { text: "The portable extinguisher holds 6 lb of CO₂, discharged in 45 s, about 3 lb in the first 10 s.", sourceId: "iss-fds-2001" },
      { text: "Rack oxygen falls below 10.5% within one minute of suppression.", sourceId: "iss-fds-2001" },
    ],
    pillars: ["controls", "crew-environments"],
    topics: ["detection", "suppression"],
    gravity: ["0g"],
    conditions: { pressureKpa: [98.3, 98.6], fuels: ["Rack and cabin fire scenarios"], note: "Typical ISS oxygen slightly below 24%; pressure controlled near 14.25–14.3 psia." },
    environments: [
      { id: "station", basis: "applies", note: "The operating system on the ISS." },
      { id: "spacecraft", basis: "transferable", note: "Same detection principle; smaller volumes change agent concentrations." },
      { id: "lunar-base", basis: "transferable", note: "Duct-mounted detection assumes forced flow carries the smoke; partial gravity adds a plume." },
      { id: "mars-base", basis: "transferable", note: "Duct-mounted detection assumes forced flow carries the smoke; partial gravity adds a plume." },
      { id: "rover", basis: "transferable", note: "CO₂ discharge in a small cabin exceeds breathable limits quickly." },
    ],
    modelUse: ["CO₂ extinguisher mass and discharge profile.", "The automatic response sequence: power removal, then ventilation isolation.", "Detector location in the ventilation return."],
    controlsUse: ["The baseline that next-generation systems are measured against."],
    holdings: [{ kind: "summary", label: "System description" }],
    links: { psi: [], ntrs: ["20030053429"], sources: ["iss-fds-2001"] },
  },
  {
    id: "fine-water-mist",
    name: "Fine water mist extinguisher",
    title: "ISS fine water mist portable fire extinguisher",
    kind: "flight-system",
    organization: "NASA Johnson Space Center",
    platform: "Qualification testing for the ISS",
    period: "2013",
    summary:
      "The water-mist extinguisher developed to replace CO₂ on the ISS, and the fire scenarios it was qualified against.",
    findings: [
      { text: "CO₂ discharge creates an unsafe breathing environment because the crew masks do not filter CO₂.", sourceId: "fwm-pfe" },
      { text: "Open-cabin standard fire extinguished in 1 s on average over 16 tests; an enclosed rack took about 60 s.", sourceId: "fwm-pfe" },
      { text: "Qualification scenarios: rack, open cabin, lithium-ion battery, elevated oxygen and oxygen candle.", sourceId: "fwm-pfe" },
      { text: "The extinguisher carries 6 lb of water and 1.2 lb of nitrogen.", sourceId: "fwm-pfe" },
    ],
    pillars: ["controls"],
    topics: ["suppression"],
    gravity: ["1g"],
    conditions: {
      fuels: ["Standard test fires, including lithium-ion batteries"],
      note: "Elevated-oxygen tests at 24–30% O₂ and 10.2 psia. Extinction times belong to the tested configurations.",
    },
    environments: [
      { id: "station", basis: "applies", note: "Qualified for ISS fire scenarios in ground tests." },
      { id: "spacecraft", basis: "transferable", note: "Same agent; enclosure geometry sets how much mist reaches the fire." },
      { id: "lunar-base", basis: "transferable", note: "Elevated-oxygen tests cover candidate cabin atmospheres; droplet transport in partial gravity was not tested." },
      { id: "mars-base", basis: "transferable", note: "Elevated-oxygen tests cover candidate cabin atmospheres; droplet transport in partial gravity was not tested." },
      { id: "rover", basis: "transferable", note: "Water mist avoids the CO₂ breathing hazard, which is most acute in a small cabin." },
    ],
    modelUse: ["Water charge of the extinguisher.", "The lithium-ion battery scenario as an ignition source."],
    controlsUse: ["An agent that does not poison a small cabin, qualified against battery and elevated-oxygen fires."],
    holdings: [{ kind: "summary", label: "Qualification results" }],
    links: { psi: [], ntrs: ["20130011664"], sources: ["fwm-pfe"] },
  },
  {
    id: "cabin-atmosphere-limits",
    name: "Cabin atmosphere limits",
    title: "Exposure limits for combustion products in spacecraft cabins",
    kind: "standard",
    organization: "NASA Office of the Chief Health and Medical Officer; NASA Johnson Space Center",
    platform: "Applies to all crewed vehicles",
    period: "Current revisions, 2026",
    summary:
      "The limits a fire's combustion products are judged against: carbon dioxide in NASA-STD-3001 and carbon monoxide in the spacecraft maximum allowable concentrations.",
    findings: [
      { text: "CO₂: a nominal one-hour average total partial pressure of no more than 3 mmHg. It is not an instantaneous emergency threshold.", sourceId: "nasa-std-3001" },
      { text: "CO limits depend on exposure duration; an instantaneous reading does not establish a violation.", sourceId: "jsc-smac" },
      { text: "The Saffire VI analysis used CO limits of 425 ppm for one hour and 100 ppm for 24 hours.", sourceId: "saffire-vi" },
    ],
    pillars: ["controls", "crew-environments"],
    topics: ["atmosphere-limits"],
    gravity: ["0g", "lunar", "mars"],
    conditions: { fuels: ["Not material-specific"], note: "Exposure standards, independent of gravity." },
    environments: [
      { id: "spacecraft", basis: "applies", note: "Applies directly." },
      { id: "station", basis: "applies", note: "Applies directly." },
      { id: "lunar-base", basis: "applies", note: "Applies directly." },
      { id: "mars-base", basis: "applies", note: "Applies directly." },
      { id: "rover", basis: "applies", note: "Applies directly; a small free volume reaches a limit sooner." },
    ],
    modelUse: ["Reference lines for the modeled CO and CO₂ histories."],
    controlsUse: ["Defines when a cabin is habitable again after a fire, and so the capacity required of atmosphere cleanup."],
    holdings: [{ kind: "summary", label: "Limit values and their averaging times" }],
    links: { psi: [], ntrs: [], sources: ["nasa-std-3001", "jsc-smac"] },
  },
];

export function investigationById(id: string): InvestigationRecord | null {
  return INVESTIGATIONS.find((item) => item.id === id) ?? null;
}

export function investigationsForPillar(pillar: Pillar): InvestigationRecord[] {
  return INVESTIGATIONS.filter((item) => item.pillars.includes(pillar));
}

export function investigationsForEnvironment(environment: CrewEnvironment, basis?: EnvironmentLink["basis"]): InvestigationRecord[] {
  return INVESTIGATIONS.filter((item) => item.environments.some((link) => link.id === environment && (!basis || link.basis === basis)));
}

/** Records whose tests included a gravity regime and a topic. An empty cell means none is indexed here, not that none exists. */
export function coverageCell(topic: Topic, gravity: GravityRegime): InvestigationRecord[] {
  return INVESTIGATIONS.filter((item) => item.kind !== "standard" && item.topics.includes(topic) && item.gravity.includes(gravity));
}

export function psiUrl(psiId: string): string {
  return `https://psi.nasa.gov/physci/repo/data/investigations/${psiId}`;
}

export function ntrsUrl(ntrsId: string): string {
  return `https://ntrs.nasa.gov/citations/${ntrsId}`;
}

export const RESEARCH_INDEX_SUMMARY = {
  investigations: INVESTIGATIONS.length,
  flightExperiments: INVESTIGATIONS.filter((item) => item.kind === "flight-experiment").length,
  psiTables: new Set(INVESTIGATIONS.flatMap((item) => item.links.psi)).size,
  partialGravity: INVESTIGATIONS.filter((item) => item.kind !== "standard" && (item.gravity.includes("lunar") || item.gravity.includes("mars"))).length,
};
