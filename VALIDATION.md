# IGNIS model v2: verification and scientific limits

Updated 2026-11-14. Implementation follows [SCIENCE-UX-PLAN.md](SCIENCE-UX-PLAN.md). Model version: **2.0.0**.

## What changed

The gas network now exchanges energy with species. Nominal PMMA, cellulose and polyethylene reaction budgets conserve carbon, hydrogen and oxygen. Water vapor, transported unburned fuel vapor, condensed pre-fire aerosols, deposition and remaining fuel have separate inventories. Local oxygen delivery constrains combustion. Chemical HRR is separate from ignition-source heating.

Fuel heating uses implicit one-dimensional conduction for thick solids and a lumped layer for thin/edge cases. Radiation, convection, source shutoff and wall heating retain temperature history. Electrical overload power uses I²R for the assumed circuit. Arc and battery inputs remain prescribed illustrative sources, with finite duration/energy.

Finite CO₂ and chemical-agent doses enter the gas inventories. Water discharge is split into deposited and evaporated mass; captured evaporation is bounded by accessible surface heat and pressure-dependent boiling temperature. Direct calibrated flame/spray transfer is not resolved. Fixed one-second mist extinction and an unlimited local vapor reservoir are no longer imposed.

Flames use a ray-marched shader envelope driven by modeled extent, flow and soot tendency. The default scale is physical; enlargement is an explicit option. Smoke uses solver transport-step history and particle diffusivity; tracer opacity uses an assumed effective mass-extinction coefficient. These are illustrative transport visuals, not a calibrated optical instrument or resolved HVAC CFD. Individual modeled detector locations have their own signals and alarm states.

The navigation has four primary destinations: Home, Fire simulation, NASA research and Results. Set up, Run, Respond and Review share the forecast editor and scenario state. Ask IGNIS is available globally and can explain a captured scenario with real citations or compute a copied fan-shutdown comparison. It is a structured local scenario assistant; a live generative provider is not connected.

## Verification

| Check | Result |
| --- | --- |
| Unit suite | 77 passed in 11 files, including the existing diagnostic probe. |
| Production build | Passed compilation, TypeScript and generation of all application routes after the final correction. |
| Full production browser suite, first pass | 14 passed, 2 optional captures skipped, no failures. Includes original Moon/Mars/Gateway navigation and new workflow/assistant cases. |
| Final correction browser suite | 14 passed, 2 optional captures skipped, 0 failed, 0 flaky (7.6 minutes). |
| Saffire-I extraction | Matches the original workbook exactly. |
| NASA file integrity | Original metadata, eight experimental CSVs and workbook retain their recorded SHA-256 hashes. |
| Original scenes/assets | Moon, Mars and Gateway habitat modules and all public assets are unchanged. |
| Whitespace check | `git diff --check` passed. |

The browser tests cover ignition, pause, suppression, reset, camera framing and raycasts in all habitats; the Research → comparison → simulation handoff; source tables/downloads; mobile no-WebGL controls; assistant citations, copied comparisons and keyboard behavior; run export; original cutaway, deck, exterior and dossier routes. The optional `zz-*` capture scripts require `SHOT_DIR` and remain skipped by default.

Final browser JSON is `.qa-baseline/v2-final-playwright.json`; screenshots are archived in `.qa-baseline/v2-final-browser/`. These machine-specific QA artifacts are ignored by Git. The first complete run is archived in `.qa-baseline/v2-first-pass/`.

## Numerical audit

Run `node scripts/audit-fire-model.cjs` to regenerate `.qa-baseline/v2-physics-audit.json`. It reads the current source without fitting coefficients or modifying data.

- The isolated two-zone energy-exchange example has a **0 J residual**. Tests also check larger transport steps and unequal temperatures.
- PMMA reaction products now contain the nominal fuel carbon inventory. CO₂ is reduced after CO/soot partitioning; the earlier 0.657 kg carbon from 0.600 kg fuel carbon is removed.
- Global oxygen loss matches reaction consumption. Total pyrolysed fuel is accounted for by burned material, transported vapor and retained/removed condensed aerosols.
- For the 600 s lunar PMMA audit case, 0.25 s and 0.125 s public steps both give 528.640 kJ because the internal step is bounded at 0.125 s. A 0.0625 s step gives 528.390 kJ: **about 0.047% difference**. Ignition is 8.5 s in both; alarm time differs by 0.0625 s.
- Finite dose tests check discharge boundaries and repeated actions. Mist tests verify evaporated + deposited water equals released water and the accessible fuel surface does not overcool below incoming water temperature in the tested case.
- Numerical checks do not establish accuracy of spread, yields, detector response, whole-cabin temperature or suppression time in flight.

Measured throughput for the 600 s case is recorded in the JSON report; timing varies with JIT, hardware and simultaneous browser work. It is not a browser/GPU performance guarantee. Browser QA uses installed Edge with software WebGL; native mobile-device frame rates have not been established.

