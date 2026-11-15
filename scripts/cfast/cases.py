"""Builds NIST CFAST models (through pycfast) for the IGNIS cabin cross-check.

Inputs come from ``scripts/cfast/inputs/*.json``, written by the IGNIS exporter
(``CFAST_EXPORT=1 npx vitest run src/lib/fire/cfast-export.test.ts``). Those
files carry the Saffire table rows, the cabin geometry and atmosphere, the fuel
chemistry and the IGNIS heat-release history, so nothing here re-types a
published number.

Running this module writes one CFAST input file per case to
``scripts/cfast/build/<case>/<case>.in`` without running CFAST.

CFAST facts relied on (CFAST 7.7.7, NIST TN 1889v1 Technical Reference and
TN 1889v2 User's Guide, both dated 2026-05-27):

* Gravity is not an input. It is the constant g = 9.8 m/s^2 (Tech Ref,
  nomenclature) used in the plume entrainment correlation (Heskestad, Tech Ref
  eq. 3.17) and the natural-convection wall coefficient h = C |Tg - Tw|^(1/3)
  (Tech Ref eq. 5.23).
* ``&COMP SHAFT = .TRUE.`` makes a compartment a single well-mixed zone
  (User's Guide section 4.3). pycfast: ``Compartment(shaft=True)``.
* ``&INIT PRESSURE`` (Pa) sets the initial pressure inside and outside, and
  ``INTERIOR_O2_MASS_FRACTION`` / ``EXTERIOR_O2_MASS_FRACTION`` (kg/kg, default
  0.23) set the initial oxygen (User's Guide section 2.3 and Table B.4). pycfast
  0.2.2 does not expose the oxygen fields, so ``CabinEnvironment`` adds them.
* ``&MISC LOWER_OXYGEN_LIMIT`` is an oxygen MASS fraction (default 0.15) that
  throttles burning through C_LOL = (tanh(800 (Y_O2 - Y_O2,l) - 4) + 1) / 2
  (Tech Ref eqs. 3.14-3.15). CFAST echoes it in percent.
* ``&TABL`` HEIGHT is the height of the fire base, not a flame height (User's
  Guide section 6.2), and a fire definition takes at most 199 data points
  (User's Guide, Appendix A limits).
"""

from __future__ import annotations

import json
import math
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from pycfast import CFASTModel, Compartment, Fire, Material, SimulationEnvironment
from pycfast.utils.namelist import NamelistRecord

HERE = Path(__file__).resolve().parent
INPUT_DIR = HERE / "inputs"
BUILD_DIR = HERE / "build"

#: User's Guide Appendix A: "Maximum number of data points for a single fire definition: 199".
CFAST_MAX_TABLE_POINTS = 199
TABLE_POINT_BUDGET = 190

#: Oxygen mass fraction below which CFAST throttles burning (Tech Ref eq. 3.15).
#: 0.05 sits far below every cabin here (lowest initial value 0.244), so the
#: prescribed heat release is never limited. run_cases.py checks that CFAST
#: released the prescribed energy.
LOWER_OXYGEN_LIMIT = 0.05

#: Molar masses used to convert the cabin O2 mole fraction to CFAST's mass
#: fraction. CFAST takes N2 as the balance (User's Guide section 2.3).
M_O2 = 31.998
M_N2 = 28.014

#: Assumption for rows without a published peak: t-squared growth and decay each
#: take this share of the published burn duration (CFAST's t-squared fire form,
#: User's Guide section 6.3, with a steady period between them).
GROWTH_FRACTION = 0.10

#: Initial relative humidity. IGNIS starts with dry gas (no water vapour), so
#: CFAST does too; the O2 mole fraction is then the same quantity in both.
RELATIVE_HUMIDITY = 0.0

