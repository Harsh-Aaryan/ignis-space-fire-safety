Intelligent Grounded Navigation of Investigation Science: a NASA Space Apps Challenge 2026 "Flame in Freefall" research console and interactive habitat fire model.

The generated demonstration catalog, rankings, and recommendations remain synthetic. The separate NTRS index contains citation metadata only. The fire model has its own source registry and extracted Saffire, SAME-2 and White Sands summary tables in `src/data/fire/`. Eight public NASA PSI experimental CSV tables and their complete metadata are downloaded unchanged in `public/data/nasa-psi/`, with DOI/version/license records and SHA-256 checksums. These experiment tables are not complete instrument time histories. Handbook values, derived coefficients and assumptions are labeled alongside NASA sources.

# IGNIS

## Fire model v2 and guided workflow

Navigation is **Home · Fire simulation · NASA research · Results**. Fire simulation uses **Set up → Run → Respond → Review**; comparison remains at `/predict`. The original Moon, Mars and Gateway geometry and public assets are retained.

- `thermal.ts` implements implicit one-dimensional solid conduction, with thin-layer heating for films/ignition edges. Surface convection and radiation retain thermal history.
- `chemistry.ts` balances carbon, hydrogen and oxygen for nominal PMMA, cellulose and polyethylene. CO₂ is adjusted after CO and soot partitioning. Water and unburned vapor are tracked.
- `transport.ts` exchanges species and energy in a finite-volume source/room/connected-habitat network. Gas pressure follows the ideal-gas inventory. Recirculation introduces no fresh oxygen. Particle diffusion uses Stokes–Einstein with slip correction.
- Finite CO₂, water and Halon doses enter the same network. Water evaporation is bounded by captured water and accessible surface heat. Spray capture and chemical inhibition remain assumptions.
- The shader flame envelope uses modeled extent, airflow and soot tendency. Smoke follows a bounded history of solver transport steps. Physical display scale is the default; **Enhance visibility** explicitly enlarges the envelope. Original room lighting is retained.
- **Ask IGNIS** is a global scenario assistant using captured model output and the project's source registry. An optional server-side Groq connection adds scoped generative answers from retrieved source extracts. Local explanations remain available without a key or when AI output fails validation. It can run a copied ventilation comparison. The older synthetic briefing remains an explicitly labeled research demonstration.
- Results exports include model version, exact inputs, evidence status, telemetry, agent inventories and events. Materials exports include parameter units, provenance, reference pressure and uncertainty notes.

Quantitative flaming chemistry is currently limited to the four PMMA/cellulose/polyethylene profiles (`pmma`, `sibal`, `paper`, `ldpe-wire`). The other eight profiles remain available for exploratory heating/pyrolysis and aerosol detection; their flaming chemistry is withheld. Handbook values without verified property-level tables stay labeled as assumed. Model v2 has substantial Saffire comparison residuals and has not established predictive accuracy. See [VALIDATION.md](VALIDATION.md) and the [implementation plan](SCIENCE-UX-PLAN.md).

Reproduce the numerical report with `node scripts/audit-fire-model.cjs`. It writes `.qa-baseline/v2-physics-audit.json` without fitting any coefficients or changing source data.

Intelligent Grounded Navigation of Investigation Science.

