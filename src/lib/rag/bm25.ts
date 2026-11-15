/**
 * BM25 retrieval with light stemming and weighted fields.
 *
 * The tokenizer, stopwords and stemmer match scripts/NASAflamesRAG.py so the
 * command-line query and the app rank the PSI corpus the same way. Pure
 * TypeScript with no dependencies; it runs on the server and in the browser.
 */

export const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her here
hers him his how i if in into is it its itself just me more most my no nor not of off on once only or other our out over
own she should so some such than that the their them then there these they this those through to too under until up
very was we were what when where which while who whom why will with would you your yours tell show list give find please
much many`.split(/\s+/),
);
// "same" is deliberately absent: it is also the SAME experiment acronym.

const TOKEN = /[a-z0-9]+(?:-[a-z0-9]+)*/g;

/** Light suffix stripping. Identical to stem() in scripts/NASAflamesRAG.py. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("ied")) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.length > 4 && ["ses", "xes", "zes", "ches", "shes"].some((s) => w.endsWith(s))) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !["ss", "us", "is"].some((s) => w.endsWith(s))) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 6 && w.endsWith("ion")) w = w.slice(0, -3);
  else if (w.length > 6 && w.endsWith("or")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  if (w.length > 4 && w.at(-1) === w.at(-2) && !"aeiouls".includes(w.at(-1)!)) w = w.slice(0, -1);
  return w;
}

/** Lower-case word tokens with light stemming. Hyphenated names also yield a joined token (flex-2 gives flex2). */
export function tokenize(text: string, { keepStopwords = false }: { keepStopwords?: boolean } = {}): string[] {
  const out: string[] = [];
  for (const match of text.toLowerCase().replace(/₂/g, "2").matchAll(TOKEN)) {
    const pieces = match[0].split("-");
    if (pieces.length > 1) out.push(stem(pieces.join("")));
    for (const piece of pieces) {
      if (piece && (keepStopwords || !STOPWORDS.has(piece))) out.push(stem(piece));
    }
  }
  return out;
}

export interface IndexedField {
  text: string;
  /** Multiplies this field's term frequency and length. 1 is plain body text. */
  weight: number;
  /** Keep stopwords, e.g. for titles and acronyms such as "SAME". */
  keepStopwords?: boolean;
}

export interface Bm25Doc<T> {
  item: T;
  fields: IndexedField[];
  /** Multiplies the final score, e.g. to prefer prose over title lists. Default 1. */
  prior?: number;
}

export interface Bm25Hit<T> {
  item: T;
  score: number;
  /** Query terms (stemmed) found in the document. */
  matched: string[];
}

export class Bm25Index<T> {
  private readonly docs: Array<{ item: T; tf: Map<string, number>; length: number; prior: number }>;
  private readonly idf = new Map<string, number>();
  private readonly avgLength: number;

  constructor(docs: Bm25Doc<T>[], private readonly k1 = 1.2, private readonly b = 0.75) {
    const df = new Map<string, number>();
    this.docs = docs.map(({ item, fields, prior = 1 }) => {
      const tf = new Map<string, number>();
      let length = 0;
      for (const field of fields) {
        const tokens = tokenize(field.text, { keepStopwords: field.keepStopwords });
        for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + field.weight);
        length += field.weight * tokens.length;
      }
      for (const token of tf.keys()) df.set(token, (df.get(token) ?? 0) + 1);
      return { item, tf, length, prior };
    });
    const n = this.docs.length;
    this.avgLength = n ? this.docs.reduce((sum, d) => sum + d.length, 0) / n || 1 : 1;
    for (const [token, f] of df) this.idf.set(token, Math.log(1 + (n - f + 0.5) / (f + 0.5)));
  }

  get size(): number {
    return this.docs.length;
  }

  /** Whether any document contains this (already stemmed) term. */
  has(term: string): boolean {
    return this.idf.has(term);
  }

  /** Documents with a positive score, best first. */
  search(query: string, k = 10, filter?: (item: T) => boolean): Bm25Hit<T>[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const hits: Bm25Hit<T>[] = [];
    for (const doc of this.docs) {
      if (filter && !filter(doc.item)) continue;
      const norm = this.k1 * (1 - this.b + (this.b * doc.length) / this.avgLength);
      let score = 0;
      const matched: string[] = [];
      for (const term of terms) {
        const f = doc.tf.get(term);
        if (!f) continue;
        score += (this.idf.get(term) ?? 0) * ((f * (this.k1 + 1)) / (f + norm));
        matched.push(term);
      }
      if (score > 0) hits.push({ item: doc.item, score: score * doc.prior, matched });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