#: Wall construction (assumption, the same for walls, ceiling and floor of a
#: pressure vessel). An aluminium shell with handbook properties of alloy
#: 6061-T6 (k 167 W/m K, rho 2700 kg/m^3, c 0.896 kJ/kg K). 5 mm gives
#: 12.1 kJ/m^2 K, the lumped wall capacity IGNIS uses (12 kJ/m^2 K). Behind it,
#: a fibrous blanket sized to the IGNIS wall loss to ambient of 0.3 W/m^2 K
#: (0.04 W/m K over 0.13 m), since CFAST exposes the back face to ambient.
#: Emissivity 0.9: cabin surfaces are covered by stowage, panels and paint, and
#: IGNIS sends all flame radiation into the wall.
WALL_LAYERS = (
    Material("ALSHELL", "Aluminium shell 6061-T6 assumed", 167.0, 2700.0, 0.896, 0.005, 0.9),
    Material("BLANKET", "Fibrous blanket assumed", 0.04, 30.0, 1.2, 0.13, 0.9),
)

#: Same atomic masses as the IGNIS chemistry (src/lib/fire/chemistry.ts).
ATOMIC_MASS = {"c": 12.0, "h": 1.0, "o": 16.0}


class CfastInputError(RuntimeError):
    """Raised when the IGNIS export is missing or inconsistent."""


class CabinEnvironment(SimulationEnvironment):
    """SimulationEnvironment that also writes the &INIT oxygen mass fractions.

    pycfast 0.2.2 writes PRESSURE, RELATIVE_HUMIDITY and the two temperatures
    in &INIT, but not INTERIOR_O2_MASS_FRACTION / EXTERIOR_O2_MASS_FRACTION
    (CFAST 7.7 User's Guide Table B.4). The record is rebuilt with them.
    """

    def __init__(self, *args: Any, o2_mass_fraction: float, **kwargs: Any):
        self.o2_mass_fraction = o2_mass_fraction
        super().__init__(*args, **kwargs)

    def to_input_string(self) -> str:
        text = super().to_input_string()
        init = (
            NamelistRecord("INIT")
            .add_field("PRESSURE", self.init_pressure)
            .add_field("RELATIVE_HUMIDITY", self.relative_humidity)
            .add_field("INTERIOR_TEMPERATURE", self.interior_temperature)
            .add_field("EXTERIOR_TEMPERATURE", self.exterior_temperature)
            .add_field("INTERIOR_O2_MASS_FRACTION", self.o2_mass_fraction)
            .add_field("EXTERIOR_O2_MASS_FRACTION", self.o2_mass_fraction)
            .build()
        )
        lines = text.splitlines(keepends=True)
        replaced = [init if line.startswith("&INIT") else line for line in lines]
        if replaced == lines:
            raise CfastInputError("pycfast did not write an &INIT record to replace.")
        return "".join(replaced)


@dataclass
class Case:
    id: str
    label: str
    group: str  # "saffire" | "habitat"
    source_id: str
    hrr_source: str  # "published-shape" | "ignis"
    zone_model: str  # "single-zone" | "two-zone"
    bounding: bool
    gravity_g: float
    horizon_s: int
    pressure_kpa: float
    oxygen_pct: float
    ambient_c: float
    volume_m3: float
    height_m: float
    width_m: float
    depth_m: float
    ignis_wall_area_m2: float
    fire_height_m: float
    fire_area_m2: float
    material: dict[str, Any]
    hrr_t: list[float]
    hrr_kw: list[float]
    target_heat_kj: float
    shape: dict[str, Any] | None = None
    source: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    @property
    def surface_area_m2(self) -> float:
        floor = self.width_m * self.depth_m
        return 2 * floor + 2 * (self.width_m + self.depth_m) * self.height_m

    @property
    def o2_mass_fraction(self) -> float:
        return o2_mass_fraction(self.oxygen_pct)

    @property
    def file_stem(self) -> str:
        """File name for CFAST. pycfast passes it on the command line, where
        CFAST 7.7.7 reads a hyphenated stem such as "saffire-IV-1" as its "-I"
        (initialise only) switch, so hyphens become underscores."""
        return self.id.replace("-", "_")


