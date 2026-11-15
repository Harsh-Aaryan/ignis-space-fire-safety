"""Runs the NIST CFAST cross-check cases and writes src/data/fire/cfast-reference.json.

    python scripts/cfast/run_cases.py

Requires the CFAST 7.7 solver: set the CFAST environment variable to cfast.exe,
put ``cfast`` on PATH, or unpack the NIST package to tools/cfast (the default
location tools/cfast/firemodels/cfast7/cfast.exe is tried last). Requires the
IGNIS export in scripts/cfast/inputs (see README.md).

Post-processing per case:
* cabin gas temperature rise above the initial temperature;
* oxygen: CFAST's depletion in mole-fraction points (initial minus current
  O2 mol %) applied to the habitat's own initial O2. CFAST starts from that O2
  through INTERIOR_O2_MASS_FRACTION, so this is a no-op unless its initial
  value differs, which is checked and reported;
* CO2 rise in ppm;
* for two-zone runs, mole-weighted means of the two layers (layer moles are
  proportional to volume over absolute temperature at one pressure), with the
  upper-layer temperature kept as the hot-layer bound;
* a check that CFAST released the prescribed heat (the lower oxygen limit
  did not throttle the fire).
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import sys
import warnings
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cases as cfast_cases  # noqa: E402
from cases import BUILD_DIR, Case, build_cases, build_model  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / "src" / "data" / "fire" / "cfast-reference.json"
DEFAULT_EXE = REPO / "tools" / "cfast" / "firemodels" / "cfast7" / ("cfast.exe" if os.name == "nt" else "cfast")
GRID_POINTS = 60
#: A run counts as throttled if CFAST released less than this share of the prescribed heat.
THROTTLE_TOLERANCE = 0.99
#: Largest accepted gap between CFAST's initial O2 and the habitat value, mole-% points.
O2_INITIAL_TOLERANCE = 0.05


class CfastNotAvailable(RuntimeError):
    pass


def resolve_cfast() -> str:
    """Path of the CFAST solver: $CFAST, then PATH, then tools/cfast."""
    env = os.environ.get("CFAST")
    if env:
        if shutil.which(env) or Path(env).is_file():
            return env
        raise CfastNotAvailable(f"The CFAST environment variable points to {env!r}, which is not an executable.")
    on_path = shutil.which("cfast")
    if on_path:
        return on_path
    if DEFAULT_EXE.is_file():
        return str(DEFAULT_EXE)
    raise CfastNotAvailable(
        "NIST CFAST 7.7 was not found. Install it from https://pages.nist.gov/cfast/ and either\n"
        "  set CFAST=<path to cfast.exe>, put cfast on PATH, or unpack it to tools/cfast/\n"
        "(expected tools/cfast/firemodels/cfast7/cfast.exe). No results were written."
    )


def cfast_revision(case_dir: Path) -> str | None:
    for name in sorted(case_dir.glob("*.log")):
        match = re.search(r"Revision\s*:\s*(\S+)", name.read_text(encoding="utf-8", errors="replace"))
        if match:
            return match.group(1)
    return None


def layer_means(comp: pd.DataFrame, volume_m3: float) -> dict[str, np.ndarray]:
    """Cabin-average temperature, O2 and CO2 from CFAST's compartment output.

    Single zone: the ULT/ULO2/ULCO2 columns. Two zones: mole-weighted means,
    with layer moles proportional to V / T (both layers share one pressure).
    """
    upper_t = comp["ULT_1"].to_numpy(float)
    if "LLT_1" not in comp.columns:
        return {
            "tempC": upper_t,
            "upperTempC": upper_t,
            "o2Pct": comp["ULO2_1"].to_numpy(float),
            "co2Pct": comp["ULCO2_1"].to_numpy(float),
        }
    lower_t = comp["LLT_1"].to_numpy(float)
    v_upper = np.clip(comp["VOL_1"].to_numpy(float), 0.0, volume_m3)
    v_lower = volume_m3 - v_upper
    w_upper = v_upper / (upper_t + 273.15)
    w_lower = v_lower / (lower_t + 273.15)
    total = w_upper + w_lower

    def mean(u: str, lo: str) -> np.ndarray:
        return (comp[u].to_numpy(float) * w_upper + comp[lo].to_numpy(float) * w_lower) / total

    return {
        "tempC": volume_m3 / total - 273.15,
        "upperTempC": upper_t,
        "o2Pct": mean("ULO2_1", "LLO2_1"),
        "co2Pct": mean("ULCO2_1", "LLCO2_1"),
    }


def prescribed_heat_kj(case: Case) -> float:
    """Heat in the case's table up to the simulation end. CFAST holds the last
    table value after the table ends (User's Guide section 6.2)."""
    t = np.asarray(case.hrr_t, float)
    q = np.asarray(case.hrr_kw, float)
    end = min(float(case.horizon_s), float(t[-1]))
    grid = np.union1d(t[t <= end], [end])
    heat = float(np.trapezoid(np.interp(grid, t, q), grid))
    if case.horizon_s > t[-1]:
        heat += float(q[-1]) * (case.horizon_s - float(t[-1]))
    return heat


def grid_for(horizon_s: float) -> np.ndarray:
    step = max(5, int(math.ceil(horizon_s / GRID_POINTS / 5.0)) * 5)
    grid = np.arange(0, horizon_s + 1e-9, step, dtype=float)
    if grid[-1] < horizon_s:
        grid = np.append(grid, horizon_s)
    return grid


def rounded(values: np.ndarray, digits: int) -> list[float]:
    return [round(float(v), digits) for v in values]


def post_process(case: Case, results: dict[str, pd.DataFrame | None]) -> dict[str, Any]:
    comp = results.get("compartments")
    if comp is None or comp.empty:
        raise RuntimeError(f"{case.id}: CFAST wrote no compartment results.")
    t = comp["Time"].to_numpy(float)
    means = layer_means(comp, case.volume_m3)
    rise = means["tempC"] - means["tempC"][0]
    upper_rise = means["upperTempC"] - means["upperTempC"][0]
    initial_o2 = float(means["o2Pct"][0])
    depletion = initial_o2 - means["o2Pct"]
    o2 = case.oxygen_pct - depletion
    co2_ppm = (means["co2Pct"] - means["co2Pct"][0]) * 1e4
    # HRR_1 is the heat release CFAST actually applied, in W.
    released_kj = float(np.trapezoid(comp["HRR_1"].to_numpy(float), t)) / 1000.0
    prescribed_kj = prescribed_heat_kj(case)
    released_share = released_kj / prescribed_kj if prescribed_kj > 0 else 1.0
    notes = list(case.notes)
    if abs(initial_o2 - case.oxygen_pct) > O2_INITIAL_TOLERANCE:
        notes.append(
            f"CFAST started at {initial_o2:.2f} % O2 against {case.oxygen_pct:.2f} %; "
            "its depletion is applied to the habitat value."
        )

    grid = grid_for(case.horizon_s)
    hrr_grid = np.interp(grid, case.hrr_t, case.hrr_kw)
    series: dict[str, Any] = {
        "t": rounded(grid, 1),
        "hrrKw": rounded(hrr_grid, 3),
        "cfastTempRiseC": rounded(np.interp(grid, t, rise), 3),
        "cfastO2Pct": rounded(np.interp(grid, t, o2), 4),
    }
    if case.zone_model == "two-zone":
        series["cfastUpperTempRiseC"] = rounded(np.interp(grid, t, upper_rise), 3)

    data = case.source
    ignis_block = None
    if case.hrr_source == "ignis":
        history = data["ignis"]["history"]
        it = np.asarray(history["t"], float)
        i_temp = np.asarray(history["tempC"], float) - data["atmosphere"]["ambientC"]
        i_o2 = np.asarray(history["o2Pct"], float)
        series["ignisTempRiseC"] = rounded(np.interp(grid, it, i_temp), 3)
        series["ignisO2Pct"] = rounded(np.interp(grid, it, i_o2), 4)
        ignis_block = {
            "peakTempRiseC": round(float(i_temp.max()), 3),
            "finalO2DepletionPts": round(float(i_o2[0] - i_o2[-1]), 4),
            "finalO2Pct": round(float(i_o2[-1]), 4),
            "finalCo2RisePpm": round(float(data["ignis"]["co2RisePpmFinal"]), 1),
            "totalHeatKJ": round(float(data["ignis"]["totalHeatJ"]) / 1000.0, 2),
            "finalPhase": data["ignis"]["finalPhase"],
        }

    measured = None
    if case.group == "saffire":
        bm = data["benchmark"]
        measured = {
            "maxFarFieldC": bm["maxFarFieldC"],
            "maxOutletC": bm["maxOutletC"],
            "co2RisePpm": bm["co2RisePpm"],
            "totalHeatKJ": bm["totalHeatKJ"],
            "burnDurationS": bm["burnDurationS"],
            "assumedInitialC": case.ambient_c,
            "source": "ICES-2024-365 Tables 1 and 2 (src/data/fire/options.ts SAFFIRE_BENCHMARKS)",
        }

    return {
        "id": case.id,
        "label": case.label,
        "group": case.group,
        "sourceId": case.source_id,
        "hrrSource": case.hrr_source,
        "zoneModel": case.zone_model,
        "bounding": case.bounding,
        "gravityG": case.gravity_g,
        "atmosphere": {
            "pressureKpa": round(case.pressure_kpa, 3),
            "oxygenPct": round(case.oxygen_pct, 3),
            "ambientC": case.ambient_c,
            "o2MassFraction": round(case.o2_mass_fraction, 6),
        },
        "geometry": {
            "volumeM3": round(case.volume_m3, 3),
            "heightM": case.height_m,
            "widthM": round(case.width_m, 3),
            "depthM": round(case.depth_m, 3),
            "surfaceAreaM2": round(case.surface_area_m2, 2),
            "ignisWallAreaM2": round(case.ignis_wall_area_m2, 2),
        },
        "fire": {
            "material": case.material["name"],
            "materialId": case.material["id"],
            "heatOfCombustionMJkg": case.material["heatOfCombustionMJkg"],
            "radiativeFraction": case.material["radiativeFraction"],
            "fireHeightM": round(case.fire_height_m, 3),
            "totalHeatKJ": round(case.target_heat_kj, 2),
            "peakHrrKw": round(float(max(case.hrr_kw)), 4),
            "durationS": case.horizon_s,
            "tablePoints": len(case.hrr_t),
            "cfastHeatKJ": round(released_kj, 2),
            "releasedShare": round(released_share, 4),
            "throttled": released_share < THROTTLE_TOLERANCE,
            "shape": None
            if case.shape is None
            else {k: (round(v, 3) if isinstance(v, float) else v) for k, v in case.shape.items()},
        },
        "cfast": {
            "peakTempRiseC": round(float(rise.max()), 3),
            "peakUpperLayerRiseC": round(float(upper_rise.max()), 3) if case.zone_model == "two-zone" else None,
            "finalO2DepletionPts": round(float(depletion[-1]), 4),
            "finalO2Pct": round(float(o2[-1]), 4),
            "finalCo2RisePpm": round(float(co2_ppm[-1]), 1),
            "initialO2PctModel": round(initial_o2, 4),
        },
        "ignis": ignis_block,
        "measured": measured,
        "series": series,
        "notes": notes,
    }


METHOD_NOTES = [
    "CFAST is driven with a prescribed heat-release history; it does not predict burning. Cases marked 'IGNIS heat release' use the IGNIS history for the same case, so both models see identical heat release.",
    "0 g cabins are single well-mixed zones (CFAST SHAFT): without gravity there is no buoyant stratification and cabin fans mix the air.",
    "CFAST has no gravity input (g = 9.8 m/s² in its plume and wall-convection correlations). Lunar and Martian two-zone runs over-state stratification and only bound the hot layer.",
    "Wall heat transfer uses CFAST's 1 g natural-convection coefficient; in 0 g the cabin fans drive forced convection instead.",
    "Initial O₂ is set with INTERIOR_O2_MASS_FRACTION; oxygen is reported as depletion in mole-fraction points applied to the cabin's initial O₂.",
    "The lower oxygen limit is an O₂ mass fraction of 0.05, below every cabin here, and each run is checked to release the prescribed heat.",
    "Cabins are closed: no vents and no leakage. Saffire flow-duct recirculation stays inside the one well-mixed zone, so it is not a CFAST vent.",
    "Walls (assumed): 5 mm aluminium shell (6061-T6 handbook properties, 12.1 kJ/m²·K like the IGNIS lumped wall) backed by a blanket giving 0.3 W/m²·K to ambient, emissivity 0.9.",
    "Each CFAST box keeps the IGNIS free volume, room height and wall area.",
    "Published-shape cases: t-squared growth, steady burning and t-squared decay, constrained by the published peak and total heat (and burn duration when consistent with them).",
]


def run_all(cases: list[Case], exe: str) -> tuple[list[dict[str, Any]], str | None]:
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    out = []
    revision = None
    for case in cases:
        model = build_model(case, BUILD_DIR, cfast_exe=exe)
        with warnings.catch_warnings():
            # CFAST does not write the optional _zone.csv for these inputs.
            warnings.simplefilter("ignore", RuntimeWarning)
            results = model.run(timeout=900)
        revision = revision or cfast_revision(BUILD_DIR / case.file_stem)
        record = post_process(case, results)
        out.append(record)
        ignis = record["ignis"]
        print(
            f"{case.id:28s} dT CFAST {record['cfast']['peakTempRiseC']:6.2f} K"
            + (f"  IGNIS {ignis['peakTempRiseC']:6.2f} K" if ignis else "")
            + f"  dO2 CFAST {record['cfast']['finalO2DepletionPts']:6.3f} pts"
            + (f"  IGNIS {ignis['finalO2DepletionPts']:6.3f} pts" if ignis else "")
            + f"  heat released {record['fire']['releasedShare']:.3f}"
        )
    return out, revision


def main() -> int:
    try:
        exe = resolve_cfast()
    except CfastNotAvailable as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    try:
        cases = build_cases()
    except cfast_cases.CfastInputError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    index = json.loads((cfast_cases.INPUT_DIR / "index.json").read_text(encoding="utf-8"))
    records, revision = run_all(cases, exe)
    throttled = [r["id"] for r in records if r["fire"]["throttled"]]
    if throttled:
        print(f"warning: CFAST released less than the prescribed heat in {', '.join(throttled)}", file=sys.stderr)
    payload = {
        "schemaVersion": 1,
        "status": "ok",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cfastVersion": revision,
        "pycfastVersion": version("pycfast"),
        "ignisModelVersion": index.get("ignisModelVersion"),
        "ignisExportedAt": index.get("generatedAt"),
        "method": {
            "summary": "NIST CFAST 7.7 zone-model reference for cabin gas temperature and oxygen, driven by the same heat release as IGNIS.",
            "notes": METHOD_NOTES,
            "lowerOxygenLimitMassFraction": cfast_cases.LOWER_OXYGEN_LIMIT,
            "relativeHumidityPct": cfast_cases.RELATIVE_HUMIDITY,
            "walls": [
                {
                    "id": m.id,
                    "material": m.material,
                    "conductivityWmK": m.conductivity,
                    "densityKgM3": m.density,
                    "specificHeatKJkgK": m.specific_heat,
                    "thicknessM": m.thickness,
                    "emissivity": m.emissivity,
                }
                for m in cfast_cases.WALL_LAYERS
            ],
        },
        "cases": records,
    }
    OUTPUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(records)} cases, {revision})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
