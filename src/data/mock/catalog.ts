import type {
  EquipmentId,
  EvidenceSource,
  FuelCategory,
  FuelMaterial,
  Investigation,
  MeasurementType,
  ResearchFinding,
  ResearchObjective,
  Sensor,
} from "@/types/domain";

const FAMILY_NOTE =
  "The investigation family name is a public NASA program label used only as a category. This dossier, its runs, and its numbers are synthetic demonstration records. No DOI or official citation is attached.";

export interface InvestigationDraft {
  id: string;
  family: string;
  title: string;
  description: string;
  researchObjectives: ResearchObjective[];
  fuelCategories: FuelCategory[];
  fuelMaterials: string[];
  hardware: string[];
  measurementTypes: MeasurementType[];
  relatedSafetyApplications: string[];
  equipmentLinks: EquipmentId[];
}

function source(draft: InvestigationDraft): EvidenceSource {
  return {
    id: `SYN-SRC-${draft.id}`,
    kind: "synthetic-dossier",
    familyLabel: draft.family,
    citation: null,
    doi: null,
    note: "No DOI is assigned. This record is not a NASA data product.",
  };
}

function finding(
  draft: InvestigationDraft,
  index: number,
  statement: string,
): ResearchFinding {
  return {
    id: `${draft.id}-finding-${index}`,
    investigationId: draft.id,
    statement,
    synthetic: true,
    limitations:
      "Statement describes the synthetic dossier only. It is not an official NASA finding and it is not a safety conclusion.",
  };
}

