/**
 * Source registry for the fire model.
 *
 * Every number in src/data/fire and src/lib/fire points at one of these ids.
 * "nasa" sources were retrieved on RETRIEVED_AT and the cited values were read
 * out of the document text. "handbook" sources are standard fire-science
 * references used where NASA flight papers do not publish the property.
 * "assumption" marks a modelling choice that is not a measurement.
 */

export const RETRIEVED_AT = "2026-11-14";
export const FIRE_MODEL_VERSION = "3.0.1";

export type SourceKind = "nasa" | "peer-reviewed" | "handbook" | "assumption";

export interface FireSource {
  id: string;
  short: string;
  kind: SourceKind;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
  url: string | null;
  /** What was actually read out of this source and used by the model. */
  extracted: string[];
}

export const FIRE_SOURCES: FireSource[] = [
  { id: "saffire-i-iii-matrix", short: "Saffire I–III test matrix", kind: "nasa", title: "Saffire: A Novel Approach to Study of Spacecraft Fire Safety Using Un-manned Spacecraft", authors: "Urban, Ferkul, Olson, Ruff, Easton", year: 2017, venue: "ASGSR, slides 23 and 30–31", url: "https://ntrs.nasa.gov/citations/20180005168", extracted: ["I-2 uses approximately 10 cm of remaining SIBAL, with a 70 s burn; the original sheet was 94 cm long.", "II-6 airflow is 25 cm/s, whereas II-5 is 20 cm/s. The bundled PSI summary gives 20 cm/s for both; original CSVs are preserved."] },
  { id: "saffire-vi-timeline", short: "Saffire VI fan timeline", kind: "nasa", title: "Preliminary Results from the Saffire VI Experiment (presentation)", authors: "Urban et al.", year: 2024, venue: "ICES-2024, slides 16–18", url: "https://ntrs.nasa.gov/citations/20240007488", extracted: ["VI-3 ignition at 637 s, airflow reduced from 20 to 5 cm/s at 1120 s and stopped at 1420 s: commands at 483 and 783 s after ignition.", "VI-4 also used reduced flow, but its command times are not given in this presentation. Its constant-flow reproduction remains incomplete."] },
  { id: "nist-cfast", short: "NIST CFAST equations", kind: "handbook", title: "CFAST Version 7 Volume 1: Technical Reference Guide", authors: "Peacock, McGrattan, Forney, Reneke", year: 2015, venue: "NIST TN 1889v1, chapters 2–5", url: "https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1889v1.pdf", extracted: ["Conservation of mass/energy, ideal-gas control volumes, mass and enthalpy exchange.", "Buoyant plume correlations have a terrestrial validation domain; partial-gravity application is an extrapolation."] },
  { id: "nist-smoke", short: "NIST smoke transport", kind: "peer-reviewed", title: "Generation and Transport of Smoke Components", authors: "Butler, Mulholland", year: 2004, venue: "Fire Technology 40, 149–176, equations 5–7", url: "https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=861149", extracted: ["Stokes–Einstein particle diffusion with Cunningham slip correction; settling differs from gas diffusion."] },
  { id: "nasa-std-3001", short: "NASA-STD-3001 Vol 2 F", kind: "nasa", title: "NASA Spaceflight Human-System Standard Volume 2", authors: "NASA OCHMO", year: 2026, venue: "Revision F, V2 6004", url: "https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2", extracted: ["Nominal average one-hour TOTAL CO₂ partial pressure ≤3 mmHg; not an instantaneous fire emergency threshold."] },
  { id: "jsc-smac", short: "JSC 20584 Rev D", kind: "nasa", title: "Spacecraft Maximum Allowable Concentrations for Airborne Contaminants", authors: "NASA Johnson Space Center", year: 2026, venue: "Revision D, February 2026", url: "https://www.nasa.gov/wp-content/uploads/2026/02/jsc-20584-smacs-rev-d.pdf", extracted: ["CO references depend on exposure duration and atmosphere applicability; an instantaneous reading does not establish an exposure limit violation."] },
  {
    id: "saffire-vi",
    short: "Saffire VI (ICES-2024-365)",
    kind: "nasa",
    title: "Preliminary Results from the Saffire VI Experiment",
    authors: "Urban, Ruff, Ferkul, Easton, Johnston, Owens, Olson, Fortenberry, et al.",
    year: 2024,
    venue: "53rd International Conference on Environmental Systems, ICES-2024-365",
    url: "https://ntrs.nasa.gov/citations/20240002981",
    extracted: [
      "Table 1: test conditions for IV-1, V-2, VI-2, VI-3, VI-4 (pressure 54.1–100 kPa, oxygen 22.0–31.0 mol %, free volume 16.7–19.0 m³, 20 cm/s concurrent flow).",
      "Table 2: burn duration, peak and total heat release, CO₂ and CO rise, peak temperatures for the same five tests.",
      "Fires were 1.5–3.2 kW in 17–19 m³ of free volume; temperature rose significantly only near the fire.",
      "Heat release from oxygen consumption uses 13.1 kJ per gram of O₂ (Huggett).",
      "A 1 mg/m³ far-field smoke alarm threshold was reached at 981 s, after most of the hazardous gas had been released.",
      "CO 1-hour SMAC 425 ppm, 24-hour SMAC 100 ppm (JSC 20584); CO₂ 1-hour average limit 3 mmHg (NASA-STD-3001).",
      "Duct 30 cm × 45 cm × 109 cm; SIBAL fabric 75 % cotton / 25 % fiberglass, 18.05 mg/cm².",
    ],
  },
  {
    id: "saffire-iv-v",
    short: "Saffire IV–V (ICES-2021-266)",
    kind: "nasa",
    title: "Fire Safety Implications of Preliminary Results from Saffire IV and V Experiments on Large Scale Spacecraft Fires",
    authors: "Urban, Ruff, Ferkul, Easton, Owens, Olson, Meyer, Fortenberry, Brooker, et al.",
    year: 2021,
    venue: "50th International Conference on Environmental Systems, ICES-2021-266",
    url: "https://ntrs.nasa.gov/citations/20210011521",
    extracted: [
      "Concurrent flames reached a limiting, steady size on thin and thick fuels, unlike upward spread in 1 g.",
      "Thick PMMA in concurrent flow stayed pinned at the leading edge: 9.5 cm flame after 400 s in air (IV-2), 11 cm after 450 s at 25.4 % O₂ (V-3).",
      "Thick samples kept burning after the flow was reduced; extinguishment of thick or charring fuels cannot be assumed to be rapid. Flamelets re-ignited samples.",
      "V-3 extinguished quickly once flow was stopped after 300 s at 5 cm/s.",
      "Fuel vapour accumulates in low gravity: two samples ignited as small deflagrations.",
    ],
  },
  {
    id: "saffire-iv-vi-emission",
    short: "Saffire IV–VI emission (ICES-2026-577)",
    kind: "nasa",
    title: "Heat and Smoke Emission from Tests on the SAFFIRE IV-VI Experiments",
    authors: "Urban, Ruff, Ferkul, Easton, Owens, Olson, Fortenberry, Graf, George, Toth, Meyer, Eigenbrod, T’ien, Liao, Fernandez-Pello, Legros, Guibaud, Smirnov, Fujita, Rojas Alva, Jomaas",
    year: 2026,
    venue: "55th International Conference on Environmental Systems, ICES-2026-577, 12–16 July 2026",
    url: "https://ntrs.nasa.gov/citations/20260001992",
    extracted: [
      "Table 1: seven flight tests (PMMA IV-2, V-3, VI-3, VI-4; SIBAL IV-1, VI-2; cotton V-2). Pressure 541–1000 mbar, O₂ 0.22–0.31 mole fraction, free volume 16.7–19 m³. All samples 40 cm wide in 20 cm/s flow; PMMA 18 cm long (5 mm thick one-sided, 10 mm thick two-sided), preheated 10 min at low igniter power; SIBAL and cotton 50 cm long.",
      "Table 1 also gives ignition duration, duration of initial flow, flame length growth rate (PMMA, 0.22–0.38 mm/s), thin-fuel flame spread rate (SIBAL and cotton, 3.4–4.05 mm/s), maximum flame length (PMMA, 89.9–118 mm), peak heat release (VI-3 3240 W, VI-4 1487 W, VI-2 3376 W; not measured on flights IV and V), and the rises at the Far Field Diagnostics (FFD) in CO₂, CO, pressure and temperature.",
      "Gas concentrations and temperatures are at the FFD, next to the Cygnus air-circulation intake. There is no CO removal on board and only limited CO₂ removal, so CO and CO₂ are reported as rises above a pre-existing baseline, not absolute levels.",
      "Table 1 times to alarm are for 2 mg/m³ total particulate (DustTrak DRX at the FFD): 1083 s (IV-2), 1117 s (V-3), 1037 s (VI-3), 1603 s (VI-4), 92 s (IV-1), 146 s (V-2), 201 s (VI-2). They are referenced to the experiment timeline start, about 10 minutes before ignition, not to ignition.",
      "At alarm, CO rise was 63.2, 28.1, 105, 283, 7.9, 11.9 and 57.1 ppm (same order); CO₂ rise 1.28, 0.49, 1.43, 3.09, 0.00, 0.00 and 0.04 mmHg; heat release 2500 W (VI-3), 623 W (VI-4) and 3180 W (VI-2).",
      "Limits used: CO 24-hour SMAC 100 ppm and 1-hour SMAC 425 ppm (JSC 20584); CO₂ 3 mmHg, 1-hour average (NASA-STD-3001). The maximum rise exceeded the CO₂ 1-hour limit and the CO 24-hour SMAC for both VI PMMA tests, and the CO 24-hour SMAC for IV-2 (PMMA) and VI-2 (SIBAL); the paper attributes the high VI levels to the higher oxygen.",
      "At the 2 mg/m³ alarm, CO already exceeded the 24-hour SMAC in both VI PMMA tests (105 and 283 ppm), with the one-sided VI-4 approaching the 1-hour SMAC and the CO rise worse for the one-sided sample. The IV PMMA and VI SIBAL fires were detected before reaching hazardous CO.",
      "Conclusion on detection: a 2 mg/m³ threshold was not low enough to detect the fires before some cases exceeded the 24-hour CO SMAC. A lower threshold or additional detectors to reduce transport time would be needed for this spacecraft configuration.",
      "Smoke aerosol at the FFD tracked the flame length with a minor delay because of the direct path from the flow unit to the FFD, without the extensive mixing seen on the ISS. Detection here is therefore likely quicker than in many spacecraft.",
      "Flat PMMA flames did not spread: they stayed anchored at the leading edge and grew as the material regressed, with intervals of linear growth lasting several minutes, 0.22–0.38 mm/s. This is faster than the Saffire II 5 cm wide sample, which grew at less than 0.1 mm/s in air. Thin SIBAL samples also spread linearly. Low-gravity flame growth can be expected to be linear or less, and may reach a limiting size.",
      "One-sided PMMA samples began to plateau near 380 s (Saffire V) and 420 s (Saffire VI); two-sided samples were still growing at the end of the test (about 500 s). Whether two-sided samples would plateau is unknown.",
      "Two-sided PMMA growth rate rose 73 % for a 0.08 mole-fraction oxygen increase despite a 45 % pressure decrease; one-sided growth rate was unchanged for a 0.03 mole-fraction oxygen increase with a 27 % pressure decrease.",
      "One-sided back side: 0.1 mm mica (diffusivity about 0.6 mm²/s) on 0.8 mm aluminium (about 97 mm²/s), adding under 1 % to the thermal resistance. Thermal penetration time of 5 mm PMMA (0.11 mm²/s) is about 220 s. Two-sided results are a conservative upper bound on the growth rate of one-sided applications.",
      "Temperature: the peak heat release was about 3 kW, yet the FFD temperature rose only 0.04–0.50 °C and pressure 0.25–1.31 mbar. The flow unit outlet reached 77 °C, which fell quickly through mixing and heat loss. Smoke products were more hazardous than heat.",
      "Discrepancy 1: the Table 1 caption says opposed flow. ICES-2024-365 and this paper's text (flames anchored at the leading edge, growing as the material regresses) describe concurrent flow. IGNIS records the tests as concurrent.",
      "Discrepancy 2: peak heat release differs from ICES-2024-365 Table 2 (VI-3 3240 W here against 3080 W; VI-4 1487 against 1507 W; VI-2 3376 against 3217 W). The CO and CO₂ maxima here are FFD far-field maxima and also differ. The two sets are kept separate; the ICES-2024-365 values are the model calibration set.",
      "Discrepancy 3: ICES-2024-365 used a 1 mg/m³ alarm threshold (981 s); this paper uses 2 mg/m³.",
      "IV-1 conditions differ between papers: 980 mbar and 0.23 O₂ mole fraction here, against 100.0 kPa and 22.0 % O₂ in ICES-2024-365 Table 1. The other shared tests (VI-2, VI-3, VI-4) agree within 0.2 kPa and 0.5 percentage points of O₂.",
      "V-3 oxygen is 0.26 mole fraction in Table 1, whereas ICES-2021-266 gives 25.4 % O₂ for the same test.",
    ],
  },
  {
    id: "saffire-poster",
    short: "Saffire overview (NTRS 20150000894)",
    kind: "nasa",
    title: "Large-scale Spacecraft Fire Safety Tests",
    authors: "Urban, Ruff, Ferkul, Olson, Fernandez-Pello, T'ien, Torero, et al.",
    year: 2014,
    venue: "NASA Glenn Research Center poster",
    url: "https://ntrs.nasa.gov/citations/20150000894",
    extracted: [
      "Saffire I and III sample: 40.6 cm × 94.0 cm SIBAL cloth; Saffire II samples 5 cm × 30 cm at 20–30 cm/s.",
      "ISS thin-sample test (10 cm × 2.2 cm, 1 atm, 18.7 % O₂): ignited at 5 cm/s, quenched when flow fell to 2.2 cm/s.",
      "Nomex HT90-40 limiting oxygen concentration depends strongly on pressure and on forced versus quiescent flow.",
    ],
  },
  {
    id: "bass-ii",
    short: "BASS-II (NTRS 20160000593)",
    kind: "nasa",
    title: "Combustion of Solids in Microgravity: Results from the BASS-II Experiment",
    authors: "Ferkul, Bhattacharjee, Fernandez-Pello, Miller, Olson, Takahashi, T'ien",
    year: 2014,
    venue: "30th ASGSR Conference poster",
    url: "https://ntrs.nasa.gov/citations/20160000593",
    extracted: [
      "PMMA rod: 1 g blowoff limit 16 % O₂; steady spread at 13.6 % O₂ in microgravity. Negative oxygen margin of safety of 2.4 % O₂.",
      "The minimum of the flammability boundary sits at very low flow, of the order of diffusive speeds.",
      "0.1 mm PMMA film: radiative quenching below 2 cm/s, blowoff as flow crosses 40 cm/s.",
      "PMMA rods (0.25–0.5 in): 54 opposed spread rates between roughly 0.005 and 0.025 cm/s at 16–21 % O₂, 0.4–4 cm/s.",
      "Tunnel flow range 0–55 cm/s; oxygen 21 % and below.",
    ],
  },
  {
    id: "psi-saffire-i",
    short: "Saffire-I table (NASA PSI-98)",
    kind: "nasa",
    title: "Spacecraft Fire Safety Experiment-I: experimental table and telemetry",
    authors: "NASA Glenn Research Center, Saffire team",
    year: 2016,
    venue: "NASA Physical Sciences Informatics, DOI 10.60555/0t15-1z43",
    url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-98",
    extracted: [
      "S1: SIBAL fabric, 20 cm/s concurrent flow, 21.5–21.7 % O₂, 182 W igniter for 8 s, burn time 420 s.",
      "S2: same sample in opposed flow, about 21.5 % O₂, burn time 70 s. The table does not say whether this marks extinction or a partial burn.",
      "The length and width cells read 40.6 cm and 94 cm; the Saffire overview and the Saffire-III table give the same sample as 94 cm long and 40.6 cm wide, so the cells are read as swapped.",
      "Thickness is given as 0.37 cm; the Saffire-II table gives SIBAL as 0.37 mm, which matches the 18.05 mg/cm² areal density of the fabric. The centimetre unit is read as a typing error.",
      "Cabin pressure telemetry (PCM) reads 14.47–14.54 psi (99.8–100.2 kPa) across the record.",
    ],
  },
  {
    id: "psi-saffire-ii",
    short: "Saffire-II table (NASA PSI-99)",
    kind: "nasa",
    title: "Spacecraft Fire Safety Experiment-II: experimental table",
    authors: "NASA Glenn Research Center, Saffire team",
    year: 2016,
    venue: "NASA Physical Sciences Informatics, DOI 10.60555/2chp-m469",
    url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-99",
    extracted: [
      "Samples 5 cm wide and 29 cm long at 20 cm/s; oxygen about 21.5–22.1 % (derived from measured CO₂ production).",
      "2-5 and 2-6, SIBAL, concurrent: burned the full 29 cm in 145 s and 115 s; spread rates 2.1 and 2.6 mm/s.",
      "2-1 to 2-4, silicone 0.27–1.03 mm: microgravity burn insignificant, burn length about 0.",
      "2-8 and 2-9, PMMA: about 10 cm of visibly damaged fuel after 600 s and 900 s; flames anchored at the sample base with a regression rate of 0.01–0.04 mm/s.",
    ],
  },
  {
    id: "psi-saffire-iii",
    short: "Saffire-III table (NASA PSI-100)",
    kind: "nasa",
    title: "Spacecraft Fire Safety Experiment-III: experimental table",
    authors: "NASA Glenn Research Center, Saffire team",
    year: 2017,
    venue: "NASA Physical Sciences Informatics, DOI 10.60555/040q-4h36",
    url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-100",
    extracted: [
      "S1 and S2: SIBAL, 94 cm × 40.6 cm, 30 cm/s, concurrent and opposed. The table reports conditions only; no burn time or spread rate, so it supplies no check.",
    ],
  },
  {
    id: "psi-bass-ii",
    short: "BASS-II table (NASA PSI-25)",
    kind: "nasa",
    title: "Burning and Suppression of Solids - II: experimental table",
    authors: "Ferkul, Bhattacharjee, Fernandez-Pello, Miller, Olson, T'ien et al.",
    year: 2014,
    venue: "NASA Physical Sciences Informatics, DOI 10.60555/4qc4-de67",
    url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
    extracted: [
      "Per run: calibrated initial and final O₂ (vol %), initial and final CO₂ (vol %), initial and final CO (ppm) in the Microgravity Science Glovebox working volume.",
      "The change over a run gives a run-level CO/CO₂ molar ratio for PMMA slabs, PMMA rods and SIBAL. The chamber volume is not needed for the ratio.",
      "Runs are small samples (1–2 cm wide) at flows up to about 40 cm/s and 14–22 % O₂ near 1 atm.",
    ],
  },
  {
    id: "olson-2008",
    short: "Olson et al. 2008 (NASA/TM-2008-215260)",
    kind: "nasa",
    title: "Microgravity Flame Spread in Exploration Atmospheres: Pressure, Oxygen, and Velocity Effects on Opposed and Concurrent Flame Spread",
    authors: "Olson, Ruff, Miller",
    year: 2008,
    venue: "NASA/TM-2008-215260; SAE 2008-01-2055",
    url: "https://ntrs.nasa.gov/citations/20080034883",
    extracted: [
      "For Ultem 1000, Nomex HT90-40 and Mylar G, the 1 g upward limiting oxygen index and maximum oxygen concentration were higher than the 0 g values by up to 4 % O₂ mole fraction.",
      "Materials burned in 0 g at lower oxygen than NASA-STD-6001 Test 1 indicates.",
    ],
  },
  {
    id: "ferkul-2026",
    short: "Ferkul et al. 2026 (LPSC)",
    kind: "nasa",
    title: "Material Flammability at Lunar and Martian Gravity",
    authors: "Ferkul, Kralik, Liao",
    year: 2026,
    venue: "Lunar and Planetary Science Conference 2026",
    url: "https://ntrs.nasa.gov/citations/20260001966",
    extracted: [
      "Flame spread rate as a function of gravity peaks near lunar gravity (citing Sacksteder and T'ien 1994).",
      "The oxygen concentration needed for flammability reaches a minimum in the vicinity of lunar gravity.",
      "Partial-gravity fire in a habitat is expected to be substantially worse than 0 g and potentially worse than 1 g.",
      "Drop towers give 5 s and aircraft about 25 s of partial gravity; Flammability of Materials on the Moon (FM2) is planned for late 2026.",
    ],
  },
  {
    id: "konno-2023",
    short: "Konno et al. (partial-g wires)",
    kind: "peer-reviewed",
    title: "Experimental study on downward/opposed flame spread and extinction over electric wires in partial gravity environments",
    authors: "Konno, Li, Citerne, Legros, Guibaud, Hashimoto, Fujita",
    year: 2023,
    venue: "Proceedings of the Combustion Institute 39 (accepted manuscript, UCL Discovery)",
    url: "https://discovery.ucl.ac.uk/id/eprint/10154634/",
    extracted: [
      "LDPE-insulated wires burned at 0 g, 0.16 g, 0.38 g and 1 g in parabolic flight, 60 and 150 mm/s flow, oxygen at or below 21 %.",
      "Flammability limit versus gravity is U-shaped: radiative extinction branch at low gravity, blowoff branch at high gravity.",
      "Limiting oxygen concentration of NiCr-core wire falls as gravity falls; copper-core wire is nearly insensitive.",
      "Electrical faults are the most likely cause of spacecraft fire.",
    ],
  },
  {
    id: "hirsch-2011",
    short: "Hirsch et al. (WSTF limits)",
    kind: "nasa",
    title: "Selected Parametric Effects on Materials Flammability Limits",
    authors: "Hirsch, Juarez, Peyton, Harper, Olson",
    year: 2011,
    venue: "NASA White Sands Test Facility / AIAA",
    url: "https://ntrs.nasa.gov/citations/20110008636",
    extracted: [
      "Upward limiting oxygen index (ULOI) and maximum oxygen concentration (MOC) for PEI, PET, polyimide, PEEK, PMMA, silicone, nylon, POM, polypropylene, PVC and epoxy/glass.",
      "MOC falls roughly linearly with total pressure: slope −0.251 to −0.975 % O₂ per psia, average −0.607.",
      "PTFE ULOI drops from 49 to 40.8 when preheated to 200 °F.",
      "Thinner silicone is more flammable: ULOI 17.5 at 4 mil versus 23.4 at 40 mil.",
    ],
  },
  {
    id: "nasa-std-6001b",
    short: "NASA-STD-6001B",
    kind: "nasa",
    title: "Flammability, Offgassing, and Compatibility Requirements and Test Procedures",
    authors: "NASA Office of the Chief Engineer",
    year: 2025,
    venue: "NASA-STD-6001B w/Change 3 (active; change dated 2025-06-09)",
    url: "https://standards.nasa.gov/standard/NASA/NASA-STD-6001",
    extracted: [
      "Test 1 (upward flame propagation): five specimens 30 cm × 6.5 cm, mounted vertically, worst-case atmosphere.",
      "Pass: no specimen burns more than 15 cm (6 in) and none propagates flame by transfer of burning debris.",
      "Test 4 (wire insulation): five wires, 30 cm active length, 15° from vertical, same 15 cm criterion.",
      "Maximum oxygen concentration: the highest oxygen concentration at which at least five specimens pass.",
    ],
  },
  {
    id: "same-2",
    short: "SAME-2 (AIAA 2012-3536)",
    kind: "nasa",
    title: "Particle Morphology and Size Results from the Smoke Aerosol Measurement Experiment-2",
    authors: "Urban, Ruff, Greenberg, Fischer, Meyer, Mulholland, Yuan, Bryg, Cleary, Yang",
    year: 2012,
    venue: "42nd International Conference on Environmental Systems, AIAA 2012-3536",
    url: "https://ntrs.nasa.gov/citations/20130000422",
    extracted: [
      "Table 1: count mean diameter and diameter of average mass, unaged and aged 720 s, for Kapton, lamp wick (cellulose), silicone, Teflon and Pyrell.",
      "Most average particle sizes were 200–400 nm; zero-flow cases produced particles 2 to 3 times larger than at 8 cm/s.",
      "Kapton and Teflon smoke is very small and hard for light-scattering detectors; all samples were readily detected by an ionization detector.",
      "With no flow in microgravity, smoke diffuses about 4 cm in 60 s.",
      "Detectors measuring more than one moment of the size distribution are recommended.",
    ],
  },
  {
    id: "iss-fds-2001",
    short: "ISS fire detection and suppression overview",
    kind: "nasa",
    title: "Overview of ISS U.S. Fire Detection and Suppression System",
    authors: "Whitaker",
    year: 2001,
    venue: "NASA/CP-2003-212103",
    url: "https://ntrs.nasa.gov/citations/20030053429",
    extracted: [
      "CO₂ portable extinguisher: 6 lb of CO₂ at 850 psi, discharged in 45 s, about 3 lb in the first 10 s.",
      "Rack oxygen falls below 10.5 % within 1 minute of suppression; CO₂ exceeds 50 % in enclosed volumes of 60 ft³ or less.",
      "Photoelectric smoke detectors on the ventilation filter intake ducts; alarms use the scattering photodiode.",
      "Alarm response: remove power to racks, then isolate the module by shutting intermodule ventilation valves and cabin fans.",
      "Typical ISS oxygen slightly below 24 %; total pressure controlled near 14.25–14.3 psia.",
      "Portable breathing apparatus carries a 15-minute oxygen bottle.",
    ],
  },
  {
    id: "fwm-pfe",
    short: "ISS fine water mist extinguisher",
    kind: "nasa",
    title: "Development of the International Space Station Fine Water Mist Portable Fire Extinguisher",
    authors: "Rodriguez, Young",
    year: 2013,
    venue: "43rd International Conference on Environmental Systems",
    url: "https://ntrs.nasa.gov/citations/20130011664",
    extracted: [
      "6 lb of water and 1.2 lb of nitrogen at about 1270 psia.",
      "Open-cabin standard: 55 kW PMMA fire, extinguished in 1 s on average over 16 tests.",
      "Enclosed rack standard: about 60 s on average. Elevated oxygen (24–30 % at 10.2 psia): about 0.3 s.",
      "CO₂ extinguisher discharge creates an unsafe breathing environment because the masks do not filter CO₂.",
      "ISS fire scenarios: rack, open cabin, lithium-ion battery, elevated oxygen, oxygen candle.",
    ],
  },
  {
    id: "s-flame",
    short: "ACME / s-Flame",
    kind: "nasa",
    title: "Structure and Response of Spherical Diffusion Flames (s-Flame)",
    authors: "NASA Biological and Physical Sciences / ACME team",
    year: null,
    venue: "ISS Combustion Integrated Rack, ACME",
    url: "https://science.nasa.gov/biological-physical/investigations/s-flame/",
    extracted: [
      "Spherical gaseous diffusion flames isolate the roles of radiation and extinction in microgravity.",
      "This is qualitative context for flame shape. Burner results are not solid-material flammability measurements and supply no coefficients to this model.",
    ],
  },
  {
    id: "sfpe",
    short: "SFPE Handbook / Tewarson; Quintiere",
    kind: "handbook",
    title: "SFPE Handbook of Fire Protection Engineering (Tewarson, generation of heat and gaseous, liquid, and solid products in fires); Quintiere, Fundamentals of Fire Phenomena",
    authors: "Tewarson; Quintiere; Drysdale",
    year: 2016,
    venue: "Standard fire-science references",
    url: null,
    extracted: [
      "Heats of combustion, product yields (CO₂, CO, soot), radiative fractions.",
      "Piloted ignition temperature, thermal inertia kρc and critical heat flux for common polymers.",
      "Ignition time for thermally thick and thin solids; Heskestad flame height; Zukoski plume entrainment; Alpert ceiling jet.",
    ],
  },
  {
    id: "model",
    short: "IGNIS model assumption",
    kind: "assumption",
    title: "Reduced-order modelling choice made in IGNIS",
    authors: "IGNIS",
    year: 2026,
    venue: "src/lib/fire/model.ts",
    url: null,
    extracted: [
      "Values tagged with this source are not measurements. They close the model where no published number was found.",
    ],
  },
];

export function sourceById(id: string): FireSource {
  const source = FIRE_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Unknown fire source ${id}`);
  return source;
}

/** A value with its provenance. */
export interface Cited<T = number> {
  value: T;
  source: string;
  note?: string;
  evidence?: "measured" | "derived" | "calibrated" | "assumed";
  locator?: string;
  uncertainty?: string;
}

export type EvidenceKind = NonNullable<Cited["evidence"]>;

/** A cited value. The evidence class is inferred from the source and note unless
 * it is given explicitly, which every model 3.0.0 calibrated or derived value does. */
export function cite<T>(value: T, source: string, note?: string, explicit?: EvidenceKind): Cited<T> {
  const evidence = explicit ?? (source === "model" || source === "sfpe" ? "assumed" : /fitted|scaled|sets |chosen/i.test(note ?? "") ? "calibrated" : /stoich| at .*kg|from the|per burning/i.test(note ?? "") ? "derived" : "measured");
  return { value, source, ...(note ? { note } : {}), evidence,
    uncertainty: "Not quantified for this application",
    locator: source === "sfpe" ? "Exact handbook table not verified; retained exploratory value" : note ?? "See source registry; specimen match required" };
}
