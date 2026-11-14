"""Extract explicitly labeled NASA sensor channels without interpolation or ignition-time alignment.

Requires openpyxl. Run after fetch-nasa-psi.ps1. --check verifies the committed
extract against the original workbook without rewriting either file.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1] / "public" / "data" / "nasa-psi"
WORKBOOK = ROOT / "PSI-98_Raw Data_Saffire-I Telemetry Data Good Process Version.xlsx"
OUTPUT = ROOT / "saffire-i-sensor-history.json"


def extract():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8-sig"))
    record = next(item for item in manifest["investigations"] if item["id"] == "PSI-98")
    original_hash = hashlib.sha256(WORKBOOK.read_bytes()).hexdigest()
    source = next(item for item in record["workbooks"] if item["sha256"] == original_hash)
    workbook = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)
    specs = [
        ("temperature", "Cabin air temperature", "°C", "CygnusTemperatureData", 1, 2, 3),
        ("pressure", "Cabin pressure", "psi", "CygnusPressureData", 1, 2, 3),
        ("obscuration", "FIZ 2 smoke obscuration signal", "V", "CygnusSmokeDetectorData", 2, 2, 3),
        ("scattering", "FIZ 2 smoke scattering signal", "V", "CygnusSmokeDetectorData", 2, 7, 8),
    ]
    channels = []
    try:
        for channel_id, name, unit, sheet_name, header_row, time_column, value_column in specs:
            sheet = workbook[sheet_name]
            rows = sheet.iter_rows(values_only=True)
            header = None
            for _ in range(header_row):
                header = next(rows)
            assert header[time_column] == "Relative Time (s)"
            assert isinstance(header[value_column], str)
            points, skipped = [], 0
            for row_number, row in enumerate(rows, start=header_row + 1):
                time, value = row[time_column], row[value_column]
                if any(isinstance(item, bool) or not isinstance(item, (int, float)) or not math.isfinite(item) for item in (time, value)):
                    skipped += 1
                    continue
                points.append({"timeS": time, "value": value, "sourceRow": row_number})
            channels.append({
                "id": channel_id, "name": name, "unit": unit, "sheet": sheet_name,
                "timeColumn": header[time_column], "valueColumn": header[value_column],
                "headerRow": header_row, "timeColumnIndex": time_column + 1, "valueColumnIndex": value_column + 1,
                "skippedNonNumericOrMissingRows": skipped, "points": points,
            })
    finally:
        workbook.close()
    return {
        "dataClass": "NASA observed sensor telemetry, extracted from labeled workbook sheets",
        "investigationId": "PSI-98", "doi": record["doi"], "sourceUrl": record["sourceUrl"],
        "license": record["license"], "workbookPath": source["path"], "workbookSha256": original_hash,
        "method": "Numeric cached cell values only, in source row order. No interpolation, smoothing, clipping, unit conversion or ignition-time alignment. Missing/nonnumeric pairs are counted and omitted.",
        "limits": "Relative time is the workbook time coordinate, not time since ignition. Smoke detector voltages are not smoke concentration or calibrated alarm times. These channels do not provide HRR or O2 histories.",
        "channels": channels,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = extract()
    if args.check:
        assert json.loads(OUTPUT.read_text(encoding="utf-8")) == result, "Telemetry extract differs from its NASA workbook."
        print("Saffire-I extraction matches the source workbook exactly.")
    else:
        OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(json.dumps({channel["id"]: len(channel["points"]) for channel in result["channels"]}))