def o2_mass_fraction(oxygen_mole_pct: float) -> float:
    """O2 mass fraction of an O2/N2 mixture with the given O2 mole percent."""
    x = oxygen_mole_pct / 100.0
    return x * M_O2 / (x * M_O2 + (1.0 - x) * M_N2)


def o2_mole_pct(mass_fraction: float) -> float:
    """Inverse of :func:`o2_mass_fraction`."""
    n_o2 = mass_fraction / M_O2
    return 100.0 * n_o2 / (n_o2 + (1.0 - mass_fraction) / M_N2)


def box_for(volume_m3: float, height_m: float, surface_area_m2: float) -> tuple[float, float, bool]:
    """Width and depth of a box with this volume, height and total surface area.

    Keeps the free volume and room height IGNIS uses and, where a box can
    have it, the IGNIS wall area too. Falls back to a square footprint.
    Returns (width, depth, matched_area).
    """
    floor = volume_m3 / height_m
    half_perimeter = (surface_area_m2 - 2 * floor) / (2 * height_m)
    disc = half_perimeter**2 - 4 * floor
    if half_perimeter <= 0 or disc < 0:
        side = math.sqrt(floor)
        return side, side, False
    width = (half_perimeter + math.sqrt(disc)) / 2
    return width, floor / width, True


def fuel_formula(elements: dict[str, float]) -> dict[str, float]:
    """Smallest whole-number C/H/O formula for the IGNIS element mass fractions."""
    moles = {k: elements[k] / ATOMIC_MASS[k] for k in ("c", "h", "o")}
    base = min(v for v in moles.values() if v > 0)
    ratio = {k: v / base for k, v in moles.items()}
    for scale in range(1, 13):
        scaled = {k: v * scale for k, v in ratio.items()}
        if all(abs(v - round(v)) < 1e-6 for v in scaled.values()):
            return {k: float(round(v)) for k, v in scaled.items()}
    return {k: round(v * 10, 4) for k, v in ratio.items()}


def trapz_kj(t: list[float] | np.ndarray, kw: list[float] | np.ndarray) -> float:
    return float(np.trapezoid(np.asarray(kw, float), np.asarray(t, float)))


def published_shape(benchmark: dict[str, Any]) -> dict[str, Any]:
    """Assumed heat-release shape constrained by a Saffire row's published numbers.

    t-squared growth to the peak, a steady period, and a mirrored t-squared
    decay (the CFAST t-squared fire form). Constraints, in order: the integral
    equals the published total heat; the peak equals the published peak when
    there is one; the burn lasts the published burn duration when the first two
    allow it. Each growth or decay ramp of time a releases Qp * a / 3.
    """
    energy = float(benchmark["totalHeatKJ"])
    duration = float(benchmark["burnDurationS"])
    peak_w = benchmark.get("peakHeatW")
    avg_w = benchmark.get("avgHeatW")
    notes: list[str] = []
    if peak_w is None:
        ramp = GROWTH_FRACTION * duration
        steady = duration - 2 * ramp
        peak = energy / (steady + 2 * ramp / 3)
        basis = "total heat and burn duration; growth and decay times assumed"
        notes.append(
            f"No peak is published for this row; growth and decay each take {GROWTH_FRACTION:.0%} of the "
            f"{duration:.0f} s burn (assumption), which sets the peak at {peak:.2f} kW."
        )
    else:
        peak = peak_w / 1000.0
        fill = energy / (peak * duration)
        if fill > 1:
            ramp = GROWTH_FRACTION * duration
            steady = energy / peak - 2 * ramp / 3
            basis = "peak and total heat; burn lengthened"
            notes.append(
                f"{energy:.0f} kJ cannot be released in the published {duration:.0f} s at the published peak "
                f"of {peak_w:.0f} W; the peak and total heat are kept and the burn lasts "
                f"{steady + 2 * ramp:.0f} s (growth and decay {ramp:.0f} s each, assumed)."
            )
            if avg_w is not None and avg_w > peak_w:
                notes.append(f"The published average ({avg_w:.0f} W) exceeds the published peak ({peak_w:.0f} W).")
        elif fill >= 1 / 3:
            ramp = 0.75 * duration * (1 - fill)
            steady = duration - 2 * ramp
            basis = "peak, total heat and burn duration"
        else:
            ramp = 1.5 * energy / peak
            steady = 0.0
            basis = "peak and total heat; burn shortened"
            notes.append("The published total heat is below a t-squared rise and fall at the published peak.")
    end = 2 * ramp + steady
    n = 16
    rise = [ramp * i / n for i in range(n + 1)]
    times = list(rise)
    values = [peak * (t / ramp) ** 2 for t in rise]
    if steady > 1e-9:
        times.append(ramp + steady)
        values.append(peak)
    for i in range(1, n + 1):
        t = ramp + steady + ramp * i / n
        times.append(t)
        values.append(peak * ((end - t) / ramp) ** 2)
    # Linear interpolation of the sampled t-squared ramps over-counts slightly;
    # rescale so CFAST's piecewise-linear table carries exactly the total heat.
    scale = energy / trapz_kj(times, values)
    values = [v * scale for v in values]
    return {
        "t": [round(t, 4) for t in times],
        "kw": [round(v, 6) for v in values],
        "peakKw": max(values),
        "growthS": ramp,
        "steadyS": steady,
        "endS": end,
        "basis": basis,
        "notes": notes,
    }


