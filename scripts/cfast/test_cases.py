"""Offline checks of the CFAST case generation. CFAST itself is not needed.

    python -m unittest scripts/cfast/test_cases.py
"""

from __future__ import annotations

import math
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import f90nml
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cases as C  # noqa: E402
import run_cases as R  # noqa: E402

try:
    from pycfast.parsers import parse_cfast_file
except ImportError:  # pragma: no cover - older pycfast
    parse_cfast_file = None


class GeneratedCases(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.inputs = C.load_inputs()
        cls.cases = C.build_cases()
        cls.tmp = tempfile.TemporaryDirectory()
        cls.paths = C.write_inputs(cls.cases, Path(cls.tmp.name), clean=False)
        cls.namelists = {case.id: f90nml.read(cls.paths[case.id]) for case in cls.cases}

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def test_inventory(self) -> None:
        ids = {case.id for case in self.cases}
        saffire = [d for d in self.inputs if d["kind"] == "saffire"]
        self.assertGreaterEqual(len(saffire), 4)
        for d in saffire:
            self.assertIn(f"{d['id']}-published", ids)
            self.assertIn(f"{d['id']}-ignis", ids)
        for habitat in ("moon-lab", "mars-lab", "gateway-ihab"):
            self.assertIn(f"{habitat}-single", ids)
        self.assertIn("moon-lab-two-zone", ids)
        self.assertIn("mars-lab-two-zone", ids)
        self.assertNotIn("gateway-ihab-two-zone", ids)

    def test_input_files_parse_back(self) -> None:
        for case in self.cases:
            nml = self.namelists[case.id]
            for group in ("head", "time", "init", "misc", "matl", "comp", "fire", "chem", "tabl"):
                self.assertIn(group, nml, f"{case.id}: missing &{group.upper()}")
            if parse_cfast_file is not None:
                model = parse_cfast_file(self.paths[case.id], output_path=Path(self.tmp.name) / "roundtrip.in")
                self.assertEqual(len(model.compartments), 1)
                self.assertEqual(len(model.fires), 1)
                self.assertAlmostEqual(model.simulation_environment.init_pressure, case.pressure_kpa * 1000, places=2)
                self.assertEqual(len(model.fires[0].data_table), len(case.hrr_t))

    def test_zero_g_is_single_zone(self) -> None:
        for case in self.cases:
            comp = self.namelists[case.id]["comp"]
            if case.gravity_g <= 0:
                self.assertEqual(case.zone_model, "single-zone", case.id)
                self.assertIs(comp.get("shaft"), True, f"{case.id}: SHAFT must be set in 0 g")
            if case.zone_model == "two-zone":
                self.assertGreater(case.gravity_g, 0)
                self.assertTrue(case.bounding)
                self.assertIsNone(comp.get("shaft"), f"{case.id}: two-zone run must not set SHAFT")
                self.assertTrue(any("bound" in note for note in case.notes))

    def test_published_heat_integrals(self) -> None:
        for case in self.cases:
            if case.hrr_source != "published-shape":
                continue
            bm = case.source["benchmark"]
            self.assertAlmostEqual(C.trapz_kj(case.hrr_t, case.hrr_kw), bm["totalHeatKJ"], delta=1e-6 * bm["totalHeatKJ"])
            self.assertAlmostEqual(case.target_heat_kj, bm["totalHeatKJ"])
            self.assertEqual(case.hrr_kw[0], 0.0)
            self.assertAlmostEqual(case.hrr_kw[-1], 0.0, places=9)
            if bm["peakHeatW"] is not None:
                self.assertAlmostEqual(max(case.hrr_kw), bm["peakHeatW"] / 1000, delta=0.005 * bm["peakHeatW"] / 1000)
            if "burn duration" in case.shape["basis"]:
                self.assertAlmostEqual(case.hrr_t[-1], bm["burnDurationS"], places=6)
            self.assertGreaterEqual(case.horizon_s, case.hrr_t[-1])

    def test_ignis_heat_integrals(self) -> None:
        for case in self.cases:
            if case.hrr_source != "ignis":
                continue
            total = case.source["ignis"]["totalHeatJ"] / 1000
            self.assertAlmostEqual(C.trapz_kj(case.hrr_t, case.hrr_kw), total, delta=1e-6 * max(total, 1))
            self.assertLessEqual(len(case.hrr_t), C.CFAST_MAX_TABLE_POINTS)
            self.assertEqual(case.hrr_t[0], 0.0)
            self.assertTrue(all(b > a for a, b in zip(case.hrr_t, case.hrr_t[1:])))
            self.assertAlmostEqual(case.hrr_t[-1], case.source["run"]["durationS"])

    def test_pressure_oxygen_and_temperature(self) -> None:
        for case in self.cases:
            init = self.namelists[case.id]["init"]
            atmosphere = case.source["atmosphere"]
            self.assertAlmostEqual(init["pressure"], atmosphere["pressureKpa"] * 1000, places=2)
            self.assertAlmostEqual(init["interior_temperature"], atmosphere["ambientC"])
            self.assertEqual(init["relative_humidity"], 0)
            y = init["interior_o2_mass_fraction"]
            self.assertEqual(y, init["exterior_o2_mass_fraction"])
            self.assertAlmostEqual(C.o2_mole_pct(y), atmosphere["oxygenPct"], delta=1e-3)

    def test_saffire_rows_use_their_flight_conditions(self) -> None:
        for case in self.cases:
            if case.group != "saffire":
                continue
            bm = case.source["benchmark"]
            self.assertAlmostEqual(case.pressure_kpa, bm["pressureKpa"])
            self.assertAlmostEqual(case.oxygen_pct, bm["oxygenPct"])
            self.assertAlmostEqual(case.volume_m3, bm["freeVolumeM3"])
            self.assertEqual(case.gravity_g, 0)

    def test_volume_height_and_wall_area(self) -> None:
        for case in self.cases:
            comp = self.namelists[case.id]["comp"]
            volume = comp["width"] * comp["depth"] * comp["height"]
            self.assertAlmostEqual(volume, case.source["geometry"]["volumeM3"], delta=1e-4)
            self.assertAlmostEqual(comp["height"], case.source["geometry"]["heightM"])
            self.assertAlmostEqual(case.surface_area_m2, case.source["geometry"]["wallAreaM2"], delta=0.05)
            x, y = self.namelists[case.id]["fire"]["location"]
            self.assertTrue(0 < x < comp["width"] and 0 < y < comp["depth"])
            heights = {row["data"][2] for row in self.namelists[case.id]["tabl"] if "data" in row}
            self.assertTrue(all(0 <= h < comp["height"] for h in heights))

    def test_closed_cabin(self) -> None:
        for case in self.cases:
            nml = self.namelists[case.id]
            self.assertNotIn("vent", nml, f"{case.id}: the cabin is closed")
            self.assertIsNone(nml["comp"].get("leak_area_ratio"))

    def test_lower_oxygen_limit_cannot_throttle(self) -> None:
        lowest = min(case.o2_mass_fraction for case in self.cases)
        for case in self.cases:
            limit = self.namelists[case.id]["misc"]["lower_oxygen_limit"]
            self.assertEqual(limit, C.LOWER_OXYGEN_LIMIT)
        # CFAST's smoothing reaches 1 within 0.01 above the limit (Tech Ref eq. 3.15).
        # Allow 3 mole-% points of depletion, several times the largest seen here.
        self.assertGreater(C.o2_mass_fraction(C.o2_mole_pct(lowest) - 3), C.LOWER_OXYGEN_LIMIT + 0.02)

    def test_cfast_file_names_have_no_switch_characters(self) -> None:
        for case in self.cases:
            self.assertNotIn("-", Path(self.paths[case.id]).stem)


class Helpers(unittest.TestCase):
    def test_fuel_formulas(self) -> None:
        self.assertEqual(C.fuel_formula({"c": 0.60, "h": 0.08, "o": 0.32}), {"c": 5.0, "h": 8.0, "o": 2.0})
        self.assertEqual(C.fuel_formula({"c": 72 / 162, "h": 10 / 162, "o": 80 / 162}), {"c": 6.0, "h": 10.0, "o": 5.0})
        self.assertEqual(C.fuel_formula({"c": 12 / 14, "h": 2 / 14, "o": 0.0}), {"c": 1.0, "h": 2.0, "o": 0.0})

    def test_oxygen_conversion_round_trip(self) -> None:
        # Binary O2/N2 (CFAST takes N2 as the balance); real air with argon is 0.2314.
        self.assertAlmostEqual(C.o2_mass_fraction(20.95), 0.2324, delta=2e-4)
        for pct in (21.0, 28.8, 32.0):
            self.assertAlmostEqual(C.o2_mole_pct(C.o2_mass_fraction(pct)), pct, places=10)

    def test_box_keeps_volume_and_area(self) -> None:
        w, d, matched = C.box_for(16.7, 3.0, 50.0)
        self.assertTrue(matched)
        self.assertAlmostEqual(w * d * 3.0, 16.7)
        self.assertAlmostEqual(2 * w * d + 2 * (w + d) * 3.0, 50.0)
        w, d, matched = C.box_for(16.7, 3.0, 20.0)
        self.assertFalse(matched)
        self.assertAlmostEqual(w, d)

    def test_published_shape_branches(self) -> None:
        base = {"totalHeatKJ": 600.0, "burnDurationS": 300.0, "avgHeatW": None}
        consistent = C.published_shape({**base, "peakHeatW": 3000.0})
        self.assertEqual(consistent["basis"], "peak, total heat and burn duration")
        self.assertAlmostEqual(C.trapz_kj(consistent["t"], consistent["kw"]), 600.0, delta=1e-6 * 600)
        self.assertAlmostEqual(consistent["t"][-1], 300.0)
        too_short = C.published_shape({**base, "burnDurationS": 100.0, "peakHeatW": 3000.0, "avgHeatW": 4000.0})
        self.assertIn("lengthened", too_short["basis"])
        self.assertGreater(too_short["endS"], 100.0)
        self.assertEqual(len(too_short["notes"]), 2)
        no_peak = C.published_shape({**base, "peakHeatW": None})
        self.assertAlmostEqual(no_peak["growthS"], C.GROWTH_FRACTION * 300.0)
        self.assertAlmostEqual(C.trapz_kj(no_peak["t"], no_peak["kw"]), 600.0, delta=1e-6 * 600)

    def test_simplification_respects_budget(self) -> None:
        t = np.arange(0, 1000.0)
        q = np.where(t > 10, 1 + 0.2 * np.sin(t / 7), 0.0)
        idx = C.simplify_series(t, q, 120)
        self.assertLessEqual(len(idx), 120)
        self.assertEqual(idx[0], 0)
        self.assertEqual(idx[-1], len(t) - 1)


class PostProcessing(unittest.TestCase):
    def test_single_zone_passthrough(self) -> None:
        comp = pd.DataFrame({"Time": [0, 1], "ULT_1": [20.0, 25.0], "ULO2_1": [21.0, 20.5], "ULCO2_1": [0.0, 0.1]})
        means = R.layer_means(comp, 10.0)
        np.testing.assert_allclose(means["tempC"], [20.0, 25.0])
        np.testing.assert_allclose(means["o2Pct"], [21.0, 20.5])

    def test_two_zone_mole_weighting(self) -> None:
        comp = pd.DataFrame(
            {
                "Time": [0.0],
                "ULT_1": [100.0],
                "LLT_1": [20.0],
                "VOL_1": [5.0],
                "ULO2_1": [19.0],
                "LLO2_1": [21.0],
                "ULCO2_1": [1.0],
                "LLCO2_1": [0.0],
            }
        )
        means = R.layer_means(comp, 10.0)
        wu, wl = 5 / 373.15, 5 / 293.15
        self.assertAlmostEqual(means["o2Pct"][0], (19 * wu + 21 * wl) / (wu + wl))
        self.assertAlmostEqual(means["tempC"][0], 10 / (wu + wl) - 273.15)
        self.assertAlmostEqual(means["upperTempC"][0], 100.0)

    def test_missing_cfast_is_a_clear_error(self) -> None:
        with mock.patch.dict(os.environ, {"CFAST": str(Path(tempfile.gettempdir()) / "no-such-cfast.exe")}):
            with self.assertRaises(R.CfastNotAvailable):
                R.resolve_cfast()

    def test_grid_is_coarse(self) -> None:
        grid = R.grid_for(1200)
        self.assertLessEqual(len(grid), R.GRID_POINTS + 2)
        self.assertEqual(grid[0], 0)
        self.assertEqual(grid[-1], 1200)
        self.assertTrue(math.isclose(R.grid_for(112)[-1], 112))


if __name__ == "__main__":
    unittest.main()
