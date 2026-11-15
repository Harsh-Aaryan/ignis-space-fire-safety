# NIST CFAST cross-check

An offline reference for the cabin gas temperature and oxygen that the IGNIS fire
model computes. [CFAST](https://pages.nist.gov/cfast/) is NIST's Consolidated Fire
and Smoke Transport zone model. Here it is driven, through
[pycfast](https://pypi.org/project/pycfast/), with a prescribed heat-release
history and answers one question: given this heat release in this cabin, how warm
does the cabin gas get and how much oxygen is used?

CFAST does not predict burning, so it checks the cabin response, not the flame.
The website cannot run CFAST; the results are computed here and shipped as
`src/data/fire/cfast-reference.json`, which `src/lib/fire/cfast.ts` reads and
`src/components/research/cfast-crosscheck.tsx` displays.

## Cases

| Case | Heat release | Zones |
|---|---|---|
| Saffire IV-1, VI-2, VI-3, VI-4, `-published` | Assumed shape constrained by the published peak and total heat | single zone, 0 g |
| Saffire rows, `-ignis` | IGNIS history for the same row (`saffireInput`) | single zone, 0 g |
| `moon-lab-single`, `mars-lab-single`, `gateway-ihab-single` | IGNIS history: PMMA sample on the laboratory workbench (`buildFireInput`) | single zone |
| `moon-lab-two-zone`, `mars-lab-two-zone` | same IGNIS history | two-zone, bounding only |

Inputs and their sources:

* Saffire flight conditions, free volume, peak and total heat, burn duration,
  measured far-field temperature and CO₂ rise: `SAFFIRE_BENCHMARKS` in
  `src/data/fire/options.ts` (ICES-2024-365 Tables 1 and 2).
  IGNIS histories end at ignition plus the published burn duration. VI-3 uses
  the published fan commands at 483 s and 783 s after ignition; the latter falls
  just after the rounded 780 s observation window. VI-4's complete airflow history is unavailable.
  The exported atmosphere includes the prescribed schedule. CFAST sees its effect
  through the prescribed heat history; recirculation is not an external vent.
* Cabin height, floor and wall area for the Cygnus cabin: `saffireInput()` in
  `src/lib/fire/scenario.ts`. Habitat rooms: `roomGeometry()` of the room in
  `src/data/habitat-interiors.ts`; atmospheres from `src/data/missions.ts`.
* Fuel chemistry (C/H/O formula, heat of combustion, radiative fraction, CO and
  soot yields): `src/data/fire/materials.ts` and `src/lib/fire/chemistry.ts`.
* Every CFAST box keeps the IGNIS free volume, room height and wall area (width
  and depth are solved for). The fire sits at the box centre at the IGNIS fuel
  height; its base area is the fuel sample face.

Assumptions (labelled as such in the JSON):

* **Published-shape heat release.** t-squared growth, steady burning and a
  mirrored t-squared decay (CFAST's t-squared fire form, User's Guide section
  6.3). Its integral always equals the published total heat. It reaches the
  published peak where one is published and lasts the published burn duration
  when the peak and total heat allow it. IV-1 publishes no peak: growth and decay
  each take 10 % of the burn. VI-2 publishes 580 kJ, a 3217 W peak, a 3650 W
  average and a 112 s burn, which cannot all hold; the peak and total heat are
  kept and the burn lasts 195 s. These notes are written into each case.
* **Walls.** 5 mm aluminium shell with handbook 6061-T6 properties
  (12.1 kJ/m²·K, the same lumped capacity as the IGNIS wall), backed by a fibrous
  blanket that gives the IGNIS wall loss of 0.3 W/m²·K to ambient, emissivity 0.9.
* **Closed cabins.** No vents, no leakage. The Saffire flow duct (0.135 m² at
  20 cm/s) recirculates air inside the vehicle; inside one well-mixed zone that
  has no effect, so it is not a CFAST vent. Habitat rooms are closed to the rest
  of the habitat in both models (the exporter sets the IGNIS habitat volume to
  the room volume).
* **Dry start.** Relative humidity 0, as in IGNIS, so O₂ mole fractions mean the
  same thing in both models.

## CFAST facts this relies on

Checked in the CFAST 7.7.7 documentation (NIST TN 1889v1 Technical Reference,
TN 1889v2 User's Guide, both revised 2026-05-27) and in the solver's own echo of
its inputs.

* **Gravity is not configurable.** No namelist has a gravity input; g = 9.8 m/s²
  is a constant (Technical Reference, nomenclature). It enters the Heskestad
  plume entrainment (eq. 3.17) and the natural-convection wall coefficient
  h = C |Tg − Tw|^(1/3) (eq. 5.23).
* **0 g cabins are single well-mixed zones.** `&COMP SHAFT = .TRUE.` (User's
  Guide section 4.3, "Shaft (single-zone model)"); in pycfast,
  `Compartment(shaft=True)`. Without gravity there is no buoyant layer and the
  cabin fans mix the air.
* **Lunar and Martian two-zone runs are bounds.** CFAST's plume and layer
  correlations assume 1 g, so the two-zone result over-states stratification at
  0.165 g and 0.38 g. It is kept, labelled `bounding`, next to the single-zone
  result.
* **Initial oxygen is settable.** `&INIT INTERIOR_O2_MASS_FRACTION` and
  `EXTERIOR_O2_MASS_FRACTION` (kg/kg, default 0.23; User's Guide section 2.3,
  Table B.4). pycfast 0.2.2 does not expose them, so `CabinEnvironment` in
  `cases.py` adds them. The cabin O₂ mole fraction is converted with N₂ as the
  balance; CFAST then starts within 0.005 mole-% points of the target. Oxygen is
  reported as CFAST's depletion in mole-fraction points applied to the cabin's
  initial O₂ (the same number unless CFAST's start differs; that is checked).
* **Pressure.** `&INIT PRESSURE` in Pa, inside and outside (User's Guide
  section 2.3), e.g. 54 100 Pa for VI-2.
* **Lower oxygen limit.** `&MISC LOWER_OXYGEN_LIMIT` is an O₂ mass fraction,
  default 0.15 (Table B.5; Technical Reference eqs. 3.14–3.15: burning is
  multiplied by C_LOL = (tanh(800 (Y_O2 − Y_O2,l) − 4) + 1)/2). The CEdit
  section of the User's Guide calls it a percentage; the solver echoes the input
  0.05 as "5.00". It is set to 0.05, far below every cabin here (lowest initial
  0.244), and `run_cases.py` checks that CFAST released the prescribed heat
  (`fire.releasedShare`, all ≥ 0.99).
* **Fire table.** `&TABL` HEIGHT is the height of the fire base (User's Guide
  section 6.2; pycfast's docstring calls it flame height). A fire definition
  takes at most 199 points (User's Guide Appendix A), so the 1 s IGNIS history
  is simplified (Ramer–Douglas–Peucker, at most 190 points) and rescaled to the
  heat IGNIS released.
* **Solver quirk found while running 7.7.7.** pycfast passes the input file
  stem on the command line, and a stem containing "-I" (such as
  `saffire-IV-1`) makes CFAST stop after initialising ("Initialize only", empty
  CSV files). File stems therefore use underscores (`saffire_IV_1_ignis`).

## How to run

1. Install CFAST 7.7 from <https://pages.nist.gov/cfast/>, then either set the
   `CFAST` environment variable to `cfast.exe`, put `cfast` on `PATH`, or unpack
   the NIST package into `tools/cfast/` (gitignored), giving
   `tools/cfast/firemodels/cfast7/cfast.exe`.
2. `pip install -r scripts/cfast/requirements.txt` (add `--user` if the system
   site is not writable).
3. Export the IGNIS inputs from the current model. On Windows run vitest from
   PowerShell or cmd, not Git Bash: a `/d/...` working directory loads vitest
   twice and every suite fails.

   ```powershell
   $env:CFAST_EXPORT = '1'; npx vitest run src/lib/fire/cfast-export.test.ts; Remove-Item Env:CFAST_EXPORT
   ```

   ```sh
   CFAST_EXPORT=1 npx vitest run src/lib/fire/cfast-export.test.ts
   ```

   This writes `scripts/cfast/inputs/*.json`. Without `CFAST_EXPORT=1` the test is
   skipped, so `npm test` is unaffected.
4. Run the cases:

   ```sh
   python scripts/cfast/run_cases.py
   ```

   It builds every case, writes the CFAST inputs and outputs to
   `scripts/cfast/build/` (gitignored), and overwrites
   `src/data/fire/cfast-reference.json` with `status: "ok"`. Without CFAST it
   exits with code 2 and leaves the JSON untouched.

`python scripts/cfast/cases.py` only writes the `.in` files.
`python -m unittest scripts/cfast/test_cases.py` checks the generated inputs
without CFAST: input files parse back, heat-release integrals equal the published
or IGNIS totals, pressures, oxygen, volumes and wall areas match, 0 g cases set
SHAFT, and the oxygen limit cannot throttle.

Re-run steps 3 and 4 after any change to the IGNIS fire model.