const DRAFTS: InvestigationDraft[] = [
  {
    id: "syn-inv-bass-01",
    family: "BASS",
    title: "Solid flame-spread baselines",
    description:
      "Synthetic dossier organized under the Burning and Suppression of Solids family. Flat coupons and strips are compared across oxygen, pressure, and a microgravity-versus-Earth gravity pair.",
    researchObjectives: ["solid-material-flammability", "flame-spread"],
    fuelCategories: ["solid-polymer", "solid-fabric"],
    fuelMaterials: ["PMMA", "cotton fabric", "meta-aramid fabric"],
    hardware: ["sample card holder", "forced-flow duct"],
    measurementTypes: ["flame-spread-rate", "mass-loss-rate", "burn-duration"],
    relatedSafetyApplications: [
      "Habitat material screening scenarios, not a certification test",
    ],
    equipmentLinks: ["material-storage", "living-quarters"],
  },
  {
    id: "syn-inv-bass-02",
    family: "BASS",
    title: "Oxygen series on solid polymers",
    description:
      "Synthetic oxygen sweep for solid polymers under the BASS family label. Used to show how oxygen similarity moves rankings when the mission atmosphere changes.",
    researchObjectives: [
      "solid-material-flammability",
      "oxygen-enriched-atmospheres",
    ],
    fuelCategories: ["solid-polymer"],
    fuelMaterials: ["PMMA", "UHMWPE"],
    hardware: ["sample card holder", "oxygen sensor stand-in"],
    measurementTypes: [
      "flame-spread-rate",
      "mass-loss-rate",
      "extinction-limit-oxygen",
    ],
    relatedSafetyApplications: [
      "Oxygen-enriched atmosphere questions for a scenario cabin",
    ],
    equipmentLinks: ["material-storage", "airlock-oxygen"],
  },
  {
    id: "syn-inv-bass2-01",
    family: "BASS-II",
    title: "Sample geometry and opposed flow",
    description:
      "Synthetic BASS-II dossier varying coupon, rod, and edge geometry under low forced flow. Geometry is metadata, not a flame-shape prediction.",
    researchObjectives: ["flame-spread", "solid-material-flammability"],
    fuelCategories: ["solid-polymer"],
    fuelMaterials: ["PMMA"],
    hardware: ["sample card holder", "forced-flow duct"],
    measurementTypes: ["flame-spread-rate", "flame-standoff", "burn-duration"],
    relatedSafetyApplications: ["Material geometry questions in stowage"],
    equipmentLinks: ["material-storage", "ventilation"],
  },
  {
    id: "syn-inv-bass2-02",
    family: "BASS-II",
    title: "Fabric and polymer comparison",
    description:
      "Synthetic comparison of cotton and meta-aramid fabric strips against PMMA coupons. Supports fabric-focused mission scenarios such as the Martian habitat journey.",
    researchObjectives: ["flame-spread", "solid-material-flammability"],
    fuelCategories: ["solid-fabric", "solid-polymer"],
    fuelMaterials: ["cotton fabric", "meta-aramid fabric", "PMMA"],
    hardware: ["sample card holder"],
    measurementTypes: ["flame-spread-rate", "mass-loss-rate", "burn-duration"],
    relatedSafetyApplications: ["Soft-goods screening scenarios"],
    equipmentLinks: ["material-storage", "living-quarters"],
  },
  {
    id: "syn-inv-flex-01",
    family: "FLEX",
    title: "Droplet extinction limits",
    description:
      "Synthetic dossier under the Flame Extinguishment Experiment family. Droplet burns carry an extinction-limit marker that is explicitly a generated index.",
    researchObjectives: ["extinction-suppression", "droplet-combustion"],
    fuelCategories: ["liquid-droplet"],
    fuelMaterials: ["n-heptane droplet"],
    hardware: ["droplet deployment needle", "radiometer stand-in"],
    measurementTypes: [
      "extinction-limit-oxygen",
      "burn-duration",
      "flame-standoff",
    ],
    relatedSafetyApplications: [
      "Suppression-research questions, not an extinguisher rating",
    ],
    equipmentLinks: ["fire-suppression", "laboratory"],
  },
  {
    id: "syn-inv-flex-02",
    family: "FLEX",
    title: "Pressure series for droplet burns",
    description:
      "Synthetic pressure sweep for heptane droplets. Includes one run with pressure left unreported so missing metadata stays visible.",
    researchObjectives: ["droplet-combustion"],
    fuelCategories: ["liquid-droplet"],
    fuelMaterials: ["n-heptane droplet"],
    hardware: ["droplet deployment needle", "pressure transducer stand-in"],
    measurementTypes: ["burn-duration", "flame-standoff"],
    relatedSafetyApplications: ["Cabin-pressure scenario comparisons"],
    equipmentLinks: ["fire-suppression", "airlock-oxygen"],
  },
  {
    id: "syn-inv-flex2-01",
    family: "FLEX-2",
    title: "Soot index on droplet burns",
    description:
      "Synthetic FLEX-2 dossier tracking a soot index. The index is unitless demonstration data, not a flight soot measurement.",
    researchObjectives: ["droplet-combustion"],
    fuelCategories: ["liquid-droplet"],
    fuelMaterials: ["n-heptane droplet"],
    hardware: ["radiometer stand-in", "imaging stand-in"],
    measurementTypes: ["soot-volume-fraction", "burn-duration", "flame-standoff"],
    relatedSafetyApplications: ["Soot-related suppression questions"],
    equipmentLinks: ["fire-suppression", "laboratory"],
  },
  {
    id: "syn-inv-flex2-02",
    family: "FLEX-2",
    title: "Suppression-screening markers",
    description:
      "Synthetic screening records for extinction markers under the FLEX-2 family label. No suppressant is certified by these rows.",
    researchObjectives: ["extinction-suppression"],
    fuelCategories: ["liquid-droplet"],
    fuelMaterials: ["n-heptane droplet"],
    hardware: ["droplet deployment needle"],
    measurementTypes: ["extinction-limit-oxygen", "burn-duration"],
    relatedSafetyApplications: ["Suppression evidence inventory"],
    equipmentLinks: ["fire-suppression"],
  },
  {
    id: "syn-inv-acme-bre",
    family: "ACME",
    title: "Burning-rate emulator stand-in",
    description:
      "Synthetic records grouped with the ACME Burning Rate Emulator family. Spread and mass-loss values illustrate oxygen sensitivity inside this dossier only.",
    researchObjectives: ["solid-material-flammability"],
    fuelCategories: ["solid-polymer"],
    fuelMaterials: ["PMMA"],
    hardware: ["burning-rate emulator stand-in"],
    measurementTypes: ["flame-spread-rate", "mass-loss-rate"],
    relatedSafetyApplications: ["Solid-fuel scenario comparisons"],
    equipmentLinks: ["laboratory", "material-storage"],
  },
  {
    id: "syn-inv-acme-fd",
    family: "ACME",
    title: "Flame-design geometry notes",
    description:
      "Synthetic ACME Flame Design dossier. Standoff is recorded as a length in the mock instrument frame, not a predicted flame shape for the habitat.",
    researchObjectives: ["flame-spread"],
    fuelCategories: ["solid-polymer"],
    fuelMaterials: ["PMMA"],
    hardware: ["imaging stand-in", "forced-flow duct"],
    measurementTypes: ["flame-spread-rate", "flame-standoff"],
    relatedSafetyApplications: ["Flow-conditioned material questions"],
    equipmentLinks: ["laboratory", "ventilation"],
  },
  {
    id: "syn-inv-acme-cl",
    family: "ACME",
    title: "Cool-flame duration markers",
    description:
      "Synthetic cool-flame duration records under the ACME family label. Duration is not translated into a habitat ignition time.",
    researchObjectives: ["droplet-combustion"],
    fuelCategories: ["liquid-droplet"],
    fuelMaterials: ["n-heptane droplet"],
    hardware: ["radiometer stand-in"],
    measurementTypes: ["burn-duration", "flame-standoff"],
    relatedSafetyApplications: ["Droplet-combustion evidence inventory"],
    equipmentLinks: ["laboratory"],
  },
  {
    id: "syn-inv-same-01",
    family: "SAME",
    title: "Smoke particle size records",
    description:
      "Synthetic Smoke Aerosol Measurement Experiment dossier. Particle diameter and number density are generated values for detector questions.",
    researchObjectives: ["smoke-detection", "detector-aerosol"],
    fuelCategories: ["aerosol-smoke"],
    fuelMaterials: ["synthetic smoke aerosol"],
    hardware: ["optical particle counter stand-in"],
    measurementTypes: [
      "smoke-particle-diameter",
      "smoke-number-density",
      "detector-response",
    ],
    relatedSafetyApplications: ["Smoke-detection scenario matching"],
    equipmentLinks: ["smoke-detection", "living-quarters"],
  },
  {
    id: "syn-inv-same-02",
    family: "SAME",
    title: "Detector response envelopes",
    description:
      "Synthetic SAME dossier focused on detector-response arbitrary units across airflow setpoints.",
    researchObjectives: ["smoke-detection"],
    fuelCategories: ["aerosol-smoke"],
    fuelMaterials: ["synthetic smoke aerosol"],
    hardware: ["smoke detector head stand-in", "forced-flow duct"],
    measurementTypes: ["detector-response", "smoke-number-density"],
    relatedSafetyApplications: ["Detector placement questions"],
    equipmentLinks: ["smoke-detection", "ventilation"],
  },
  {
    id: "syn-inv-samer-01",
    family: "SAME-R",
    title: "Refined aerosol characterization",
    description:
      "Synthetic SAME-R dossier with a tighter particle-size series. One run leaves oxygen unreported on purpose.",
    researchObjectives: ["detector-aerosol", "smoke-detection"],
    fuelCategories: ["aerosol-smoke"],
    fuelMaterials: ["synthetic smoke aerosol"],
    hardware: ["optical particle counter stand-in"],
    measurementTypes: ["smoke-particle-diameter", "smoke-number-density"],
    relatedSafetyApplications: ["Aerosol evidence inventory"],
    equipmentLinks: ["smoke-detection", "laboratory"],
  },
  {
    id: "syn-inv-daft-01",
    family: "DAFT",
    title: "Detector challenge aerosols",
    description:
      "Synthetic DAFT dossier of detector challenge aerosols in microgravity and Earth gravity. Response values are arbitrary units.",
    researchObjectives: ["smoke-detection", "detector-aerosol"],
    fuelCategories: ["aerosol-smoke"],
    fuelMaterials: ["synthetic smoke aerosol"],
    hardware: ["smoke detector head stand-in"],
    measurementTypes: ["detector-response", "smoke-particle-diameter"],
    relatedSafetyApplications: ["Detector technology comparisons"],
    equipmentLinks: ["smoke-detection"],
  },
  {
    id: "syn-inv-daft2-01",
    family: "DAFT-2",
    title: "Flow-conditioned detection",
    description:
      "Synthetic DAFT-2 dossier crossing detector response with duct velocity. Supports the ventilation and smoke-detection hotspots.",
    researchObjectives: ["smoke-detection", "detector-aerosol"],
    fuelCategories: ["aerosol-smoke"],
    fuelMaterials: ["synthetic smoke aerosol"],
    hardware: ["forced-flow duct", "smoke detector head stand-in"],
    measurementTypes: [
      "detector-response",
      "smoke-number-density",
      "smoke-particle-diameter",
    ],
    relatedSafetyApplications: ["Airflow effects on detection scenarios"],
    equipmentLinks: ["smoke-detection", "ventilation"],
  },
  {
    id: "syn-inv-spice-01",
    family: "SPICE",
    title: "Smoke-point oxygen notes",
    description:
      "Synthetic SPICE dossier relating a soot index to oxygen for polymer coupons and a few droplets. Not a smoke-point standard.",
    researchObjectives: ["flame-spread"],
    fuelCategories: ["solid-polymer", "liquid-droplet"],
    fuelMaterials: ["PMMA", "n-heptane droplet"],
    hardware: ["imaging stand-in", "forced-flow duct"],
    measurementTypes: ["soot-volume-fraction", "flame-spread-rate"],
    relatedSafetyApplications: ["Soot and spread evidence inventory"],
    equipmentLinks: ["laboratory", "ventilation"],
  },
  {
    id: "syn-inv-slice-01",
    family: "SLICE",
    title: "Liftoff and stabilization markers",
    description:
      "Synthetic SLICE dossier of standoff and spread markers under forced flow. Standoff is not a habitat flame-geometry forecast.",
    researchObjectives: ["flame-spread"],
    fuelCategories: ["solid-polymer"],
    fuelMaterials: ["PMMA"],
    hardware: ["forced-flow duct", "imaging stand-in"],
    measurementTypes: ["flame-standoff", "flame-spread-rate"],
    relatedSafetyApplications: ["Ventilation-conditioned material questions"],
    equipmentLinks: ["ventilation", "laboratory"],
  },
  {
    id: "syn-inv-acme-efield",
    family: "ACME",
    title: "Electric-field flame markers",
    description:
      "Synthetic ACME electric-field series. Included so the catalog has a thin, weakly matched droplet set with incomplete sensor notes.",
    researchObjectives: ["droplet-combustion"],
    fuelCategories: ["liquid-droplet"],
    fuelMaterials: ["n-heptane droplet"],
    hardware: ["electrode stand-in", "imaging stand-in"],
    measurementTypes: ["flame-standoff", "burn-duration"],
    relatedSafetyApplications: ["Sparse droplet evidence"],
    equipmentLinks: ["laboratory"],
  },
  {
    id: "syn-inv-ground-01",
    family: "Ground reference",
    title: "Earth-gravity solid reference",
    description:
      "Synthetic 1 g companion dossier for polymers, a composite coupon, and cellulose. It is not a standards-lab flammability report.",
    researchObjectives: [
      "solid-material-flammability",
      "habitat-fire-safety",
    ],
    fuelCategories: ["solid-polymer", "solid-composite", "paper-cellulose"],
    fuelMaterials: ["PMMA", "fiberglass-epoxy coupon", "cellulose sheet"],
    hardware: ["sample card holder"],
    measurementTypes: ["flame-spread-rate", "mass-loss-rate", "burn-duration"],
    relatedSafetyApplications: ["Earth reference for scenario comparison"],
    equipmentLinks: ["material-storage", "laboratory"],
  },
];