Prototype for the NASA Space Apps Challenge 2026 challenge [Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

Tagline: from NASA combustion research to mission-ready fire safety insights.

IGNIS connects combustion evidence to a reduced-order fire model and the existing 3D habitat scenes. It does not calculate an ignition probability or certify a cabin, material, detector or extinguisher.

**Evidence classes.** Synthetic catalog rows remain synthetic; verified index rows remain metadata only. Extracted measurements live on the Materials page. Forecasts and live telemetry are model output, even where coefficients were calibrated using NASA measurements. Partial-gravity results are extrapolations.

## What you can do

One cabin scenario connects **Set up → Run → Respond → Review**. Research is accessible throughout; older route URLs remain available.

1. **Mission Overview** — Moon, Mars, or the Gateway-inspired lunar-orbit habitat. Oxygen, total cabin pressure, airflow, and material carry across a switch. Gravity follows the habitat: Moon 0.165 g, Mars 0.38 g, Gateway and ISS ~0 g, Earth 1 g. pO₂ is oxygen fraction times total cabin pressure. ISS and Earth are comparison regimes, not extra FireTwin scenes.
2. **Research** — investigate the indexed studies and demonstration catalog. Materials and measurements, Gravity coverage (`/gravity-bridge`), and Gaps and briefing (`/firelab`) are subviews. The Materials page exposes property provenance and extracted tables, with a comparison of Saffire summaries against the model. Matching a calibrated peak does not establish agreement in total heat or detector response.
3. **Predict** — choose habitat equipment, material, ignition source and duration. Compare 0 g, 0.165 g and 0.38 g using the same fire engine as FireTwin. Open that exact equipment/material/source setup in the 3D view or export the modeled time history as JSON. The earlier synthetic statistical baseline remains in a labeled disclosure.
4. **FireTwin** — preserve the existing exterior and interior geometry while adding flame, smoke, airflow, sensor and extinguisher effects. The Fire scenario panel controls ignition, ventilation, sensors, automatic isolation and crew response. The HUD shows HRR, oxygen, temperature, gravity, CFM, CO, CO₂ and smoke. Pause, resume, reset, speed controls, manual response actions and the no-WebGL fallback remain available.
5. **Reports** — print to PDF, export catalog CSV, and save/load cabin scenarios in this browser. Live fire runtime is session memory, not part of a saved cabin scenario; export the forecast separately when its time history is needed.

The earlier research tools are retained:

- **Research Explorer** — search, filter, sort, and page 20 synthetic dossiers and 100 fictional runs. Compare up to three dossiers. Adjust the ranking weights. Missing measurements are excluded or labeled, not treated as zeros.
- **GravityBridge** — heatmap, nearest rows, out-of-range warnings, and gaps computed from the catalog. An empty lunar or Martian cell means that gravity was not tested here. It is not a negative result and not a safety claim. An optional oxygen sketch withholds any partial-gravity blend.
- **FireLab** — deterministic proposals ranked from those gaps, plus a demo briefing clerk that answers from the same records. No external model is called.

Three journeys are wired through: lunar material flammability, microgravity smoke detection, and Martian habitat gaps.

The Materials page also provides a searchable, paginated viewer and original downloads for BASS/BASS-II (PSI-25/26), Saffire I–III (PSI-98/99/100), SAME/SAME-R (PSI-102/101), and FLEX (PSI-69). Missing cells, ranges, source notes and uncalibrated display settings are retained rather than coerced into numbers. FLEX is liquid-droplet evidence and is not used to validate solid-fuel spread. `scripts/fetch-nasa-psi.ps1` retrieves missing public files without changing existing downloaded files or model coefficients.

Selecting PSI-98 also opens an interactive viewer of 1,215 observed readings from the original Saffire-I telemetry workbook: cabin air temperature (322), pressure (332), obscuration detector voltage (289), and scattering detector voltage (272). Each point retains its source sheet, column and row. Relative time is the workbook coordinate, not time since ignition. Detector voltage is not converted into smoke concentration. `python scripts/prepare-saffire-telemetry.py --check` verifies the extract against the downloaded workbook (requires `openpyxl`). No smoothing, interpolation, clipping or time alignment is performed.

## Relevance, coverage, and priority

These are heuristics over the synthetic catalog. They are not ignition probabilities, hazard percentages, or certifications.

- Relevance weights, before renormalizing around unreported fields: objective and fuel 30%, oxygen and pressure 25%, gravity and airflow 20%, measurement availability 15%, evidence completeness 10%. Cross-regime gravity is deliberately not treated as almost the same g.
- Envelope coverage mixes gravity, oxygen, pressure, airflow, and required measurements for the objective. Each term is capped. The interface states that this is not a fire-safety probability.
- Gap severity uses explicit count thresholds. Recommendations then score gap size, mission relevance, usefulness, related dossiers, and a rough feasibility note.

## Stack

Next.js (App Router) and TypeScript, Tailwind CSS, shadcn/ui, React Three Fiber, Drei, Three.js, Motion, Recharts, Lucide, Zustand.

The visual system is Ember Instrument: graphite elevations, bone type, one copper accent, IBM Plex Sans / Condensed / Mono, and aerospace status chips. Tokens live in `src/app/globals.css`. `src/design/palette.ts` holds the matching fallbacks for the 3D scene. Do not hardcode a second palette in components.

The lunar surface in FireTwin uses a procedural stand-in for the CC0 Poly Haven Moon 01 tile (3.1 m repeat) so the build does not depend on a texture CDN. MLI, aluminium, and pad colours follow that same material table.

CC0 environment and ground maps live in `public/textures/cc0/`. Sources and licences are in `ATTRIBUTIONS.md`. They are loaded from this site, not from a texture CDN.

## Local setup

```bash
npm install
npm run dev
```

Open the URL printed by Next.js. Production check:

```bash
npm test
npm run build
npm start
```

Copy `.env.example` to `.env.local` only if you need to pin the Phase 1 switches:

```
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_ASSISTANT_PROVIDER=mock
```

These two public switches configure the synthetic research demonstration and stay `mock`. Ask IGNIS has a separate server-side configuration described below. Do not put API keys in the client bundle.

## Architecture

```
src/app/                  routes
src/components/           shell, modules, charts, 3D
src/data/mock/            synthetic catalog (only the services import this)
src/data/missions.ts      mission profiles and the three journeys
src/data/fire/            cited material properties, extracted measurements, ignition/sensor/agent options
src/lib/fire/             ignition, HRR, oxygen/gas/heat balances, transport, response, calibration comparison
src/components/three/fire-effects.tsx  additive visual layer; does not replace habitat geometry
src/lib/ranking/          explainable relevance
src/lib/analytics/        coverage, heatmap, gaps, applicability
src/lib/evidence/         filters and the shared analysis
src/services/             repository, assistant, and scenario storage contracts
src/stores/mission-store.ts
src/stores/fire-sim-store.ts  fixed-step runtime and independently copied telemetry snapshots
src/design/palette.ts
```

UI code calls `getServices()` and `analyzeMission()`. It does not import fixture rows directly. `EvidenceRepository`, `ResearchAssistant`, and `ScenarioRepository` are the swap points for later NASA PSI records, a database, and a retrieval-augmented model.

The fire engine is separate from the synthetic evidence repository. `buildFireInput()` maps the selected equipment and shared cabin conditions into physical units. The AppShell owns the simulation clock and synchronizes edits from every page: changing habitat, initial oxygen, pressure or gravity resets the run; changing airflow changes the fan target. Closing the inspector or visiting another app route keeps the clock mounted. The runtime requests 0.25 s steps; the numerical core bounds its coupling substeps to 0.125 s. Playback speed changes time advancement rather than the solver step.

Camera bounds exclude the visual effects subtree, so uninitialized or expired smoke particles cannot move room framing. Gateway interior camera placement is constrained to the selected module. The exterior model files and habitat geometry are unchanged.

Saved scenarios use `localStorage`. The live scenario, weights, filters, activity, and chat use `sessionStorage`.

## Tests

`npm test` covers relevance scoring, missing-value handling, weight renormalization, catalog integrity (no DOIs, fictional run ids, no lunar or Martian rows), coverage, heatmap counts, gap discovery, recommendation ranking, and the demo assistant.

It also covers gas-network energy conservation, elemental/product balances, retained vapor mass, ignition and cooling, timestep convergence, finite agent doses, exact action timing, telemetry snapshot independence, scenario synchronization and stable camera bounds. Comparisons with Saffire are reported separately from verification tests. Vitest uses worker threads for compatibility with the restricted Windows environment.

With a production server running, use `npm run test:e2e`. Playwright defaults to installed Microsoft Edge and software WebGL; set `IGNIS_TEST_URL` or `PLAYWRIGHT_CHANNEL` to override. `tests/fire-scenario.spec.ts` tests ignition, pause, suppression and reset in all three habitats, the material-to-forecast-to-FireTwin handoff, grouped navigation, and narrow-screen simulation without WebGL. Existing interior navigation tests remain in `tests/firetwin.spec.ts`. The `zz-*` screenshot scripts are optional and run when `SHOT_DIR` is supplied. Screenshots and traces are written under ignored `test-results/`.

## Deployment

`netlify.toml` builds with `next build` and publishes `.next`, with Node 22. Netlify’s Next.js runtime picks up the App Router from that output. The site can be public for review while the GitHub repository stays private.

Connect the GitHub repository in Netlify and use the build settings already in `netlify.toml`. Keep both `NEXT_PUBLIC_*` switches set to `mock` for the synthetic research demonstration.

### Ask IGNIS with Groq

No fine-tuning or extra database is required. Set `GROQ_API_KEY` in Netlify's project environment variables and redeploy. The key must be available to **Functions** (or all scopes); values in `netlify.toml` are build-time settings and are not available to serverless functions. See [Netlify's function environment documentation](https://docs.netlify.com/build/functions/environment-variables/). Never prefix the key with `NEXT_PUBLIC_`, commit it, or paste it into chat.

For local use, copy `.env.example` to `.env.local`, fill in `GROQ_API_KEY`, and restart `npm run dev`. A configured key enables Groq by default. `IGNIS_CHAT_PROVIDER=local` explicitly disables external calls; `IGNIS_CHAT_PROVIDER=groq` explicitly enables them. Missing keys use local explanations. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`; an override must support [Groq strict structured outputs](https://console.groq.com/docs/structured-outputs).

The browser sends a bounded question, up to four earlier questions and a small numeric scenario snapshot to `POST /api/ask-ignis`. The server restores material definitions and source extracts from the project, classifies the latest question for scope, then asks Groq for an answer with source IDs constrained to the retrieved registry entries. Groq receives this question/context data; it receives no browser storage dump, credentials or unrelated chat history. It cannot browse, run code, change a scenario or perform app actions. The comparison button runs the local solver on the setup captured with that answer.

Off-topic questions and detected instruction overrides receive a fixed redirect to the subject. Insufficient evidence receives a fixed response rather than a guessed answer. Unknown citations, invalid output, timeouts and provider failures fall back to a labeled local explanation. The UI renders model text as plain text and builds links only from the project's registry. These layers reduce topic drift and unsupported claims; neither a system prompt nor a schema guarantees factual accuracy, citation entailment or resistance to every injection. Citations identify source extracts, not independent verification. No model tuning is performed.

The endpoint bounds input size, output tokens and total upstream time, checks browser origin, and limits requests to ten per minute per IP within a server instance. This memory limit is best effort across Netlify instances, not a distributed quota. Use Groq account spend limits for a hard provider-side budget. Automated checks mock Groq; a live end-to-end provider check requires your key.

## Phase 2

Replace the mock repository with NASA PSI investigation records and verified measurements. Add real citations and DOIs only when they belong to those records. Keep the same TypeScript shapes (`Investigation`, `ExperimentalRun`, and the rest) so the pages do not need to be rewritten.

A database such as Postgres can sit behind `EvidenceRepositoryAsync`. A later assistant can implement `LlmResearchAssistant` with retrieval over the verified corpus. Do that only with an explicit provider setting and a server-side key. Predictive fits stay labeled as illustrations until a validated model exists. Partial-gravity behavior should not be interpolated from microgravity and Earth data and then presented as a result.

## Scientific limits of this prototype

- The catalog has microgravity and Earth rows only. Lunar (0.165 g) and Martian (0.38 g) cells are empty by construction.
- Spread, soot, particle, and detector numbers follow a small deterministic generator so the console is internally consistent. They are not instrument data.
- The 3D habitat is built from primitives. It is a navigation model, not a geometric twin of flight hardware.
- The fire engine models a finite fuel package with correlated spread and zone balances. It does not solve CFD, validate a full cabin fire, or include lithium-ion cell electrochemistry, all toxic species, detailed material degradation, or full HVAC geometry. Smoke motion is a visualization of the model, not a resolved velocity field.
- Published Saffire summary values constrain selected coefficients. Model comparisons retain discrepancies in total energy and gas products; the changing flight fan protocols are not reconstructed from those summaries. No independent validation set is loaded.
- Gas readouts are instantaneous. The displayed exposure references do not represent calculated one-hour or 24-hour exposure averages.
- The NASA source registry points to NASA-STD-6001B with Change 3, the active revision checked on 2026-11-14. A ground-test oxygen limit is not a universal material constant.
- Rankings can look precise. The precision is the math of the heuristic, not the precision of an experiment.

## Data needed for independent validation

| Dataset | Required fields |
| --- | --- |
| Saffire IV–VI time histories | Time and time origin, HRR or oxygen-consumption channels, inlet/outlet O₂, CO/CO₂, temperatures, flow changes, igniter timing, free volume, sample geometry, calorimetry method, uncertainties and units. |
| BASS/BASS-II spread and extinction runs | Sample geometry and thickness, pressure, oxygen, flow direction/speed, ignition protocol, flame-front position versus time, extinction event and measurement uncertainty. |
| SAME/SAME-2 detector histories | Particle count/mass distributions, source heating and flow, detector location and type, calibration, alarm thresholds, response traces and synchronized timestamps. |
| Partial-gravity solid-fuel runs | Actual acceleration history, 0.165 g / 0.38 g test duration, material configuration, atmosphere and flow, observed spread/HRR/extinction and uncertainty. |
| Habitat/control hardware | Measured free-air volumes, duct/return paths and fan curves, wall thermal response, detector specifications, and agent discharge/capture data in the intended enclosure and atmosphere. |

CSV or original scientific files plus a data dictionary and source/run identifiers are suitable. The checkout includes eight original public PSI experimental tables and metadata, the Saffire-I sensor workbook and reproducible channel extract, extracted publication summaries, and `src/data/verified/ntrs-index.json`. Complete synchronized HRR/O₂ histories, source timing, detector calibration and partial-gravity validation data are still necessary for independent model validation; these are not inferred from the summary tables or smoke voltages.
