import type { ExperimentalRun, Investigation } from "@/types/domain";

export function runsToCsv(runs: ExperimentalRun[], investigations: Investigation[]): string {
  const family = new Map(investigations.map((item) => [item.id, item.family]));
  const headers = [
    "provenance",
    "run_id",
    "investigation_id",
    "family_label",
    "oxygen_pct",
    "pressure_psi",
    "gravity_g",
    "airflow_m_s",
    "fuel_category",
    "fuel_material",
    "sample_geometry",
    "completeness",
    "metadata_gaps",
    "measurements_json",
  ];
  const lines = [
    headers.join(","),
    csvRow([
      "META",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "SYNTHETIC DEMONSTRATION DATA — not NASA measurements. Run IDs are fictional.",
      "",
      "",
      "",
    ]),
  ];
  for (const run of runs) {
    lines.push(
      csvRow([
        run.provenance,
        run.id,
        run.investigationId,
        family.get(run.investigationId) ?? "",
        cell(run.oxygenConcentrationPct),
        cell(run.pressurePsi),
        cell(run.gravityG),
        cell(run.airflowVelocityMs),
        run.fuelCategory,
        run.fuelMaterial,
        run.sampleGeometry,
        run.evidenceCompleteness,
        run.metadataGaps.join("; "),
        JSON.stringify(run.measurements),
      ]),
    );
  }
  return lines.join("\n");
}

function cell(value: number | null): string {
  return value == null ? "" : String(value);
}

function csvRow(values: string[]): string {
  return values.map(escapeCell).join(",");
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