export const FUELS: FuelMaterial[] = [
  {
    id: "fuel-pmma",
    name: "PMMA",
    category: "solid-polymer",
    notes: "Demonstration polymer coupon. Not a qualified spacecraft material.",
  },
  {
    id: "fuel-uhmwpe",
    name: "UHMWPE",
    category: "solid-polymer",
    notes: "Demonstration polymer. Synthetic runs only.",
  },
  {
    id: "fuel-cotton",
    name: "Cotton fabric",
    category: "solid-fabric",
    notes: "Demonstration soft good.",
  },
  {
    id: "fuel-aramid",
    name: "Meta-aramid fabric",
    category: "solid-fabric",
    notes: "Generic fabric class. Not a certified garment test.",
  },
  {
    id: "fuel-composite",
    name: "Fiberglass-epoxy coupon",
    category: "solid-composite",
    notes: "Sparse composite class used to surface an underrepresented fuel.",
  },
  {
    id: "fuel-cellulose",
    name: "Cellulose sheet",
    category: "paper-cellulose",
    notes: "Sparse cellulose class.",
  },
  {
    id: "fuel-heptane",
    name: "n-Heptane droplet",
    category: "liquid-droplet",
    notes: "Demonstration droplet fuel.",
  },
  {
    id: "fuel-aerosol",
    name: "Synthetic smoke aerosol",
    category: "aerosol-smoke",
    notes: "Generated aerosol challenge. Not a spacecraft smoke event.",
  },
];

