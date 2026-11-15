import { FIRE_SOURCES, type FireSource } from "@/data/fire/sources";
import { CREW_ENVIRONMENTS, GRAVITY_REGIMES, INVESTIGATIONS, TOPICS, type InvestigationRecord } from "@/data/research/investigations";
import { ROUTES } from "@/lib/routes";
import { Bm25Index, tokenize, type Bm25Doc } from "./bm25";
import { FIELD_LABEL, PSI_CORPUS, psiLabel, type PsiChunk, type PsiInvestigation } from "./corpus";

/**
 * Passage retrieval over everything IGNIS can cite:
 *  - "record": the curated research index (src/data/research/investigations.ts),
 *  - "source": extracts in the fire-model source registry (src/data/fire/sources.ts),
 *  - "psi": passages from NASA PSI combustion investigation records (src/data/rag).
 * One BM25 index spans all three, so scores are comparable across kinds.
 */

export type PassageKind = "record" | "source" | "psi";

export interface Passage {
  /** Record id, source id, or PSI passage id such as "PSI-25#objective-0". */
  id: string;
  kind: PassageKind;
  title: string;
  text: string;
  /** Internal route for records, the original document otherwise. */
  href: string;
  citationLabel: string;
  /** The id a grounded answer cites: record id, source id, or PSI accession. */
  citeId: string;
  score: number;
}

export interface RetrieveOptions {
  /** Maximum passages returned. Default 6. */
  k?: number;
  kinds?: PassageKind[];
  /** At most this many PSI passages from one investigation. Default 2. */
  perInvestigation?: number;
}

type Entry = Omit<Passage, "score">;

function recordDoc(record: InvestigationRecord): Bm25Doc<Entry> {
  const tested = record.environments.filter((link) => link.basis === "tested").map((link) => CREW_ENVIRONMENTS[link.id].label);
  const findings = record.findings.map((finding) => finding.text);
  return {
    item: {
      id: record.id,
      kind: "record",
      title: record.name,
      text: [record.summary, ...findings].join(" "),
      href: ROUTES.investigation(record.id),
      citationLabel: record.name,
      citeId: record.id,
    },
    fields: [
      { text: `${record.name} ${record.title}`, weight: 2, keepStopwords: true },
      { text: [...record.topics.map((topic) => TOPICS[topic].label), ...record.gravity.map((g) => GRAVITY_REGIMES[g].label), ...tested].join(" "), weight: 1 },
      { text: record.summary, weight: 1 },
      { text: findings.join(" "), weight: 1 },
      { text: [...record.conditions.fuels, record.conditions.note ?? ""].join(" "), weight: 0.6 },
      { text: record.controlsUse.join(" "), weight: 0.8 },
    ],
  };
}

function sourceDoc(source: FireSource): Bm25Doc<Entry> {
  return {
    item: {
      id: source.id,
      kind: "source",
      title: source.title,
      text: source.extracted.join(" "),
      href: source.url ?? `${ROUTES.modelingData}?view=sources#source-${source.id}`,
      citationLabel: source.short,
      citeId: source.id,
    },
    fields: [
      { text: `${source.short} ${source.title}`, weight: 2, keepStopwords: true },
      { text: source.extracted.join(" "), weight: 1 },
      { text: `${source.authors} ${source.venue}`, weight: 0.3 },
    ],
  };
}

function psiDoc(investigation: PsiInvestigation, chunk: PsiChunk): Bm25Doc<Entry> {
  const name = investigation.acronym ? `${investigation.acronym}: ${investigation.title}` : investigation.title;
  return {
    item: {
      id: chunk.id,
      kind: "psi",
      title: `${name} (${FIELD_LABEL[chunk.field].toLowerCase()})`,
      text: chunk.text,
      href: investigation.url,
      citationLabel: psiLabel(investigation),
      citeId: investigation.accession,
    },
    fields: [
      { text: chunk.text, weight: 1 },
      { text: [investigation.title, investigation.acronym, investigation.accession, ...investigation.keywords].join(" "), weight: 0.6, keepStopwords: true },
    ],
    // Publication-title lists match many words; prefer prose when scores are close.
    prior: chunk.field === "publications" ? 0.85 : 1,
  };
}

let index: Bm25Index<Entry> | null = null;

function passageIndex(): Bm25Index<Entry> {
  index ??= new Bm25Index<Entry>([
    ...INVESTIGATIONS.map(recordDoc),
    // The IGNIS assumption entry is not research evidence.
    ...FIRE_SOURCES.filter((source) => source.kind !== "assumption").map(sourceDoc),
    ...PSI_CORPUS.investigations.flatMap((investigation) => investigation.chunks.map((chunk) => psiDoc(investigation, chunk))),
  ]);
  return index;
}

/** Best-matching passages for a question, across the research index, source registry and PSI corpus. */
export function retrievePassages(query: string, { k = 6, kinds, perInvestigation = 2 }: RetrieveOptions = {}): Passage[] {
  const allowed = kinds ? new Set(kinds) : null;
  const hits = passageIndex().search(query, Number.MAX_SAFE_INTEGER, allowed ? (item) => allowed.has(item.kind) : undefined);
  const perPsi = new Map<string, number>();
  const out: Passage[] = [];
  for (const hit of hits) {
    if (hit.item.kind === "psi") {
      const used = perPsi.get(hit.item.citeId) ?? 0;
      if (used >= perInvestigation) continue;
      perPsi.set(hit.item.citeId, used + 1);
    }
    out.push({ ...hit.item, score: hit.score });
    if (out.length >= k) break;
  }
  return out;
}

/** Words of a text that occur nowhere in the indexed records, extracts or PSI passages. */
export function unknownWords(text: string): string[] {
  const index = passageIndex();
  return (text.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g) ?? []).filter((word) => {
    const terms = tokenize(word);
    return terms.length > 0 && terms.every((term) => !index.has(term));
  });
}

/** Number of indexed passages by kind, for diagnostics and tests. */
export function passageCounts(): Record<PassageKind, number> {
  return {
    record: INVESTIGATIONS.length,
    source: FIRE_SOURCES.filter((source) => source.kind !== "assumption").length,
    psi: PSI_CORPUS.investigations.reduce((sum, investigation) => sum + investigation.chunks.length, 0),
  };
}
