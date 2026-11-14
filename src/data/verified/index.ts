import raw from "@/data/verified/ntrs-index.json";

export interface VerifiedCitation {
  id: string;
  source: "ntrs";
  title: string;
  authors: string[];
  year: string | null;
  stiType: string | null;
  keywords: string[];
  abstractExcerpt: string;
  abstractTruncated: boolean;
  sourceUrl: string;
  apiUrl: string;
  indexHint: string;
  priority: "A" | "B" | "C";
  retrievedAt: string;
  measurementsExtracted: false;
  hintBasis: string;
  note: string;
}

export interface VerifiedIndex {
  retrievedAt: string;
  retrievalApi: string;
  searchApi: string;
  portal: string;
  psiPortalNotedNotIngested: string;
  psiNote: string;
  records: VerifiedCitation[];
  explicitlyNotIndexed: string[];
}

const index = raw as unknown as VerifiedIndex;

export const VERIFIED_INDEX = index;

export const VERIFIED_CITATIONS: VerifiedCitation[] = index.records.map((record) => ({
  ...record,
  source: "ntrs",
  measurementsExtracted: false,
}));

export function citationById(id: string): VerifiedCitation | null {
  return VERIFIED_CITATIONS.find((item) => item.id === id) ?? null;
}