export const SENSORS: Sensor[] = [
  {
    id: "SYN-SEN-VIDEO",
    name: "Imaging stand-in",
    measures: ["flame-spread-rate", "flame-standoff", "burn-duration"],
    synthetic: true,
    note: "Placeholder instrument. Not flight hardware.",
  },
  {
    id: "SYN-SEN-SCALE",
    name: "Mass-loss stand-in",
    measures: ["mass-loss-rate"],
    synthetic: true,
    note: "Placeholder instrument. Not flight hardware.",
  },
  {
    id: "SYN-SEN-OPTICAL",
    name: "Optical particle counter stand-in",
    measures: ["smoke-particle-diameter", "smoke-number-density"],
    synthetic: true,
    note: "Placeholder instrument. Not flight hardware.",
  },
  {
    id: "SYN-SEN-DETECTOR",
    name: "Smoke detector head stand-in",
    measures: ["detector-response"],
    synthetic: true,
    note: "Arbitrary-unit response. Not a qualified detector.",
  },
  {
    id: "SYN-SEN-RADIO",
    name: "Radiometer stand-in",
    measures: ["soot-volume-fraction", "extinction-limit-oxygen"],
    synthetic: true,
    note: "Placeholder instrument. Not flight hardware.",
  },
];

export function investigationFromDraft(draft: InvestigationDraft): Omit<
  Investigation,
  "gravityConditions"
> & { gravityConditions: Investigation["gravityConditions"] } {
  return {
    ...draft,
    gravityConditions: [],
    sourceStatus: "synthetic-dossier",
    dataOrigin: "synthetic-demonstration",
    officialNameNote: FAMILY_NOTE,
    findings: [
      finding(
        draft,
        1,
        `Inside ${draft.id}, records with higher reported oxygen tend to carry higher spread or response values than the 21% rows in the same dossier. That pattern is baked into the generator.`,
      ),
      finding(
        draft,
        2,
        `Gravity in ${draft.id} is only microgravity or Earth. No lunar or Martian row exists, so the dossier cannot establish partial-gravity behavior.`,
      ),
    ],
    evidenceSource: source(draft),
  };
}

export const INVESTIGATION_DRAFTS = DRAFTS;
export { FAMILY_NOTE };
