export interface PsiTable {
  fileName: string;
  version: number;
  bytes: number;
  sha256: string;
  path: string;
}

export interface PsiInvestigation {
  id: string;
  title: string;
  doi: string;
  version: number;
  license: string;
  sourceUrl: string;
  metadataPath: string;
  metadataSha256: string;
  tables: PsiTable[];
  workbooks?: PsiTable[];
  accessNotes: string[];
}

export interface ObservedSensorHistory {
  dataClass: string;
  investigationId: string;
  doi: string;
  sourceUrl: string;
  workbookPath: string;
  workbookSha256: string;
  method: string;
  limits: string;
  channels: {
    id: string;
    name: string;
    unit: string;
    sheet: string;
    timeColumn: string;
    valueColumn: string;
    headerRow: number;
    points: { timeS: number; value: number; sourceRow: number }[];
  }[];
}

export interface PsiManifest {
  schemaVersion: number;
  retrievedAt: string;
  investigations: PsiInvestigation[];
}

/** Preserve source cells as strings: ranges, blanks, display settings and notes are not numeric measurements. */
export function parsePsiCsv(source: string): { headers: string[]; rows: string[][] } {
  const text = source.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  function finishRow() {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) records.push(row);
    row = [];
    cell = "";
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      finishRow();
    } else cell += char;
  }
  if (quoted) throw new Error("CSV ends inside a quoted cell.");
  if (cell.length || row.length) finishRow();
  return { headers: records[0] ?? [], rows: records.slice(1) };
}
