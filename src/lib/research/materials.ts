import type { InvestigationRecord } from "@/data/research/investigations";

/**
 * Material and specimen-geometry vocabulary for matching a question or a cabin against the research index.
 *
 * A record's materials are read from its tested fuels (record.conditions.fuels); its specimen
 * geometry is derived from the words its fuels, conditions note, summary and findings use
 * ("film", "slab", "rod", "wire", "droplet"). Both are derived from the index text, not added data.
 */

export type SpecimenGeometry = "thin" | "thick" | "wire" | "droplet" | "gas";

export interface MaterialTerm {
  /** Lower-case key, stable: used in URLs and in ResearchQuestion.materials. */
  id: string;
  label: string;
  /** Matches the material in a record's tested-fuel list. */
  fuel: RegExp;
  /** Matches the material in a typed question. */
  words: RegExp;
  /** Fire-model material ids (src/data/fire/materials.ts) that are this material. */
  fireMaterialIds: string[];
}

export const MATERIAL_TERMS: MaterialTerm[] = [
  { id: "pmma", label: "PMMA (acrylic)", fuel: /pmma|acrylic/i, words: /\b(pmma|acrylic|plexiglas\w*)\b/i, fireMaterialIds: ["pmma"] },
  { id: "sibal", label: "SIBAL (cotton–fiberglass fabric)", fuel: /sibal|cotton/i, words: /\b(sibal|cotton\w*)\b/i, fireMaterialIds: ["sibal"] },
  { id: "nomex", label: "Nomex", fuel: /nomex/i, words: /\b(nomex|aramid)\b/i, fireMaterialIds: ["nomex"] },
  { id: "kapton", label: "Kapton (polyimide)", fuel: /kapton|polyimide/i, words: /\b(kapton|polyimide)\b/i, fireMaterialIds: ["kapton"] },
  { id: "teflon", label: "Teflon (PTFE)", fuel: /teflon|ptfe/i, words: /\b(teflon|ptfe)\b/i, fireMaterialIds: ["ptfe"] },
  { id: "silicone", label: "Silicone", fuel: /silicone/i, words: /\bsilicone\w*\b/i, fireMaterialIds: ["silicone"] },
  { id: "ultem", label: "Ultem (PEI)", fuel: /ultem|\bpei\b/i, words: /\b(ultem|pei|polyetherimide)\b/i, fireMaterialIds: ["pei"] },
  { id: "mylar", label: "Mylar (PET film)", fuel: /mylar|\bpet\b/i, words: /\b(mylar|pet film|melinex)\b/i, fireMaterialIds: [] },
  { id: "wire", label: "Wire insulation", fuel: /wire|ldpe|polyethylene/i, words: /\b(wire|wires|wiring|insulation|ldpe|polyethylene|cable\w*)\b/i, fireMaterialIds: ["ldpe-wire"] },
  { id: "cellulose", label: "Cellulose (paper, wick)", fuel: /cellulose|kimwipe|paper|wick/i, words: /\b(cellulose|paper|kimwipe\w*|tissue)\b/i, fireMaterialIds: ["paper"] },
  { id: "pyrell", label: "Pyrell foam", fuel: /pyrell/i, words: /\b(pyrell|foam)\b/i, fireMaterialIds: ["pyrell"] },
  { id: "nylon", label: "Nylon", fuel: /nylon/i, words: /\b(nylon|polyamide)\b/i, fireMaterialIds: ["nylon"] },
  { id: "epoxy", label: "Epoxy / glass", fuel: /epoxy/i, words: /\b(epoxy|g-11|circuit board\w*)\b/i, fireMaterialIds: ["epoxy-glass"] },
  { id: "droplet", label: "Liquid fuel droplets", fuel: /droplet|heptane|methanol/i, words: /\b(droplet\w*|heptane|methanol|liquid fuel\w*)\b/i, fireMaterialIds: [] },
  { id: "battery", label: "Lithium-ion batteries", fuel: /battery|batteries|lithium/i, words: /\b(battery|batteries|lithium)\b/i, fireMaterialIds: [] },
];

export function materialTerm(id: string): MaterialTerm | null {
  return MATERIAL_TERMS.find((term) => term.id === id) ?? null;
}

/** The material key for a fire-model material id, e.g. "ptfe" -> "teflon". */
export function materialForFireMaterial(fireMaterialId: string): MaterialTerm | null {
  return MATERIAL_TERMS.find((term) => term.fireMaterialIds.includes(fireMaterialId)) ?? null;
}

/** Fuel lists that name no specific material ("Any candidate spacecraft material", "Not material-specific"). */
const GENERIC_FUEL = /^(any|not material|solid spacecraft materials|spacecraft materials|rack and cabin|saffire iv|gaseous fuels)/i;

export function hasSpecificFuels(record: InvestigationRecord): boolean {
  return record.conditions.fuels.some((fuel) => !GENERIC_FUEL.test(fuel.trim()));
}

/** Tested fuels of a record that are this material. */
export function fuelsMatching(record: InvestigationRecord, term: MaterialTerm): string[] {
  return record.conditions.fuels.filter((fuel) => term.fuel.test(fuel));
}

/** Material keys a record tested, from its fuel list. */
export function recordMaterials(record: InvestigationRecord): MaterialTerm[] {
  return MATERIAL_TERMS.filter((term) => fuelsMatching(record, term).length > 0);
}

export const GEOMETRY_LABEL: Record<SpecimenGeometry, string> = {
  thin: "Thin (fabric, film, sheet)",
  thick: "Thick (slab, rod, sphere)",
  wire: "Wire",
  droplet: "Droplet",
  gas: "Gas burner",
};

export const GEOMETRY_SHORT: Record<SpecimenGeometry, string> = {
  thin: "thin",
  thick: "thick",
  wire: "wire",
  droplet: "droplet",
  gas: "gas-burner",
};

const GEOMETRY_PATTERNS: Array<[SpecimenGeometry, RegExp]> = [
  ["thin", /\b(films?|fabrics?|sibal|kimwipes?|paper|cloth|thin|nomex|mylar)\b/i],
  ["thick", /\b(slabs?|rods?|spheres?|thick|blocks?|candles?)\b/i],
  ["wire", /\b(wires?|cables?)\b/i],
  ["droplet", /\bdroplets?\b/i],
  ["gas", /\b(gaseous fuels?|gas burner|burner)\b/i],
];

/** Specimen geometries a record's own text names. Derived; empty when the record does not say. */
export function recordGeometry(record: InvestigationRecord): SpecimenGeometry[] {
  const text = [...record.conditions.fuels, record.conditions.note ?? "", record.summary, ...record.findings.map((finding) => finding.text)].join(" ");
  return GEOMETRY_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([geometry]) => geometry);
}

/** Lists items as "a", "a and b", "a, b and c". */
export function listJoin(items: string[], conjunction = "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}