def simplify_series(t: np.ndarray, q: np.ndarray, budget: int) -> np.ndarray:
    """Indices of a Ramer-Douglas-Peucker simplification with at most ``budget`` points."""
    n = len(t)
    if n <= budget:
        return np.arange(n)

    def keep_for(tolerance: float) -> np.ndarray:
        keep = np.zeros(n, dtype=bool)
        keep[0] = keep[-1] = True
        stack = [(0, n - 1)]
        while stack:
            i, j = stack.pop()
            if j <= i + 1:
                continue
            span = t[i + 1 : j]
            line = q[i] + (q[j] - q[i]) * (span - t[i]) / (t[j] - t[i])
            err = np.abs(q[i + 1 : j] - line)
            k = int(np.argmax(err))
            if err[k] > tolerance:
                m = i + 1 + k
                keep[m] = True
                stack.append((i, m))
                stack.append((m, j))
        return keep

    lo, hi = 0.0, float(np.max(q) - np.min(q)) + 1e-9
    best = keep_for(hi)
    for _ in range(60):
        mid = (lo + hi) / 2
        keep = keep_for(mid)
        if keep.sum() <= budget:
            best, hi = keep, mid
        else:
            lo = mid
    return np.flatnonzero(best)


def ignis_table(ignis: dict[str, Any]) -> tuple[list[float], list[float], float]:
    """IGNIS heat release as a CFAST table of at most TABLE_POINT_BUDGET points.

    The 1 s history is simplified (Ramer-Douglas-Peucker) and rescaled so the
    table's integral equals the heat IGNIS released.
    """
    history = ignis["history"]
    t = np.asarray(history["t"], float)
    q = np.asarray(history["hrrW"], float) / 1000.0
    target = float(ignis["totalHeatJ"]) / 1000.0
    idx = simplify_series(t, q, TABLE_POINT_BUDGET)
    tt, qq = t[idx], q[idx]
    current = trapz_kj(tt, qq)
    if current > 0:
        qq = qq * (target / current)
    return [round(float(v), 4) for v in tt], [round(float(v), 6) for v in qq], target


