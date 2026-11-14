import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePsiCsv, type ObservedSensorHistory, type PsiManifest } from "@/lib/fire/psi-data";

describe("NASA PSI source preservation", () => {
  it("preserves quoted cells, line breaks, ranges, negative measurements and missing values", () => {
    const parsed = parsePsiCsv('\uFEFFMaterial,O2,CO,Note\r\n"PMMA, film",21.5 - 21.7,-1,"two\nlines"\r\nKapton,,,"a ""quoted"" note"\r\n');
    expect(parsed).toEqual({ headers: ["Material", "O2", "CO", "Note"], rows: [
      ["PMMA, film", "21.5 - 21.7", "-1", "two\nlines"], ["Kapton", "", "", 'a "quoted" note'],
    ] });
  });

  it("rejects truncated quoted CSV instead of silently inventing a row", () => {
    expect(() => parsePsiCsv('sample,value\n"unfinished,3')).toThrow(/quoted/);
  });

  it("retains eight public datasets with intact NASA metadata and original CSV checksums", () => {
    const publicRoot = path.resolve("public");
    const manifest = JSON.parse(readFileSync("public/data/nasa-psi/manifest.json", "utf8").replace(/^\uFEFF/, "")) as PsiManifest;
    expect(manifest.investigations).toHaveLength(8);
    for (const dataset of manifest.investigations) {
      expect(dataset.sourceUrl).toMatch(/^https:\/\/psi\.nasa\.gov\//);
      expect(dataset.doi).toMatch(/^10\.60555\//);
      expect(dataset.license).toBe("CC0-1.0");
      for (const file of [{ path: dataset.metadataPath, sha256: dataset.metadataSha256 }, ...dataset.tables, ...(dataset.workbooks ?? [])]) {
        const resolved = path.resolve(publicRoot, `.${file.path}`);
        expect(resolved.startsWith(publicRoot + path.sep)).toBe(true);
        const bytes = readFileSync(resolved);
        expect(createHash("sha256").update(bytes).digest("hex"), file.path).toBe(file.sha256);
      }
      for (const table of dataset.tables) {
        const csv = parsePsiCsv(readFileSync(path.resolve(publicRoot, `.${table.path}`), "utf8"));
        expect(csv.headers.length).toBeGreaterThan(2);
        expect(csv.rows.length).toBeGreaterThan(0);
      }
    }
  });

  it("ties measured sensor traces to the original workbook and retains negative detector baselines", () => {
    const history = JSON.parse(readFileSync("public/data/nasa-psi/saffire-i-sensor-history.json", "utf8")) as ObservedSensorHistory;
    const original = readFileSync(path.resolve("public", `.${history.workbookPath}`));
    expect(createHash("sha256").update(original).digest("hex")).toBe(history.workbookSha256);
    expect(history.channels.map((channel) => channel.unit)).toEqual(["°C", "psi", "V", "V"]);
    for (const channel of history.channels) {
      expect(channel.points.length).toBeGreaterThan(250);
      expect(channel.timeColumn).toBe("Relative Time (s)");
      expect(channel.points.every((point) => Number.isFinite(point.timeS) && Number.isFinite(point.value) && point.sourceRow > channel.headerRow)).toBe(true);
    }
    expect(history.channels.find((channel) => channel.id === "obscuration")!.points.some((point) => point.value < 0)).toBe(true);
  });
});
