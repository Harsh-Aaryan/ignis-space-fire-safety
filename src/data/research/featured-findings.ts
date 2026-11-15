import { FIRE_SOURCES, type FireSource } from "@/data/fire/sources";
import {
  investigationById,
  ntrsUrl,
  psiUrl,
  type CrewEnvironment,
  type Finding,
  type GravityRegime,
  type InvestigationRecord,
  type Topic,
} from "@/data/research/investigations";

/**
 * Research content for the opening screen.
 *
 * A featured finding is a pointer into the research index: a record id, the
 * position of one of its findings, and the position of one of the record's own
 * statements of what that means for controls or for the model. The page shows
 * the record's text as written, so a featured finding can only say what the
 * index already says.
 */

export type ImplicationField = "controlsUse" | "modelUse";

export interface FeaturedFindingRef {
  recordId: string;
  /** Index into the record's `findings`. */
  finding: number;
  /** Index into the record's `controlsUse` or `modelUse`. */
  implication: { field: ImplicationField; index: number };
}

export const FEATURED_FINDINGS: readonly FeaturedFindingRef[] = [
  // Far-field smoke alarm at 981 s, after most hazardous gas was released: detector placement.
  { recordId: "saffire-vi", finding: 1, implication: { field: "controlsUse", index: 0 } },
  // Acrylic burned at 13.6% O2 in microgravity, below its 16% Earth-gravity limit: ground screening is not conservative.
  { recordId: "bass-ii", finding: 0, implication: { field: "controlsUse", index: 0 } },
  // Partial gravity may be worse than 0 g or 1 g: limits qualified elsewhere may not bound the Moon or Mars.
  { recordId: "lunar-martian-flammability", finding: 2, implication: { field: "controlsUse", index: 0 } },
];

export const IMPLICATION_LABEL: Record<ImplicationField, string> = {
  controlsUse: "Implication for crew safety",
  modelUse: "How the IGNIS model uses it",
};

export interface SourceLink {
  kind: "ntrs" | "psi";
  label: string;
  href: string;
}

export interface ResolvedFeaturedFinding {
  ref: FeaturedFindingRef;
  record: InvestigationRecord;
  finding: Finding;
  implication: string;
  /** The document the finding was read from, in the fire-model source registry. */
  source: FireSource | null;
  /** The NASA records behind it: the NTRS citation of the source first, then the record's PSI tables. */
  links: SourceLink[];
}

/** The links worth showing beside a finding: the cited NTRS record and the first NASA experiment table. */
export function primaryLinks(links: SourceLink[]): SourceLink[] {
  const ntrs = links.find((link) => link.kind === "ntrs");
  const psi = links.find((link) => link.kind === "psi");
  return [ntrs, psi].filter((link): link is SourceLink => !!link);
}

/** Resolves a pointer against the research index. Null when any part of it does not exist. */
export function resolveFeaturedFinding(ref: FeaturedFindingRef): ResolvedFeaturedFinding | null {
  const record = investigationById(ref.recordId);
  if (!record) return null;
  const finding = record.findings[ref.finding];
  const implication = record[ref.implication.field][ref.implication.index];
  if (!finding || !implication) return null;
  const source = finding.sourceId ? (FIRE_SOURCES.find((item) => item.id === finding.sourceId) ?? null) : null;
  const ntrs = [...record.links.ntrs].sort(
    (a, b) => Number(ntrsUrl(b) === source?.url) - Number(ntrsUrl(a) === source?.url),
  );
  return {
    ref,
    record,
    finding,
    implication,
    source,
    links: [
      ...ntrs.map((id) => ({ kind: "ntrs" as const, label: `NTRS ${id}`, href: ntrsUrl(id) })),
      ...record.links.psi.map((id) => ({ kind: "psi" as const, label: id, href: psiUrl(id) })),
    ],
  };
}

export function featuredFindings(refs: readonly FeaturedFindingRef[] = FEATURED_FINDINGS): ResolvedFeaturedFinding[] {
  return refs.flatMap((ref) => {
    const resolved = resolveFeaturedFinding(ref);
    return resolved ? [resolved] : [];
  });
}

/**
 * Example research questions. Each opens the investigations with filters the
 * research index already defines, so every example lands on matching records.
 */
export interface ExampleQuestion {
  label: string;
  environment?: CrewEnvironment;
  topic?: Topic;
  gravity?: GravityRegime;
  query?: string;
}

export const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  { label: "Fire detection in lunar habitats", environment: "lunar-base", topic: "detection" },
  { label: "Oxygen limits at reduced pressure", query: "pressure" },
  { label: "Suppression in microgravity", gravity: "0g", topic: "suppression" },
];