def load_inputs(input_dir: Path = INPUT_DIR) -> list[dict[str, Any]]:
    index_path = input_dir / "index.json"
    if not index_path.exists():
        raise CfastInputError(
            f"{index_path} is missing. Export the IGNIS inputs first:\n"
            "  CFAST_EXPORT=1 npx vitest run src/lib/fire/cfast-export.test.ts"
        )
    index = json.loads(index_path.read_text(encoding="utf-8"))
    out = []
    for entry in index["cases"]:
        data = json.loads((input_dir / entry["file"]).read_text(encoding="utf-8"))
        if data.get("schemaVersion") != 1:
            raise CfastInputError(f"{entry['file']}: unsupported schemaVersion {data.get('schemaVersion')}")
        out.append(data)
    return out


def _base_case(data: dict[str, Any], **overrides: Any) -> Case:
    geometry = data["geometry"]
    atmosphere = data["atmosphere"]
    width, depth, matched = box_for(geometry["volumeM3"], geometry["heightM"], geometry["wallAreaM2"])
    notes = []
    if not matched:
        notes.append("No box has the IGNIS wall area at this volume and height; a square footprint is used.")
    fields: dict[str, Any] = dict(
        group=data["kind"],
        source_id=data["id"],
        gravity_g=float(atmosphere["gravityG"]),
        pressure_kpa=float(atmosphere["pressureKpa"]),
        oxygen_pct=float(atmosphere["oxygenPct"]),
        ambient_c=float(atmosphere["ambientC"]),
        volume_m3=float(geometry["volumeM3"]),
        height_m=float(geometry["heightM"]),
        width_m=width,
        depth_m=depth,
        ignis_wall_area_m2=float(geometry["wallAreaM2"]),
        fire_height_m=float(geometry["fireHeightM"]),
        fire_area_m2=float(data["fuel"]["areaM2"]),
        material=data["material"],
        source=data,
        notes=notes,
    )
    fields.update(overrides)
    return Case(**fields)


def cases_for(data: dict[str, Any]) -> list[Case]:
    """CFAST cases for one exported IGNIS input."""
    out: list[Case] = []
    t, kw, ignis_heat = ignis_table(data["ignis"])
    horizon = int(math.ceil(data["run"]["durationS"]))
    zero_g = data["atmosphere"]["gravityG"] <= 0
    if data["kind"] == "saffire":
        benchmark = data["benchmark"]
        shape = published_shape(benchmark)
        out.append(
            _base_case(
                data,
                id=f"{data['id']}-published",
                label=f"{data['label']} · published heat release",
                hrr_source="published-shape",
                zone_model="single-zone",
                bounding=False,
                horizon_s=int(math.ceil(max(benchmark["burnDurationS"], shape["endS"]))),
                hrr_t=shape["t"],
                hrr_kw=shape["kw"],
                target_heat_kj=float(benchmark["totalHeatKJ"]),
                shape={k: shape[k] for k in ("peakKw", "growthS", "steadyS", "endS", "basis")},
            )
        )
        out[-1].notes.extend(shape["notes"])
        out.append(
            _base_case(
                data,
                id=f"{data['id']}-ignis",
                label=f"{data['label']} · IGNIS heat release",
                hrr_source="ignis",
                zone_model="single-zone",
                bounding=False,
                horizon_s=horizon,
                hrr_t=t,
                hrr_kw=kw,
                target_heat_kj=ignis_heat,
            )
        )
        return out
    out.append(
        _base_case(
            data,
            id=f"{data['id']}-single",
            label=f"{data['label']} · single zone",
            hrr_source="ignis",
            zone_model="single-zone",
            bounding=False,
            horizon_s=horizon,
            hrr_t=t,
            hrr_kw=kw,
            target_heat_kj=ignis_heat,
        )
    )
    if not zero_g:
        bound = _base_case(
            data,
            id=f"{data['id']}-two-zone",
            label=f"{data['label']} · two-zone bound",
            hrr_source="ignis",
            zone_model="two-zone",
            bounding=True,
            horizon_s=horizon,
            hrr_t=t,
            hrr_kw=kw,
            target_heat_kj=ignis_heat,
        )
        bound.notes.append(
            "CFAST's plume and layer correlations assume 1 g, so this two-zone result over-states "
            f"stratification at {data['atmosphere']['gravityG']} g; it bounds the hot layer, it is not a prediction."
        )
        out.append(bound)
    return out


