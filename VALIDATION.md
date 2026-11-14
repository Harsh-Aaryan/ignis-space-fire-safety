# Fire simulation and NASA data validation — 2026-11-14

This continues the existing uncommitted fire-simulation implementation and the Gateway camera investigation described in the handoff. Existing habitat geometry, model assets, lighting presets and prepared material data were retained.

## Architecture reviewed

The app uses Next.js 16.4.6, React, Zustand and React Three Fiber. `mission-store` owns cabin conditions and equipment selection. `src/lib/fire/model.ts` implements the numerical ignition → heat release → gas/temperature → transport → detection/response chain. `scenario.ts` maps conceptual room/equipment geometry into model inputs. `fire-sim-store` owns the fixed-step runtime and published telemetry. `FireEffects` adds meshes and particles to the existing rooms.

The original synthetic evidence repository and metadata-only NTRS index remain separate from extracted publication values, original PSI tables, observed sensor readings, and model output. Predict and FireTwin now use the same engine and setup. The AppShell keeps the runtime mounted across route changes and synchronizes cabin edits.

## Functional corrections

- Oxygen-limited burning cannot release more chemical energy than the oxygen inventory supports, including during delayed extinction.
- CO₂ and chemical-agent discharge account for time steps crossing discharge-stage boundaries. A repeated CO₂ action does not create another bottle.
- Batch scenarios execute response actions at their requested times and end at the requested horizon; invalid time steps are rejected.
- Telemetry snapshots no longer share mutable zone, lag or event objects with the running model.
- Material/source choices survive the Research → Predict → FireTwin handoff. Habitat or initial atmosphere changes reset stale runs; airflow changes update the live fan target.
- Fire-particle buffers are excluded from navigation bounds. Gateway camera positions stay within the revealed module, with a separate room framing target to include foreground equipment.
- The mobile HUD is in the scrolling flow; desktop telemetry remains over the scene. Fire colors/light were adjusted only in the effect layer.
- Research groups material data, gravity coverage and research gaps. The materials/citations drawer is reachable from every page. Older route URLs remain available.

## Data retrieved and preserved

Original public NASA PSI experimental CSV files and complete metadata were downloaded for PSI-25, PSI-26, PSI-69, PSI-98, PSI-99, PSI-100, PSI-101 and PSI-102. All eight records declare CC0-1.0. The [manifest](public/data/nasa-psi/manifest.json) retains source URLs, DOIs, record/file versions and SHA-256 checksums. Existing source files and material coefficients were not replaced. CSV ranges, empty values, negative readings, notes and uncalibrated display settings are preserved as strings.

The original 2,775,737-byte Saffire-I telemetry workbook was also retrieved. Its four explicitly labeled sensor channels were extracted without interpolation, smoothing, clipping, unit conversion or ignition-time alignment: 322 temperature points, 332 pressure points, 289 obscuration-voltage points and 272 scattering-voltage points. Every point retains its source sheet, column and row. The viewer uses the workbook's relative-time coordinate. Smoke voltages are not mass concentrations, calibrated alarm times, HRR or oxygen histories.

The NASA-STD-6001 source was updated to the [active B with Change 3](https://standards.nasa.gov/standard/NASA/NASA-STD-6001). Saffire publication tables were checked against [ICES-2024-365](https://ntrs.nasa.gov/citations/20240002981). The partial-gravity source link was corrected to NTRS 20260001966. ACME/s-Flame is identified as qualitative gaseous-flame context, rather than solid-material validation data.

## Verification

| Check | Result |
| --- | --- |
| `npm test -- --reporter=dot` | 73 tests passed in 11 files. Includes the existing diagnostic probe. |
| `npm run build` | Passed, including TypeScript and generation of all application routes. |
| `python scripts/prepare-saffire-telemetry.py --check` | Extract matches the original workbook exactly. |
| NASA source integrity | Original metadata, eight CSV files and the telemetry workbook match their recorded checksums. |
| `git diff --check` | Passed. |
| Original Moon/Mars/Gateway habitat modules and `public/models` | No changes. |
| Full production Playwright suite | 12 passed, 2 optional capture scripts skipped, 0 failed (8.6 minutes). |

The new browser cases exercise ignition, telemetry, pause, manual suppression and reset in all three habitats; material/setup handoff; grouped routes; no-WebGL mobile controls; and original NASA CSV browsing, filtering, downloading and observed-voltage viewing. Existing interior raycast, cutaway, floor, exterior, research-context and route tests are retained. The two `zz-*` scripts are optional captures requiring `SHOT_DIR`.

The full machine-readable browser report is saved locally at `.qa-baseline/final-playwright.json`; final screenshots are copied to `.qa-baseline/final-browser/`. These QA artifacts are ignored by Git. A viewport screenshot is used for the fixed app shell so the capture follows the visible scrolling panel.

## Scientific validation limits

Passing functional tests does not establish predictive accuracy. The Saffire cases used to select coefficients are calibration cases. The interface exposes their residuals. The following comparison runs constant initial flow for the reported duration, without reconstructing the changing flight fan protocol; each cell is published / modeled:

| Test | HRR basis | HRR (W) | Total heat (kJ) | CO₂ rise (ppm) | CO rise (ppm) |
| --- | --- | --- | --- | --- | --- |
| IV-1 | Mean | 3150 / 2034 | 409 / 264 | 1390 / 906 | 80 / 36 |
| VI-2 | Peak | 3217 / 3213 | 580 / 262 | 2800 / 1778 | 120 / 71 |
| VI-3 | Peak | 3080 / 3067 | 1280 / 2002 | 8539 / 10705 | 308 / 428 |
| VI-4 | Peak | 1507 / 1407 | 830 / 1499 | 8117 / 7926 | 320 / 317 |

The paper reports different calorimetry methods for some thin-fuel values; VI-2 also lists 409 kJ by fuel consumption. Its reported peak, duration and oxygen-calorimetry total do not form a consistent constant-HRR history. Published values are retained, not silently reconciled.

Partial-gravity results remain model extrapolations. Complete HRR/O₂ histories with timing/calibration, detector calibration and ground truth, habitat thermal/HVAC parameters, and matching partial-gravity measurements are still needed for independent validation. The UI identifies assumptions and keeps observed telemetry distinct from predicted telemetry. Instantaneous gas references are not calculated one-hour or 24-hour exposure averages.