`node scripts/profile-fire-scene.cjs` measured **0.53 fps** over a 5.61 s / three-frame sample at 1600×1000 in forced SwiftShader software rendering during 10× playback. This software-rendered configuration does **not** meet the proposed frame-rate target. The report is `.qa-baseline/v2-render-performance.json`; the captured scene is `.qa-baseline/v2-profiled-scene.png`. No native GPU/mobile performance claim is made, and original render geometry/presets were retained. Test on the intended GPU before a live demonstration; this short sample cannot establish general-device performance.

## Publication comparisons

These run the reported duration with constant initial flow, without reconstructing flight fan changes or ignition timing. They compare model output with publication summaries; they are **not independent validation**. Values are published / modeled, rounded:

| Test | HRR basis | HRR (W) | Heat (kJ) | CO₂ rise (ppm) | CO rise (ppm) |
| --- | --- | --- | --- | --- | --- |
| IV-1 | Mean | 3150 / 707 | 409 / 92 | 1390 / 296 | 80 / 1 |
| VI-2 | Peak | 3217 / 1108 | 580 / 100 | 2800 / 647 | 120 / 3 |
| VI-3 | Peak | 3080 / 1496 | 1280 / 796 | 8539 / 4029 | 308 / 30 |
| VI-4 | Peak | 1507 / 922 | 830 / 758 | 8117 / 3802 | 320 / 28 |

**These discrepancies are substantial.** Conserving inventory and removing transferred assumptions has not produced a scientifically validated predictor. Model v2 is not refitted to make these summary rows pass. The interface displays the comparison residuals. Matching a peak alone would not establish agreement with the complete fire history.

Saffire VI-2 reports different calorimetry methods, including 580 kJ by oxygen calorimetry and 409 kJ by fuel consumption. Published quantities remain distinct; inconsistencies are not silently reconciled. Full synchronized HRR/O₂/CO/CO₂ histories, fan/igniter schedules, calibration and uncertainty are still needed before rigorous fitting and held-out evaluation.

## Scope of scientific support

All 12 prepared material profiles are retained. Flaming reaction budgets are enabled for PMMA, SIBAL, paper and LDPE. The other eight profiles support exploratory heating/pyrolysis/aerosol behavior while their flaming chemistry is withheld. Complex fluorinated, silicon- and nitrogen-containing product chemistry, acid gases, deflagration and battery cell kinetics are not solved.

Handbook-attributed values without exact verified tables stay labeled as assumed. Parameter exports include units, evidence class, source context, reference pressure, model version and uncertainty notes. The original source measurements and prepared material values are not rewritten to force agreement with model output. Some active coefficients remain empirical or exploratory, including spread, feedback efficiency, effective gasification heat, pre-fire aerosol generation, representative vapor molecular mass, wall properties, exchange geometry, detector response and agent capture.

Buoyant correlations carry gravity and mixture conditions, but their partial-gravity application remains an extrapolation. A nominal lunar or Martian case is not proof that the tested spacecraft geometry behaves the same way. BASS rod/film results, Saffire slab/fabric results and partial-gravity wire results describe distinct configurations. No universal “fastest on the Moon,” blue-at-zero-g, or fan-off extinction rule is claimed.

The three-volume network and detector delay/sensitivity relations approximate spatial transport; they do not solve a three-dimensional velocity field or establish a real detector's response time. Emissivity, opacity and visual flame color are not spectroscopic measurements. Solid-front/spread approximations still need independent experimental evaluation. Gas-network conservation tests do not establish full reacting-flow accuracy.

## Preserved observed data and checked references

The unmodified PSI experimental CSVs/metadata remain available for PSI-25, PSI-26, PSI-69, PSI-98, PSI-99, PSI-100, PSI-101 and PSI-102, with DOI, record/file versions, CC0 license declarations and SHA-256 checksums. The Saffire-I workbook and 1,215 extracted temperature/pressure/detector-voltage readings remain unchanged. Voltage is not converted into smoke concentration; workbook-relative time is not assigned an ignition origin.

The plan records primary-source checks for [Saffire](https://ntrs.nasa.gov/citations/20240002981), [BASS-II](https://ntrs.nasa.gov/citations/20160000593), [SAME-2](https://ntrs.nasa.gov/citations/20130000422), [partial-gravity wires](https://discovery.ucl.ac.uk/id/eprint/10154634/), [NASA-STD-6001B Change 3](https://standards.nasa.gov/standard/NASA/NASA-STD-6001), and ISS extinguisher studies. The source registry now also includes the [NIST control-volume reference](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1889v1.pdf), [particle transport reference](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=861149), [NASA-STD-3001 Volume 2 Revision F](https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2) and JSC 20584 Revision D.

The 3 mmHg CO₂ reference concerns nominal one-hour average **total** partial pressure. Instantaneous fire-generated rise is shown separately. The app does not declare emergency exposure violations from that reference or invent missing exposure history.