def build_cases(input_dir: Path = INPUT_DIR) -> list[Case]:
    return [case for data in load_inputs(input_dir) for case in cases_for(data)]


def build_model(case: Case, build_dir: Path = BUILD_DIR, cfast_exe: str | None = None) -> CFASTModel:
    """A pycfast model for one case. The input file goes to build_dir/<stem>/<stem>.in."""
    if len(case.hrr_t) > CFAST_MAX_TABLE_POINTS:
        raise CfastInputError(f"{case.id}: {len(case.hrr_t)} HRR points exceed CFAST's limit of 199.")
    env = CabinEnvironment(
        title=case.id[:50],
        time_simulation=case.horizon_s,
        print=max(1, min(60, case.horizon_s // 2)),
        smokeview=0,
        spreadsheet=1,
        init_pressure=round(case.pressure_kpa * 1000.0, 3),
        relative_humidity=RELATIVE_HUMIDITY,
        interior_temperature=case.ambient_c,
        exterior_temperature=case.ambient_c,
        lower_oxygen_limit=LOWER_OXYGEN_LIMIT,
        o2_mass_fraction=round(case.o2_mass_fraction, 6),
    )
    ids = [m.id for m in WALL_LAYERS]
    thickness = [m.thickness for m in WALL_LAYERS]
    compartment = Compartment(
        id="CABIN",
        width=round(case.width_m, 6),
        depth=round(case.depth_m, 6),
        height=case.height_m,
        shaft=True if case.zone_model == "single-zone" else None,
        ceiling_mat_id=list(ids),
        ceiling_thickness=list(thickness),
        wall_mat_id=list(ids),
        wall_thickness=list(thickness),
        floor_mat_id=list(ids),
        floor_thickness=list(thickness),
    )
    formula = fuel_formula(case.material["elements"])
    yields = case.material["yields"]
    rows = [
        [t, kw, case.fire_height_m, case.fire_area_m2, yields["co"], yields["soot"], 0.0, 0.0, 0.0]
        for t, kw in zip(case.hrr_t, case.hrr_kw, strict=True)
    ]
    fire = Fire(
        id="FIRE",
        comp_id="CABIN",
        fire_id=case.material["id"].upper().replace("-", "")[:16],
        location=(round(case.width_m / 2, 6), round(case.depth_m / 2, 6)),
        carbon=formula["c"],
        hydrogen=formula["h"],
        oxygen=formula["o"],
        nitrogen=0,
        chlorine=0,
        heat_of_combustion=case.material["heatOfCombustionMJkg"] * 1000.0,
        radiative_fraction=case.material["radiativeFraction"],
        data_table=rows,
    )
    case_dir = build_dir / case.file_stem
    case_dir.mkdir(parents=True, exist_ok=True)
    return CFASTModel(
        simulation_environment=env,
        compartments=[compartment],
        material_properties=list(WALL_LAYERS),
        fires=[fire],
        file_name=str(case_dir / f"{case.file_stem}.in"),
        cfast_exe=cfast_exe,
    )


def write_inputs(cases: list[Case], build_dir: Path = BUILD_DIR, clean: bool = True) -> dict[str, Path]:
    if clean and build_dir.exists():
        shutil.rmtree(build_dir)
    paths = {}
    for case in cases:
        paths[case.id] = Path(build_model(case, build_dir).save())
    return paths


def main() -> int:
    cases = build_cases()
    paths = write_inputs(cases)
    for case in cases:
        print(
            f"{case.id:28s} {case.zone_model:11s} g={case.gravity_g:<5} P={case.pressure_kpa:6.1f} kPa "
            f"O2={case.oxygen_pct:5.1f}% V={case.volume_m3:6.2f} m3 heat={case.target_heat_kj:7.1f} kJ "
            f"points={len(case.hrr_t):3d} -> {paths[case.id].relative_to(HERE)}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
